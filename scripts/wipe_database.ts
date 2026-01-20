import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Startup } from '../src/models/Startup';

dotenv.config();

async function wipeDatabase() {
    await mongoose.connect(process.env.MONGODB_URI!);

    const count = await Startup.countDocuments();
    console.log(`🗑️  Current database has ${count} startups`);
    console.log('⚠️  Wiping entire database...\n');

    const result = await Startup.deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} startups`);
    console.log('📊 Database is now empty and ready for fresh data\n');

    await mongoose.disconnect();
}

wipeDatabase();
