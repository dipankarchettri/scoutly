// Credit Service - Manages user credits and usage tracking

import { PRICING_TIERS, PricingTier } from '../../config/searchConfig';
import { CreditInfo } from '../search/interfaces';

// In-memory credit store (replace with MongoDB in production)
const creditStore = new Map<string, {
    tier: PricingTier;
    total: number;
    used: number;
    resetAt: Date;
}>();

export class CreditService {

    /**
     * Get or create credit info for a user
     */
    getCredits(userId: string): CreditInfo {
        let credits = creditStore.get(userId);

        if (!credits) {
            // Initialize new user with free tier
            credits = {
                tier: 'free',
                total: PRICING_TIERS.free.credits,
                used: 0,
                resetAt: this.getNextResetDate()
            };
            creditStore.set(userId, credits);
        }

        // Check if credits should reset
        if (new Date() >= credits.resetAt) {
            credits.used = 0;
            credits.resetAt = this.getNextResetDate();
            creditStore.set(userId, credits);
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
     * Check if user has credits available
     */
    hasCredits(userId: string): boolean {
        const credits = this.getCredits(userId);
        return credits.remaining > 0;
    }

    /**
     * Deduct one credit from user
     */
    deductCredit(userId: string): boolean {
        const storedCredits = creditStore.get(userId);

        if (!storedCredits) {
            return false;
        }

        if (storedCredits.used >= storedCredits.total) {
            return false;
        }

        storedCredits.used += 1;
        creditStore.set(userId, storedCredits);

        return true;
    }

    /**
     * Upgrade user to paid tier
     */
    upgradeToPaid(userId: string): CreditInfo {
        const credits = creditStore.get(userId) || {
            tier: 'free' as PricingTier,
            total: PRICING_TIERS.free.credits,
            used: 0,
            resetAt: this.getNextResetDate()
        };

        credits.tier = 'paid';
        credits.total = PRICING_TIERS.paid.credits;
        credits.resetAt = this.getNextResetDate();

        creditStore.set(userId, credits);

        return this.getCredits(userId);
    }

    /**
     * Get next monthly reset date
     */
    private getNextResetDate(): Date {
        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return nextMonth;
    }

    /**
     * Get usage stats for analytics
     */
    getUsageStats(): { totalUsers: number; totalSearches: number } {
        let totalSearches = 0;
        for (const credits of creditStore.values()) {
            totalSearches += credits.used;
        }
        return {
            totalUsers: creditStore.size,
            totalSearches
        };
    }
}

// Export singleton
export const creditService = new CreditService();
