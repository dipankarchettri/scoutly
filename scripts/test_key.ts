import 'dotenv/config';
import fs from 'fs';
import path from 'path';

async function testKey() {
    // Manually load .env to be sure
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf-8');
        for (const line of envConfig.split('\n')) {
            const [key, val] = line.split('=');
            if (key && val && key.trim() === 'OPENROUTER_API_KEY') {
                process.env.OPENROUTER_API_KEY = val.trim().replace(/^["']|["']$/g, ''); // Remove quotes if any
            }
        }
    }

    const key = process.env.OPENROUTER_API_KEY;
    if (!key) {
        console.error("❌ No OPENROUTER_API_KEY found in .env");
        process.exit(1);
    }
    console.log(`🔑 Testing Key from .env: ${key.substring(0, 15)}...`);

    try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${key}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "Scoutly Test"
            },
            body: JSON.stringify({
                model: "meta-llama/llama-3.1-8b-instruct",
                messages: [{ role: "user", content: "Say hello" }]
            })
        });

        if (res.ok) {
            const data = await res.json();
            console.log("✅ Success! API is working.");
            console.log("Response:", data.choices?.[0]?.message?.content);
        } else {
            console.error(`❌ Failed! Status: ${res.status}`);
            console.error(`Error Body: ${await res.text()}`);
        }
    } catch (err) {
        console.error("❌ Network Request Failed:", err);
    }
}

testKey();
