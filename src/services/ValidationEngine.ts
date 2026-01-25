import mongoose from 'mongoose';
import { PendingStartup, ConfidenceHistory, DataSource } from '../models/DataIngestion';
import Logger from '../utils/logger';

interface CompanyMatch {
    record: PendingStartup;
    similarity: number;
}

interface ValidationRule {
    name: string;
    description: string;
    validate: (data: PendingStartup[]) => CompanyMatch[];
}

class ValidationEngine {
    private rules: ValidationRule[] = [
        {
            name: 'exact_name_match',
            description: 'Exact company name matches (case-insensitive)',
            validate: (data) => this.findExactMatches(data)
        },
        {
            name: 'website_match',
            description: 'Same website URL (ignoring protocol)',
            validate: (data) => this.findWebsiteMatches(data)
        },
        {
            name: 'domain_match',
            description: 'Same domain (ignoring subdomains)',
            validate: (data) => this.findDomainMatches(data)
        },
        {
            name: 'funding_amount_consistency',
            description: 'Funding amounts within reasonable variance',
            validate: (data) => this.validateFundingConsistency(data)
        },
        {
            name: 'date_congruity',
            description: 'Announcement dates make chronological sense',
            validate: (data) => this.validateDateCongruity(data)
        }
    ];

    private findExactMatches(data: PendingStartup[]): CompanyMatch[] {
        const matches: CompanyMatch[] = [];
        
        for (let i = 0; i < data.length; i++) {
            for (let j = i + 1; j < data.length; j++) {
                const similarity = this.calculateSimilarity(
                    data[i].canonicalName || this.normalizeName(data[i].name),
                    data[j].canonicalName || this.normalizeName(data[j].name)
                );
                
                if (similarity > 0.9) {
                    matches.push({
                        record: data[i],
                        similarity,
                        matchType: 'exact_name'
                    });
                }
            }
        }
        
        return matches;
    }

    private findWebsiteMatches(data: PendingStartup[]): CompanyMatch[] {
        const matches: CompanyMatch[] = [];
        
        for (let i = 0; i < data.length; i++) {
            for (let j = i + 1; j < data.length; j++) {
                if (i !== j && 
                    data[i].website && 
                    data[j].website && 
                    this.normalizeWebsite(data[i].website) === this.normalizeWebsite(data[j].website)) {
                    
                    matches.push({
                        record: data[i],
                        similarity: 1.0,
                        matchType: 'website_match'
                    });
                }
            }
        }
        
        return matches;
    }

    private findDomainMatches(data: PendingStartup[]): CompanyMatch[] {
        const matches: CompanyMatch[] = [];
        
        for (let i = 0; i < data.length; i++) {
            for (let j = i + 1; j < data.length; j++) {
                if (i !== j) {
                    const domain1 = this.extractDomain(data[i].website);
                    const domain2 = this.extractDomain(data[j].website);
                    
                    if (domain1 && domain2 && domain1 === domain2) {
                        matches.push({
                            record: data[i],
                            similarity: 1.0,
                            matchType: 'domain_match'
                        });
                    }
                }
            }
        }
        
        return matches;
    }

    private calculateSimilarity(name1: string, name2: string): number {
        const longer = Math.max(name1.length, name2.length);
        const shorter = Math.min(name1.length, name2.length);
        
        if (longer === 0) return 0;
        
        let matches = 0;
        for (let i = 0; i < shorter; i++) {
            if (name1.toLowerCase().includes(name2.toLowerCase().substring(0, shorter + 1))) {
                matches++;
            }
            if (name2.toLowerCase().includes(name1.toLowerCase().substring(0, shorter + 1))) {
                matches++;
            }
        }
        
        return matches / shorter;
    }

