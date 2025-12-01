import { GoogleGenAI, Type } from "@google/genai";
import { NewsCategory, NewsItem, ForumPost, AdItem } from "../types";
import { supabase, supabaseUrl } from "./supabaseClient";
import { ConfigService } from "./configService";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Helper to map DB snake_case to Frontend camelCase
const fromDbSchema = (item: any): NewsItem => ({
  id: item.id,
  title: item.title,
  summary: item.summary,
  content: item.content,
  category: item.category,
  timestamp: item.timestamp,
  imageUrl: item.image_url || item.imageUrl,
  source: item.source,
  sourceUrl: item.source_url || item.sourceUrl,
  youtubeUrl: item.youtube_url || item.youtubeUrl,
  city: item.city
});

// Helper to map Frontend camelCase to DB snake_case
const toDbSchema = (item: NewsItem) => ({
  id: item.id,
  title: item.title,
  summary: item.summary,
  content: item.content,
  category: item.category,
  timestamp: item.timestamp,
  image_url: item.imageUrl,
  source: item.source,
  source_url: item.sourceUrl,
  youtube_url: item.youtubeUrl,
  city: item.city
});

// Enhanced cleanJsonString to be more robust
const cleanJsonString = (str: string) => {
  if (!str) return "[]";
  let cleaned = str.replace(/^```json\s*/g, '').replace(/^```\s*/g, '').replace(/```$/g, '').trim();
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    return cleaned.substring(firstBracket, lastBracket + 1);
  }
  return "[]";
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isValidUrl = (urlString: string) => {
  try {
    return Boolean(new URL(urlString));
  }
  catch (e) {
    return false;
  }
};

const base64ToBlob = (base64Data: string): Blob => {
  const arr = base64Data.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};

// Retry Helper
const generateWithRetry = async (model: string, params: any, retries = 3) => {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      return await ai.models.generateContent({ model, ...params });
    } catch (error: any) {
      lastError = error;
      console.warn(`Gemini API Attempt ${i + 1} failed:`, error.message || error);
      if (i < retries - 1) await delay(1000 * (i + 1));
    }
  }
  throw lastError;
};

export const getCityNameFromCoordinates = async (lat: number, lon: number): Promise<string> => {
  if (!apiKey) return "本地";

  try {
    const response = await generateWithRetry("gemini-2.5-flash", {
      contents: `What city is at latitude ${lat} and longitude ${lon}? Return ONLY the city name in Chinese (Simplified). Do not include 'City' or 'Shi' suffix if natural. e.g. 'Beijing', 'Toronto'.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            city: { type: Type.STRING, description: "City name in Chinese" }
          }
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    return data.city || "本地";
  } catch (error) {
    console.error("City Resolve Error:", error);
    return "本地";
  }
};

