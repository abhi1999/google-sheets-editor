# Sheet Editor

A production-ready Next.js application for viewing and collaboratively editing Google Sheets data with role-based access control, audit logging, and a polished dark UI.

---

## Features

- **Google OAuth** — All users must sign in with Google. No anonymous access.
- **Role-based permissions** — Editor allowlist controls who can write. Everyone else is read-only.
- **Server-side enforcement** — Backend rejects unauthorized writes regardless of frontend state.
- **Controlled editing** — Only whitelisted columns are editable (configurable via env var).
- **Inline cell editing** — Double-click any editable cell to edit in place.
- **Bulk edit** — Select multiple rows and apply a value to an editable column at once.
- **Audit log** — Every change is logged (user, timestamp, row, column, old/new value) to a separate Google Sheet tab.
- **Column sorting** — Click any column header to sort ascending/descending.
- **Filtering** — Full-text search + column filter + extensible predefined filter chips.
- **Pagination** — Configurable page size (10/25/50/100).
- **CSV export** — Respects current filters and sort order.
- **Loading skeletons** — Shimmer loaders while data fetches.
- **Toast notifications** — Feedback for save, error, discard actions.

---

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── [...nextauth]/route.ts   # NextAuth Google OAuth
│   │   │   └── me/route.ts              # Current user info
│   │   ├── sheets/
│   │   │   ├── route.ts                 # GET: read sheet data
│   │   │   └── update/route.ts          # POST: write edits (editor-only)
│   │   ├── audit/route.ts               # GET: audit log entries
│   │   └── export/route.ts              # GET: CSV download
│   ├── login/page.tsx                   # Sign-in page
│   ├── dashboard/page.tsx               # Protected data dashboard
│   └── layout.tsx                       # Root layout + font loading
├── components/
│   ├── auth/Providers.tsx               # SessionProvider + ToastProvider
│   ├── filters/FilterBar.tsx            # Search, column filter, predefined chips
│   ├── table/
│   │   ├── DashboardClient.tsx          # Main orchestration component
│   │   ├── DataTable.tsx                # Table with inline editing
│   │   ├── Pagination.tsx               # Page controls
│   │   ├── Toolbar.tsx                  # Top bar: save, export, bulk edit, user menu
│   │   ├── BulkEditModal.tsx            # Multi-row edit modal
│   │   └── AuditPanel.tsx               # Slide-out audit log drawer
│   └── ui/
│       ├── Toast.tsx                    # Toast notification system
│       └── Skeleton.tsx                 # Shimmer loading state
├── config/index.ts                      # Centralized config (permissions, sheets, settings)
├── lib/
│   ├── auth.ts                          # requireAuth / requireEditor helpers
│   └── sheets.ts                        # Google Sheets API service
└── types/index.ts                       # TypeScript types
```

---

## Setup Guide

### 1. Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or use an existing one)
3. Enable the **Google Sheets API**
4. Enable the **Google Drive API** (required for Sheets API)

### 2. OAuth Client (for user login)

1. In your Google Cloud project → **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth 2.0 Client ID**
3. Application type: **Web application**
4. Add Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://your-domain.com/api/auth/callback/google` (production)
5. Copy the **Client ID** and **Client Secret**

### 3. Service Account (for Sheets API)

1. In Credentials → **Create Credentials → Service Account**
2. Give it a name, click **Done**
3. Click the service account → **Keys tab → Add Key → JSON**
4. Download the JSON key file
5. **Share your Google Sheet** with the service account email (e.g., `sheets-editor@your-project.iam.gserviceaccount.com`) with **Editor** access

### 4. Google Sheet Setup

1. Create or identify your Google Sheet
2. Get the **Sheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID_HERE/edit
   ```
3. The first row must contain **headers** (column names)
4. Share the sheet with your service account email

### 5. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in the values:

```bash
cp .env.local.example .env.local
```

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<run: openssl rand -base64 32>

# Service account — paste the entire JSON as a string
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"..."}

# Your Sheet ID
SHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms

# Range to read (leave generous)
SHEET_RANGE=Sheet1!A1:Z1000

# Comma-separated column headers that editors can modify
EDITABLE_COLUMNS=Status,Notes,Assigned To

# Who can edit (comma-separated Google emails)
EDITOR_EMAILS=admin@gmail.com,coach@yourclub.com
```

**Alternative: JSON editor config file**

Instead of `EDITOR_EMAILS`, create `editors.json`:
```json
{
  "editors": [
    "admin@gmail.com",
    "coach@yourclub.com"
  ]
}
```
Then set: `EDITORS_CONFIG_PATH=./editors.json`

### 6. Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Deployment (Vercel)

```bash
npm install -g vercel
vercel
```

Set environment variables in Vercel dashboard or via CLI:
```bash
vercel env add GOOGLE_CLIENT_ID
vercel env add GOOGLE_CLIENT_SECRET
vercel env add NEXTAUTH_SECRET
vercel env add GOOGLE_SERVICE_ACCOUNT_KEY
vercel env add SHEET_ID
vercel env add EDITOR_EMAILS
vercel env add EDITABLE_COLUMNS
```

Update `NEXTAUTH_URL` to your production domain.

---

## Adding Predefined Filters

Edit `src/components/table/DashboardClient.tsx`, find `PREDEFINED_FILTERS`:

```typescript
const PREDEFINED_FILTERS: PredefinedFilter[] = [
  { id: 'active', label: 'Active', column: 'Status', value: 'Active' },
  { id: 'pending', label: 'Pending', column: 'Status', value: 'Pending' },
  { id: 'u13', label: 'U13', column: 'Age Group', value: 'U13' },
];
```

The column name must exactly match a header in your sheet.

---

## Permission Model

| User | Sign-in Required | Can View | Can Edit |
|------|-----------------|----------|----------|
| Not signed in | — | ✗ | ✗ |
| Signed in (not in allowlist) | ✓ | ✓ | ✗ |
| Signed in (in allowlist) | ✓ | ✓ | ✓ |

Permission checks happen in **two places**:
1. **Frontend** — Edit UI is hidden for non-editors
2. **Backend** — `/api/sheets/update` rejects requests from non-editors with HTTP 403

---

## Audit Log

Changes are written to a tab named `AuditLog` in your Google Sheet (created automatically on first edit).

Columns: `ID | Timestamp | User Email | User Name | Row Index | Column | Old Value | New Value | Status`

---

## Security Notes

- Never commit `.env.local`, `service-account-key.json`, or `editors.json` — they are in `.gitignore`
- The `NEXTAUTH_SECRET` must be a strong random string — generate with `openssl rand -base64 32`
- Service account credentials in `GOOGLE_SERVICE_ACCOUNT_KEY` should be stored as a Vercel secret, not in plain text in your repo
- The backend always re-validates editor status from the server-side config — frontend state cannot be spoofed to gain write access

---

## Tech Stack

- [Next.js 14](https://nextjs.org) (App Router)
- [NextAuth.js](https://next-auth.js.org) — Google OAuth
- [Google Sheets API v4](https://developers.google.com/sheets/api) via `googleapis`
- [Tailwind CSS](https://tailwindcss.com)
- [TypeScript](https://www.typescriptlang.org)
- Fonts: Fraunces (display) + DM Sans (body) + DM Mono