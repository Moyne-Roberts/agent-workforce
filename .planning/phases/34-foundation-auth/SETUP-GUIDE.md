# Phase 34: External Service Setup Guide

Complete these steps before running verification (Plan 34-03).

## 1. Supabase Setup

- [ ] Create a new Supabase project at https://supabase.com/dashboard
- [ ] Update `web/.env.local` with real values:
  - `NEXT_PUBLIC_SUPABASE_URL` — Settings → API → Project URL
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — Settings → API → anon public key
  - `SUPABASE_SERVICE_ROLE_KEY` — Settings → API → service_role key (secret)
- [ ] Run `supabase/schema.sql` in SQL Editor (Supabase Dashboard → SQL Editor → New Query → paste & run)
- [ ] Enable Azure OAuth provider: Auth → Providers → Azure
  - Set Azure Tenant URL to `https://login.microsoftonline.com/<moyne-roberts-tenant-id>` (NOT `common`)
  - Enter Client ID and Secret from Azure App Registration (see below)

## 2. Azure AD Setup

- [ ] Create App Registration: Azure Portal → Azure Active Directory → App registrations → New registration
  - Supported account types: **Accounts in this organizational directory only**
  - Redirect URI: `https://<supabase-project-ref>.supabase.co/auth/v1/callback`
- [ ] Create client secret: App Registration → Certificates & secrets → New client secret
- [ ] Grant API permissions: App Registration → API permissions → Add:
  - Microsoft Graph → `User.Read` (delegated)
  - Microsoft Graph → `User.Read.All` (delegated, requires admin consent)
- [ ] Copy Client ID and Secret into Supabase Azure provider settings (step 1 above)

## 3. Verify Auth Flow

```bash
cd web && npm run dev
```

- [ ] http://localhost:3000 redirects to /login
- [ ] Login page shows "Sign in with Microsoft" button AND email/password fields
- [ ] SSO sign-in with Moyne Roberts account → redirects to dashboard
- [ ] Sidebar shows: Dashboard, Projects, Runs, Settings, Profile
- [ ] Sidebar collapses to icons-only mode
- [ ] Personal Microsoft account (@outlook.com / @hotmail.com) is **rejected**

## 4. Verify Project CRUD

- [ ] Dashboard shows stats section + empty state "Create your first project"
- [ ] Create Project modal → project appears in list
- [ ] Project detail page shows name, description, members (you)
- [ ] Invite modal has Directory search + Email modes
- [ ] Search/filter works on project list

## After Verification

Resume phase execution:

```
/gsd:execute-phase 34
```

This will pick up from plan 34-03 where we left off.
