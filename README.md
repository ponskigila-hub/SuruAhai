# SuruAhai 🏠

<p align="center">
  <strong>Marketplace Jasa Rumah Tangga Indonesia</strong>
</p>

<p align="center">
  Menghubungkan pelanggan dengan penyedia jasa terpercaya melalui platform digital modern.
</p>

---

## 📌 Ringkasan Proyek

**SuruAhai** adalah marketplace jasa rumah tangga yang menghubungkan:
- 👤 **USER** - Pelanggan mencari layanan
- 🤝 **MITRA** - Penyedia jasa profesional  
- ⚙️ **ADMIN** - Operator platform

Platform ini menyediakan ekosistem lengkap untuk booking jasa, pembayaran aman dengan escrow, rating & review, serta dashboard operasional per role.

---

## 🎯 Fitur Utama

### 👤 USER (Pelanggan)
- ✅ Registrasi & login aman
- 🔍 Jelajah kategori dan daftar layanan
- 📅 Booking mitra dengan jadwal fleksibel
- 💼 Riwayat pesanan & tracking real-time
- 💰 Wallet management + transaksi
- ⭐ Rating & review mitra
- 🔔 Notifikasi pesanan

### 🤝 MITRA (Penyedia Jasa)
- 📊 Dashboard performa (order, rating, earnings)
- 🟢 Toggle status online/offline
- 📝 Kelola status pesanan (confirm, in progress, complete, cancel)
- 💵 Saldo wallet & riwayat earnings
- 📈 Analytics penjualan

### ⚙️ ADMIN (Operator Platform)
- 📈 Dashboard agregasi (GMV, escrow, revenue)
- 👥 Kelola pengguna (aktif/suspend)
- ✔️ Verifikasi mitra
- 🛡️ Monitor escrow & transaksi
- 📊 Laporan operasional

---

## 💻 Arsitektur & Tech Stack

### 🎨 Frontend
- **React 18** - UI library
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Axios** - HTTP client
- **React Router** - Navigation
- **Lucide React** - Icon library
- **Sonner** - Toast notifications

