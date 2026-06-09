# Implementation Plan: GitHub OAuth Authentication

## Overview

Implement GitHub OAuth 2.0 sign-in by following the exact pattern of the existing Google OAuth
flow. Changes touch five files: backend config, backend auth router, frontend API client, frontend
auth context, and the sign-in page. The frontend callback route already exists and needs only a
one-line fix.

---

## Tasks

- [ ] 1. Extend backend configuration for GitHub OAuth
  - Add `github_client_id: str = ""`, `github_client_secret: str = ""`, and
    `frontend_url: str = "http://localhost:8080"` fields to the `Settings` class in
    `backend/app/config.py`, following the same pattern as `google_client_id`.
  - Add `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `FRONTEND_URL` placeholder entries to
    `backend/.env.example`.
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 2. Implement the backend GitHub OAuth endpoints
  - [ ] 2.1 Add Pydantic schemas and email-resolution helper
    - Add `GitHubTokenResponse`, `GitHubUser`, and `GitHubEmail` Pydantic models to
      `backend/app/routers/auth.py`.
    - Implement `_resolve_github_email(user: GitHubUser, token: str) -> str` that returns the
      profile email when present, else fetches `/user/emails` with `httpx.AsyncClient` and returns
      the first entry with `primary=True` and `verified=True`, raising `ValueError` when none
      found.
    - _Requirements: 2.4, 2.5, 2.6_

  - [ ]* 2.2 Write property test for email resolution (Property 1)
    - **Property 1: Email resolution selects the correct verified primary email**
    - Use `hypothesis` to generate lists of `GitHubEmail` objects with random combinations of
      `primary` and `verified` flags.
    - Assert the helper returns the correct primary+verified address, and raises when none exists.
    - **Validates: Requirements 2.5, 2.6**

  - [ ] 2.3 Add `GET /api/auth/github/authorize` endpoint
    - Implement the endpoint in `backend/app/routers/auth.py`.
    - Return HTTP 500 JSON `{"detail": "GitHub OAuth is not configured"}` when
      `settings.github_client_id` is empty.
    - Otherwise return `RedirectResponse` (302) to
      `https://github.com/login/oauth/authorize?client_id={id}&redirect_uri=http://localhost:5000/api/auth/github/callback&scope=user:email`.
    - _Requirements: 2.1, 2.2_

  - [ ] 2.4 Add `GET /api/auth/github/callback` endpoint
    - Implement the callback in `backend/app/routers/auth.py` using `httpx.AsyncClient`.
    - Exchange the `code` query param for a GitHub access token via
      `POST https://github.com/login/oauth/access_token`.
    - On exchange error, redirect to `{frontend_url}/auth/github/callback?error=github_token_exchange_failed`.
    - Fetch user profile via `GET https://api.github.com/user`.
    - Resolve email using `_resolve_github_email`; on `ValueError` redirect with
      `?error=no_verified_email`.
    - Wrap the full handler body in a `try/except Exception` that redirects with
      `?error=github_api_error` on any unexpected error.
    - _Requirements: 2.3, 2.4, 2.5, 2.6, 2.13, 2.14_

  - [ ] 2.5 Implement find-or-create user logic in callback
    - Query DB first by `oauth_subject = str(github_id)`, then fall back to `email`.
    - If found: update `oauth_provider = "github"` and `oauth_subject`.
    - If not found: create a new `User` (name from profile/login, random hashed_password,
      role=engineer, organization="Independent").
    - Issue JWT with `create_access_token({"sub": user.id}, ...)`.
    - Redirect to `{frontend_url}/auth/github/callback?token={jwt}`.
    - _Requirements: 2.7, 2.8, 2.9, 2.10, 2.11, 2.12_

  - [ ]* 2.6 Write property test for user idempotency (Property 2)
    - **Property 2: User find-or-create idempotency**
    - Use `hypothesis` with `@given` to generate random GitHub user profiles (id, login, email).
    - Mock the DB session and call the find-or-create logic twice with the same profile.
    - Assert exactly one `User` row is produced with correct `oauth_provider` and `oauth_subject`.
    - **Validates: Requirements 2.7, 2.8, 2.9, 2.10**

  - [ ]* 2.7 Write property test for JWT round-trip (Property 3)
    - **Property 3: JWT round-trip — token issued is verifiable**
    - Use `hypothesis` to generate random user IDs (UUID strings).
    - For each, call `create_access_token({"sub": user_id}, ...)` then decode the result.
    - Assert `decoded["sub"] == user_id`.
    - **Validates: Requirements 2.11**

  - [ ]* 2.8 Write property test for success redirect URL (Property 4)
    - **Property 4: Success redirect always embeds the issued JWT verbatim**
    - Use `hypothesis` to generate random JWT-like strings.
    - Call the redirect-building logic with each token and assert the `Location` header contains
      the token unchanged.
    - **Validates: Requirements 2.12**

