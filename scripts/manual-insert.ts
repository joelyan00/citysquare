import { NewsCategory } from '../types';

// Polyfill environment variables
if (!process.env.API_KEY && process.env.GEMINI_API_KEY) {
    process.env.API_KEY = process.env.GEMINI_API_KEY;
}
if (!process.env.GOOGLE_SEARCH_API_KEY && process.env.API_KEY) {
    process.env.GOOGLE_SEARCH_API_KEY = process.env.API_KEY;
}

// Dynamic import
const { NewsDatabase, fetchArticleContent, generateWithRetry, cleanJsonString } = await import('../services/geminiService');

const targetUrls = [
    { url: "https://www.163.com/news/article/KGHASGGQ000189FH.html", category: NewsCategory.INTERNATIONAL },
    { url: "https://www.bbc.com/zhongwen/articles/cm20ep54395o/simp", category: NewsCategory.INTERNATIONAL }
];

async function run() {
    console.log("Starting manual insertion...");

    const itemsToSave = [];

    for (const target of targetUrls) {
        console.log(`Processing ${target.url}...`);

        // 1. Fetch Content
        const articleData = await fetchArticleContent(target.url);
        if (!articleData) {
            console.error(`Failed to fetch content for ${target.url}`);
            continue;
        }

        const fullContent = articleData.text;
        const videoUrl = articleData.videoUrl;
        console.log(`Fetched content length: ${fullContent.length}`);
        if (fullContent.length < 100) {
            console.warn("Content too short, skipping.");
            continue;
        }

        // 2. Generate Summary
        const systemInstruction = `You are a professional journalist for "City666".
        Your task is to summarize the provided news item based on its **FULL CONTENT**.
        
        INPUT: A news item with Full Content.
        OUTPUT: A JSON array containing a single news object.
    
        CRITICAL RULES:
        1. **Content Quality**: Read the **FULL CONTENT** carefully. Summarize the **MAIN EVENT** into a **SINGLE, CONCISE PARAGRAPH** (approx 150-200 Chinese characters).
        2. **Language**: ALWAYS write Title and Content in **CHINESE (Simplified)**.
        3. **Source**: Extract the source name from the content or URL.
    
        Output JSON Format:
        [{ "title": "Chinese Title", "summary": "Concise Chinese Paragraph", "content": "Concise Chinese Paragraph", "source_name": "Source" }]
        `;

        const response = await generateWithRetry("gemini-2.0-flash", {
            contents: `Here is the news item to summarize:\nContent: ${fullContent.slice(0, 8000)}`,
            config: {
                systemInstruction,
                responseMimeType: "application/json"
            }
        });

        const jsonStr = cleanJsonString(response.text || "{}");
        let aiItem;
        try {
            aiItem = JSON.parse(jsonStr);
        } catch (e) {
            console.error("JSON Parse Error", e);
            continue;
        }

        if (Array.isArray(aiItem)) aiItem = aiItem[0];

        if (!aiItem || !aiItem.title) {
            console.error("Invalid AI response:", jsonStr);
            continue;
        }

        // 3. Construct News Item
        itemsToSave.push({
            id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: aiItem.title,
            summary: aiItem.summary,
            content: aiItem.content,
            category: target.category,
            timestamp: Date.now(),
            imageUrl: undefined, // Let it be undefined or generate if needed (skipping for speed)
            source: `CitySquare 整理自 ${aiItem.source_name || '互联网'}`,
            sourceUrl: target.url,
            youtubeUrl: videoUrl,
            city: undefined
        });
    }

    if (itemsToSave.length > 0) {
        console.log(`Saving ${itemsToSave.length} items to DB...`);
        await NewsDatabase.save(itemsToSave);
        console.log("Saved!");
    } else {
        console.log("No items to save.");
    }
}

run();
