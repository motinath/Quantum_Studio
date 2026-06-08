"""Auth router — register, login, token refresh."""

from __future__ import annotations

from datetime import datetime, timedelta
import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import httpx

import base64
import urllib.parse
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import create_access_token, get_current_user, hash_password, verify_password
from app.config import settings
from app.database import get_db
from app.models import User, UserRole

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ── Schemas ─────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    organization: str = "Independent"
    role: UserRole = UserRole.engineer
    otp: str


class OTPRequest(BaseModel):
    email: str


class GoogleLoginRequest(BaseModel):
    token: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: str
    organization: str


class GitHubTokenResponse(BaseModel):
    access_token: str
    token_type: str = ""
    scope: str = ""


class GitHubUser(BaseModel):
    id: int
    login: str
    name: str | None = None
    email: str | None = None


class GitHubEmail(BaseModel):
    email: str
    primary: bool
    verified: bool


# ── Helpers ──────────────────────────────────────────────────────────────────

def _user_to_dict(user: User) -> dict:
    initials = "".join(p[0].upper() for p in user.name.split()[:2]) or "?"
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role.value,
        "organization": user.organization,
        "initials": initials,
    }


# In-memory store for OTPs: { email: { "otp": otp, "expires_at": datetime } }
otp_store: dict[str, dict] = {}


def send_verification_email(email: str, otp: str) -> bool:
    if not settings.smtp_host or not settings.smtp_username or not settings.smtp_password:
        return False
    try:
        msg = MIMEMultipart()
        msg['From'] = f"{settings.smtp_from_name} <{settings.smtp_from_email or settings.smtp_username}>"
        msg['To'] = email
        msg['Subject'] = f"{otp} is your verification code"
        
        body = f"""Hi,

Thank you for registering. Please verify your email address.

Your 6-digit verification code is:
{otp}

This code will expire in 5 minutes.

If you didn't request this, you can ignore this email.

Best regards,
The Quantum Studio Team"""
        msg.attach(MIMEText(body, 'plain'))
        
        server = smtplib.SMTP(settings.smtp_host, settings.smtp_port)
        server.starttls()
        server.login(settings.smtp_username, settings.smtp_password)
        server.sendmail(msg['From'], email, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        print(f"Error sending verification email: {e}")
        return False


async def _resolve_github_email(profile: GitHubUser, gh_token: str) -> str:
    """Return the verified primary GitHub email for the given user.
    
    First checks the profile's email field. If absent, fetches /user/emails
    and returns the first entry with primary=True and verified=True.
    Raises ValueError if no verified primary email can be found.
    """
    if profile.email:
        return profile.email
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.github.com/user/emails",
            headers={
                "Authorization": f"token {gh_token}",
                "Accept": "application/vnd.github+json",
            },
        )
        resp.raise_for_status()
        emails: list[dict] = resp.json()
    for entry in emails:
        if entry.get("primary") and entry.get("verified"):
            return entry["email"]
    raise ValueError("No verified primary email found for this GitHub account")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/send-otp")
async def send_otp(body: OTPRequest, db: AsyncSession = Depends(get_db)):
    # Check if email is already registered
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Generate a random 6-digit numeric OTP code
    otp = f"{secrets.randbelow(1000000):06d}"
    
    # Store OTP in-memory with a 5-minute expiry
    otp_store[body.email] = {
        "otp": otp,
        "expires_at": datetime.utcnow() + timedelta(minutes=5)
    }

    # Print verification code clearly to the server console for local testing
    box_width = 60
    title_line = f" EMAIL VERIFICATION OTP: {otp} "
    email_line = f" For email: {body.email} "
    expire_line = " This code will expire in 5 minutes. "
    
    print("\n" + "+" + "-" * box_width + "+")
    print("|" + title_line.center(box_width) + "|")
    print("|" + email_line.center(box_width) + "|")
    print("|" + expire_line.center(box_width) + "|")
    print("+" + "-" * box_width + "+\n")

    # Attempt to send email via SMTP (if configured)
    sent_real_email = send_verification_email(body.email, otp)
    
    if sent_real_email:
        return {"detail": "Verification email sent successfully."}
    else:
        return {"detail": "Verification code generated. Please check your developer terminal logs for the code."}


