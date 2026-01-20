# Database Management Guide

## Initial Database Seeding

For the first time setup or when you need to populate the database with fresh data:

```bash
npm run db:seed
```

This script will:
- Scrape all configured sources (RSS feeds, Reddit, Product Hunt, etc.)
- RSS feeds naturally return the last 30-60 days of posts
- Reddit/HN/Product Hunt APIs fetch recent posts
- Enrich all discovered startups with founders and website information
- Take approximately 10-15 minutes depending on API rate limits

## Database Cleanup

To remove duplicates, test data, and fix data quality issues:

```bash
npm run db:cleanup
```

This script will:
- Remove startups with missing names
- Remove duplicate entries (keeps most recent)
- Fix invalid dates
- Remove test/dummy data

## Ongoing Scraping (Production)

The application has a **cron job** configured in `src/server.ts` that runs **every hour**:

```typescript
cron.schedule('0 * * * *', async () => {
    // Scrapes all sources and adds to queue
    await scrapeQueue.add('scrape-all', { source: 'cron' });
    await runGalleryScrape();
});
```

### Cron Job Schedule

- **Current**: `'0 * * * *'` = Every hour at minute 0
- **Production Recommendation**: Keep hourly for RSS feeds and news sources
- **Alternative Daily**: `'0 0 * * *'` = Once per day at midnight
- **Alternative 6 Hours**: `'0 */6 * * *'` = Every 6 hours

### How Far Back Do Scrapers Go?

| Source | Time Range |
|--------|------------|
| **RSS Feeds** | Automatically includes last 30-60 days |
| **Reddit** | Last 100 "hot" posts (typically last week) |
| **Product Hunt** | Today's posts by default |
| **Hacker News** | Latest "Show HN" posts |
| **SERP Discovery** | Live search results |

## Initial Setup Strategy

1. **First Time**:
   ```bash
   npm run db:seed  # Populate with 30 days of data
   ```

2. **Start Server**:
   ```bash
   npm run dev  # Cron will keep DB updated hourly
   ```

3. **Clean Up (If Needed)**:
   ```bash
   npm run db:cleanup
   ```

4. **Production**: The hourly cron job handles all ongoing updates automatically.

## Data Quality

The application has built-in validation:
- **BaseScraper** rejects startups without funding amounts
- **AI Validation** ensures only legitimate funding announcements are saved
- **Enrichment** adds founders and website data post-save
- **Deduplication** prevents saving the same startup twice
