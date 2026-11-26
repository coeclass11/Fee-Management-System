# School Fee Management System

A responsive school fee administration web app with Supabase authentication and PostgreSQL storage.

## Features
- Secure sign-in, first-admin setup, password reset and sign-out
- Dashboard with collected fees, outstanding balance, student counts and recent payments
- Student records with search and status
- Fee structures by academic year and class
- Full and partial fee payments
- Outstanding balance tracking
- Payment history and CSV report export
- Responsive layout for desktop, tablet and mobile

## Stack
- HTML, CSS and vanilla JavaScript (no build step)
- Supabase Auth and PostgreSQL

## Setup
1. Create a Supabase project.
2. Open **SQL Editor** and run `supabase/schema.sql`.
3. In **Project Settings → API**, copy the Project URL and anon/public key.
4. Open `config.js` and replace the placeholder values.
5. Serve the folder with a local web server (for example, VS Code Live Server). Do not open `index.html` as a `file://` URL.
6. Open the app and choose **Create first admin**. The first registered account receives the admin role. Later registrations receive the staff role.
7. For a school deployment, disable public sign-ups in Supabase after creating accounts for approved staff.

## Important security notes
- The browser uses only the Supabase anon/public key. Never put a service-role key in this project.
- Row Level Security is enabled on all application tables. Policies require an authenticated user.
- Keep the Supabase project URL and anon key in `config.js`; the anon key is designed to be public, but database access is protected by RLS.
- Configure your Supabase Auth email templates and allowed redirect URLs before production use.

## Project structure
```
.
├── index.html
├── styles.css
├── app.js
├── config.js
└── supabase/
    └── schema.sql
```