@router.post("/google", response_model=TokenResponse)
async def google_login(body: GoogleLoginRequest, db: AsyncSession = Depends(get_db)):
    # 1. Verify Google ID token
    if not settings.google_client_id:
        raise HTTPException(
            status_code=500,
            detail="Google Client ID is not configured on the backend server."
        )

    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests as google_requests

        idinfo = id_token.verify_oauth2_token(
            body.token,
            google_requests.Request(),
            settings.google_client_id
        )

        # Validate issuer
        if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
            raise HTTPException(status_code=400, detail="Invalid token issuer")

        google_sub = idinfo['sub']
        email = idinfo['email']
        name = idinfo.get('name', email.split('@')[0])

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid Google ID token: {e}")

    # 2. Check if user already exists by email
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user:
        # Link user if not already linked
        user.oauth_provider = "google"
        user.oauth_subject = google_sub
    else:
        # Create a new user automatically
        user = User(
            name=name,
            email=email,
            hashed_password=hash_password(secrets.token_hex(32)), # Random secure placeholder
            role=UserRole.engineer,
            organization="Independent",
            oauth_provider="google",
            oauth_subject=google_sub,
        )
        db.add(user)

    await db.flush()
    await db.refresh(user)

    # 3. Generate standard JWT access token for our system
    token = create_access_token({"sub": user.id}, timedelta(minutes=settings.access_token_expire_minutes))
    return TokenResponse(access_token=token, user=_user_to_dict(user))


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # 1. Verify OTP
    stored_info = otp_store.get(body.email)
    if not stored_info:
        raise HTTPException(status_code=400, detail="No verification code requested for this email")
    
    if datetime.utcnow() > stored_info["expires_at"]:
        otp_store.pop(body.email, None)
        raise HTTPException(status_code=400, detail="Verification code has expired")
    
    if stored_info["otp"] != body.otp.strip():
        raise HTTPException(status_code=400, detail="Invalid verification code")
    
    # Clean verification code on success
    otp_store.pop(body.email, None)

    # 2. Check if user already exists
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    # 3. Create user
    user = User(
        name=body.name,
        email=body.email,
        hashed_password=hash_password(body.password),
        organization=body.organization,
        role=body.role,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    token = create_access_token({"sub": user.id}, timedelta(minutes=settings.access_token_expire_minutes))
    return TokenResponse(access_token=token, user=_user_to_dict(user))


@router.post("/token", response_model=TokenResponse)
async def login(form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == form.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token({"sub": user.id}, timedelta(minutes=settings.access_token_expire_minutes))
    return TokenResponse(access_token=token, user=_user_to_dict(user))


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return _user_to_dict(current_user)


@router.get("/github/authorize")
async def github_authorize(request: Request, frontend_url: str | None = None):
    if not settings.github_client_id:
        raise HTTPException(
            status_code=500,
            detail="GitHub OAuth is not configured",
        )
    
    # Pass the frontend URL in the state query parameter
    state_data = frontend_url or settings.frontend_url
    # Base64 encode state to keep it clean in URLs
    state = base64.urlsafe_b64encode(state_data.encode("utf-8")).decode("utf-8")
    
    # Dynamically determine the backend's callback URI based on the request's base URL
    base_url = str(request.base_url).rstrip("/")
    redirect_uri = f"{base_url}/api/auth/github/callback"
    
    github_url = (
        f"https://github.com/login/oauth/authorize"
        f"?client_id={settings.github_client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&scope=user:email"
        f"&state={state}"
    )
    return RedirectResponse(url=github_url, status_code=302)


@router.get("/github/callback")
async def github_callback(code: str, state: str | None = None, db: AsyncSession = Depends(get_db)):
    # Retrieve the frontend URL from state parameter, fallback to settings.frontend_url
    frontend_url = settings.frontend_url
    if state:
        try:
            decoded_bytes = base64.urlsafe_b64decode(state.encode("utf-8"))
            decoded_url = decoded_bytes.decode("utf-8")
            # Basic validation to prevent open redirect vulnerabilities
            parsed = urllib.parse.urlparse(decoded_url)
            is_local = parsed.hostname in ("localhost", "127.0.0.1")
            
            # Check if it's in the allowed CORS origins or starts with localhost
            is_allowed = is_local or any(
                origin in decoded_url for origin in settings.cors_origins_list
            )
            
            if is_allowed:
                frontend_url = decoded_url
        except Exception as e:
            print(f"Error decoding state parameter: {e}")
            
    frontend_url = frontend_url.rstrip("/")
    try:
        # 1. Exchange code for access token
        async with httpx.AsyncClient() as client:
            token_resp = await client.post(
                "https://github.com/login/oauth/access_token",
                json={
                    "client_id": settings.github_client_id,
                    "client_secret": settings.github_client_secret,
                    "code": code,
                },
                headers={"Accept": "application/json"},
            )
            token_data = token_resp.json()

        if "error" in token_data or "access_token" not in token_data:
            return RedirectResponse(
                url=f"{frontend_url}/auth/github/callback?error=github_token_exchange_failed",
                status_code=302,
            )

        gh_token = token_data["access_token"]

        # 2. Fetch GitHub user profile
        async with httpx.AsyncClient() as client:
            profile_resp = await client.get(
                "https://api.github.com/user",
                headers={
                    "Authorization": f"token {gh_token}",
                    "Accept": "application/vnd.github+json",
                },
            )
            profile_resp.raise_for_status()
            profile_data = profile_resp.json()

        profile = GitHubUser(**profile_data)

        # 3. Resolve email
        try:
            email = await _resolve_github_email(profile, gh_token)
        except ValueError:
            return RedirectResponse(
                url=f"{frontend_url}/auth/github/callback?error=no_verified_email",
                status_code=302,
            )

        github_id = str(profile.id)

        # 4. Find or create user
        # First try by oauth_subject
        result = await db.execute(select(User).where(User.oauth_subject == github_id))
        user = result.scalar_one_or_none()

        if user is None:
            # Fall back to email lookup
            result = await db.execute(select(User).where(User.email == email))
            user = result.scalar_one_or_none()

        if user:
            # Update OAuth linkage
            user.oauth_provider = "github"
            user.oauth_subject = github_id
        else:
            # Create new user
            name = profile.name or profile.login
            user = User(
                name=name,
                email=email,
                hashed_password=hash_password(secrets.token_hex(32)),
                role=UserRole.engineer,
                organization="Independent",
                oauth_provider="github",
                oauth_subject=github_id,
            )
            db.add(user)

        await db.flush()
        await db.refresh(user)

        # 5. Issue JWT and redirect
        jwt_token = create_access_token(
            {"sub": user.id},
            timedelta(minutes=settings.access_token_expire_minutes),
        )
        return RedirectResponse(
            url=f"{frontend_url}/auth/github/callback?token={jwt_token}",
            status_code=302,
        )

    except Exception as e:
        print(f"GitHub OAuth error: {e}")
        return RedirectResponse(
            url=f"{frontend_url}/auth/github/callback?error=github_api_error",
            status_code=302,
        )
