# 🚀 SuruAhai Deployment Guide

Panduan lengkap untuk deploy SuruAhai ke production menggunakan:
- **Frontend**: Vercel
- **Backend**: Replit  
- **Database**: MongoDB Atlas

---

## 📋 Checklist Pre-Deployment

- [ ] Frontend build test lokal (`npm run build`)
- [ ] Backend test lokal dengan `.env` production
- [ ] MongoDB Atlas cluster sudah buat
- [ ] GitHub repository sudah push (untuk Vercel)
- [ ] Replit project sudah setup
- [ ] Domain preparation (opsional untuk custom domain)

---

## 1️⃣ MongoDB Atlas Setup

### Step 1: Create MongoDB Atlas Account

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Sign up atau login
3. Create organization (atau gunakan default)

### Step 2: Create Cluster

1. Click "Create Deployment"
2. Select "M0 Free" tier (gratis)
3. Choose provider (AWS, Azure, GCP) - recommend `AWS`
4. Choose region closest to users
5. Cluster name: `suruahai-prod`
6. Click "Create Cluster" - tunggu ~5 menit

### Step 3: Security Setup

#### Create Database User
1. Go to **Security** → **Database Access**
2. Click **"+ Add New Database User"**
3. Username: `suruahai_user`
4. Password: Generate secure password (min 12 chars, special chars)
5. Built-in Role: `Read and write to any database`
6. Click **"Add User"**

**💾 SAVE CREDENTIALS SOMEWHERE SECURE**

#### Network Access
1. Go to **Security** → **Network Access**
2. Click **"+ Add IP Address"**
3. Select **"Allow access from anywhere"** (0.0.0.0/0)
4. Description: `Production deployment`
5. Click **"Confirm"**

⚠️ **Note:** Ini untuk development/staging. Untuk production, whitelist specific IP range.

### Step 4: Get Connection String

1. Go to **Deployments** → Click cluster name
2. Click **"Connect"** button
3. Select **"Drivers"**
4. Choose **"Python 3.6+"** → version **"PyMongo 3.12+"**
5. Copy connection string

Format:
```
mongodb+srv://suruahai_user:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

Replace `PASSWORD` dengan password user yang dibuat tadi.

### Step 5: Create Database

1. Di cluster detail page, go to **Collections**
2. Click **"Create Database"**
3. Database name: `suruahai`
4. Collection name: `users`
5. Click **"Create"**

Koleksi lain akan auto-created oleh backend saat runtime.

---

## 2️⃣ Replit Backend Deployment

### Step 1: Setup Replit Project

**Option A: Import dari GitHub**

1. Go to [Replit](https://replit.com)
2. Click **"+ Create"**
3. **"Import from GitHub"**
4. Paste repo URL: `https://github.com/your-org/SuruAhai`
5. Select `backend` folder sebagai root
6. Click **"Import"**

**Option B: Manual Upload**

1. Create new Replit (Python)
2. Upload `backend/` folder contents
3. Create `.env` file

### Step 2: Configure Environment Variables

Buat file `.env` di root Replit:

```env
# MongoDB
MONGO_URL=mongodb+srv://suruahai_user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/suruahai?retryWrites=true&w=majority
DB_NAME=suruahai

# JWT
JWT_SECRET=your-super-secret-key-at-least-32-chars-long-random-string-here
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Server
HOST=0.0.0.0
PORT=8001

# CORS - for Vercel frontend
ALLOWED_ORIGINS=["http://localhost:3000","https://suruahai.vercel.app"]
```

**Penting:**
- Generate `JWT_SECRET`: 
  ```bash
  python -c "import secrets; print(secrets.token_urlsafe(32))"
  ```
- Copy-paste hasil ke Replit `.env`

### Step 3: Install Dependencies

Replit auto-detect `requirements.txt`. Jika tidak:

```bash
pip install -r requirements.txt
```

### Step 4: Run Server

Klik **"Run"** button atau:

```bash
python server.py
```

Output:
```
INFO:     Uvicorn running on http://0.0.0.0:8001
```

