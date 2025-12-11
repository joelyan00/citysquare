import { NewsCategory } from '../types';

// Polyfill environment variables
if (!process.env.API_KEY && process.env.GEMINI_API_KEY) {
    process.env.API_KEY = process.env.GEMINI_API_KEY;
}
if (!process.env.GOOGLE_SEARCH_API_KEY && process.env.API_KEY) {
    process.env.GOOGLE_SEARCH_API_KEY = process.env.API_KEY;
}

// Dynamic import
const { NewsCrawler } = await import('../services/geminiService');

async function run() {
    console.log("Starting targeted fetch for INTERNATIONAL category...");
    await NewsCrawler.run(NewsCategory.INTERNATIONAL);
    console.log("Done.");
}

run();
