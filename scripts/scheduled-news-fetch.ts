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
const { ConfigService } = await import('../services/configService');

// Define cities (matching NewsView.tsx)
const POPULAR_CITIES = [
    { label: '大多伦多 (GTA)', value: 'Toronto' },
    { label: '大温哥华 (Greater Vancouver)', value: 'Vancouver' },
    { label: '蒙特利尔 (Montreal)', value: 'Montreal' },
    { label: '卡尔加里 (Calgary)', value: 'Calgary' },
    { label: '埃德蒙顿 (Edmonton)', value: 'Edmonton' },
    { label: '滑铁卢/圭尔夫 (Waterloo/Guelph)', value: 'Waterloo' },
    { label: '温莎 (Windsor)', value: 'Windsor' },
    { label: '伦敦 (London)', value: 'London' },
];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    console.log(`[${new Date().toISOString()}] Starting scheduled news fetch...`);

    // Get latest config to ensure we respect user settings
    const config = await ConfigService.get();
    console.log(`Config loaded. Target article count: ${config.news.localArticleCount}, Retention: ${config.news.localRetentionLimit}`);

    // 1. Fetch Local News for each city
    // Stagger strategy: Process one city every 30 seconds to avoid rate limits
    for (const city of POPULAR_CITIES) {
        console.log(`Processing ${city.label}...`);
        try {
            await NewsCrawler.run(NewsCategory.LOCAL, city.value);
        } catch (error) {
            console.error(`Failed to fetch news for ${city.label}:`, error);
        }

        console.log("Waiting 30 seconds before next city...");
        await delay(30 * 1000);
    }

    // 2. Fetch other categories
    // Stagger strategy: Process one category every 60 seconds
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
        console.log("Waiting 60 seconds before next category...");
        await delay(60 * 1000);
    }

    // 3. Fetch Custom Categories
    if (config.news.customCategories && config.news.customCategories.length > 0) {
        console.log(`Processing ${config.news.customCategories.length} custom categories...`);
        for (const cat of config.news.customCategories) {
            console.log(`Processing custom category: ${cat.name} (${cat.id})...`);
            try {
                await NewsCrawler.run(cat.id);
            } catch (error) {
                console.error(`Failed to fetch news for custom category ${cat.name}:`, error);
            }
            console.log("Waiting 45 seconds before next custom category...");
            await delay(45 * 1000);
        }
    }

    console.log(`[${new Date().toISOString()}] Scheduled news fetch completed.`);
    process.exit(0);
}

main().catch((error) => {
    console.error("Fatal Error in News Fetch Script:", error);
    process.exit(1);
});
