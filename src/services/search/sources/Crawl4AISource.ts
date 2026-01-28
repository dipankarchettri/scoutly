// Crawl4AI Source - Calls Python Crawl4AI for web scraping (FREE)

import { ISearchSource, SearchResult, SearchSourceResult } from '../interfaces';
import { FREE_SOURCES } from '../../../config/searchConfig';
import { spawn } from 'child_process';

export class Crawl4AISource implements ISearchSource {
    name = 'Crawl4AI';
    enabled: boolean;
    priority: number;
    private timeout: number;
    private concurrent: number;

    constructor() {
        const config = FREE_SOURCES.crawl4ai;
        this.enabled = config.enabled;
        this.priority = config.priority;
        this.timeout = config.timeout;
        this.concurrent = config.concurrent;
    }

    /**
     * Crawl a list of URLs using Crawl4AI Python library
     * Falls back to Puppeteer if Crawl4AI is not available
     */
    async crawlUrls(urls: string[]): Promise<{ url: string; content: string; error?: string }[]> {
        const results: { url: string; content: string; error?: string }[] = [];

        // Try Python Crawl4AI first
        try {
            const crawlResult = await this.callPythonCrawler(urls);
            return crawlResult;
        } catch (error) {
            console.warn('⚠️ Crawl4AI Python not available, falling back to Puppeteer');
            // Fallback to Puppeteer
            return this.puppeteerFallback(urls);
        }
    }

    private callPythonCrawler(urls: string[]): Promise<{ url: string; content: string; error?: string }[]> {
        return new Promise((resolve, reject) => {
            const pythonScript = `
import sys
import json
import asyncio

try:
    from crawl4ai import AsyncWebCrawler
    
    async def crawl(urls):
        results = []
        async with AsyncWebCrawler() as crawler:
            for url in urls:
                try:
                    result = await crawler.arun(url=url)
                    results.append({
                        "url": url,
                        "content": result.markdown[:10000] if result.markdown else "",
                        "error": None
                    })
                except Exception as e:
                    results.append({
                        "url": url,
                        "content": "",
                        "error": str(e)
                    })
        return results
    
    urls = json.loads(sys.argv[1])
    results = asyncio.run(crawl(urls))
    print(json.dumps(results))
    
except ImportError:
    print(json.dumps({"error": "crawl4ai not installed"}))
    sys.exit(1)
`;

            const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
            const childProcess = spawn(pythonCmd, ['-c', pythonScript, JSON.stringify(urls)]);

            let stdout = '';
            let stderr = '';

            childProcess.stdout.on('data', (data) => { stdout += data.toString(); });
            childProcess.stderr.on('data', (data) => { stderr += data.toString(); });

            // Handle spawn errors (e.g. python not found)
            childProcess.on('error', (err) => {
                reject(new Error(`Failed to spawn python process: ${err.message}`));
            });

            const timeout = setTimeout(() => {
                childProcess.kill();
                reject(new Error('Crawl4AI timeout'));
            }, this.timeout);

            childProcess.on('close', (code) => {
                clearTimeout(timeout);
                if (code === 0) {
                    try {
                        const result = JSON.parse(stdout);
                        if (result.error) {
                            reject(new Error(result.error));
                        } else {
                            resolve(result);
                        }
                    } catch (e) {
                        reject(new Error('Failed to parse Crawl4AI output'));
                    }
                } else {
                    reject(new Error(`Crawl4AI exited with code ${code}: ${stderr}`));
                }
            });
        });
    }

    private async puppeteerFallback(urls: string[]): Promise<{ url: string; content: string; error?: string }[]> {
        const puppeteer = (await import('puppeteer')).default;
        const results: { url: string; content: string; error?: string }[] = [];

        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            // Process URLs in batches to limit concurrency
            for (let i = 0; i < urls.length; i += this.concurrent) {
                const batch = urls.slice(i, i + this.concurrent);
                const batchPromises = batch.map(async (url) => {
                    const page = await browser.newPage();
                    try {
                        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
                        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
                        const content = await page.evaluate(() => document.body.innerText);
                        return { url, content: content.substring(0, 10000), error: undefined };
                    } catch (error: any) {
                        return { url, content: '', error: error.message };
                    } finally {
                        await page.close();
                    }
                });

                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults);
            }
        } finally {
            await browser.close();
        }

        return results;
    }

    async search(query: string): Promise<SearchSourceResult> {
        const startTime = Date.now();

        if (!this.enabled) {
            return {
                source: this.name,
                results: [],
                error: 'Crawl4AI is not enabled',
                latencyMs: 0
            };
        }

        // This source is primarily used for crawling URLs from other sources
        // Direct search is limited - we return empty and let orchestrator use it for URL crawling
        return {
            source: this.name,
            results: [],
            latencyMs: Date.now() - startTime
        };
    }
}
