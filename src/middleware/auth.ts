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



      // Atomic Get-or-Create to prevent race conditions
      // This solves the E11000 duplicate key error when multiple requests come in simultaneously
      let user = await User.findOneAndUpdate(
        { clerkId },
        {
          $setOnInsert: {
            clerkId,
            email: 'pending_sync', // Placeholder until we have a way to get email safely
            tier: 'free',
            credits: PRICING_TIERS.free.credits
          }
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true
        }
      );

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
