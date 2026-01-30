import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../src/models/User';

dotenv.config();

async function updateUserCredits() {
    try {
        await mongoose.connect(process.env.MONGODB_URI!);
        console.log('🔌 Connected to MongoDB...');

        // Update all users to have 1000 credits and 'paid' tier
        const result = await User.updateMany(
            {},
            {
                $set: {
                    credits: 1000,
                    tier: 'paid'
                }
            }
        );

        console.log(`✅ Updated ${result.modifiedCount} users.`);
        console.log('🎉 All users now have 1000 credits and PAID tier.');

    } catch (error) {
        console.error('❌ Error updating credits:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected.');
    }
}

updateUserCredits();
