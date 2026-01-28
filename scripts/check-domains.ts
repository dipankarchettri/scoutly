
import mongoose from 'mongoose';
import { Startup } from '../src/models/Startup';
import 'dotenv/config';

async function checkDomains() {
    console.log('📊 Analyzing Industry Domains...');

    const MONGO_URI = process.env.MONGODB_URI;
    if (!MONGO_URI) {
        throw new Error('MONGODB_URI not defined');
    }

    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const total = await Startup.countDocuments();
        console.log(`Summary: ${total} total startups in database.\n`);

        const distribution = await Startup.aggregate([
            {
                $group: {
                    _id: { $ifNull: ["$industry", "Uncategorized"] },
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        const fs = await import('fs');
        const path = await import('path');

        let output = `Summary: ${total} total startups in database.\n\n--- Domain Breakdown ---\n`;
        distribution.forEach(d => {
            output += `${d._id}: ${d.count}\n`;
        });

        console.log(output);
        fs.writeFileSync(path.join(process.cwd(), 'domain_stats.txt'), output);


    } catch (error) {
        console.error("Error:", error);
    } finally {
        await mongoose.disconnect();
    }
}

checkDomains();