    private normalizeName(name: string): string {
        return name.toLowerCase()
            .replace(/^(the|a|an)\s+/gi, '')
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+(inc|llc|corp|ltd|llp)\s*$/gi, '')
            .trim();
    }

    private normalizeWebsite(url: string): string {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.replace(/^www\./, '').toLowerCase();
        } catch {
            return url.toLowerCase();
        }
    }

    private extractDomain(url: string): string {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname?.replace(/^www\./, '').toLowerCase();
        } catch {
            return '';
        }
    }

    private normalizeFunding(amount: string): number {
        if (!amount) return 0;
        
        // Extract numeric value
        const numericValue = amount.replace(/[^0-9.]/g, '');
        const millions = parseFloat(numericValue) || 0;
        
        return Math.round(millions * 1000000); // Convert to dollars
    }

    private validateFundingConsistency(data: PendingStartup[]): CompanyMatch[] {
        const matches: CompanyMatch[] = [];
        
        for (let i = 0; i < data.length; i++) {
            for (let j = i + 1; j < data.length; j++) {
                if (i !== j) {
                    const amount1 = this.normalizeFunding(data[i].fundingAmount);
                    const amount2 = this.normalizeFunding(data[j].fundingAmount);
                    
                    if (amount1 > 0 && amount2 > 0) {
                        const variance = Math.abs(amount1 - amount2) / Math.max(amount1, amount2);
                        
                        if (variance < 0.5) { // Allow 50% variance
                            matches.push({
                                record: data[i],
                                similarity: 1.0 - variance,
                                matchType: 'funding_amount_consistency'
                            });
                        }
                    }
                }
            }
        }
        
        return matches;
    }

    private validateDateCongruity(data: PendingStartup[]): CompanyMatch[] {
        const matches: CompanyMatch[] = [];
        
        for (let i = 0; i < data.length; i++) {
            for (let j = i + 1; j < data.length; j++) {
                if (i !== j) {
                    const date1 = new Date(data[i].dateAnnouncedISO);
                    const date2 = new Date(data[j].dateAnnouncedISO);
                    
                    if (date1 > date2) { // Later date should have higher amount
                        const daysDiff = (date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24);
                        const amount1 = this.normalizeFunding(data[i].fundingAmount);
                        const amount2 = this.normalizeFunding(data[j].fundingAmount);
                        
                        if (amount1 > amount2) {
                            matches.push({
                                record: data[j], // Earlier record with higher amount
                                similarity: 0.8,
                                matchType: 'date_congruity'
                            });
                        }
                    }
                }
            }
        }
        
        return matches;
    }

    public async validatePendingStartups(): Promise<{
        totalPending: number;
        duplicates: CompanyMatch[];
        validated: number;
        promoted: number;
        errors: any[];
    }> {
        try {
            const pending = await PendingStartup.find().sort({ createdAt: 1 });
            Logger.info(`🔍 Found ${pending.length} pending startups for validation`);
            
            const duplicates: CompanyMatch[] = [];
            const validated: number[] = [];
            const errors: any[] = [];
            
            // Process each validation rule
            for (const rule of this.rules) {
                try {
                    const matches = rule.validate(pending);
                    duplicates.push(...matches);
                    
                    // Mark validated records
                    for (const match of matches) {
                        validated.push(match.record._id);
                    }
                } catch (error) {
                    errors.push({ rule: rule.name, error: error.message });
                }
            }
            
            // Calculate confidence scores for pending records
            const pendingWithScores = pending.map(startup => {
                let confidence = 0.3; // Base confidence for pending
                
                // Boost confidence based on sources
                for (const source of startup.sources) {
                    switch (source.confidence) {
                        case 0.95: confidence += 0.25; break; // SEC EDGAR
                        case 0.90: confidence += 0.20; break; // Y Combinator
                        case 0.85: confidence += 0.15; break; // TechCrunch
                        case 0.80: confidence += 0.10; break; // Signal NFX
                        case 0.75: confidence += 0.05; break; // RSS feeds
                    }
                }
                
                // Source count bonus
                confidence += Math.min(startup.sources.length * 0.05, 0.2);
                
                // Penalize older records
                const daysOld = (Date.now() - new Date(startup.createdAt).getTime()) / (1000 * 60 * 60 * 24);
                if (daysOld > 90) confidence -= 0.1;
                if (daysOld > 365) confidence -= 0.2;
                
                return {
                    startupId: startup._id,
                    confidence: Math.min(confidence, 1.0),
                    sources: startup.sources.map(s => s.sourceName)
                };
            });
            
            // Promote high-confidence records
            const highConfidence = pendingWithScores.filter(s => s.confidence >= 0.85);
            const promotionIds = highConfidence.map(s => s.startupId);
            
            // Promote to main database
            if (promotionIds.length > 0) {
                await mongoose.model('Startup').insertMany(
                    highConfidence.map(s => ({
                        ...s,
                        validationStatus: 'validated',
                        confidenceScore: s.confidence,
                        sourceCount: s.sources.length
                    }))
                );
                
                Logger.info(`✅ Promoted ${promotionIds.length} startups to main database`);
            }
            
            // Remove from pending
            await PendingStartup.deleteMany({ 
                _id: { $in: promotionIds }
            });
            
            const result = {
                totalPending: pending.length,
                duplicates: duplicates,
                validated: validated.length,
                promoted: promotionIds.length,
                errors
            };
            
            Logger.info(`📊 Validation complete: ${JSON.stringify(result)}`);
            
            return result;
            
        } catch (error) {
            Logger.error('❌ Validation failed:', error);
            throw error;
        }
    }

    public async revalidateOldRecords(): Promise<void> {
        // Find records not verified in last 90 days
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        
        const oldRecords = await mongoose.model('Startup').find({
            validationStatus: 'validated',
            lastValidatedAt: { $lt: ninetyDaysAgo }
        });
        
        if (oldRecords.length > 0) {
            Logger.info(`🔄 Revalidating ${oldRecords.length} old records`);
            
            for (const record of oldRecords) {
                // Queue for re-scraping if confidence was low
                if (record.confidenceScore < 0.7) {
                    await this.queueRevalidation(record);
                }
            }
        }
    }

    private async queueRevalidation(record: any): Promise<void> {
        // Schedule re-scraping with highest priority sources
        console.log(`🔄 Queuing re-validation for ${record.name}`);
        
        // This would integrate with SourceManager in Phase 2.3
        console.log('Would schedule with SEC EDGAR priority');
    }

    public getValidationStatistics(): Promise<{
        totalStartups: number;
        pendingStartups: number;
        validatedStartups: number;
        avgConfidence: number;
        confidenceDistribution: Record<string, number>;
    }> {
        const [total, pending, validated] = await Promise.all([
            mongoose.model('Startup').countDocuments(),
            PendingStartup.countDocuments({ validationStatus: 'pending' }),
            mongoose.model('Startup').countDocuments({ validationStatus: 'validated' })
        ]);
        
        const [pendingWithScores] = await PendingStartup.find(
            { validationStatus: 'pending' },
            'confidenceScore sources'
        );
        
        const avgConfidence = pendingWithScores.length > 0 
            ? pendingWithScores.reduce((sum, record) => sum + record.confidenceScore, 0) / pendingWithScores.length
            : 0;
        
        const confidenceDistribution = pendingWithScores.reduce((acc, record) => {
            const range = this.getConfidenceRange(record.confidenceScore);
            acc[range] = (acc[range] || 0) + 1;
            return acc;
        }, {});
        
        return {
            totalStartups: total,
            pendingStartups: pending,
            validatedStartups: validated,
            avgConfidence,
            confidenceDistribution
        };
    }

    private getConfidenceRange(score: number): string {
        if (score >= 0.9) return 'Very High';
        if (score >= 0.8) return 'High';
        if (score >= 0.7) return 'Medium';
        if (score >= 0.5) return 'Low';
        return 'Very Low';
    }
}

export default ValidationEngine;