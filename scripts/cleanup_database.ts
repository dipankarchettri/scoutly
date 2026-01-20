import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Startup } from '../src/models/Startup';

dotenv.config();

async function cleanupDatabase() {
    await mongoose.connect(process.env.MONGODB_URI!);

    console.log('🧹 Starting Database Cleanup...\n');

    // 1. Remove startups with missing critical fields
    const missingName = await Startup.deleteMany({ name: { $in: [null, ''] } });
    console.log(`✅ Removed ${missingName.deletedCount} startups with missing names`);

    // 2. Remove duplicates (keep the most recent one)
    const duplicates = await Startup.aggregate([
        { $group: { _id: '$name', count: { $sum: 1 }, ids: { $push: '$_id' } } },
        { $match: { count: { $gt: 1 } } }
    ]);

    let duplicateCount = 0;
    for (const dup of duplicates) {
        const idsToDelete = dup.ids.slice(0, -1); // Keep last one
        await Startup.deleteMany({ _id: { $in: idsToDelete } });
        duplicateCount += idsToDelete.length;
    }
    console.log(`✅ Removed ${duplicateCount} duplicate startups`);

    // 3. Clean up invalid dates
    const invalidDates = await Startup.updateMany(
        { dateAnnouncedISO: { $exists: false } },
        { $set: { dateAnnouncedISO: new Date() } }
    );
    console.log(`✅ Fixed ${invalidDates.modifiedCount} startups with missing ISO dates`);

    // 4. Remove test/dummy data
    const testData = await Startup.deleteMany({
        $or: [
            { name: /test/i },
            { name: /dummy/i },
            { description: /test/i }
        ]
    });
    console.log(`✅ Removed ${testData.deletedCount} test/dummy entries`);

    const finalCount = await Startup.countDocuments();
    console.log(`\n📊 Final database count: ${finalCount} startups`);

    await mongoose.disconnect();
    console.log('✅ Cleanup complete!');
}

cleanupDatabase();
