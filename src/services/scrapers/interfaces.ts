
export interface ScraperConfig {
  name: string;
  url: string;
  type: 'rss' | 'producthunt' | 'reddit' | 'hackernews' | 'puppeteer' | 'generic';
  rss?: string;
  enabled: boolean;
  selectors?: {
    articleLinks?: string;
    articleContainer?: string;
  };
}

export interface ScraperResult {
  source: string;
  processedCount: number;
  errors: number;
  items: unknown[];
}

export interface IScraper {
  name: string;
  api?: string;
  logger: Console;
  
  scrape(): Promise<ScraperResult>;
}
