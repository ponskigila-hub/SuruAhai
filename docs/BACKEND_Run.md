# 🚀 Manual Run Backend - Step by Step

Panduan lengkap untuk run backend `server.py` secara manual di Replit setiap kali.

---

## 📋 Prerequisites

- Replit sudah buka
- Environment variables sudah set (MONGO_URL, JWT_SECRET, dll)
- Python 3.11+ installed

---

## ⚡ STEP 1: Open Terminal di Replit

Di Replit interface:

```
1. Click "Shell" tab (atau buka tab baru dengan "+")
2. Akan muncul terminal
3. Ready untuk input command
```

---

## ⚡ STEP 2: Navigate ke Backend Folder

Di terminal, run:

```bash
cd python-backend
```

**Verify:**
```bash
pwd
# Should show: /home/runner/workspace/artifacts/python-backend
```

---

## ⚡ STEP 3: Start Backend Server

```bash
python server.py
```

**Expected Output:**
```
INFO:     Started server process [XXXX]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:3000 (Press CTRL+C to quit)
```

**If you see this, backend is RUNNING!** ✅

---

## ⚡ STEP 4: Keep Running

**DO NOT press Ctrl+C** - biarkan server terus jalan.

Backend akan:
- Accept requests dari frontend
- Listen on port 3000
- Expose ke public URL

---

## ⚡ STEP 5: Test Backend (Open New Terminal Tab)

Jangan close terminal yang backend-nya jalan!

Buka terminal tab baru:

```
Click "+" → Pilih "Shell"
```

Di tab baru ini, test:

```bash
curl http://0.0.0.0:3000/api/health
```

**Expected:**
```json
{"status":"healthy","service":"SuruAhai API"}
```

---

## 🔄 Terminal Layout

Ideal setup:

```
┌─────────────────────────────────────────┐
│  Tab 1: Backend Running                 │
│  $ python server.py                     │
│  INFO: Uvicorn running on 0.0.0.0:3000 │
│  (JANGAN TUTUP)                         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Tab 2: Testing & Commands              │
│  $ curl http://0.0.0.0:3000/api/health │
│  (untuk test)                           │
└─────────────────────────────────────────┘
```

---

## 📋 Full Command Reference

### Start Backend

```bash
cd python-backend && python server.py
```

### Test Health Check

```bash
curl http://0.0.0.0:3000/api/health
```

### Test Public URL

```bash
curl https://6d9de595-c82c-47f4-97f5-8b6bc34a39a3-00-29aokdb8uu2j1.sisko.replit.dev:3000/api/health
```

### Seed Data

```bash
curl -X POST https://6d9de595-c82c-47f4-97f5-8b6bc34a39a3-00-29aokdb8uu2j1.sisko.replit.dev:3000/api/seed
```

### Stop Backend

Di terminal yang backend jalan:
```bash
Ctrl + C
```

Output akan show:
```
INFO:     Shutting down
INFO:     Waiting for application shutdown.
INFO:     Application shutdown complete.
```

### Restart Backend

```bash
cd python-backend && python server.py
```

---

## 🧪 Troubleshooting

### Error: "No module named 'fastapi'"

```bash
pip install -r requirements.txt
python server.py
```

---

### Error: "Address already in use"

Port 3000 already used. Kill previous:

```bash
# Di tab baru
pkill -f "python.*server"
sleep 2

# Then start again
cd python-backend && python server.py
```

---

### Error: "MONGO_URL not found"

Environment variables tidak loaded. Set manually:

```bash
export MONGO_URL="mongodb+srv://suruahai_user:GyLfUImHfSFNv9N6@cluster0.64vkecl.mongodb.net/suruahai?retryWrites=true&w=majority&appName=Cluster0"
export DB_NAME="suruahai"
export JWT_SECRET="super-secret-key-change-this"
export JWT_ALGORITHM="HS256"
export ACCESS_TOKEN_EXPIRE_MINUTES="1440"

python server.py
```

---

### Backend Hang/Tidak Responsive

Kill dan restart:

```bash
Ctrl + C

# Wait 2 seconds
sleep 2

# Restart
python server.py
```

---

## 📋 Daily Workflow

**Setiap kali buka Replit untuk development:**

```bash
# 1. Navigate
cd python-backend

# 2. Check if requirements installed
pip list | grep fastapi

# 3. Start server
python server.py

# 4. Leave running, buka tab baru untuk test
```

---

## 🎯 Public URL

Backend public URL:

```
https://6d9de595-c82c-47f4-97f5-8b6bc34a39a3-00-29aokdb8uu2j1.sisko.replit.dev:3000
```

Gunakan ini di:
- Vercel `REACT_APP_BACKEND_URL`
- Testing dari luar Replit
- Browser requests

---

## ✅ Checklist

Sebelum test frontend:

```
□ Terminal buka
□ Navigate ke python-backend: cd python-backend
□ Run: python server.py
□ See "Uvicorn running on http://0.0.0.0:3000"
□ Tab baru untuk test/development
□ Test health: curl http://0.0.0.0:3000/api/health → JSON ✅
□ Public URL: curl https://...replit.dev:3000/api/health → JSON ✅
□ Ready untuk frontend testing!
```

---

## 💡 Pro Tips

### 1. Always Keep Backend Running

Jangan close terminal backend saat development. Buka tab baru untuk testing.

### 2. Watch Output

Saat ada error dari frontend, lihat backend terminal. Often ada error messages yang helpful.

### 3. Check Logs

Backend log akan show:
```
GET /api/health 200 OK
POST /api/auth/register 201 CREATED
POST /api/auth/login 200 OK
```

### 4. Restart When Stuck

Jika ada weird behavior:
```bash
Ctrl + C
python server.py
```

### 5. Keep Terminal Clean

```bash
# Clear terminal
clear

# Then run
python server.py
```

---

## 🚀 Next Steps

Setelah backend running:

1. ✅ Backend on port 3000
2. ✅ Public URL accessible
3. ✅ Database connected
4. → Test frontend di Vercel
5. → Test registration/login
6. → Full system testing!

---

**Simpel: `cd python-backend && python server.py` - setiap kali!** 👍

---

**Created**: Juni 2026
**Status**: Manual Run Guide ✅
**Difficulty**: Very Easy 👍

