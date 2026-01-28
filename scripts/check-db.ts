
import mongoose from 'mongoose';
import { Startup } from '../src/models/Startup';
import 'dotenv/config';

async function checkDB() {
    const MONGO_URI = process.env.MONGODB_URI;
    if (!MONGO_URI) throw new Error('MONGODB_URI not defined');

    await mongoose.connect(MONGO_URI);

    const count = await Startup.countDocuments();
    console.log(`\n📊 Total Startups in DB: ${count}`);

    if (count > 0) {
        const recent = await Startup.find().sort({ createdAt: -1 }).limit(5);
        console.log('\n🆕 Most Recent Startups:');
        recent.forEach(s => {
            console.log(`- [${s.source}] ${s.name} (${s.fundingAmount}) - ${s.dateAnnounced}`);
        });
    }

    await mongoose.disconnect();
}

checkDB().catch(console.error);