**Deployment:** 🚀 [Vercel](https://vercel.com)

### 🔧 Backend
- **FastAPI** - Python web framework
- **PyMongo** - MongoDB driver
- **JWT** - Authentication (python-jose)
- **Passlib + Bcrypt** - Password hashing
- **Pydantic** - Data validation

**Deployment:** 🎯 [Replit](https://replit.com)

### 🗄️ Database
- **MongoDB** - NoSQL database
- Collections: users, services, mitra, orders, reviews, wallets, notifications

**Hosting:** ☁️ MongoDB Atlas / Local instance

---

## 🏗️ Arsitektur Deployment

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Vercel)                    │
│              React + Vite + Tailwind CSS               │
│              https://suruahai.vercel.app                │
└────────────────────────┬────────────────────────────────┘
                         │
                    HTTP/CORS
                         │
┌────────────────────────▼────────────────────────────────┐
│                 Backend (Replit)                        │
│          FastAPI + PyMongo + JWT                        │
│    https://suruahai-backend.replit.dev (example)       │
└────────────────────────┬────────────────────────────────┘
                         │
                    PyMongo Driver
                         │
┌────────────────────────▼────────────────────────────────┐
│              Database (MongoDB Atlas)                   │
│        Hosted cloud instance atau local MongoDB         │
│         mongodb+srv://user:pass@cluster.mongodb.net     │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 Struktur Folder

```text
SuruAhai/
├── frontend/                      # React Vercel app
│   ├── src/
│   │   ├── pages/                # Page components
│   │   ├── components/           # Reusable UI components
│   │   ├── contexts/             # React context (auth, etc)
│   │   ├── services/             # API integration
│   │   └── App.jsx
│   ├── package.json
│   ├── vercel.json               # Vercel config
│   └── tailwind.config.js
│
├── backend/                       # FastAPI Replit app
│   ├── server.py                 # Main app
│   ├── requirements.txt
│   ├── .env                      # Environment variables
│   └── env.example
│
├── README.md                      # Project documentation
├── BACKEND_Run.md                # Backend setup guide
└── vercel.json                   # Root Vercel config
```

---

## ⚙️ Prerequisites

### Development Lokal
- **Python 3.10+** (rekomendasi 3.11)
- **Node.js 18+** dan npm
- **MongoDB** (lokal atau Atlas account)
- **Git** & **VS Code** (optional)

### Deployment
- **Vercel** account (gratis untuk hobby)
- **Replit** account (gratis tier tersedia)
- **MongoDB Atlas** account (free tier 512MB)

---

## 🔧 Konfigurasi Environment

### Backend (.env)

Buat file `backend/.env`:

```env
# Database
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/suruahai?retryWrites=true&w=majority
DB_NAME=suruahai

# JWT
JWT_SECRET=your-super-secret-key-change-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Server
HOST=0.0.0.0
PORT=8001

# Optional: CORS
ALLOWED_ORIGINS=["http://localhost:3000","https://suruahai.vercel.app"]
```

**Catatan Penting:**
- Ganti `MONGO_URL` dengan koneksi string MongoDB Anda
- Untuk production, gunakan MongoDB Atlas (secure credentials)
- `JWT_SECRET` minimal 32 karakter untuk production

### Frontend (.env)

Buat file `frontend/.env`:

```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

Untuk production di Vercel:
```env
REACT_APP_BACKEND_URL=https://your-replit-backend-url.replit.dev
```

---

## 🚀 Menjalankan Lokal

### 1️⃣ Setup Backend

```bash
cd backend

# Buat virtual environment
python -m venv .venv

# Activate venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run server
python server.py
```

Backend berjalan di: `http://127.0.0.1:8001`

### 2️⃣ Setup Frontend

Di terminal baru:

```bash
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev
```

Frontend berjalan di: `http://localhost:5173` (Vite default)

### 3️⃣ Seed Data

Setelah backend aktif:

```bash
curl -X POST http://127.0.0.1:8001/api/seed
```

Atau gunakan API client (Postman, Insomnia, etc).

---

## 👤 Akun Default (Setelah Seed)

| Role  | Email                | Password   |
|-------|----------------------|-----------|
| Admin | admin@suruahai.com   | admin123  |
| User  | user@suruahai.com    | user123   |
| Mitra | mitra@suruahai.com   | mitra123  |

---

## 📡 API Endpoints

### Base URL
```
Local:       http://127.0.0.1:8001
Production:  https://your-backend.replit.dev
```

### Health & Info
- `GET /api/health` - Health check
- `POST /api/seed` - Seed database

### Authentication
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Current user info

### Services
- `GET /api/services` - List semua layanan
- `GET /api/services/{id}` - Detail layanan
- `POST /api/services` - Create (ADMIN)
- `GET /api/services/categories/list` - Kategori

### Mitra (Partners)
- `GET /api/mitra/list` - List mitra
- `GET /api/mitra/{id}` - Detail mitra
- `GET /api/mitra/dashboard` - Dashboard (MITRA)
- `PUT /api/mitra/profile` - Update profil (MITRA)
- `PUT /api/mitra/toggle-online` - Toggle status (MITRA)

### Orders
- `POST /api/orders` - Create order (USER)
- `GET /api/orders` - List orders
- `GET /api/orders/{id}` - Detail order
- `PUT /api/orders/{id}/status` - Update status

**Valid status values:**
- `CONFIRMED`
- `IN_PROGRESS`
- `COMPLETED`
- `CANCELLED`

### Wallet & User
- `PUT /api/user/profile` - Update profil
- `GET /api/user/wallet` - Wallet user
- `GET /api/wallet` - Wallet general
- `GET /wallet` - Wallet info

### Reviews
- `POST /api/reviews` - Create review
- `GET /api/reviews/mitra/{mitra_id}` - Review mitra

### Admin
- `GET /api/admin/dashboard` - Dashboard stats
- `GET /api/admin/users` - User list
- `PUT /api/admin/users/{id}/status` - Suspend/activate
- `PUT /api/admin/mitra/{id}/verify` - Verify mitra
- `GET /api/admin/escrow` - Escrow monitoring

### Notifications
- `GET /api/notifications` - Get notifikasi user

---

## 🧪 Testing

Jalankan integration test:

```bash
python backend_test.py
```

Script akan test:
- Health endpoint
- Auth (register/login)
- Service listing
- Order creation
- Wallet operations
- Dashboard per role

Customize base URL:
```bash
# Linux/macOS
API_BASE_URL="http://127.0.0.1:8001" python backend_test.py

# Windows PowerShell
$env:API_BASE_URL="http://127.0.0.1:8001"; python backend_test.py
```

---

## 🌐 Deployment

### Frontend (Vercel)

1. Push ke GitHub repository
2. Login ke [Vercel](https://vercel.com)
3. Import project → Select `frontend` folder
4. Environment variables:
   ```
   REACT_APP_BACKEND_URL=https://your-backend-url.replit.dev
   ```
5. Deploy → Otomatis jalan di `https://project.vercel.app`

**Tips:** Setup custom domain di Vercel dashboard

### Backend (Replit)

1. Create Replit project from GitHub atau upload folder `backend`
2. Create `.env` file dengan config:
   ```env
   MONGO_URL=mongodb+srv://...
   JWT_SECRET=your-secret
   # dll
   ```
3. Run dengan `python server.py`
4. Replit auto-generates URL: `https://project.replit.dev`

**Tips:** Gunakan Replit "Always On" untuk production (paid feature)

### Database (MongoDB Atlas)

1. Create cluster di [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Setup Network Access (whitelist IP)
3. Create database user & get connection string
4. Masukkan ke `MONGO_URL` di backend `.env`

---

## 🐛 Troubleshooting

### Backend error: "No module named 'pymongo'"
```bash
pip uninstall pymongo passlib bcrypt -y
pip install -r requirements.txt
```

### Frontend blank page / 404
- Pastikan `REACT_APP_BACKEND_URL` benar
- Check browser console untuk error
- Verify backend CORS settings

### MongoDB connection timeout
- Verify IP whitelist di MongoDB Atlas
- Check credentials di connection string
- Test connection: `mongosh "mongodb+srv://..."`

### Replit backend tidak response
- Check server logs di Replit console
- Verify `.env` variables loaded
- Try restart container

### Vercel deployment build error
- Check Node version (`package.json` engines)
- Verify environment variables di Vercel dashboard
- Check build logs di Vercel UI

---

## 📸 Screenshots & Mockups

### 🎨 UI Components

Mohon masukkan screenshot berikut ke folder `docs/screenshots/`:

#### Authentication
- [ ] Register page
- [ ] Login page
- [ ] Forgot password (jika ada)

#### User Dashboard
- [ ] Home / Browse services
- [ ] Service detail
- [ ] Create booking
- [ ] Order history
- [ ] Wallet & transactions
- [ ] Profile

#### Mitra Dashboard
- [ ] Dashboard stats
- [ ] Incoming orders
- [ ] Order management
- [ ] Earnings & wallet
- [ ] Profile & verification

#### Admin Dashboard
- [ ] Overview stats
- [ ] User management
- [ ] Mitra verification
- [ ] Transaction monitoring
- [ ] Reports

**Instruksi:** Masukkan gambar dengan format:
```
docs/screenshots/
├── auth/
├── user/
├── mitra/
└── admin/
```

---

## 🚦 Status Development

### ✅ Completed
- Core auth & user management
- Service & mitra listing
- Order creation & tracking
- Wallet & escrow
- Review system
- Admin dashboard

### 🔄 In Progress
- Payment gateway integration
- Real-time notifications
- Document upload for verification
- Email verification

### 🗺️ Roadmap
- [ ] Email notifications
- [ ] Password reset flow
- [ ] Mitra documents verification
- [ ] Real payment gateway (not simulation)
- [ ] WebSocket real-time updates
- [ ] Mobile app (React Native)
- [ ] Multi-language support
- [ ] Advanced analytics

---

## 💬 Support & Contact

Jika ada pertanyaan atau issue:

1. **GitHub Issues** - Report bugs & feature requests
2. **Email** - [your-contact-email]
3. **Discord/Slack** - [Link jika ada]

### Team
- Developer 1 - [Name]
- Developer 2 - [Name]
- Developer 3 - [Name]

---

## 📄 License

Proyek ini menggunakan **[MIT License](LICENSE)** / **[Closed Source]**

---

## 📚 Additional Documentation

- [`BACKEND_Run.md`](./BACKEND_Run.md) - Detailed backend setup
- [`docs/API.md`](./docs/API.md) - Full API reference
- [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) - Deployment guide
- [`docs/CONTRIBUTING.md`](./docs/CONTRIBUTING.md) - Contributing guidelines

---

<p align="center">
  Made with ❤️ by SuruAhai Team
</p>

<p align="center">
  <a href="https://suruahai.vercel.app">Live Demo</a> • 
  <a href="https://github.com/your-org/SuruAhai">GitHub</a> • 
  <a href="mailto:contact@suruahai.com">Contact</a>
</p>
