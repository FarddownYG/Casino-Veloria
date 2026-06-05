# Google Sign-in via Supabase

VELORIA uses **Supabase Auth** purely as the Google identity provider. The flow:

```
Frontend ──signInWithOAuth('google')──▶ Supabase ──▶ Google consent
   ▲                                                      │
   │           redirect /auth/callback                    ▼
   └──────────────── Supabase session (access_token) ◀────┘
                          │
                          ▼  POST /api/auth/google { accessToken }
                      Backend verifies token at Supabase /auth/v1/user,
                      finds-or-creates the VELORIA user (signup bonus +
                      optional referral), and returns VELORIA JWTs.
```

The app's economy stays fully server-authoritative — Supabase is **not** used
for game data or balances, only to prove "this is a real Google account".

## Project
- **Supabase project:** `VELORIA` (`ejozdljwafoydynduboe`)
- **URL:** `https://ejozdljwafoydynduboe.supabase.co`
- **Publishable (anon) key:** `sb_publishable_L7a4ogUaL58Rin0TDjHcww_Pa36lr9h`
  (public by design; baked as the default in both apps' env)

## One-time configuration (Supabase + Google Cloud dashboards)

These cannot be set via API and must be done once:

### 1. Google Cloud Console
1. Create an **OAuth 2.0 Client ID** (type: Web application).
2. Under **Authorized redirect URIs**, add the Supabase callback:
   ```
   https://ejozdljwafoydynduboe.supabase.co/auth/v1/callback
   ```
3. Copy the **Client ID** and **Client secret**.

### 2. Supabase Dashboard → Authentication → Providers → Google
- Toggle **Enable**, paste the Google **Client ID** + **Client secret**, save.

### 3. Supabase Dashboard → Authentication → URL Configuration
- **Site URL:** your primary frontend origin (e.g. the Vercel domain).
- **Additional Redirect URLs:** add every origin's callback, e.g.
  ```
  http://localhost:5173/auth/callback
  https://<your-vercel-domain>/auth/callback
  ```

That's it — the button "Continuer avec Google" on `/login` and `/register`
then works end-to-end.

## Environment variables
Already defaulted to the values above, override if needed.

**Frontend** (`frontend/.env`)
```
VITE_SUPABASE_URL=https://ejozdljwafoydynduboe.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_L7a4ogUaL58Rin0TDjHcww_Pa36lr9h
```
**Backend** (`backend/.env`) — used to verify tokens server-side
```
SUPABASE_URL=https://ejozdljwafoydynduboe.supabase.co
SUPABASE_ANON_KEY=sb_publishable_L7a4ogUaL58Rin0TDjHcww_Pa36lr9h
```

## Notes
- First Google login creates a VELORIA account: username derived from the Google
  name/email (made unique), **1000 VC** signup bonus, optional referral code.
- If the Google email matches an existing password account, the Supabase
  identity is **linked** to it (no duplicate account).
- These accounts have no password; the password login endpoint rejects them with
  "This account uses Google sign-in".
