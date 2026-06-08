# Requirements Document

## Introduction

This document captures the functional requirements for adding GitHub OAuth 2.0 authentication to
Quantum Studio. The feature enables users to sign in with their GitHub account using the
authorization-code flow. The backend handles all GitHub API communication; the frontend initiates
the flow and processes the resulting JWT. The implementation mirrors the existing Google OAuth
pattern and requires no new packages.

---

## Glossary

- **Auth_Router**: The FastAPI router defined in `backend/app/routers/auth.py`, mounted at `/api/auth`.
- **GitHub_Callback_Handler**: The `GET /api/auth/github/callback` endpoint inside `Auth_Router`.
- **GitHub_Authorize_Endpoint**: The `GET /api/auth/github/authorize` endpoint inside `Auth_Router`.
- **Settings**: The Pydantic `Settings` class in `backend/app/config.py`.
- **User**: The SQLAlchemy ORM model in `backend/app/models.py` representing a platform user.
- **JWT**: The JSON Web Token issued by the backend using `create_access_token` from `app.auth`.
- **Frontend_Callback_Route**: The TanStack Router route at `/_auth/auth/github/callback`,
  implemented in `frontend/src/routes/_auth/auth/github/callback.tsx`.
- **Auth_Context**: The React context provider in `frontend/src/lib/auth/auth-context.tsx`.
- **Backend_API_Client**: The module `frontend/src/lib/api/backend.ts`.
- **Sign_In_Page**: The route component in `frontend/src/routes/_auth/sign-in.tsx`.
- **frontend_url**: The `Settings.frontend_url` value used to construct post-callback redirects.

---

## Requirements

### Requirement 1: Backend Configuration

**User Story:** As a developer, I want GitHub OAuth credentials and the frontend URL in the app
settings, so that the backend can perform OAuth flows without hard-coded values.

#### Acceptance Criteria

1. THE `Settings` SHALL expose a `github_client_id` field read from the `GITHUB_CLIENT_ID`
   environment variable, defaulting to an empty string.
2. THE `Settings` SHALL expose a `github_client_secret` field read from the `GITHUB_CLIENT_SECRET`
   environment variable, defaulting to an empty string.
3. THE `Settings` SHALL expose a `frontend_url` field read from the `FRONTEND_URL` environment
   variable, defaulting to `"http://localhost:8080"`.
4. THE `backend/.env.example` file SHALL include placeholder entries for `GITHUB_CLIENT_ID`,
   `GITHUB_CLIENT_SECRET`, and `FRONTEND_URL`.

---

### Requirement 2: Backend GitHub OAuth Endpoints

**User Story:** As a user, I want to click "Continue with GitHub" and be authenticated, so that I
can sign in without a password.

#### Acceptance Criteria

1. WHEN `GET /api/auth/github/authorize` is called, THE `GitHub_Authorize_Endpoint` SHALL redirect
   the browser (HTTP 302) to
   `https://github.com/login/oauth/authorize?client_id={github_client_id}&redirect_uri=http://localhost:5000/api/auth/github/callback&scope=user:email`.
2. IF `settings.github_client_id` is an empty string, THEN THE `GitHub_Authorize_Endpoint` SHALL
   return HTTP 500 with a JSON detail of `"GitHub OAuth is not configured"`.
3. WHEN `GET /api/auth/github/callback` is called with a valid `code` query parameter, THE
   `GitHub_Callback_Handler` SHALL exchange the code for a GitHub access token by sending a POST
   request to `https://github.com/login/oauth/access_token` with `client_id`, `client_secret`,
   and `code`.
4. WHEN the token exchange succeeds, THE `GitHub_Callback_Handler` SHALL fetch the authenticated
   user's profile from `https://api.github.com/user` using the obtained access token.
5. WHEN the GitHub profile's `email` field is null or empty, THE `GitHub_Callback_Handler` SHALL
   fetch the user's email list from `https://api.github.com/user/emails` and use the first entry
   where `primary` is `true` and `verified` is `true`.
6. IF no verified primary email can be resolved, THEN THE `GitHub_Callback_Handler` SHALL redirect
   to `{frontend_url}/auth/github/callback?error=no_verified_email`.
