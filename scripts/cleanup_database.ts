import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Startup } from '../src/models/Startup';

dotenv.config();

async function cleanupDatabase() {
    await mongoose.connect(process.env.MONGODB_URI!);

    console.log('🧹 Starting Database Cleanup...\n');

    // FORCE WIPE ALL DATA
    const result = await Startup.deleteMany({});
    console.log(`🔥 DELETED ${result.deletedCount} STARTUPS. DATABASE CLEARED.`);

    const finalCount = await Startup.countDocuments();
    console.log(`\n📊 Final database count: ${finalCount} startups`);

    await mongoose.disconnect();
    console.log('✅ Cleanup complete!');
}

cleanupDatabase();
