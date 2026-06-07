"""Auth router — register, login, token refresh."""

from __future__ import annotations

from datetime import datetime, timedelta
import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from fastapi import APIRouter, Depends, HTTPException, status
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
    
    print("\n" + "┌" + "─" * box_width + "┐")
    print("│" + title_line.center(box_width) + "│")
    print("│" + email_line.center(box_width) + "│")
    print("│" + expire_line.center(box_width) + "│")
    print("└" + "─" * box_width + "┘\n")

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
