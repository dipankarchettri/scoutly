
import type { ScraperConfig } from '../services/scrapers/interfaces';

export type { ScraperConfig }; // Re-export for convenience

export const SCRAPER_CONFIGS: ScraperConfig[] = [
  // --- TIER 1: API / PLATFORM SOURCES ---
  {
    name: 'Product Hunt',
    url: 'https://www.producthunt.com/',
    type: 'producthunt',
    enabled: true,
  },
  {
    name: 'Reddit Startups',
    url: 'https://www.reddit.com/r/startups',
    type: 'reddit',
    enabled: true,
  },
  {
    name: 'Hacker News (Show HN)',
    url: 'https://news.ycombinator.com/show',
    type: 'hackernews',
    enabled: true,
  },
  {
    name: 'SERP Discovery (Twitter/LinkedIn)',
    url: 'https://duckduckgo.com',
    type: 'serp',
    enabled: true,
  },

  // --- TIER 2: RSS SOURCES ---
  {
    name: 'TechCrunch',
    url: 'https://techcrunch.com/category/startups/',
    type: 'rss',
    rss: 'https://techcrunch.com/category/startups/feed/',
    enabled: true,
    selectors: {
      articleLinks: 'a[href*="/20"]',
      articleContainer: 'h3, h2'
    }
  },
  {
    name: 'Finsmes',
    url: 'https://www.finsmes.com/',
    type: 'rss',
    rss: 'https://www.finsmes.com/feed',
    enabled: true,
  },
  {
    name: 'VentureBeat',
    url: 'https://venturebeat.com/category/ai/',
    type: 'rss',
    rss: 'https://venturebeat.com/category/ai/feed/',
    enabled: true,
  },
  {
    name: 'EU-Startups',
    url: 'https://www.eu-startups.com/category/funding/',
    type: 'rss',
    rss: 'https://www.eu-startups.com/feed/',
    enabled: true,
  },
  {
    name: 'SaaS Mag',
    url: 'https://saasmag.com/',
    type: 'rss',
    rss: 'https://saasmag.com/feed/',
    enabled: true,
  },
  {
    name: 'Y Combinator Blog',
    url: 'https://blog.ycombinator.com/',
    type: 'rss',
    rss: 'https://blog.ycombinator.com/feed/',
    enabled: true,
  }
];
