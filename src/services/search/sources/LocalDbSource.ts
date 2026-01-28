import { ISearchSource, SearchResult, SearchSourceResult } from '../interfaces';
import { Startup } from '../../../models/Startup';
import Logger from '../../../utils/logger';

export class LocalDbSource implements ISearchSource {
    name = 'Local DB';
    enabled = true;
    priority = 100; // High priority to show local results first

    async search(query: string): Promise<SearchSourceResult> {
        try {
            const startTime = Date.now();

            // Regex search on name, description, industry, or tags
            const regex = new RegExp(query, 'i');
            const startups = await Startup.find({
                $or: [
                    { name: regex },
                    { description: regex },
                    { industry: regex },
                    { tags: regex } // Arrays work with regex match in Mongo
                ]
            }).limit(20).sort({ dateAnnouncedISO: -1 });

            // Map to SearchResult
            const results: SearchResult[] = startups.map(startup => ({
                title: startup.name,
                url: startup.website || (startup.sources.length > 0 ? startup.sources[0].sourceUrl : '') || '',
                snippet: startup.description,
                source: 'Local DB',
                date: startup.dateAnnounced,
                relevanceScore: 1.0, // Local matches are 100% relevant
                originalData: startup.toObject() // Pass full data
            }));

            return {
                source: this.name,
                results,
                latencyMs: Date.now() - startTime
            };
        } catch (error: any) {
            Logger.error('Local DB Search Error:', error);
            throw new Error(`Local DB search failed: ${error.message}`);
        }
    }
}
