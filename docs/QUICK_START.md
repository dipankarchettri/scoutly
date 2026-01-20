# Scoutly Quick Start Guide

This is a simplified setup guide for getting Scoutly running on your local machine quickly.

## 🚀 Quick Setup (5 minutes)

### Step 1: Install Prerequisites

You need these installed first:

1. **Node.js 18+** → [Download here](https://nodejs.org/)
2. **MongoDB** → Choose one:
   - **Easiest:** [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) (free cloud database)
   - **Local:** [Download MongoDB](https://www.mongodb.com/try/download/community)
3. **Redis** → [Download here](https://redis.io/download/)
   - Windows: [Redis for Windows](https://github.com/microsoftarchive/redis/releases)
   - Mac: `brew install redis`
   - Linux: `sudo apt-get install redis-server`

### Step 2: Get API Keys

Create free accounts and get these API keys:

- ✅ [Google Gemini API Key](https://ai.google.dev/) (required)
- ✅ [OpenRouter API Key](https://openrouter.ai/) (required)
- ⚠️ [Firecrawl API Key](https://www.firecrawl.dev/) (optional)

### Step 3: Clone & Install

```bash
git clone <repository-url>
cd scoutly
npm install
```

### Step 4: Create `.env` File

Create a `.env` file in the project root and paste this (replace with your actual keys):

```env
# Database (choose one)
MONGODB_URI=mongodb://localhost:27017/scoutly
# OR for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/

# Required API Keys
GEMINI_API_KEYS="your_gemini_key_here"
OPENROUTER_API_KEY=your_openrouter_key_here

# Optional
FIRECRAWL_API_KEY=your_firecrawl_key_here

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Environment
NODE_ENV=development
```

### Step 5: Start Services

**Terminal 1 - Start Redis:**
```bash
redis-server
```

**Terminal 2 - Start MongoDB (if using local):**
```bash
mongod
```

**Terminal 3 - Start Scoutly:**
```bash
npm run dev
```

### Step 6: Open Browser

Navigate to: **http://localhost:5173**

🎉 Done! Scoutly should now be running.

---

## 🔧 Optional: Seed Database

To add sample data for testing:

```bash
npm run db:seed
```

---

## ❌ Common Issues

### "Redis connection refused"
- Make sure Redis is running: `redis-server`
- Test connection: `redis-cli ping` (should return "PONG")

### "MongoDB connection error"
- For local: Start MongoDB with `mongod`
- For Atlas: Check your connection string in `.env`

### "API key not found"
- Check `.env` file exists in project root
- Verify no extra spaces around the `=` sign
- Restart the server: Stop `npm run dev` and start again

### "Port 3000 already in use"
Windows:
```bash
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

Mac/Linux:
```bash
lsof -ti:3000 | xargs kill -9
```

---

## 📚 Need More Help?

- Full documentation: See [README.md](../README.md)
- Architecture details: See [docs/ARCHITECTURE.md](./ARCHITECTURE.md)
- Database management: See [docs/DATABASE_MANAGEMENT.md](./DATABASE_MANAGEMENT.md)
