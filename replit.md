# TutorPay - Sistema de Gestión de Tutores y Pagos

## Overview
TutorPay es una aplicación web PWA para gestionar tutores y verificar pagos en una agencia de trabajos académicos. El administrador puede gestionar tutores, verificar pagos y configurar tipos de cambio de divisas. Los tutores pueden registrar pagos y ver su historial.

## User Credentials
- **Admin**: username: `admin`, password: `admin123`
- **Tutor**: username: `maria.garcia`, password: `tutor123`

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
        currencies.tsx    # Currencies CRUD
      tutor/
        payments.tsx      # Tutor payment history
        new-payment.tsx   # Submit new payment
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
- Tutors management (create with name, email, commission %)
- Payment verification (pending → verified/rejected)
- Currencies management with exchange rates
- Excel/CSV export of payments

### Tutor Role
- View payment history with status badges
- Submit new payments with:
  - Amount and currency
  - Client number
  - Proof image upload (optional)

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

### Tutor
- `GET /api/tutor/payments` - List own payments
- `POST /api/tutor/payments` - Create payment

### Public (authenticated)
- `GET /api/currencies` - List currencies

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

## Running the App
```bash
npm run dev        # Start development server
npm run db:push    # Push schema changes to database
```

## Recent Changes
- 2026-02-05: Initial implementation with full MVP
- Password hashing with bcrypt for security
- Seed data with 3 tutors, 5 currencies, 5 payments
