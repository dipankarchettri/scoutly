import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Startup } from '../src/models/Startup';

dotenv.config();

async function viewDatabase() {
    await mongoose.connect(process.env.MONGODB_URI!);

    console.log('📊 DATABASE OVERVIEW\n');

    const total = await Startup.countDocuments();
    console.log(`Total Startups: ${total}\n`);

    // Recent startups
    const recent = await Startup.find().sort({ createdAt: -1 }).limit(10);
    console.log('=== 10 Most Recent Startups ===\n');
    recent.forEach((s, i) => {
        console.log(`${i + 1}. ${s.name}`);
        console.log(`   💰 ${s.fundingAmount || 'N/A'} (${s.roundType || 'N/A'})`);
        console.log(`   📍 ${s.location || 'N/A'}`);
        console.log(`   🌐 ${s.website || 'N/A'}`);
        console.log(`   📅 ${s.dateAnnounced}`);
        console.log(`   👥 Founders: ${s.contactInfo?.founders?.join(', ') || 'N/A'}`);
        console.log(`   📝 ${s.description?.substring(0, 80)}...`);
        console.log('');
    });

    // Stats by industry
    console.log('=== Top Industries ===');
    const byIndustry = await Startup.aggregate([
        { $group: { _id: '$industry', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
    ]);
    byIndustry.forEach(i => console.log(`  ${i._id}: ${i.count}`));

    // Stats by source
    console.log('\n=== Top Sources ===');
    const bySource = await Startup.aggregate([
        { $group: { _id: '$source', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
    ]);
    bySource.forEach(s => console.log(`  ${s._id}: ${s.count}`));

    await mongoose.disconnect();
}

viewDatabase();
