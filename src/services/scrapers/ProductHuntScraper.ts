
import { BaseScraper } from './BaseScraper';
import { ScraperResult } from './interfaces';

export class ProductHuntScraper extends BaseScraper {
    private apiKey: string | undefined;

    constructor(config: any) {
        super(config);
        this.apiKey = process.env.PRODUCTHUNT_API_KEY; // OR token
    }

    async scrape(): Promise<ScraperResult> {
        if (!this.apiKey) {
            this.logger.warn(`[${this.name}] No PRODUCTHUNT_API_KEY found. Skipping.`);
            return { source: this.name, processedCount: 0, errors: 1, items: [] };
        }

        let processed = 0;
        const items: any[] = [];
        
        try {
            // Need a valid Graphql query or V2 endpoint.
            // Product Hunt V2 is GraphQL.
            // Simplified fetch for "today's posts"
            
            const query = `
            {
              posts(first: 10) {
                edges {
                  node {
                    id
                    name
                    tagline
                    description
                    url
                    website
                    createdAt
                    topics {
                        edges {
                            node {
                                name
                            }
                        }
                    }
                  }
                }
              }
            }
            `;

            const response = await fetch("https://api.producthunt.com/v2/api/graphql", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`,
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({ query })
            });

            if (!response.ok) {
                 throw new Error(`PH API Error: ${response.status} ${await response.text()}`);
            }

            const data = await response.json();
            const posts = data.data?.posts?.edges || [];

            this.logger.log(`[${this.name}] Found ${posts.length} posts.`);

            for (const edge of posts) {
                const node = edge.node;
                const text = `${node.name} - ${node.tagline}\n\n${node.description || ''}\nTopics: ${node.topics.edges.map((t:any) => t.node.name).join(', ')}`;
                // Use website URL if available, else PH url
                const sourceUrl = node.website || node.url; 
                
                const saved = await this.processItem(text, node.createdAt, sourceUrl);
                if (saved) processed++;
            }

        } catch (e) {
            this.logger.error(`[${this.name}] Error:`, e);
            return { source: this.name, processedCount: 0, errors: 1, items: [] };
        }

        return { source: this.name, processedCount: processed, errors: 0, items };
    }
}
