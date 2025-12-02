import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import path from 'path';

// Manually parse .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
let apiKey = '';

try {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/API_KEY=(.*)/);
    if (match) {
        apiKey = match[1].trim();
    }
} catch (e) {
    console.error("Could not read .env.local");
}

console.log(`Testing Key: ${apiKey ? (apiKey.slice(0, 4) + '...' + apiKey.slice(-4)) : 'MISSING'}`);

if (!apiKey) {
    console.error("No API Key found. Exiting.");
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function run() {
    try {
        console.log("Fetching models via REST API (v1)...");
        const url = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.models) {
            console.log("Models found in v1:", data.models.length);
            const geminiModels = data.models.filter(m => m.name.includes('gemini')).map(m => m.name);
            console.log("Gemini Models (v1):", JSON.stringify(geminiModels, null, 2));
        } else {
            console.log("No models property in v1 response:", JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error("Error fetching models:", e.message);
    }
}

run();
