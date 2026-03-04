# TutorPay - Sistema de Gestión de Tutores y Pagos

## Overview
TutorPay es una aplicación web PWA para gestionar tutores y verificar pagos en una agencia de trabajos académicos. El administrador puede gestionar tutores, verificar pagos y configurar tipos de cambio de divisas. Los tutores pueden registrar pagos y ver su historial.

## User Credentials
- **Admin**: username: `admin`, password: `admin123`
- **Tutor**: username: `maria.garcia`, password: `tutor123`
- **Verifier**: Created by admin via Verificadores page

## Tech Stack
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Shadcn UI
- **Backend**: Express.js, Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Session-based with bcrypt password hashing

## Project Structure
```
client/
  src/
    components/
      app-sidebar.tsx     # Sidebar navigation
      theme-toggle.tsx    # Dark/light mode toggle
      ui/                 # Shadcn UI components
    lib/
      auth.tsx            # Auth context provider
      queryClient.ts      # TanStack Query setup
    pages/
      login.tsx           # Login page
      admin/
        dashboard.tsx     # Admin dashboard with stats
        tutors.tsx        # Tutors CRUD
        payments.tsx      # Payment verification
        currencies.tsx    # Currencies CRUD (with verifier linking)
        verifiers.tsx     # Verifiers CRUD
      tutor/
        payments.tsx      # Tutor payment history
        new-payment.tsx   # Submit new payment
      verifier/
        payments.tsx      # Verifier payment verification
    App.tsx               # Main app with routing

server/
  index.ts                # Express server entry
  routes.ts               # API endpoints
  storage.ts              # Database operations
  db.ts                   # Database connection
  seed.ts                 # Initial data seeding

shared/
  schema.ts               # Drizzle ORM schemas
```

## Features

### Admin Role
- Dashboard with statistics (total tutors, payments, amounts)
- **Weeks Management**: Create and manage weekly payment periods (S166, S167, etc.)
  - Configure advertising costs per week (editable by admin)
  - View weekly settlements with tutor breakdown
  - Change week status (open/closed/paid)
- **Agency Settings**: Configure tutor/agency commission split (default 70%/30%, fully editable)
- Tutors management (create with name, email, commission %)
- Payment verification (pending → verified/rejected)
- Currencies management with exchange rates
- Blacklist management for problematic clients
- Excel/CSV export of payments
- Time period filters (week, month, quarter, year, all-time)

### Tutor Role
- View payment history with status badges
- **Settlement View**: Spreadsheet-style weekly earnings breakdown
  - Shows gross income, advertising share, net income, and earnings per week
  - Calculation formula displayed for transparency
- Submit new payments with:
  - Amount and currency (with dynamic currency symbols)
  - Client number (with blacklist warning)
  - Proof image upload (optional, up to 10MB)

### Weekly Settlement System
- Weeks run Sunday to Saturday
- Advertising costs are shared proportionally between tutors and agency
- Commission split: Configurable (default 70% tutor / 30% agency)
- Settlement calculation: (Gross Income - Advertising Share) × Commission %

### PWA
- Installable on mobile devices
- Manifest.json configured
- Mobile-friendly responsive design

## API Endpoints

### Auth
- `GET /api/auth/me` - Get current user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout

### Admin (requires admin role)
- `GET /api/admin/stats` - Dashboard statistics
- `GET /api/admin/tutors` - List tutors
- `POST /api/admin/tutors` - Create tutor
- `DELETE /api/admin/tutors/:id` - Delete tutor
- `GET /api/admin/payments` - List all payments
- `PATCH /api/admin/payments/:id` - Update payment status
- `GET /api/admin/payments/export` - Export CSV
- `POST /api/admin/currencies` - Create currency
- `PATCH /api/admin/currencies/:id` - Update currency
- `DELETE /api/admin/currencies/:id` - Delete currency
- `GET /api/admin/weeks` - List all weeks
- `POST /api/admin/weeks` - Create week
- `POST /api/admin/weeks/generate` - Auto-generate current week
- `PATCH /api/admin/weeks/:id` - Update week (advertising cost, status)
- `DELETE /api/admin/weeks/:id` - Delete week
- `GET /api/admin/weeks/:id/settlement` - Get week settlement with tutor breakdown
- `GET /api/admin/settings` - Get agency settings
- `PATCH /api/admin/settings` - Update agency settings (commission percentages)
- `GET /api/admin/blacklist` - List blacklisted clients
- `POST /api/admin/blacklist` - Add to blacklist
- `DELETE /api/admin/blacklist/:id` - Remove from blacklist

### Tutor
- `GET /api/tutor/payments` - List own payments
- `POST /api/tutor/payments` - Create payment
- `GET /api/tutor/settlement` - Get tutor's weekly settlements

### Public (authenticated)
- `GET /api/currencies` - List currencies
- `GET /api/blacklist/check/:clientNumber` - Check if client is blacklisted

## Database Schema

### users
- id, username, password (hashed), role (admin/tutor)
- name, email, commissionPercent, createdAt

### currencies
- id, code, name, exchangeRate, createdAt

### payments
- id, tutorId, amount, currencyId, clientNumber
- proofImage, status (pending/verified/rejected)
- createdAt, verifiedAt, verifiedBy

### blacklist
- id, clientNumber, reason, createdAt

### weeks
- id, weekNumber (S166, S167...), startDate, endDate
- status (open/closed/paid), advertisingCost, createdAt

### agencySettings
- id, agencyPercent (default 30), tutorPercent (default 70)
- currentWeekNumber (starting week number)

## Running the App
```bash
npm run dev        # Start development server
npm run db:push    # Push schema changes to database
```

## Recent Changes
- 2026-02-05: Initial implementation with full MVP
- Password hashing with bcrypt for security
- Seed data with 3 tutors, 5 currencies, 5 payments
