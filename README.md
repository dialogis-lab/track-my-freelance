# TimeHatch

TimeHatch is a simple, modern time tracking SaaS for freelancers and small teams. Track time per project and client, manage projects, generate reports, and export data.

## Features

- **Simple Time Tracking**: Start/stop timer with project selection and notes
- **Project & Client Management**: Organize work by clients and projects
- **Reports & Analytics**: View time spent per project/client with filtering
- **Data Export**: Export reports to CSV and PDF formats
- **Authentication**: Email/password and Google OAuth sign-in
- **Responsive Design**: Works seamlessly on desktop and mobile

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Supabase (Auth, Database, Realtime)
- **UI Components**: shadcn/ui
- **Routing**: React Router
- **State Management**: React Query (TanStack Query)

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/bun
- Supabase account and project

### Environment Setup

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Update the environment variables:
```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`.

## Supabase Setup

### Database Schema

The app uses the following tables:
- `leads` - Email signups from landing page
- `clients` - Client management
- `projects` - Project management with client relationships
- `time_entries` - Time tracking entries
- `reminders` - Email reminder settings
- `mfa_recovery_codes` - Hashed recovery codes for two-factor authentication

### Enable Google OAuth in Supabase

To enable Google sign-in, follow these steps in your Supabase dashboard:

1. **Configure Google OAuth Provider**:
   - Go to Authentication → Providers → Google
   - Enable the Google provider
   - Add your Google OAuth Client ID and Client Secret

2. **Set Up Google Cloud Console**:
   - Create a project in [Google Cloud Console](https://console.cloud.google.com)
   - Enable the Google+ API
   - Create OAuth 2.0 credentials (Web application)
   - Add authorized JavaScript origins:
     - `https://timehatch.app` (production)
     - `http://localhost:3000` (development)
   - Add authorized redirect URIs:
     - `https://ollbuhgghkporvzmrzau.supabase.co/auth/v1/callback` (Supabase callback)

3. **Configure Supabase URLs**:
   - Go to Authentication → URL Configuration
   - Set Site URL: `https://timehatch.app` (production) or `http://localhost:3000` (development)
   - Add Redirect URLs:
     - `https://timehatch.app/auth/callback`
     - `http://localhost:3000/auth/callback`

4. **Row Level Security (RLS)**:
   - All tables have RLS enabled
   - Policies ensure users can only access their own data
   - User ID is automatically set from `auth.uid()`

### Authentication Flow

1. **Email/Password**: Standard sign-up and sign-in flow
2. **Google OAuth**: 
   - User clicks "Continue with Google" 
   - Redirected to Google for authorization
   - Returns to `/auth/callback` for session exchange
   - Redirected to `/dashboard` on success

### Two-Factor Authentication (2FA)

TimeHatch supports TOTP (Time-based One-Time Password) multi-factor authentication using Supabase Auth.

**Features:**
- **TOTP Support**: Works with Google Authenticator, 1Password, Authy, and other authenticator apps
- **Recovery Codes**: 10 single-use backup codes for account recovery
- **Secure Storage**: Recovery codes are hashed and stored securely in the database
- **Flexible Setup**: Enable/disable 2FA from account settings

**Usage:**

1. **Enable 2FA**:
   - Go to Settings → Two-Factor Authentication
   - Click "Enable 2FA"
   - Scan the QR code with your authenticator app or enter the secret manually
   - Enter the 6-digit verification code
   - Save your recovery codes in a secure location

2. **Sign In with 2FA**:
   - Enter email/password or use Google OAuth as usual
   - If 2FA is enabled, you'll be redirected to `/mfa`
   - Enter your 6-digit TOTP code or use a recovery code

3. **Disable 2FA**:
   - Go to Settings → Two-Factor Authentication
   - Click "Disable 2FA" (requires recent authentication)
   - Recovery codes will be automatically cleared

4. **Recovery Codes**:
   - Each code can only be used once
   - Generate new codes anytime from settings
   - Download codes as a text file for safekeeping

**Technical Implementation:**
- Uses Supabase Auth MFA API (`supabase.auth.mfa.*`)
- Recovery codes stored in `mfa_recovery_codes` table with SHA-256 hashing
- Edge function handles secure recovery code generation
- Row-Level Security ensures users can only access their own codes

**Security Notes:**
- Always save recovery codes in a secure location
- Each recovery code can only be used once
- 2FA is optional but strongly recommended for account security
- Recovery codes are automatically regenerated when requested

## Deployment

### Production Environment

Update your production environment variables:
```env
NEXT_PUBLIC_SITE_URL=https://timehatch.app
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Build

```bash
# Build for production
npm run build

# Preview production build locally
npm run preview
```

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui components
│   ├── BrandLogo.tsx   # Logo component
│   ├── AppLayout.tsx   # Main app layout
│   └── ...
├── contexts/           # React contexts
│   └── AuthContext.tsx # Authentication context
├── hooks/              # Custom React hooks
├── integrations/       # External service integrations
│   └── supabase/       # Supabase client and types
├── pages/              # Page components
│   ├── Login.tsx       # Login page
│   ├── Register.tsx    # Registration page
│   ├── Dashboard.tsx   # Main dashboard
│   └── ...
└── lib/                # Utility functions
```

## Key Features Implementation

### Time Tracking
- Real-time timer with start/stop functionality
- Manual time entry support
- Project and notes association
- Automatic time calculations

### Project Management
- CRUD operations for clients and projects
- Archive functionality
- Hourly rate tracking per project
- Client-project relationships

### Reports & Analytics
- Time entries filtered by date range
- Grouping by client/project
- Export to CSV and PDF
- Visual charts and summaries

### Authentication & Security
- Supabase Auth with email/password and Google OAuth
- Row Level Security (RLS) policies
- Protected routes and automatic redirects
- Session persistence and auto-refresh

---

*Powered by [Lovable](https://lovable.dev) - Create amazing apps with AI*