export const uploadImageToSupabase = async (base64Data: string, filename: string): Promise<string | null> => {
  try {
    if (!supabaseUrl || supabaseUrl.includes('placeholder')) return null;

    // Use manual conversion instead of fetch
    const blob = base64ToBlob(base64Data);

    const { data, error } = await supabase.storage.from('urbanhub_assets').upload(filename, blob, {
      contentType: blob.type,
      upsert: true
    });

    if (error) {
      console.error("Storage Upload Error:", error);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage.from('urbanhub_assets').getPublicUrl(filename);
    return publicUrl;
  } catch (e) {
    console.error("Image Process/Upload Exception:", e);
    return null;
  }
};

export const uploadImageToImgur = async (file: Blob | File): Promise<string | null> => {
  const CLIENT_ID = 'd3372338634d00e'; // Public Demo Client ID. Replace with your own if needed.

  try {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: {
        Authorization: `Client-ID ${CLIENT_ID}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (data.success) {
      return data.data.link;
    } else {
      console.error('Imgur Upload Failed:', data);
      return null;
    }
  } catch (error) {
    console.error('Imgur Upload Error:', error);
    return null;
  }
};

const generateNewsImage = async (headline: string, category: string): Promise<string | undefined> => {
  if (!apiKey) return undefined;

  let visualContext = "";
  if ([NewsCategory.USA, NewsCategory.CANADA, NewsCategory.INTERNATIONAL].includes(category as any)) {
    visualContext = "Setting is Western/International. Any visible text, street signs, or banners in the image MUST be in ENGLISH or the local language. STRICTLY NO CHINESE CHARACTERS in the image.";
  } else if (category === NewsCategory.CHINA) {
    visualContext = "Setting is China. Visuals should reflect authentic Chinese street/environment.";
  }

  try {
    const response = await generateWithRetry('imagen-3.0-generate-001', {
      contents: {
        parts: [{
          text: `Create a highly realistic, editorial-style news photography for the headline: "${headline}". 
      ${visualContext}
      The image should capture the essence of the event. NO COLLAGE. Photorealistic style.` }]
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
  } catch (error) {
    console.warn("Image generation failed:", error);
  }
  return undefined;
};

export const fetchNewsFromAI = async (category: string, context?: string): Promise<NewsItem[]> => {
  if (!apiKey) {
    console.warn("No API Key");
    return [];
  }

  const config = await ConfigService.get();

  let topic = category;
  let articleCount = config.news.globalArticleCount || 8;
  let timeWindow = config.news.globalTimeWindow || "24 hours";
  let keywords = config.news.extraKeywords || "";

  // Check if it's a known static category
  if (category === NewsCategory.LOCAL) {
    topic = context && context !== '本地' ? context : '您所在的城市';
    articleCount = config.news.localArticleCount || 15;
    timeWindow = config.news.localTimeWindow || "48 hours";
  } else if (category === NewsCategory.CANADA) {
    topic = 'Canada';
    articleCount = config.news.canadaArticleCount || 10;
    timeWindow = config.news.canadaTimeWindow || "24 hours";
    if (config.news.canadaKeywords) keywords = config.news.canadaKeywords;
  } else if (category === NewsCategory.USA) {
    topic = 'United States';
    articleCount = config.news.usaArticleCount || 10;
    timeWindow = config.news.usaTimeWindow || "24 hours";
    if (config.news.usaKeywords) keywords = config.news.usaKeywords;
  } else if (category === NewsCategory.CHINA) {
    topic = 'China';
    articleCount = config.news.chinaArticleCount || 10;
    timeWindow = config.news.chinaTimeWindow || "24 hours";
  } else if (category === NewsCategory.INTERNATIONAL) {
    topic = 'Global International News';
    articleCount = config.news.intlArticleCount || 8;
    timeWindow = config.news.intlTimeWindow || "48 hours";
  } else {
    // Check Custom Categories
    const customCat = config.news.customCategories?.find(c => c.id === category);
    if (customCat) {
      topic = customCat.topic;
      articleCount = customCat.articleCount || 10;
      timeWindow = customCat.timeWindow || "24 hours";
      if (customCat.keywords) keywords = `${keywords}, ${customCat.keywords}`;
    }
  }

  // Add Authoritative Sources to Keywords
  if (category === NewsCategory.CANADA) {
    keywords += ", CTV News, CBC, Global News, CP24";
  } else if (category === NewsCategory.USA) {
    keywords += ", CNN, NBC News, New York Times, Washington Post";
  } else if (category === NewsCategory.INTERNATIONAL) {
    keywords += ", CNN, BBC, Reuters, AP News";
  }

  const systemInstruction = `You are a professional journalist for "City666".
  Your task is to search for real-time news about "${topic}".
  Time Window: Past ${timeWindow}.
  Article Count: Try to find ${articleCount} items.
  Keywords to focus on: ${keywords}.
  
  For LOCAL news, you MUST search for "Official City Hall Announcements" for ${topic} and include them.
  
  CRITICAL FOR LOCAL NEWS:
  - The news MUST be specifically about "${topic}".
  - Do NOT include general national news (e.g. Federal Customs, National Holidays) unless it specifically mentions "${topic}".
  - Do NOT include international news.
  - If you cannot find enough specific local news, return fewer items. Quality > Quantity.

  AUTHORITATIVE SOURCES PRIORITY:
  - For Canada: Prioritize CTV, CBC, Global News.
  - For USA: Prioritize CNN, NBC, NYT.
  - For International: Prioritize CNN, BBC, Reuters.
  - Always try to find the original report from these major outlets.

  Step 1: SEARCH for trending news URLs first.
  Step 2: SELECT unique, diverse stories (Sports, Politics, Tech, Heartwarming, Official Notices).
  Step 3: Write a deep, narrative article (4 paragraphs) for each item.
       - **FORMAT REQUIREMENT**: Start the content with "据 [Source Name] 报道，".
       - Paragraph 1: The Core Event (What happened, Who, When, Where).
       - Paragraph 2: Background & Context (History, causes, detailed process).
       - Paragraph 3: Viewpoints & Analysis (Naturally integrate expert opinions, quotes, or public sentiment/analysis).
       - Paragraph 4: Impact & Future (Consequences, potential impact).
       - **ENDING REQUIREMENT**: Append the source link at the very end of the content in this format: "(Link: [Source URL])".
    
  IMPORTANT:
  - Do NOT use labels like [Time], [Location], **Title**.
  - Write naturally in CHINESE (Simplified).
  - Keep proper nouns (People names, City names, Street names) in ORIGINAL English (or local language) where appropriate for clarity.
  - "source_name" must be the specific publisher (e.g. 'The Star', 'BBC').
  - "source_url" MUST be a direct deep link to the specific news article found in search, NOT a home page.
  
  Output JSON Array:
  [{ "title": "", "summary": "", "content": "", "source_name": "", "source_url": "", "image_url": "URL of the actual news image if found", "youtube_url": "" }]
  
  CRITICAL INSTRUCTIONS FOR MEDIA:
  1. IMAGES: You MUST try to extract the actual lead image URL from the search result. If found, put it in "image_url".
  2. NO AI IMAGES: If no real image URL is found in the search results, leave "image_url" EMPTY (""). Do NOT invent URLs. Do NOT describe an image for generation.
  3. YOUTUBE: If the news is related to a video or has a YouTube video, find the YouTube link and put it in "youtube_url".
  4. DUPLICATES: Do not generate multiple items for the exact same story.
  5. LINKS: If the news involves an application, registration, or official document, YOU MUST include the direct URL in the content (e.g. "Official Application Link: [URL]").`;

  try {
    const searchContext = `Search for trending news about "${topic}" in the last ${timeWindow}. Focus on: ${keywords}. Return ${articleCount} items.`;

    const response = await generateWithRetry("gemini-2.5-flash", {
      contents: searchContext,
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }]
      }
    });

    const jsonStr = cleanJsonString(response.text || "[]");
    let items: any[] = [];

    try {
      items = JSON.parse(jsonStr);
    } catch (e) {
      console.error("JSON Parse Error", e);
      return [];
    }

    if (!Array.isArray(items)) return [];

    const finalItems: NewsItem[] = [];

    for (const [index, item] of items.entries()) {
      if (!item) continue;

      // Image generation logic
      let imageUrl = item.image_url && isValidUrl(item.image_url) ? item.image_url : undefined;

      if (!imageUrl) {
        // Fallback to AI Image Generation + Imgur Upload
        try {
          console.log(`Generating AI image for: ${item.title}`);
          const base64Image = await generateNewsImage(item.title, category);
          if (base64Image) {
            // Convert Base64 to Blob
            const blob = base64ToBlob(base64Image);
            // Upload to Imgur
            const imgurLink = await uploadImageToImgur(blob);
            if (imgurLink) {
              imageUrl = imgurLink;
              console.log(`AI Image uploaded to Imgur: ${imgurLink}`);
            }
          }
        } catch (err) {
          console.error("Failed to generate/upload AI image:", err);
        }
      }

      // Clean URL
      let sourceUrl = isValidUrl(item.source_url) ? item.source_url : undefined;
      if (sourceUrl) sourceUrl = sourceUrl.trim();

      finalItems.push({
        id: `news-${category}-${Date.now()}-${index}`,
        title: item.title,
        summary: item.summary,
        content: item.content,
        category,
        timestamp: Date.now(),
        imageUrl: imageUrl,
        source: `CitySquare 整理自 ${item.source_name || '互联网'}`,
        sourceUrl: sourceUrl,
        youtubeUrl: item.youtube_url,
        city: category === NewsCategory.LOCAL ? context : undefined
      });
    }

    return finalItems;

  } catch (error) {
    console.error("Gemini News Error:", error);
    return [];
  }
};

export const NewsDatabase = {
  getNewsContent: async (id: string): Promise<string | null> => {
    if (!supabaseUrl) return null;
    const { data } = await supabase
      .from('news')
      .select('content')
      .eq('id', id)
      .maybeSingle();
    return data?.content || null;
  },

  getByCategory: async (category: string, city?: string): Promise<NewsItem[]> => {
    if (!supabaseUrl) return [];

    // Get Limit from Config
    const config = await ConfigService.get();
    let limit = 50;

    if (Object.values(NewsCategory).includes(category as NewsCategory)) {
      switch (category) {
        case NewsCategory.LOCAL: limit = config.news.localRetentionLimit || 50; break;
        case NewsCategory.CANADA: limit = config.news.canadaRetentionLimit || 50; break;
        case NewsCategory.USA: limit = config.news.usaRetentionLimit || 50; break;
        case NewsCategory.CHINA: limit = config.news.chinaRetentionLimit || 50; break;
        case NewsCategory.INTERNATIONAL: limit = config.news.intlRetentionLimit || 50; break;
      }
    } else {
      // Custom Category Limit
      const customCat = config.news.customCategories?.find(c => c.id === category);
      if (customCat) limit = customCat.retentionLimit || 50;
    }

    let query = supabase
      .from('news')
      .select('id, title, summary, category, timestamp, image_url, source, source_url, youtube_url, city')
      .eq('category', category);

    if (category === NewsCategory.LOCAL && city && city !== '本地') {
      query = query.eq('city', city);
    }

    const { data, error } = await query
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Supabase Read Error", error);
      return [];
    }
    return (data || []).map(fromDbSchema);
  },

  save: async (newItems: NewsItem[]) => {
    if (!supabaseUrl || newItems.length === 0) return;

    // 1. Deduplication: Fetch recent titles
    const category = newItems[0].category;
    const { data: existingPosts } = await supabase
      .from('news')
      .select('title')
      .eq('category', category)
      .order('timestamp', { ascending: false })
      .limit(100);

    const existingTitles = new Set((existingPosts || []).map(p => p.title));

    // 2. Filter out duplicates (Exact Title Match)
    const uniqueItems = newItems.filter(item => !existingTitles.has(item.title));

    if (uniqueItems.length === 0) {
      console.log(`[NewsDatabase] All ${newItems.length} items were duplicates. Skipping.`);
      return;
    }

    console.log(`[NewsDatabase] Saving ${uniqueItems.length} new items (filtered from ${newItems.length})`);

    const dbItems = uniqueItems.map(toDbSchema);

    // Upsert items
    const { error } = await supabase.from('news').upsert(dbItems);

    if (error) {
      console.error("Supabase Save Error:", JSON.stringify(error, null, 2));
    } else {
      // Retention Logic: Delete items exceeding the limit
      await NewsDatabase.enforceRetention(category);
    }
  },

  enforceRetention: async (category: string) => {
    const config = await ConfigService.get();
    let limit = 50;

    if (Object.values(NewsCategory).includes(category as NewsCategory)) {
      switch (category) {
        case NewsCategory.LOCAL: limit = config.news.localRetentionLimit || 50; break;
        case NewsCategory.CANADA: limit = config.news.canadaRetentionLimit || 50; break;
        case NewsCategory.USA: limit = config.news.usaRetentionLimit || 50; break;
        case NewsCategory.CHINA: limit = config.news.chinaRetentionLimit || 50; break;
        case NewsCategory.INTERNATIONAL: limit = config.news.intlRetentionLimit || 50; break;
      }
    } else {
      const customCat = config.news.customCategories?.find(c => c.id === category);
      if (customCat) limit = customCat.retentionLimit || 50;
    }

    // Get IDs of latest N items
    const { data: keepIds } = await supabase
      .from('news')
      .select('id')
      .eq('category', category)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (keepIds && keepIds.length > 0) {
      const idsToKeep = keepIds.map(k => k.id);
      // Delete items NOT in the keep list
      await supabase.from('news').delete().eq('category', category).not('id', 'in', `(${idsToKeep.join(',')})`);
    }
  },

  getLastUpdateTime: async (category: string): Promise<number> => {
    if (!supabaseUrl) return 0;
    const { data } = await supabase
      .from('news')
      .select('timestamp')
      .eq('category', category)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.timestamp || 0;
  },

  clearAll: async () => {
    if (!supabaseUrl) return;
    await supabase.from('news').delete().neq('id', '0'); // Delete all
  }
};

export const NewsCrawler = {
  init: async () => {
    console.log("News Crawler initialized");
    // Background loop check every minute
    setInterval(() => {
      // ... (Optional background check logic)
    }, 60000);
  },

  shouldUpdate: async (category: string): Promise<boolean> => {
    const lastUpdate = await NewsDatabase.getLastUpdateTime(category);
    const now = Date.now();
    const config = await ConfigService.get();

    let intervalMinutes = 120; // Default 2 hours

    if (Object.values(NewsCategory).includes(category as NewsCategory)) {
      switch (category) {
        case NewsCategory.LOCAL: intervalMinutes = config.news.localRefreshInterval || 720; break;
        case NewsCategory.CANADA: intervalMinutes = config.news.canadaRefreshInterval || 120; break;
        case NewsCategory.USA: intervalMinutes = config.news.usaRefreshInterval || 120; break;
        case NewsCategory.CHINA: intervalMinutes = config.news.chinaRefreshInterval || 720; break;
        case NewsCategory.INTERNATIONAL: intervalMinutes = config.news.intlRefreshInterval || 120; break;
      }
    } else {
      const customCat = config.news.customCategories?.find(c => c.id === category);
      if (customCat) intervalMinutes = customCat.refreshInterval || 120;
    }

    const intervalMs = intervalMinutes * 60 * 1000;
    return (now - lastUpdate) > intervalMs;
  },

  run: async (category: string, context?: string) => {
    console.log(`Crawler running for ${category}...`);
    const news = await fetchNewsFromAI(category, context);
    if (news.length > 0) {
      await NewsDatabase.save(news);
      window.dispatchEvent(new Event('NEWS_DB_UPDATED'));
    }
  },

  forceRefresh: async (category: string, context?: string) => {
    console.log(`Force refresh for ${category}`);
    await NewsCrawler.run(category, context);
  }
};

// Forum Services
export const generateTrendingTopic = async (): Promise<ForumPost | null> => {
  if (!apiKey) return null;

  const config = await ConfigService.get();

  // Parse lists
  const categories = config.forum.categories.split(',').map(s => s.trim());
  const qTypes = config.forum.questionTypes.split(',').map(s => s.trim());

  // Random selection
  const selectedCat = categories[Math.floor(Math.random() * categories.length)] || "社会热点";
  const selectedType = qTypes[Math.floor(Math.random() * qTypes.length)] || "理性讨论";

  console.log(`[City666 Forum] Generating topic: Cat="${selectedCat}", Style="${selectedType}"`);

  try {
    const response = await generateWithRetry("gemini-2.5-flash", {
      contents: `Generate a trending forum topic. 
      Topic Category: ${selectedCat}. 
      Question Style: ${selectedType}. 
      Keywords: ${config.forum.topicKeywords}.
      Language: Chinese (Simplified).`,
      config: {
        systemInstruction: "You are 'City666 话题君', a community manager. Generate a simplified JSON object.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });

    const item = JSON.parse(response.text || "{}");
    if (!item.title) return null;

    const post: ForumPost = {
      id: `topic-${Date.now()}`,
      title: item.title,
      content: item.content,
      author: "City666 话题君",
      likes: Math.floor(Math.random() * 50) + 10,
      comments: Math.floor(Math.random() * 20),
      timestamp: Date.now(),
      isAiGenerated: true,
      tags: item.tags || ["热门"]
    };

    await ForumDatabase.save(post);
    return post;

  } catch (error) {
    console.error("Gemini Forum Error:", error);
    return null;
  }
};

export const ForumDatabase = {
  getPosts: async (): Promise<ForumPost[]> => {
    if (!supabaseUrl) return [];
    const { data } = await supabase.from('forum').select('*').order('timestamp', { ascending: false }).limit(50);
    return (data || []).map(item => ({
      id: item.id,
      title: item.title,
      content: item.content,
      author: item.author,
      likes: item.likes,
      comments: item.comments,
      timestamp: item.timestamp,
      isAiGenerated: item.is_ai_generated,
      tags: item.tags || [],
      images: item.images || [],
      videoUrl: item.video_url
    }));
  },
  save: async (post: ForumPost) => {
    if (!supabaseUrl) return;
    await supabase.from('forum').upsert({
      id: post.id,
      title: post.title,
      content: post.content,
      author: post.author,
      likes: post.likes,
      comments: post.comments,
      timestamp: post.timestamp,
      is_ai_generated: post.isAiGenerated,
      tags: post.tags,
      images: post.images,
      video_url: post.videoUrl
    });
  },
  getLastUpdateTime: async (): Promise<number> => {
    const { data } = await supabase.from('forum').select('timestamp').order('timestamp', { ascending: false }).limit(1).maybeSingle();
    return data?.timestamp || 0;
  },
  clearAll: async () => {
    if (!supabaseUrl) return;
    await supabase.from('forum').delete().neq('id', '0');
  },

  // Comment Methods
  addComment: async (postId: string, comment: any) => {
    if (!supabaseUrl) return;

    // 1. Insert Comment
    const { error } = await supabase.from('forum_comments').insert({
      id: comment.id,
      post_id: postId,
      author: comment.author,
      content: comment.content,
      likes: comment.likes,
      timestamp: comment.timestamp
    });

    if (error) {
      console.error("Failed to add comment:", error);
      throw error;
    }

    // 2. Increment Comment Count on Post
    // Note: This is a simple increment. For strict consistency, use an RPC or trigger.
    // But for this demo, fetching and updating is acceptable or just incrementing.
    // Supabase doesn't have a direct 'increment' atomic operator in JS client without RPC.
    // We will read, increment, write for simplicity, or just let the UI handle the count optimistically 
    // and the DB count be updated on next fetch if we had a count trigger.
    // Let's just update the count manually.
    const { data: post } = await supabase.from('forum').select('comments').eq('id', postId).maybeSingle();
    if (post) {
      await supabase.from('forum').update({ comments: (post.comments || 0) + 1 }).eq('id', postId);
    }
  },

  getCommentsByPostId: async (postId: string): Promise<any[]> => {
    if (!supabaseUrl) return [];
    const { data } = await supabase
      .from('forum_comments')
      .select('*')
      .eq('post_id', postId)
      .order('timestamp', { ascending: true });

    return (data || []).map(item => ({
      id: item.id,
      author: item.author,
      content: item.content,
      timestamp: item.timestamp,
      likes: item.likes
    }));
  },

  // Following Methods
  followUser: async (followedName: string) => {
    if (!supabaseUrl) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('user_follows').insert({
      follower_id: user.id,
      followed_name: followedName
    });
  },

  unfollowUser: async (followedName: string) => {
    if (!supabaseUrl) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('user_follows').delete()
      .eq('follower_id', user.id)
      .eq('followed_name', followedName);
  },

  getFollowedNames: async (): Promise<string[]> => {
    if (!supabaseUrl) return [];
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data } = await supabase.from('user_follows')
      .select('followed_name')
      .eq('follower_id', user.id);

    return (data || []).map(d => d.followed_name);
  },

  getFollowedPosts: async (): Promise<ForumPost[]> => {
    if (!supabaseUrl) return [];
    const followedNames = await ForumDatabase.getFollowedNames();
    if (followedNames.length === 0) return [];

    // 1. Get posts authored by followed users
    const { data: postsData } = await supabase.from('forum')
      .select('*')
      .in('author', followedNames)
      .order('timestamp', { ascending: false })
      .limit(50);

    // 2. Get posts commented on by followed users
    // First get the comments
    const { data: commentsData } = await supabase.from('forum_comments')
      .select('post_id')
      .in('author', followedNames)
      .order('timestamp', { ascending: false })
      .limit(50);

    const commentedPostIds = [...new Set((commentsData || []).map(c => c.post_id))];

    let commentedPosts: any[] = [];
    if (commentedPostIds.length > 0) {
      const { data } = await supabase.from('forum')
        .select('*')
        .in('id', commentedPostIds);
      commentedPosts = data || [];
    }

    // Merge and Deduplicate
    const allPosts = [...(postsData || []), ...commentedPosts];
    const uniquePosts = Array.from(new Map(allPosts.map(item => [item.id, item])).values());

    // Sort by timestamp descending
    uniquePosts.sort((a, b) => b.timestamp - a.timestamp);

    return uniquePosts.map(item => ({
      id: item.id,
      title: item.title,
      content: item.content,
      author: item.author,
      likes: item.likes,
      comments: item.comments,
      timestamp: item.timestamp,
      isAiGenerated: item.is_ai_generated,
      tags: item.tags || [],
      images: item.images || [],
      videoUrl: item.video_url
    }));
  },
  getPostsByAuthor: async (authorName: string): Promise<ForumPost[]> => {
    if (!supabaseUrl) return [];
    const { data } = await supabase
      .from('forum')
      .select('*')
      .eq('author', authorName)
      .order('timestamp', { ascending: false });

    return (data || []).map(item => ({
      id: item.id,
      title: item.title,
      content: item.content,
      author: item.author,
      likes: item.likes,
      comments: item.comments,
      timestamp: item.timestamp,
      isAiGenerated: item.is_ai_generated,
      tags: item.tags || [],
      images: item.images || [],
      videoUrl: item.video_url
    }));
  }
};

export const ForumCrawler = {
  init: async () => {
    setInterval(async () => {
      const config = await ConfigService.get();
      const lastUpdate = await ForumDatabase.getLastUpdateTime();
      const interval = (config.forum.generateInterval || 60) * 60 * 1000;
      if (Date.now() - lastUpdate > interval) {
        console.log("Auto-generating forum topic...");
        await generateTrendingTopic();
        window.dispatchEvent(new Event('FORUM_DB_UPDATED'));
      }
    }, 60000);
  }
};

// Ad Services
export const AdDatabase = {
  saveAd: async (ad: AdItem) => {
    if (!supabaseUrl) return;
    await supabase.from('ads').insert({
      title: ad.title,
      content: ad.content,
      raw_content: ad.rawContent,
      image_url: ad.imageUrl,
      contact_info: ad.contactInfo,
      link_url: ad.linkUrl,
      scope: ad.scope,
      duration_days: ad.durationDays,
      price_total: ad.priceTotal,
      status: 'pending', // Default to pending
      start_date: new Date().toISOString()
    });
  },
  getActiveAds: async (): Promise<AdItem[]> => {
    if (!supabaseUrl) return [];
    // For demo, we fetch all 'pending' or 'active' ads
    const { data } = await supabase.from('ads').select('*').order('created_at', { ascending: false });
    return (data || []).map(item => ({
      id: item.id,
      title: item.title,
      content: item.content,
      rawContent: item.raw_content,
      imageUrl: item.image_url,
      contactInfo: item.contact_info,
      scope: item.scope,
      durationDays: item.duration_days,
      priceTotal: item.price_total,
      status: item.status
    }));
  }
};

export const generateAdCopy = async (rawText: string, productName: string) => {
  if (!apiKey) return { title: productName, content: rawText };
  try {
    const response = await generateWithRetry("gemini-2.5-flash", {
      contents: `Refine this ad content for "${productName}". 
       Original: "${rawText}". 
       Goal: Make it catchy, professional, and persuasive.
       Output JSON: { "title": "Catchy Headline", "content": "Polished text" }`,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "{}");
  } catch (e) {
    return { title: productName, content: rawText };
  }
};

export const polishText = async (text: string): Promise<string> => {
  if (!apiKey) return text;
  try {
    const response = await generateWithRetry("gemini-2.5-flash", {
      contents: `You are a professional editor. Your task is to polish the following text to make it more engaging, professional, and grammatically correct.
      
      CRITICAL INSTRUCTION:
      - You MUST output the result in the SAME LANGUAGE as the input text.
      - Do NOT translate the text.
      - If the input is Chinese, output Chinese.
      - If the input is English, output English.
      
      Original Text:
      ${text}`,
      config: {
        responseMimeType: "text/plain"
      }
    });
    return response.text?.trim() || text;
  } catch (e) {
    console.error("Polish Text Error:", e);
    return text;
  }
};

export const AdminDatabase = {
  getUsers: async (): Promise<any[]> => {
    if (!supabaseUrl) return [];
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Get Users Error:', error);
      return [];
    }
    return data || [];
  },

  updateUserRole: async (userId: string, role: string): Promise<boolean> => {
    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId);
    return !error;
  },

  deletePost: async (postId: string): Promise<boolean> => {
    const { error } = await supabase
      .from('forum')
      .delete()
      .eq('id', postId);
    return !error;
  },

  getPendingServices: async (): Promise<any[]> => {
    // For demo, returning all services
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .order('created_at', { ascending: false });
    return data || [];
  },

  getPendingAds: async (): Promise<any[]> => {
    if (!supabaseUrl) return [];
    const { data, error } = await supabase
      .from('ads')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Get Pending Ads Error:', error);
      return [];
    }

    return (data || []).map(item => ({
      id: item.id,
      title: item.title,
      content: item.content,
      rawContent: item.raw_content,
      imageUrl: item.image_url,
      contactInfo: item.contact_info,
      scope: item.scope,
      durationDays: item.duration_days,
      priceTotal: item.price_total,
      status: item.status
    }));
  },

  approveAd: async (adId: string): Promise<boolean> => {
    const { error } = await supabase
      .from('ads')
      .update({ status: 'active' })
      .eq('id', adId);
    return !error;
  },

  rejectAd: async (adId: string, reason: string): Promise<boolean> => {
    const { error } = await supabase
      .from('ads')
      .update({
        status: 'rejected',
        rejection_reason: reason
      })
      .eq('id', adId);
    return !error;
  },

  approveService: async (serviceId: string): Promise<boolean> => {
    // Placeholder: In real app, update status column
    return true;
  }
};
