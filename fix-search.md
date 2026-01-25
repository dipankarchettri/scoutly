# Fix Scoutly Search Functionality

## Current Issue
The project was refactored from Gemini AI search to Convex database, but Convex isn't properly set up.

## Steps to Fix:

### 1. Install Convex CLI
```bash
npm install -g convex
```

### 2. Initialize Convex
```bash
npx convex dev
```
This will:
- Set up your Convex deployment
- Start the development server
- Populate the database schema

### 3. Run Initial Data Scrapers
The app will automatically trigger scrapers when no data is found, but you can manually trigger them:

```bash
# In the browser console after starting the app:
# Go to http://localhost:5173
# Open browser dev tools
# Run these commands to populate data:

// Trigger all scrapers
fetch('/api/scraper/hackernews', { method: 'POST' })
fetch('/api/scraper/rss', { method: 'POST' })  
fetch('/api/scraper/reddit', { method: 'POST' })
fetch('/api/scraper/indiehackers', { method: 'POST' })
```

### 4. Alternative: Restore Original Gemini Search
If you prefer the original AI-powered search, we need to:
- Restore the `geminiService.ts` file
- Update the Dashboard to use Gemini instead of Convex
- Add your Gemini API key to `.env.local`

## Current Architecture
- **Frontend**: React + TypeScript
- **Database**: Convex (real-time)
- **Data Sources**: HackerNews, RSS feeds, Reddit, IndieHackers
- **Search**: Database queries (not AI search)

## Next Steps
Choose one:
1. **Fix Convex setup** (recommended - more reliable)
2. **Restore Gemini AI search** (original design)

Which approach would you prefer?