- [ ] 3. Checkpoint — Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement frontend API helper and auth context method
  - [ ] 4.1 Add `initiateGithubLogin` to `backend.ts`
    - Export `initiateGithubLogin(): void` from `frontend/src/lib/api/backend.ts`.
    - The function reads `VITE_BACKEND_URL`, strips trailing slash, and sets
      `window.location.href = \`${backendUrl}/api/auth/github/authorize\``.
    - _Requirements: 4.3_

  - [ ]* 4.2 Write property test for `initiateGithubLogin` URL construction (Property 6)
    - **Property 6: `initiateGithubLogin` constructs the correct authorize URL**
    - Use `fast-check` to generate random URL strings (with and without trailing slashes).
    - Mock `import.meta.env.VITE_BACKEND_URL` and `window.location`.
    - Assert `window.location.href` always ends with `/api/auth/github/authorize` and has no
      double slashes.
    - **Validates: Requirements 4.2, 4.3**

  - [ ] 4.3 Add `signInWithGitHub` to `auth-context.tsx`
    - Add `signInWithGitHub: () => void` to the `AuthContextType` interface in
      `frontend/src/lib/auth/auth-context.tsx`.
    - Implement the method using `useCallback`: call `initiateGithubLogin()` from
      `@/lib/api/backend`.
    - Expose `signInWithGitHub` in the `AuthContext.Provider` value.
    - _Requirements: 4.1, 4.2_

- [ ] 5. Wire up the GitHub button on the Sign-In page
  - In `frontend/src/routes/_auth/sign-in.tsx`, destructure `signInWithGitHub` from `useAuth()`.
  - Change the `SocialButton` `onClick` from `() => toast("Coming soon")` to
    `() => signInWithGitHub()`.
  - Remove any `toast("Coming soon")` import or call that becomes unused.
  - _Requirements: 4.4, 4.5_

- [ ] 6. Fix the frontend callback route
  - In `frontend/src/routes/_auth/auth/github/callback.tsx`, change the `from` argument in
    `useSearch({ from: "/_auth/auth/github/success" })` to
    `useSearch({ from: "/_auth/auth/github/callback" })`.
  - Verify the rest of the component logic (store token, fetch `/api/auth/me`, cache `qs_user`,
    navigate `/dashboard`, show error toast + redirect on `?error=`) matches the design.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 6.1 Write property test for token storage in callback route (Property 5)
    - **Property 5: Frontend callback stores exactly the token from the URL**
    - Use `fast-check` to generate random non-empty token strings.
    - Render the `GitHubSuccessPage` component with each token as the `?token=` search param
      (using TanStack Router test utilities and a mocked `localStorage`).
    - After `useEffect` settles, assert `localStorage.getItem("qs_token") === token`.
    - **Validates: Requirements 3.1**

- [ ] 7. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP.
- No new packages are needed — `httpx` is already available in the FastAPI ecosystem and is used
  for all GitHub API calls.
- The `frontend_url` setting must be updated in `backend/.env` to match the actual frontend
  development server port (default `http://localhost:8080`) before testing end-to-end.
- The existing `frontend/src/routes/_auth/github-callback.tsx` file is a stale placeholder and can
  be deleted or ignored; the canonical route is
  `frontend/src/routes/_auth/auth/github/callback.tsx`.

## Task Dependency Graph

```json
{
  "waves": [
    ["1"],
    ["2.1"],
    ["2.2", "2.3"],
    ["2.4"],
    ["2.5"],
    ["2.6", "2.7", "2.8", "3"],
    ["4.1"],
    ["4.2", "4.3"],
    ["5", "6"],
    ["6.1", "7"]
  ]
}
```
