import mongoose from 'mongoose';
import 'dotenv/config';
import { User } from '../src/models/User';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/scoutly';

async function resetUsers() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('🔌 Connected to MongoDB');

        const result = await User.updateMany({}, { credits: 50 });
        console.log(`✅ Reset credits for ${result.modifiedCount} users to 50.`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to reset users:', error);
        process.exit(1);
    }
}

resetUsers();