7. WHEN a valid email and GitHub user ID are obtained, THE `GitHub_Callback_Handler` SHALL query
   the database for an existing `User` where `oauth_subject` equals the GitHub user ID (cast to
   string).
8. IF no matching user is found by `oauth_subject`, THEN THE `GitHub_Callback_Handler` SHALL query
   the database for an existing `User` where `email` equals the resolved email.
9. IF a matching `User` is found (by subject or email), THEN THE `GitHub_Callback_Handler` SHALL
   update that user's `oauth_provider` to `"github"` and `oauth_subject` to the GitHub user ID
   string.
10. IF no matching `User` exists, THEN THE `GitHub_Callback_Handler` SHALL create a new `User`
    with `name` from the GitHub profile (falling back to the login name), `email` from the
    resolved email, a random `hashed_password`, `role` of `engineer`, `organization` of
    `"Independent"`, `oauth_provider` of `"github"`, and `oauth_subject` of the GitHub user ID
    string.
11. WHEN the `User` record is persisted, THE `GitHub_Callback_Handler` SHALL issue a JWT using
    `create_access_token` with `{"sub": user.id}` and the configured expiry.
12. WHEN the JWT is issued, THE `GitHub_Callback_Handler` SHALL redirect to
    `{frontend_url}/auth/github/callback?token={jwt}` with HTTP 302.
13. IF the GitHub token exchange returns an error response, THEN THE `GitHub_Callback_Handler`
    SHALL redirect to `{frontend_url}/auth/github/callback?error=github_token_exchange_failed`.
14. IF any network or unexpected exception occurs during the GitHub API calls, THEN THE
    `GitHub_Callback_Handler` SHALL redirect to `{frontend_url}/auth/github/callback?error=github_api_error`.

---

### Requirement 3: Frontend Callback Route

**User Story:** As a user, I want to be seamlessly signed in after GitHub redirects me back, so
that I land on the dashboard without any manual steps.

#### Acceptance Criteria

1. WHEN the `Frontend_Callback_Route` renders with a `token` query parameter, THE
   `Frontend_Callback_Route` SHALL store the token in `localStorage` under the key `"qs_token"`.
2. WHEN the token is stored, THE `Frontend_Callback_Route` SHALL call `GET /api/auth/me` with the
   token to retrieve user data and store it in `localStorage` under the key `"qs_user"`.
3. WHEN user data is cached, THE `Frontend_Callback_Route` SHALL navigate to `/dashboard`.
4. WHEN the `Frontend_Callback_Route` renders with an `error` query parameter, THE
   `Frontend_Callback_Route` SHALL display an error toast containing the error message and navigate
   to `/sign-in` after 2 seconds.
5. WHILE the `Frontend_Callback_Route` is processing (before navigation), THE
   `Frontend_Callback_Route` SHALL display a loading spinner with the text
   `"Completing GitHub sign in"`.
6. THE `Frontend_Callback_Route` SHALL use the route path `"/_auth/auth/github/callback"` as the
   `from` argument to `useSearch`.

---

### Requirement 4: Frontend Sign-In Integration

**User Story:** As a user, I want to click "Continue with GitHub" on the sign-in page and be
redirected to GitHub, so that I can begin the OAuth flow without confusion.

#### Acceptance Criteria

1. THE `Auth_Context` SHALL expose a `signInWithGitHub` method with signature `() => void`.
2. WHEN `signInWithGitHub` is called, THE `Auth_Context` SHALL set `window.location.href` to
   `{VITE_BACKEND_URL}/api/auth/github/authorize`.
3. THE `Backend_API_Client` SHALL export an `initiateGithubLogin` function that sets
   `window.location.href` to `{VITE_BACKEND_URL}/api/auth/github/authorize`.
4. WHEN the user clicks the "Continue with GitHub" `SocialButton` on the `Sign_In_Page`, THE
   `Sign_In_Page` SHALL call `signInWithGitHub` from `useAuth()`.
5. THE `Sign_In_Page` SHALL NOT call `toast("Coming soon")` for the GitHub button after this
   change.
