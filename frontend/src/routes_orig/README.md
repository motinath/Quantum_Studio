# Routes — SilicoFeller (frontendv2)

TanStack Start uses **file-based routing**. Every `.tsx` file in this directory is a route.

> Do **not** create `src/pages/`, `src/routes/_app/index.tsx`, or `app/layout.tsx` —  
> those are Next.js / Remix conventions, not TanStack Start.

---

## Route Map

| File                        | URL                | Auth         | Description                                                               |
| --------------------------- | ------------------ | ------------ | ------------------------------------------------------------------------- |
| `__root.tsx`                | _(all)_            | —            | App shell: `QueryClientProvider`, `AuthProvider`, `Toaster`               |
| `index.tsx`                 | `/`                | Public       | Landing page — hero, features, demo, contact                              |
| `_auth.tsx`                 | —                  | —            | Unauthenticated layout (centered card)                                    |
| `_auth/sign-in.tsx`         | `/sign-in`         | Public       | Sign in form                                                              |
| `_auth/sign-up.tsx`         | `/sign-up`         | Public       | Sign up form                                                              |
| `_auth/forgot-password.tsx` | `/forgot-password` | Public       | Password reset                                                            |
| `_app.tsx`                  | —                  | **Required** | Authenticated layout: sidebar + header, redirects if not signed in        |
| `_app/dashboard.tsx`        | `/dashboard`       | ✅           | Backend health, stats, chatbot launcher button                            |
| `_app/designer.tsx`         | `/designer`        | ✅           | AI chip designer — calls `/generate`, shows chip image + freq plan + code |
| `_app/billing.tsx`          | `/billing`         | ✅           | Billing & usage                                                           |
| `_app/team.tsx`             | `/team`            | ✅           | Team management                                                           |
| `_app/admin.tsx`            | `/admin`           | Admin only   | Admin console                                                             |
| `_app/profile.tsx`          | `/profile`         | ✅           | User profile                                                              |
| `_app/settings.tsx`         | `/settings`        | ✅           | Settings                                                                  |
| `_app/about.tsx`            | `/about`           | ✅           | About page                                                                |

`routeTree.gen.ts` is **auto-generated** by TanStack Router. Never edit it by hand.

---

## File-Based Routing Conventions

| Pattern           | URL                                                      |
| ----------------- | -------------------------------------------------------- |
| `index.tsx`       | `/`                                                      |
| `about.tsx`       | `/about`                                                 |
| `users/index.tsx` | `/users`                                                 |
| `users/$id.tsx`   | `/users/:id` (dynamic — bare `$`, no curly braces)       |
| `_layout.tsx`     | Layout route (renders children via `<Outlet />`)         |
| `__root.tsx`      | App shell — wraps every page; do not remove `<Outlet />` |

---

## Backend Integration

All backend API calls live in `src/lib/api/backend.ts`.

The backend URL is read from the `VITE_BACKEND_URL` env var (set in `.env`):

```
VITE_BACKEND_URL=http://localhost:5000
```

### Key functions

```ts
generateChip(prompt); // POST /generate  → GenerateResponse
fetchHealth(); // GET  /health    → HealthResponse
fetchFrequencyPlan(n); // POST /frequency-plan
runDRC(n, topology); // POST /drc
fetchNetlist(n, topology); // POST /netlist
fetchPlacement(n); // POST /placement
```

---

## Chatbot Integration

The **QBETA Chatbot** (a separate Vite app on `localhost:5173`) is linked from two places:

1. **`_app/dashboard.tsx`** — A dark card with an **"Open Chatbot"** button
2. **`../components/app/app-sidebar.tsx`** — A **"QBETA Chatbot"** entry under the _Tools_ group in the sidebar

Both open `http://localhost:5173` in a new tab. To change the chatbot port, update the `href` in both files.

---

## Auth Roles

| Role          | Access                                                |
| ------------- | ----------------------------------------------------- |
| `admin`       | All pages including Admin Console and Billing         |
| `org_manager` | Dashboard, Designer, Team, Billing, Settings, Profile |
| `engineer`    | Dashboard, Designer, Settings, Profile                |
