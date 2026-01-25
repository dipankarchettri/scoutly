// Credit Service - Manages user credits and usage tracking

import { PRICING_TIERS, PricingTier } from '../../config/searchConfig';
import { CreditInfo } from '../search/interfaces';
import { User } from '../../models/User';

// In-memory fallback for anonymous users (IP-based or session-based)
const anonymousStore = new Map<string, {
    tier: PricingTier;
    total: number;
    used: number;
    resetAt: Date;
}>();

export class CreditService {

    /**
     * Get or create credit info for a user
     */
    async getCredits(userId: string): Promise<CreditInfo> {
        try {
            // Try to find user in DB
            let user = await User.findById(userId);

            if (!user) {
                // If valid MongoDB ID but not found, or anonymous, check memory store
                // For now, we'll treat all requests as anonymous/demo user if not authenticated
                return this.getAnonymousCredits(userId);
            }

            const tierConfig = PRICING_TIERS[user.tier as PricingTier];
            const now = new Date();
            const nextReset = this.getNextResetDate(user.credits.lastResetDate);

            // Check for monthly reset
            if (now >= nextReset) {
                user.credits.used = 0;
                user.credits.lastResetDate = now;
                await user.save();
            }

            return {
                tier: user.tier as PricingTier,
                total: tierConfig.credits,
                used: user.credits.used,
                remaining: Math.max(0, tierConfig.credits - user.credits.used),
                pagesPerSearch: tierConfig.pagesPerSearch,
                companiesPerPage: tierConfig.companiesPerPage
            };
        } catch (error) {
            // Fallback for invalid IDs (anonymous users)
            return this.getAnonymousCredits(userId);
        }
    }

    private getAnonymousCredits(userId: string): CreditInfo {
        let credits = anonymousStore.get(userId);
        if (!credits) {
            credits = {
                tier: 'free',
                total: PRICING_TIERS.free.credits,
                used: 0,
                resetAt: this.getNextResetDate(new Date())
            };
            anonymousStore.set(userId, credits);
        }

        // Check reset
        if (new Date() >= credits.resetAt) {
            credits.used = 0;
            credits.resetAt = this.getNextResetDate(new Date());
            anonymousStore.set(userId, credits);
        }

        const tierConfig = PRICING_TIERS[credits.tier];
        return {
            tier: credits.tier,
            total: credits.total,
            used: credits.used,
            remaining: credits.total - credits.used,
            pagesPerSearch: tierConfig.pagesPerSearch,
            companiesPerPage: tierConfig.companiesPerPage
        };
    }

    /**
     * Deduct one credit from user
     */
    async deductCredit(userId: string): Promise<boolean> {
        try {
            const user = await User.findById(userId);
            if (user) {
                const tierConfig = PRICING_TIERS[user.tier as PricingTier];
                if (user.credits.used >= tierConfig.credits) return false;

                user.credits.used += 1;
                await user.save();
                return true;
            }
        } catch (e) {
            // Ignore error, fall through to anonymous
        }

        // Anonymous fallback
        const credits = anonymousStore.get(userId);
        if (!credits) return false;
        if (credits.used >= credits.total) return false;

        credits.used += 1;
        anonymousStore.set(userId, credits);
        return true;
    }

    /**
     * Get next monthly reset date
     */
    private getNextResetDate(fromDate: Date): Date {
        const next = new Date(fromDate);
        next.setMonth(next.getMonth() + 1);
        return next;
    }

    /**
     * Create a demo user if one doesn't exist
     */
    async ensureDemoUser(): Promise<string> {
        try {
            let user = await User.findOne({ email: 'demo@scoutly.app' });
            if (!user) {
                user = await User.create({
                    email: 'demo@scoutly.app',
                    name: 'Demo User',
                    tier: 'free'
                });
            }
            return user._id.toString();
        } catch (e) {
            console.error('Failed to create demo user:', e);
            return 'demo-user-id';
        }
    }
}

// Export singleton
export const creditService = new CreditService();
