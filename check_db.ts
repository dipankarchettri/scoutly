import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Startup } from './src/models/Startup';

dotenv.config();

mongoose.connect(process.env.MONGODB_URI!)
.then(async () => {
    console.log('Connected.');
    const count = await Startup.countDocuments();
    console.log(`Total Startups: ${count}`);
    
    if (count > 0) {
        const sample = await Startup.findOne();
        console.log('Sample:', JSON.stringify(sample, null, 2));
    }
    
    // Aggregate industries
    const industries = await Startup.distinct('industry');
    console.log('Unique Industries:', industries);

    // Aggregate tags
    const tags = await Startup.distinct('tags');
    console.log('Unique Tags:', tags);

    const keywords = ['bio', 'health', 'security', 'data', 'ai', 'intelligence', 'robot', 'energy', 'finance', 'payment'];
    for (const k of keywords) {
        const c = await Startup.countDocuments({ description: { $regex: k, $options: 'i' } });
        if (c > 0) console.log(`Keyword "${k}": ${c}`);
    }
    
    process.exit(0);
})
.catch(err => console.error(err));
