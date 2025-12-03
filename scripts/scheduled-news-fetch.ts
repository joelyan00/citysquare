import { NewsCategory } from '../types';

// Polyfill environment variables to match vite.config.ts logic
if (!process.env.API_KEY && process.env.GEMINI_API_KEY) {
    process.env.API_KEY = process.env.GEMINI_API_KEY;
}
if (!process.env.GOOGLE_SEARCH_API_KEY && process.env.API_KEY) {
    process.env.GOOGLE_SEARCH_API_KEY = process.env.API_KEY;
}

// Dynamic import to ensure env vars are set before service initialization
const { NewsCrawler } = await import('../services/geminiService');

// Define cities (matching NewsView.tsx)
const POPULAR_CITIES = [
    { label: '大多伦多 (Toronto)', value: 'Toronto' },
    { label: '温哥华 (Vancouver)', value: 'Vancouver' },
    { label: '蒙特利尔 (Montreal)', value: 'Montreal' },
    { label: '卡尔加里 (Calgary)', value: 'Calgary' },
    { label: '埃德蒙顿 (Edmonton)', value: 'Edmonton' },
    { label: '滑铁卢 (Waterloo)', value: 'Waterloo' },
    { label: '温莎 (Windsor)', value: 'Windsor' },
    { label: '伦敦 (London)', value: 'London' },
];

async function main() {
    console.log(`[${new Date().toISOString()}] Starting scheduled news fetch...`);

    // 1. Fetch Local News for each city
    for (const city of POPULAR_CITIES) {
        console.log(`Processing ${city.label}...`);
        try {
            // We use run() which fetches and saves. 
            // Note: run() does NOT check shouldUpdate internally, it just runs.
            // The check is done by the caller (NewsView). 
            // Here we assume the scheduler (cron) determines when to run this script.
            await NewsCrawler.run(NewsCategory.LOCAL, city.value);
        } catch (error) {
            console.error(`Failed to fetch news for ${city.label}:`, error);
        }
    }

    // 2. Fetch other categories
    const otherCategories = [
        NewsCategory.CANADA,
        NewsCategory.USA,
        NewsCategory.CHINA,
        NewsCategory.INTERNATIONAL
    ];

    for (const category of otherCategories) {
        console.log(`Processing category: ${category}...`);
        try {
            await NewsCrawler.run(category);
        } catch (error) {
            console.error(`Failed to fetch news for ${category}:`, error);
        }
    }

    // 3. Fetch Custom Categories
    const { ConfigService } = await import('../services/configService');
    const config = await ConfigService.get();

    if (config.news.customCategories && config.news.customCategories.length > 0) {
        console.log(`Processing ${config.news.customCategories.length} custom categories...`);
        for (const cat of config.news.customCategories) {
            console.log(`Processing custom category: ${cat.name} (${cat.id})...`);
            try {
                await NewsCrawler.run(cat.id);
            } catch (error) {
                console.error(`Failed to fetch news for custom category ${cat.name}:`, error);
            }
        }
    }

    console.log(`[${new Date().toISOString()}] Scheduled news fetch completed.`);
    process.exit(0);
}

main().catch((error) => {
    console.error("Fatal Error in News Fetch Script:", error);
    process.exit(1);
});