### Step 5: Get Replit URL

Setelah running, Replit auto-generates URL:
```
https://ProjectName.YourUsername.replit.dev
```

Tampil di top center Replit editor.

**Contoh:** `https://suruahai-backend.ponski.replit.dev`

### Step 6: Keep Backend Running (Optional)

Untuk production, upgrade ke **"Always On"** (paid):

1. Go to Replit **"Settings"** → **"Plan"**
2. Upgrade to Replit Pro
3. Enable **"Always On"**

Atau: Backend auto-sleep setelah 1 jam no activity (free tier).

### Step 7: Test Replit Backend

```bash
curl https://your-replit-url.replit.dev/api/health
```

Expected response:
```json
{"status":"ok"}
```

---

## 3️⃣ Vercel Frontend Deployment

### Step 1: Prepare GitHub Repository

Pastikan code sudah di GitHub dengan struktur:

```
your-repo/
├── frontend/
├── backend/
└── README.md
```

### Step 2: Create Vercel Project

1. Go to [Vercel](https://vercel.com)
2. Login dengan GitHub account
3. Click **"Import Project"** atau **"New Project"**
4. Select your GitHub repo
5. Click **"Import"**

### Step 3: Configure Vercel

**Root Directory:**
- Select `frontend`

**Framework Preset:**
- Auto-detect: Vite / React
- If not: Select **"Vite"**

**Build Command:**
```
npm run build
```

**Output Directory:**
```
dist
```

### Step 4: Environment Variables

Di Vercel project settings, add:

```
REACT_APP_BACKEND_URL=https://your-replit-backend.replit.dev
```

Contoh:
```
REACT_APP_BACKEND_URL=https://suruahai-backend.ponski.replit.dev
```

### Step 5: Deploy

Click **"Deploy"** → Vercel auto-build & deploy.

Build logs:
```
✓ Installing dependencies
✓ Running build
✓ Uploading files
✓ Deployment ready
```

Live URL:
```
https://suruahai.vercel.app
```

### Step 6: Custom Domain (Optional)

Di Vercel project settings → **"Domains"**:

1. Add domain: `suruahai.id` atau custom domain
2. Follow DNS setup instructions
3. Propagate DNS (~5-48 jam)

---

## 🔐 Security Checklist

### Backend (Replit)

- [ ] `JWT_SECRET` minimal 32 chars, random
- [ ] `MONGO_URL` pakai credentials, bukan string terbuka
- [ ] `ALLOWED_ORIGINS` hanya include frontend domain
- [ ] Setup MongoDB IP whitelist (jangan 0.0.0.0/0 untuk production)
- [ ] Enable HTTPS (Replit default sudah HTTPS)
- [ ] Regular backup MongoDB (Atlas backup plan)

### Frontend (Vercel)

- [ ] `.env` tidak commit ke Git (gunakan `.env.example`)
- [ ] `REACT_APP_BACKEND_URL` benar & HTTPS
- [ ] No sensitive keys di frontend code
- [ ] Enable Vercel "Protected Deployments"

### MongoDB Atlas

- [ ] IP whitelist only production servers
- [ ] Enable MongoDB user authentication
- [ ] Backup enabled (Atlas M0 backup every 12h)
- [ ] Monitor connection activity

---

## 📊 Environment Variables Reference

### Backend `.env` (Replit)

| Variable | Value | Notes |
|----------|-------|-------|
| `MONGO_URL` | `mongodb+srv://...` | Atlas connection string |
| `DB_NAME` | `suruahai` | Database name |
| `JWT_SECRET` | 32+ chars random | Keep secret! |
| `JWT_ALGORITHM` | `HS256` | Don't change |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | 24 hours |
| `HOST` | `0.0.0.0` | Listen all interfaces |
| `PORT` | `8001` | Server port |
| `ALLOWED_ORIGINS` | JSON list | CORS domains |

### Frontend `.env` (Vercel)

| Variable | Value | Example |
|----------|-------|---------|
| `REACT_APP_BACKEND_URL` | Backend URL | `https://backend.replit.dev` |

---

## 🚨 Troubleshooting Deployment

### Vercel - Frontend blank page

**Check:**
1. Build logs di Vercel dashboard
2. Browser console (F12 → Console tab)
3. Network tab → check backend URL calls

**Common fixes:**
```bash
# Check REACT_APP_BACKEND_URL
echo $REACT_APP_BACKEND_URL

# Rebuild & redeploy
vercel redeploy
```

### Replit - 500 Error / Database not connecting

**Check:**
1. `.env` file exists & correct
2. `MONGO_URL` credentials valid
3. MongoDB Atlas IP whitelist includes Replit IP
4. Test connection manual:

```python
from pymongo import MongoClient
client = MongoClient("mongodb+srv://user:pass@...")
print(client.admin.command('ismaster'))
```

### CORS Error when frontend calls backend

**Backend side:**
Check `ALLOWED_ORIGINS` di `.env`:
```env
ALLOWED_ORIGINS=["https://suruahai.vercel.app"]
```

**Frontend side:**
Verify `REACT_APP_BACKEND_URL`:
```javascript
console.log(import.meta.env.REACT_APP_BACKEND_URL)
```

### Long initial load / Backend sleeping

Replit free tier auto-sleeps setelah 1 hour no activity.

**Solution:**
1. Upgrade ke Replit Pro + Always On (recommended)
2. Atau setup cron job ping backend setiap 5 min

```bash
# Cron job (di external service)
*/5 * * * * curl https://your-backend.replit.dev/api/health
```

---

## 📈 Monitoring & Maintenance

### Backend Monitoring (Replit)

1. Check server logs regularly
2. Monitor error rates
3. Verify `/api/health` endpoint

```bash
watch -n 5 "curl https://your-backend.replit.dev/api/health"
```

### Database Monitoring (MongoDB)

1. Replit **Settings** → **Secrets** (view env vars)
2. MongoDB Atlas Dashboard:
   - View query stats
   - Check slow queries
   - Monitor connections
3. Setup alerts untuk:
   - High CPU
   - Disk space low
   - Many connections

### Frontend Monitoring (Vercel)

1. Vercel Analytics → Real-time traffic
2. Vercel Logs → Error logs
3. Setup monitoring:
   - Performance metrics
   - Error tracking (Sentry, Rollbar)

---

## 🔄 Updating Code (CI/CD)

### Deploy Backend Updates (Replit)

1. Push changes ke GitHub
2. Replit auto-sync jika setup dari GitHub
3. Or manual: pull latest changes
4. Replit auto-restart

### Deploy Frontend Updates (Vercel)

1. Push to GitHub `main` branch
2. Vercel auto-builds & deploys
3. Deployment live dalam 1-5 menit

**Manual redeploy:**
```bash
vercel --prod
```

---

## 📝 Post-Deployment Checklist

- [ ] Frontend live & loading
- [ ] Backend health check passing
- [ ] Login/register flow works
- [ ] Database operations working
- [ ] No console errors di browser
- [ ] HTTPS working (green lock 🔒)
- [ ] Custom domain configured (if any)
- [ ] Monitor logs untuk 1-2 hari

---

## 💡 Tips & Best Practices

1. **Keep .env secure** - Never commit `.env` to Git
2. **Use strong JWT_SECRET** - Min 32 chars, random
3. **Monitor disk/quota** - MongoDB Atlas free tier 512MB
4. **Set up alerts** - Know when things break
5. **Regular backups** - MongoDB Atlas automatic
6. **Test staging first** - Before production deploy
7. **Use custom domain** - Professional URL
8. **Enable auto-scaling** - If traffic grows (paid feature)

---

## 📞 Support

Jika ada issue:

1. Check Vercel logs → Deployment tab
2. Check Replit logs → Console/output
3. Check MongoDB Atlas → Logs tab
4. Check browser console (F12)
5. Test API manually dengan curl/Postman

---

Last updated: 2024
