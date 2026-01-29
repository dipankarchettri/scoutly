import { StrictAuthProp, ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';
import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import Logger from '../utils/logger';
import { PRICING_TIERS } from '../config/searchConfig';

// Extend Express Request to include our User model
declare global {
  namespace Express {
    interface Request extends StrictAuthProp {
      dbUser?: any;
    }
  }
}

export const requireAuth = [
  // 1. Verify Clerk Token
  ClerkExpressRequireAuth({
    // Options if needed
  }),

  // 2. Sync with Database
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth?.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const clerkId = req.auth.userId;

      // Find user
      let user = await User.findOne({ clerkId });

      // Create if not exists
      if (!user) {
        // We might need to fetch user details from Clerk if we want email/name
        // For now, we'll create a placeholder and let the optional webhook or subsequent calls fill it
        // OR better: Since we are in the request, we can assume we want to create them now.
        // But we don't have email in the token usually unless we decode it specifically or use `req.auth.claims`.
        // Let's rely on the client sending email for first creation OR better, just fetch from Clerk API.
        // For simplicity/speed in this task, I'll assume we can get email from claims if available, 
        // or we'll create with a placeholder email and update it later.
        
        // Actually, let's just default to a placeholder. Clerk webhooks are better for sync, but for this task:
        // We will do a robust "Get or Create" with default credits.
        
        user = await User.create({
          clerkId,
          email: 'pending_sync', // Placeholder until we have a way to get email safely
          tier: 'free',
          credits: PRICING_TIERS.free.credits
        });
        
        Logger.info(`🆕 Created new user for Clerk ID: ${clerkId}`);
      }
      
      // Daily Credit Reset Check
      const now = new Date();
      const lastReset = new Date(user.lastDailyReset || 0);
      const isDifferentDay = now.getDate() !== lastReset.getDate() || 
                             now.getMonth() !== lastReset.getMonth() ||
                             now.getFullYear() !== lastReset.getFullYear();

      if (isDifferentDay && user.tier === 'free') {
        user.credits = PRICING_TIERS.free.credits;
        user.lastDailyReset = now;
        await user.save();
        Logger.info(`🔄 Reset daily credits for user: ${clerkId}`);
      }

      req.dbUser = user;
      next();
    } catch (error) {
      Logger.error('Auth middleware error:', error);
      res.status(500).json({ error: 'Internal Server Error during Auth' });
    }
  }
];
