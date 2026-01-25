# Scoutly v2.0 Documentation

## 🚀 Overview
Scoutly v2 is an AI-powered startup discovery platform that aggregates data from multiple sources to find the latest funding announcements and product launches.

## 🛠️ Tech Stack
- **Frontend:** React + Vite + TailwindCSS
- **Backend:** Node.js + Express
- **Database:** MongoDB (Credits/Users), Redis (Caching - Optional)
- **Search:** SearxNG (Primary), Brave Search (Backup), Crawl4AI (Scraping)
- **AI/LLM:** Ollama (Local/Free) or OpenRouter (Cloud)

---

## 🏗️ Architecture

### Search Pipeline
1. **User Query** -> `SearchOrchestrator`
2. **Parallel Fetch** from all enabled sources:
   - SearxNG (Self-hosted metasearch)
   - Brave Search API (Free tier)
   - Crawl4AI (Direct URL crawling)
3. **Aggregation** in `ResultAggregator`:
   - Merges results
   - Deduplicates by URL
   - Ranks by relevance & freshness
4. **Extraction** via `startups/aiService`:
   - Uses LLM (Ollama/OpenRouter) to extract structured data
   - Return `{ name, funding, founders, ... }`
5. **Response** to Frontend

### Credit System
- **Free Tier:** 2 credits/month (renewed automatically)
- **Persistence:** MongoDB `User` collection
- **Anonymous:** In-memory fallback if no login

---

## 🚦 Setup Guide

### 1. Prerequisites
- Docker (for SearxNG)
- Node.js 18+
- MongoDB (Local or Atlas)
- Ollama (Optional, for free local AI)

### 2. Environment Variables
Create `.env`:
```env
MONGODB_URI=mongodb://localhost:27017/scoutly
PORT=5000

# Search Sources
SEARXNG_URL=http://localhost:8080
BRAVE_API_KEY=your_key_here

# AI / LLM
OLLAMA_URL=http://localhost:11434 
OPENROUTER_API_KEY=your_key_here

# Optional Paid Sources
EXA_API_KEY=
TAVILY_API_KEY=
```

### 3. Run Services

**Start SearxNG:**
```bash
docker run -d -p 8080:8080 --name searxng searxng/searxng
```

**Start Ollama (Mac/Linux):**
```bash
ollama serve
ollama pull llama3.1:8b
```

**Start Scoutly:**
```bash
# Terminal 1: Backend
npm run dev:server

# Terminal 2: Frontend
npm run dev
```

---

## 📚 API Reference

### `POST /api/search`
Search for startups using AI.
- **Body:** `{ "query": "AI agents", "page": 1, "tier": "free" }`
- **Response:**
  ```json
  {
    "success": true,
    "data": {
      "companies": [...],
      "pagination": {...},
      "meta": {...}
    },
    "credits": { "remaining": 1 }
  }
  ```

### `GET /api/search/sources`
Get status of all search sources.

---

## 🔮 Future Roadmap (v2.1)
- [ ] User Authentication (Auth0/Firebase)
- [ ] Stripe Integration for Pro tier
- [ ] Vector Search with MongoDB Atlas
- [ ] Email enrichment for founders
