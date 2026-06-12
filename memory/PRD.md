# SuruAhai - Marketplace Jasa Rumah Tangga

## Project Overview
SuruAhai adalah marketplace yang menghubungkan pengguna dengan mitra penyedia jasa rumah tangga.

## Tech Stack
- **Frontend**: React.js + Tailwind CSS
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Auth**: JWT-based authentication

## User Personas
1. **USER** - Pencari jasa rumah tangga
2. **MITRA** - Penyedia jasa (cleaning, AC, plumbing, etc.)
3. **ADMIN** - Pengelola sistem

## Core Requirements (Static)
- 3 role dashboard (User, Mitra, Admin)
- Service browsing dan booking
- Mock payment & escrow simulation
- Order management
- Rating & review system

## What's Been Implemented (MVP - Feb 26, 2026)

### Landing Page
- Hero section dengan CTA
- Service categories showcase
- How it works section
- Trust signals (10,000+ users, 4.9 rating)
- Responsive design

### Authentication
- Register (User/Mitra role selection)
- Login
- JWT token management
- Role-based access control

### User Dashboard
- Service browsing
- Category filtering
- Search functionality
- Order history
- Wallet balance display

### Mitra Dashboard
- Overview stats (orders, earnings, rating)
- Online/offline toggle
- Order management (accept/reject/complete)
- Wallet & withdrawal info

### Admin Dashboard
- GMV & Revenue stats
- User management (activate/suspend)
- Mitra verification
- Escrow monitoring
- Order overview

### Booking Flow
- Select service
- Choose mitra
- Set schedule & address
- Mock payment
- Order tracking

### Backend APIs
- /api/auth (register, login, me)
- /api/services (CRUD, categories)
- /api/mitra (list, profile, dashboard)
- /api/orders (create, update status)
- /api/reviews
- /api/admin (dashboard, users, mitra verification)

## Prioritized Backlog

### P0 (Critical - Next Sprint)
- Email verification flow
- Password reset functionality
- File upload for mitra documents (KTP, sertifikat)

### P1 (High Priority)
- Real payment gateway integration (Midtrans/Xendit)
- Push notifications
- Chat/messaging between user-mitra
- Promo code system

### P2 (Medium Priority)
- Google OAuth login
- Advanced search & filters
- Mitra scheduling system
- Dispute management center
- Analytics dashboard

### P3 (Nice to Have)
- Mobile app (React Native)
- Multi-language support
- Referral program
- Loyalty points

## Next Tasks
1. Implement email verification
2. Add forgot password flow
3. File upload for mitra verification documents
4. Implement real-time notifications
