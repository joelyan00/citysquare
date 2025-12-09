import { GoogleGenAI, Type } from "@google/genai";
import { NewsCategory, NewsItem, ForumPost, AdItem } from "../types";
import { supabase, supabaseUrl } from "./supabaseClient";
import { ConfigService } from "./configService";
import { GoogleSearchService } from "./googleSearchService";

const apiKey = process.env.API_KEY || '';
console.log(`[GeminiService] Initializing with Key: ${apiKey ? (apiKey.slice(0, 4) + '...' + apiKey.slice(-4)) : 'MISSING'}`);
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

// City Mapping Configuration
const CITY_CATEGORY_MAP: Record<string, NewsCategory> = {
  // GTA
  'Toronto': NewsCategory.GTA,
  'GTA': NewsCategory.GTA,
  'Greater Toronto Area': NewsCategory.GTA,
  '大多伦多': NewsCategory.GTA,
  '多伦多': NewsCategory.GTA,
  'Markham': NewsCategory.GTA,
  'Richmond Hill': NewsCategory.GTA,
  'Mississauga': NewsCategory.GTA,
  'Brampton': NewsCategory.GTA,
  'Vaughan': NewsCategory.GTA,
  'Oakville': NewsCategory.GTA,
  'Burlington': NewsCategory.GTA,
  'Pickering': NewsCategory.GTA,
  'Ajax': NewsCategory.GTA,
  'Whitby': NewsCategory.GTA,
  'Oshawa': NewsCategory.GTA,
  'Newmarket': NewsCategory.GTA,
  'York': NewsCategory.GTA,
  'Peel': NewsCategory.GTA,
  'Durham': NewsCategory.GTA,
  'Halton': NewsCategory.GTA,
  '万锦': NewsCategory.GTA,
  '列治文山': NewsCategory.GTA,
  '密西沙加': NewsCategory.GTA,
  '宾顿': NewsCategory.GTA,
  '旺市': NewsCategory.GTA,
  '奥克维尔': NewsCategory.GTA,
  '伯灵顿': NewsCategory.GTA,
  '皮克灵': NewsCategory.GTA,
  '阿贾克斯': NewsCategory.GTA,
  '惠特比': NewsCategory.GTA,
  '奥沙瓦': NewsCategory.GTA,
  '纽马克特': NewsCategory.GTA,

  // Vancouver
  'Vancouver': NewsCategory.VANCOUVER,
  '温哥华': NewsCategory.VANCOUVER,
  'Richmond': NewsCategory.VANCOUVER,
  'Burnaby': NewsCategory.VANCOUVER,
  'Surrey': NewsCategory.VANCOUVER,
  'Coquitlam': NewsCategory.VANCOUVER,
  'West Vancouver': NewsCategory.VANCOUVER,
  'North Vancouver': NewsCategory.VANCOUVER,
  'Delta': NewsCategory.VANCOUVER,
  'Langley': NewsCategory.VANCOUVER,
  'White Rock': NewsCategory.VANCOUVER,
  '列治文': NewsCategory.VANCOUVER,
  '本拿比': NewsCategory.VANCOUVER,
  '素里': NewsCategory.VANCOUVER,
  '高贵林': NewsCategory.VANCOUVER,
  '西温': NewsCategory.VANCOUVER,
  '北温': NewsCategory.VANCOUVER,
  '三角洲': NewsCategory.VANCOUVER,
  '兰里': NewsCategory.VANCOUVER,
  '白石': NewsCategory.VANCOUVER,

  // Montreal
  'Montreal': NewsCategory.MONTREAL,
  '蒙特利尔': NewsCategory.MONTREAL,

  // Calgary
  'Calgary': NewsCategory.CALGARY,
  '卡尔加里': NewsCategory.CALGARY,

  // Edmonton
  'Edmonton': NewsCategory.EDMONTON,
  '埃德蒙顿': NewsCategory.EDMONTON,

  // Waterloo Region & Guelph
  'Waterloo': NewsCategory.WATERLOO,
  'Kitchener': NewsCategory.WATERLOO,
  'Cambridge': NewsCategory.WATERLOO,
  'Guelph': NewsCategory.WATERLOO,
  '滑铁卢': NewsCategory.WATERLOO,
  '圭尔夫': NewsCategory.WATERLOO,
  '基奇纳': NewsCategory.WATERLOO,
  '剑桥': NewsCategory.WATERLOO,

  // Windsor
  'Windsor': NewsCategory.WINDSOR,
  '温莎': NewsCategory.WINDSOR,

  // London
  'London': NewsCategory.LONDON,
  '伦敦': NewsCategory.LONDON
};
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
    const response = await generateWithRetry("gemini-2.0-flash", {
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

// Helper: Compress Image
const compressImage = async (base64Str: string, maxWidth = 1200, quality = 0.7): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context null'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Compression failed'));
      }, 'image/jpeg', quality);
    };
    img.onerror = (err) => reject(err);
  });
};

export const uploadImageToSupabase = async (base64Data: string, filename: string): Promise<string | null> => {
  try {
    if (!supabaseUrl || supabaseUrl.includes('placeholder')) return null;

    // Compress the image before uploading
    const compressedBlob = await compressImage(base64Data);

    const { data, error } = await supabase.storage.from('urbanhub_assets').upload(filename, compressedBlob, {
      contentType: 'image/jpeg', // Always convert to JPEG for better compression
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

// Global flag to track if image generation is available
let isImageGenerationAvailable = true;

const generateNewsImage = async (headline: string, category: string): Promise<string | undefined> => {
  if (!apiKey || !isImageGenerationAvailable) return undefined;

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
    }, 0); // Set retries to 0 to fail fast

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
  } catch (error: any) {
    // If 404 (Model not found) or 403 (Permission denied), disable future attempts
    if (error.message?.includes('404') || error.message?.includes('not found') || error.status === 404) {
      console.warn("[GeminiService] Imagen model not found or accessible. Disabling AI image generation.");
      isImageGenerationAvailable = false;
    } else {
      console.warn("Image generation failed (skipping):", error.message || error);
    }
  }
  return undefined;
};

// Helper: Check if URL is likely a deep link (not a homepage)
const isDeepLink = (url: string): boolean => {
  try {
    const u = new URL(url);
    // Reject root paths
    if (u.pathname === '/' || u.pathname === '') return false;
    // Reject common top-level paths
    const badPaths = ['/news', '/home', '/index', '/en', '/zh', '/category', '/articles'];
    if (badPaths.includes(u.pathname.replace(/\/$/, ''))) return false;
    // Deep links usually have longer paths or query parameters
    return u.pathname.length > 10 || u.search.length > 5;
  } catch (e) {
    return false;
  }
};

// Helper: Fetch Article Content (Node.js only)
const fetchArticleContent = async (url: string): Promise<string | null> => {
  if (typeof window !== 'undefined') return null; // Only run in Node

  try {
    // Dynamic import cheerio to avoid bundling issues in browser
    const cheerioModule = await import('cheerio') as any;
    const load = cheerioModule.load || cheerioModule.default?.load;

    if (!load) {
      console.error("Failed to load cheerio");
      return null;
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) return null;

    const html = await response.text();
    const $ = load(html);

    // Remove unwanted elements
    $('script, style, nav, header, footer, .ad, .advertisement, .menu, .sidebar, .cookie-banner, .popup').remove();

    // Try to find main article container
    let container = $('article');
    if (container.length === 0) container = $('main');
    if (container.length === 0) container = $('.post-content');
    if (container.length === 0) container = $('.article-body');
    if (container.length === 0) container = $('body'); // Fallback

    // Extract text from paragraphs, headings, and lists within the container
    let text = '';
    container.find('h1, h2, h3, p, li').each((i, el) => {
      const $el = $(el);
      // Skip if inside a nested ignored container that wasn't caught by global remove
      if ($el.closest('.related-posts, .comments, .share-buttons').length > 0) return;

      const tag = el.tagName.toLowerCase();
      const content = $el.text().trim();

      if (content.length > 10) { // Lower threshold slightly for headings/list items
        if (tag.startsWith('h')) {
          text += `\n### ${content}\n`;
        } else if (tag === 'li') {
          text += `- ${content}\n`;
        } else {
          text += content + '\n\n';
        }
      }
    });

    return text.trim();
  } catch (e) {
    console.error(`Error fetching content from ${url}:`, e);
    return null;
  }
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
    // 0. Auto-Remap Local City to Regional Category
    if (context && context !== '本地') {
      const mappedCategory = Object.entries(CITY_CATEGORY_MAP).find(([key, val]) =>
        context.toLowerCase() === key.toLowerCase() ||
        context.toLowerCase().includes(key.toLowerCase())
      )?.[1];

      if (mappedCategory) {
        console.log(`[GeminiService] Remapping Local City '${context}' to Category '${mappedCategory}'`);
        category = mappedCategory; // Switch category!
        // We do NOT update topic here yet, let the next block handle it based on the new category
      }
    }
  }

  if (category === NewsCategory.LOCAL) {
    topic = context && context !== '本地' ? context : '您所在的城市';
    articleCount = config.news.localArticleCount || 15;
    timeWindow = config.news.localTimeWindow || "48 hours";
  } else if ([
    NewsCategory.GTA, NewsCategory.VANCOUVER, NewsCategory.MONTREAL,
    NewsCategory.CALGARY, NewsCategory.EDMONTON, NewsCategory.WATERLOO,
    NewsCategory.WINDSOR, NewsCategory.LONDON
  ].includes(category as NewsCategory)) {
    // Treat new cities as Local News but with specific topic
    const cityMap: Record<string, string> = {
      [NewsCategory.GTA]: 'Toronto OR "York Region" OR "Peel Region" OR "Durham Region" OR "Halton Region"',
      [NewsCategory.VANCOUVER]: 'Vancouver OR Burnaby OR Richmond OR Surrey OR Coquitlam OR "West Vancouver" OR "North Vancouver" OR Delta OR Langley OR "White Rock"',
      [NewsCategory.MONTREAL]: 'Montreal',
      [NewsCategory.CALGARY]: 'Calgary',
      [NewsCategory.EDMONTON]: 'Edmonton',
      [NewsCategory.WATERLOO]: 'Waterloo OR Kitchener OR Cambridge OR Guelph',
      [NewsCategory.WINDSOR]: 'Windsor',
      [NewsCategory.LONDON]: 'London, Ontario'
    };
    topic = cityMap[category];
    articleCount = config.news.localArticleCount || 15;
    timeWindow = config.news.localTimeWindow || "48 hours";
  } else if (category === NewsCategory.CANADA) {
    topic = 'Canada Chinese Community';
    articleCount = config.news.canadaArticleCount || 10;
    timeWindow = config.news.canadaTimeWindow || "24 hours";
    keywords = "Chinese Canadian, 华人, 加拿大华人, Chinese Community, Immigration, Visa, Housing";
    if (config.news.canadaKeywords) keywords += `, ${config.news.canadaKeywords}`;
  } else if (category === NewsCategory.USA) {
    topic = 'USA Chinese Community';
    articleCount = config.news.usaArticleCount || 10;
    timeWindow = config.news.usaTimeWindow || "24 hours";
    keywords = "Chinese American, 华人, 美国华人, Chinese Community, H-1B, Visa, Chinatown";
    if (config.news.usaKeywords) keywords += `, ${config.news.usaKeywords}`;
  } else if (category === NewsCategory.CHINA) {
    topic = 'Technology & Science';
    articleCount = config.news.chinaArticleCount || 10;
    timeWindow = config.news.chinaTimeWindow || "24 hours";
    keywords = "Technology, AI, Internet, 5G, Electric Vehicles, Science, Startup, 科技, 互联网, 人工智能, 电动车, 科学, 数码, 创业, 硬科技, 芯片";
  } else if (category === NewsCategory.INTERNATIONAL) {
    // REFACTORED: International -> Global Chinese & East Asia
    topic = 'Global Chinese Community & East Asia';
    articleCount = config.news.intlArticleCount || 8;
    timeWindow = config.news.intlTimeWindow || "24 hours";
    keywords = "Overseas Chinese, 华侨, 华人, Taiwan News, Hong Kong News, Japan News, South Korea News";
  } else {
    // Check Custom Categories
    const customCat = config.news.customCategories?.find(c => c.id === category);
    if (customCat) {
      topic = customCat.topic;
      articleCount = customCat.articleCount || 10;
      timeWindow = customCat.timeWindow || "24 hours";
      // Overwrite keywords for custom categories to be specific
      if (customCat.keywords) keywords = customCat.keywords;

      // Special handling for Europe custom category if it exists
      if (category === 'europe') {
        keywords = "Russia Ukraine War, 俄乌战争, 俄乌局势, Europe Chinese, 欧洲华人";
      }
    }
  }

  // Authoritative Source Filters
  const SOURCE_FILTERS: Record<string, string> = {
    [NewsCategory.CHINA]: "site:36kr.com OR site:huxiu.com OR site:cnbeta.com.tw OR site:ithome.com OR site:sina.com.cn/tech OR site:tech.qq.com OR site:tech.163.com OR site:jiemian.com OR site:thepaper.cn",

    [NewsCategory.CANADA]: "site:cbc.ca OR site:ctvnews.ca OR site:globalnews.ca OR site:canada.ca OR site:cp24.com OR site:singtao.ca OR site:mingpaocanada.com OR site:iask.ca OR site:ca.finance.yahoo.com",

    [NewsCategory.USA]: "site:cnn.com OR site:nytimes.com OR site:washingtonpost.com OR site:wsj.com OR site:reuters.com OR site:worldjournal.com OR site:dwnews.com OR site:voachinese.com OR site:finance.yahoo.com",

    // Mainland: 163.com; Taiwan: chinatimes, udn, ltn, cna; SG: nanyang, zaobao; JP: asahi, yahoo.co.jp; KR: chosun
    [NewsCategory.INTERNATIONAL]: "site:163.com OR site:chinatimes.com OR site:udn.com OR site:ltn.com.tw OR site:cna.com.tw OR site:nanyang.com OR site:zaobao.com.sg OR site:bbc.com/zhongwen OR site:rfi.fr/cn OR site:finance.yahoo.com",

    // Europe Custom Category
    "europe": "site:bbc.com OR site:dw.com OR site:france24.com OR site:euronews.com OR site:politico.eu OR site:theguardian.com OR site:reuters.com OR site:rfi.fr/cn OR site:bbc.com/zhongwen",

    // Local News Filters
    // Local News Filters
    [NewsCategory.GTA]: "site:thestar.com OR site:cp24.com OR site:toronto.ca OR site:mississauga.ca OR site:brampton.ca OR site:markham.ca OR site:richmondhill.ca OR site:vaughan.ca OR site:ontario.ca OR site:news.ontario.ca OR site:cbc.ca/news/canada/toronto OR site:torontosun.com OR site:singtao.ca OR site:mingpaocanada.com OR site:ca.finance.yahoo.com",
    [NewsCategory.VANCOUVER]: "site:vancouversun.com OR site:vancouver.ca OR site:richmond.ca OR site:burnaby.ca OR site:surrey.ca OR site:coquitlam.ca OR site:gov.bc.ca OR site:news.gov.bc.ca OR site:cbc.ca/news/canada/british-columbia OR site:theprovince.com OR site:ctvnews.ca/vancouver OR site:singtao.ca OR site:mingpaocanada.com OR site:ca.finance.yahoo.com",
    [NewsCategory.MONTREAL]: "site:montrealgazette.com OR site:montreal.ca OR site:quebec.ca OR site:cbc.ca/news/canada/montreal OR site:ctvnews.ca/montreal OR site:sinoquebec.com OR site:ca.finance.yahoo.com",
    [NewsCategory.CALGARY]: "site:calgaryherald.com OR site:calgary.ca OR site:alberta.ca OR site:cbc.ca/news/canada/calgary OR site:ctvnews.ca/calgary OR site:ca.finance.yahoo.com",
    [NewsCategory.EDMONTON]: "site:edmontonjournal.com OR site:edmonton.ca OR site:alberta.ca OR site:cbc.ca/news/canada/edmonton OR site:ctvnews.ca/edmonton OR site:ca.finance.yahoo.com",
    [NewsCategory.WATERLOO]: "site:therecord.com OR site:regionofwaterloo.ca OR site:kitchener.ca OR site:waterloo.ca OR site:cambridge.ca OR site:guelph.ca OR site:ontario.ca OR site:news.ontario.ca OR site:cbc.ca/news/canada/kitchener-waterloo OR site:guelphtoday.com OR site:guelphmercury.com OR site:ca.finance.yahoo.com",
    [NewsCategory.WINDSOR]: "site:windsorstar.com OR site:citywindsor.ca OR site:ontario.ca OR site:news.ontario.ca OR site:cbc.ca/news/canada/windsor OR site:ctvnews.ca/windsor OR site:ca.finance.yahoo.com",
    [NewsCategory.LONDON]: "site:lfpress.com OR site:london.ca OR site:ontario.ca OR site:news.ontario.ca OR site:cbc.ca/news/canada/london OR site:ctvnews.ca/london OR site:ca.finance.yahoo.com"
  };

  // Append source filter if available
  let sourceFilter = "";
  if (SOURCE_FILTERS[category]) {
    sourceFilter = SOURCE_FILTERS[category];
  }

  try {
    // Format keywords to be OR-separated if they exist to avoid over-restrictive AND search
    const formattedKeywords = keywords
      ? `(${keywords.split(',').map(k => k.trim()).join(' OR ')})`
      : "";

    // 1. Fetch Raw Search Results via Google Custom Search API
    // Construct query with source filter if applicable
    // Use 'news' as suffix generally, unless it's strictly Chinese local news where '新闻' might be better.
    // But 'news' works for Chinese too usually. To be safe for English sites, use 'news' or nothing.
    // Let's use 'news' for all to ensure English sites are matched.
    const newsSuffix = 'news';

    // For Local/Mapped categories, append specific topics
    let topicSuffix = "";
    if (category === NewsCategory.LOCAL || CITY_CATEGORY_MAP[category]) {
      topicSuffix = '("Real Estate" OR "Housing" OR "Crime" OR "Police" OR "Chinese Community" OR "Investment" OR "Finance" OR "News")';
    } else {
      topicSuffix = newsSuffix;
    }

    const searchQuery = sourceFilter
      ? `${topic} ${topicSuffix} (${sourceFilter}) ${formattedKeywords}`
      : `${topic} ${topicSuffix} ${formattedKeywords}`;

    console.log(`[GoogleSearch] Query: ${searchQuery}`);

    const searchResults = await GoogleSearchService.search(searchQuery, timeWindow);

    if (!searchResults || searchResults.length === 0) {
      console.warn("[GoogleSearch] No results found. Check API Key/CX or Query.");
      return [];
    }

    // Filter results (Deep Link Check & Content Filter)
    const validResults = searchResults.filter(item => {
      if (!isDeepLink(item.link)) return false;

      // Filter out generic titles, corporate announcements, and station profiles
      const titleLower = item.title.toLowerCase();
      if (
        titleLower.includes('watch live') ||
        titleLower.includes('live stream') ||
        titleLower.includes('live news') ||
        titleLower.includes('breaking news live') ||
        titleLower.includes('bbc news channel') ||
        titleLower.includes('top stories') ||
        titleLower.includes('latest news') ||
        titleLower === 'home' ||
        titleLower === 'index' ||
        titleLower === 'news' ||
        // Corporate/Partnership filters
        titleLower.includes('partnership') ||
        titleLower.includes('collaboration') ||
        titleLower.includes('partner with') ||
        titleLower.includes('announces') ||
        titleLower.includes('press release') ||
        titleLower.includes('about us') ||
        titleLower.includes('contact us') ||
        titleLower.includes('subscribe') ||
        titleLower.includes('newsletter') ||
        // Station Profiles / Radio Homepages
        titleLower.includes('am980') ||
        titleLower.includes('cfpl') ||
        titleLower.includes('news talk') ||
        titleLower.includes('traffic and weather') ||
        titleLower.includes('listen live') ||
        // Generic Site Descriptions / Topic Pages
        titleLower.includes('latest news') ||
        titleLower.includes('stories and analysis') ||
        titleLower.includes('breaking news') ||
        titleLower.includes('top headlines') ||
        titleLower.includes('news and updates') ||
        titleLower.includes('最新新闻') ||
        titleLower.includes('故事与分析') ||
        titleLower.includes('专题') ||
        titleLower.includes('专栏') ||
        titleLower.includes('频道') ||
        titleLower.includes('精选') ||
        titleLower.includes('汇编') ||
        titleLower.includes('archive') ||
        titleLower.includes('tag') ||
        titleLower.includes('category') ||
        titleLower.includes('collection') ||
        // Specific case from user feedback
        titleLower.includes('south china:') ||
        titleLower.includes('focusing on')
      ) {
        console.log(`Skipping generic/corporate/station title: ${item.title}`);
        return false;
      }
      // Strict Location Filter for Local News
      if (category === NewsCategory.LOCAL && context && context !== '本地') {
        const cityLower = context.toLowerCase();
        const textLower = (item.title + ' ' + item.snippet).toLowerCase();

        // If the city name is NOT in the title or snippet, skip it.
        // This prevents "Nassau County" news appearing for "Guelph" just because of loose matching.
        if (!textLower.includes(cityLower)) {
          console.log(`Skipping item not matching city ${context}: ${item.title}`);
          return false;
        }
      }

      // Strict Filter for Mapped Cities (Waterloo, London, etc.)
      const cityMap: Record<string, string> = {
        [NewsCategory.WATERLOO]: 'waterloo', // Will be overridden by special check below
        [NewsCategory.LONDON]: 'london',
        [NewsCategory.WINDSOR]: 'windsor',
        [NewsCategory.GTA]: 'toronto',
        [NewsCategory.VANCOUVER]: 'vancouver',
        [NewsCategory.MONTREAL]: 'montreal',
        [NewsCategory.CALGARY]: 'calgary',
        [NewsCategory.EDMONTON]: 'edmonton',
      };

      if (cityMap[category]) {
        const requiredKeyword = cityMap[category];
        const textLower = (item.title + ' ' + item.snippet).toLowerCase();

        // Special handling for GTA (Multiple Keywords)
        if (category === NewsCategory.GTA) {
          const gtaKeywords = ['toronto', 'gta', 'york', 'peel', 'durham', 'halton', 'mississauga', 'brampton', 'markham', 'vaughan', 'oakville', 'burlington', 'richmond hill'];
          const hasKeyword = gtaKeywords.some(k => textLower.includes(k));
          if (!hasKeyword) {
            console.log(`Skipping item not matching GTA keywords: ${item.title}`);
            return false;
          }
        }
        // Special handling for Vancouver (Multiple Keywords)
        else if (category === NewsCategory.VANCOUVER) {
          const vanKeywords = ['vancouver', 'burnaby', 'richmond', 'surrey', 'coquitlam', 'delta', 'langley', 'white rock', 'west vancouver', 'north vancouver', 'abbotsford', 'chilliwack', 'mission', 'maple ridge', 'pitt meadows', 'port coquitlam', 'port moody', 'new westminster'];
          const hasKeyword = vanKeywords.some(k => textLower.includes(k));
          if (!hasKeyword) {
            console.log(`Skipping item not matching Vancouver keywords: ${item.title}`);
            return false;
          }
        }
        // Special handling for Waterloo/Guelph (Multiple Keywords)
        else if (category === NewsCategory.WATERLOO) {
          const kwgKeywords = ['waterloo', 'kitchener', 'cambridge', 'guelph'];
          const hasKeyword = kwgKeywords.some(k => textLower.includes(k));
          if (!hasKeyword) {
            console.log(`Skipping item not matching K-W-Guelph keywords: ${item.title}`);
            return false;
          }
        }
        else {
          if (!textLower.includes(requiredKeyword)) {
            console.log(`Skipping item not matching category ${category}: ${item.title}`);
            return false;
          }
        }
      }

      return true;
    });

    // Limit to requested count (plus buffer for deduplication)
    const candidates = validResults.slice(0, articleCount * 2);

    // 1.5 Deduplication Check (URL based)
    const candidateUrls = candidates.map(c => c.link);
    const existingUrls = await NewsDatabase.checkExists(candidateUrls);

    const newResults = candidates.filter(c => !existingUrls.has(c.link));

    if (newResults.length === 0) {
      console.log("[GeminiService] All found items already exist in DB. Skipping.");
      return [];
    }

    const limitedResults = newResults.slice(0, articleCount);

    // 2. Prepare Context for Gemini (Send ID to map back later)
    // Parallel fetch content if in Node environment
    const isNode = typeof window === 'undefined';

    const articlesContextPromises = limitedResults.map(async (item, index) => {
      let contextText = item.snippet;

      // Try to get full content if in Node
      if (isNode) {
        try {
          const fullContent = await fetchArticleContent(item.link);
          if (fullContent && fullContent.length > 200) {
            contextText = fullContent.slice(0, 5000); // Limit context window
          }
        } catch (e) {
          console.warn(`Failed to fetch content for ${item.link}, falling back to snippet.`);
        }
      } else {
        // Fallback to og:description in browser
        const ogDescription = item.pagemap?.metatags?.find(m => m['og:description'])?.['og:description'];
        if (ogDescription && ogDescription.length > item.snippet.length) {
          contextText = ogDescription;
        }
      }

      return `
      Item ID: ${index}
      Title: ${item.title}
      Content: ${contextText}
    `});

    const articlesContext = (await Promise.all(articlesContextPromises)).join('\n\n');

    const systemInstruction = `You are a professional journalist for "City666".
    Your task is to summarize the provided news items.
    
    INPUT: A list of news items with ID, Title, and Content (or Snippet).
    OUTPUT: A JSON array of news objects.

    CRITICAL RULES:
    1. **Content Quality**: Focus on **SPECIFIC DETAILS**. You MUST include:
       - **Who**: Specific names of people, organizations, or countries.
       - **What**: The specific event, action, or announcement.
       - **When**: Dates or times mentioned.
       - **Where**: Specific locations (cities, regions).
       - **Why/How**: The reason or method.
       - **Numbers**: Statistics, money amounts, percentages.
    2. **Content Length**: Write a **DETAILED** summary for each item. It MUST be at least **200 Chinese characters** long. If the source content is short, elaborate on the context, background, or implications to meet the length requirement.
    3. **Language**: ALWAYS write Title and Content in **CHINESE (Simplified)**.
    4. **ID**: You MUST return the exact **Item ID** provided in the input.
    5. **Source**: Extract the source name from the Title (e.g. 'CBC', 'CTV').
    6. **No Generic Content**: If the content is "Subscribe to read" or "Enable JS", ignore it.

    Output JSON Format:
    [{ "id": 0, "title": "Chinese Title", "summary": "Chinese Summary (>200 chars)", "content": "Chinese Summary (>200 chars)", "source_name": "Source" }]
    `;

    // 3. Generate Summaries with Gemini
    const response = await generateWithRetry("gemini-2.0-flash", {
      contents: `Here are the news items to summarize:\n${articlesContext}`,
      config: {
        systemInstruction,
        responseMimeType: "application/json"
      }
    });

    const jsonStr = cleanJsonString(response.text || "[]");
    let aiItems: any[] = [];

    try {
      aiItems = JSON.parse(jsonStr);
    } catch (e) {
      console.error("JSON Parse Error", e);
      return [];
    }

    if (!Array.isArray(aiItems)) return [];

    const finalItems: NewsItem[] = [];

    for (const aiItem of aiItems) {
      if (!aiItem || typeof aiItem.id === 'undefined') continue;

      // Map back to original search result using ID
      const originalItem = limitedResults[aiItem.id];
      if (!originalItem) continue;

      let sourceUrl = originalItem.link;
      let imageUrl: string | undefined = undefined;

      // Helper to validate image URLs
      const isValidImageUrl = (url: string | undefined): boolean => {
        if (!url) return false;
        if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
        if (url.includes('x-raw-image')) return false;
        // Filter out known bad domains or patterns if needed
        return true;
      };

      // Improved Image Extraction
      // 1. Try og:image from metatags (Best Quality)
      const ogImage = originalItem.pagemap?.metatags?.find(m => m['og:image'])?.['og:image'];
      if (isValidImageUrl(ogImage)) {
        imageUrl = ogImage;
      }
      // 2. Fallback to cse_image (Thumbnail)
      else if (isValidImageUrl(originalItem.pagemap?.cse_image?.[0]?.src)) {
        imageUrl = originalItem.pagemap.cse_image[0].src;
      }

      // 3. Fallback to AI Image Generation (only if no image found)
      if (!imageUrl) {
        try {
          console.log(`Generating AI image for: ${aiItem.title}`);
          const base64Image = await generateNewsImage(aiItem.title, category);
          if (base64Image) {
            const filename = `ai_news/${Date.now()}_${aiItem.id}.png`;
            const supabaseUrl = await uploadImageToSupabase(base64Image, filename);
            if (supabaseUrl) imageUrl = supabaseUrl;
          }
        } catch (err) {
          console.error("Failed to generate/upload AI image:", err);
        }
      }

      finalItems.push({
        id: `news-${category}-${Date.now()}-${aiItem.id}`,
        title: aiItem.title,
        summary: aiItem.summary,
        content: aiItem.content,
        category,
        timestamp: Date.now(),
        imageUrl: imageUrl,
        source: `CitySquare 整理自 ${aiItem.source_name || '互联网'}`,
        sourceUrl: sourceUrl,
        youtubeUrl: undefined, // Google Search API doesn't easily give this, ignore for now
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
      .select('id, title, summary, category, timestamp, image_url, source, source_url, youtube_url, city');

    // Smart City Mapping Logic
    let effectiveCategory = category;
    let effectiveCity = city;

    if (category === NewsCategory.LOCAL && city && city !== '本地') {
      // Check if this city maps to a special category
      const mappedCategory = Object.entries(CITY_CATEGORY_MAP).find(([key, val]) =>
        city.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(city.toLowerCase())
      )?.[1];

      if (mappedCategory) {
        effectiveCategory = mappedCategory;
        // When using a mapped category, we don't filter by city string anymore, 
        // we filter by the category itself.
        effectiveCity = undefined;
      }
    }

    query = query.eq('category', effectiveCategory);

    if (effectiveCategory === NewsCategory.LOCAL && effectiveCity && effectiveCity !== '本地') {
      query = query.eq('city', effectiveCity);
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

    // 2. Filter out duplicates (Exact Title or URL Match)
    const uniqueItems = newItems.filter(item => {
      const titleExists = existingTitles.has(item.title);
      // We rely on the pre-check in fetchNewsFromAI for URL, but double check here if needed?
      // Let's trust the pre-check for URL to avoid extra DB calls, but title check is good for same content different URL.
      return !titleExists;
    });

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

    // Default time limit: 48 hours
    const timeLimitMs = 48 * 60 * 60 * 1000;
    const cutoffTime = Date.now() - timeLimitMs;

    if (Object.values(NewsCategory).includes(category as NewsCategory)) {
      switch (category) {
        case NewsCategory.LOCAL:
        case NewsCategory.GTA:
        case NewsCategory.VANCOUVER:
        case NewsCategory.MONTREAL:
        case NewsCategory.CALGARY:
        case NewsCategory.EDMONTON:
        case NewsCategory.WATERLOO:
        case NewsCategory.WINDSOR:
        case NewsCategory.LONDON:
          limit = config.news.localRetentionLimit || 50; break;
        case NewsCategory.CANADA: limit = config.news.canadaRetentionLimit || 50; break;
        case NewsCategory.USA: limit = config.news.usaRetentionLimit || 50; break;
        case NewsCategory.CHINA: limit = config.news.chinaRetentionLimit || 50; break;
        case NewsCategory.INTERNATIONAL: limit = config.news.intlRetentionLimit || 50; break;
      }
    } else {
      const customCat = config.news.customCategories?.find(c => c.id === category);
      if (customCat) limit = customCat.retentionLimit || 50;
    }

    // 1. Identify items to delete (Time-based)
    const { data: timeExpiredItems } = await supabase
      .from('news')
      .select('id, image_url')
      .eq('category', category)
      .lt('timestamp', cutoffTime);

    // 2. Identify items to delete (Count-based)
    const { data: keepIds } = await supabase
      .from('news')
      .select('id')
      .eq('category', category)
      .order('timestamp', { ascending: false })
      .limit(limit);

    let countExpiredItems: any[] = [];
    if (keepIds && keepIds.length > 0) {
      const idsToKeep = keepIds.map(k => k.id);
      const { data: overflowItems } = await supabase
        .from('news')
        .select('id, image_url')
        .eq('category', category)
        .not('id', 'in', `(${idsToKeep.join(',')})`);

      if (overflowItems) countExpiredItems = overflowItems;
    }

    // Combine all items to delete
    const allItemsToDelete = [...(timeExpiredItems || []), ...countExpiredItems];

    // Deduplicate by ID
    const uniqueDeleteItems = Array.from(new Map(allItemsToDelete.map(item => [item.id, item])).values());

    if (uniqueDeleteItems.length === 0) return;

    console.log(`[NewsDatabase] Cleaning up ${uniqueDeleteItems.length} expired items for category: ${category}`);

    // 3. Delete Images from Storage (if AI generated)
    for (const item of uniqueDeleteItems) {

      if (item.image_url && item.image_url.includes('supabase') && item.image_url.includes('ai_news')) {
        try {
          // Extract filename from URL
          // URL format: .../storage/v1/object/public/ai_news/filename.png
          const parts = item.image_url.split('/ai_news/');
          if (parts.length === 2) {
            const filename = parts[1];
            console.log(`[NewsDatabase] Deleting image from storage: ${filename}`);
            await supabase.storage.from('ai_news').remove([filename]);
          }
        } catch (err) {
          console.error(`[NewsDatabase] Failed to delete image for item ${item.id}`, err);
        }
      }
    }

    // 4. Delete Records from DB
    const idsToDelete = uniqueDeleteItems.map(i => i.id);
    await supabase.from('news').delete().in('id', idsToDelete);
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
  },

  checkExists: async (urls: string[]): Promise<Set<string>> => {
    if (!supabaseUrl || urls.length === 0) return new Set();

    // Check for existing source_urls
    const { data } = await supabase
      .from('news')
      .select('source_url')
      .in('source_url', urls);

    const existing = new Set((data || []).map(d => d.source_url));
    return existing;
  }
};

export const NewsCrawler = {
  init: async () => {
    console.log("News Crawler initialized with Staggered Round-Robin Scheduler");

    let currentCategoryIndex = 0;

    // Background loop check every minute
    setInterval(async () => {
      try {
        const config = await ConfigService.get();
        const categories = [
          NewsCategory.LOCAL,
          NewsCategory.CANADA,
          NewsCategory.USA,
          NewsCategory.CHINA,
          NewsCategory.INTERNATIONAL,
          ...(config.news.customCategories?.map(c => c.id) || [])
        ];

        if (categories.length === 0) return;

        // Round-Robin: Pick one category to check per tick (every minute)
        // This ensures updates are staggered and don't happen all at once.
        const cat = categories[currentCategoryIndex % categories.length];
        currentCategoryIndex++;

        // Check if this specific category needs an update (e.g. > 2 hours since last)
        if (await NewsCrawler.shouldUpdate(cat)) {
          console.log(`[AutoFetch] Staggered check: Triggering update for ${cat}`);
          await NewsCrawler.run(cat);
        } else {
          console.log(`[AutoFetch] Staggered check: ${cat} is up to date.`);
        }

      } catch (e) {
        console.error("[AutoFetch] Error in background loop:", e);
      }
    }, 60000); // Check one category every minute
  },

  shouldUpdate: async (category: string, context?: string): Promise<boolean> => {
    // Smart City Mapping Logic
    let effectiveCategory = category;
    if (category === NewsCategory.LOCAL && context && context !== '本地') {
      const mappedCategory = Object.entries(CITY_CATEGORY_MAP).find(([key, val]) =>
        context.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(context.toLowerCase())
      )?.[1];
      if (mappedCategory) effectiveCategory = mappedCategory;
    }

    const lastUpdate = await NewsDatabase.getLastUpdateTime(effectiveCategory);
    const now = Date.now();
    const config = await ConfigService.get();

    let intervalMinutes = 120; // Default 2 hours

    if (Object.values(NewsCategory).includes(effectiveCategory as NewsCategory)) {
      switch (effectiveCategory) {
        case NewsCategory.LOCAL:
        case NewsCategory.GTA:
        case NewsCategory.VANCOUVER:
        case NewsCategory.MONTREAL:
        case NewsCategory.CALGARY:
        case NewsCategory.EDMONTON:
        case NewsCategory.WATERLOO:
        case NewsCategory.WINDSOR:
        case NewsCategory.LONDON:
          intervalMinutes = config.news.localRefreshInterval || 720; break;
        case NewsCategory.CANADA: intervalMinutes = config.news.canadaRefreshInterval || 120; break;
        case NewsCategory.USA: intervalMinutes = config.news.usaRefreshInterval || 120; break;
        case NewsCategory.CHINA: intervalMinutes = config.news.chinaRefreshInterval || 720; break;
        case NewsCategory.INTERNATIONAL: intervalMinutes = config.news.intlRefreshInterval || 120; break;
      }
    } else {
      const customCat = config.news.customCategories?.find(c => c.id === effectiveCategory);
      if (customCat) intervalMinutes = customCat.refreshInterval || 120;
    }

    const intervalMs = intervalMinutes * 60 * 1000;
    return (now - lastUpdate) > intervalMs;
  },

  run: async (category: string, context?: string) => {
    // Smart City Mapping Logic
    let effectiveCategory = category;
    let effectiveContext = context;

    if (category === NewsCategory.LOCAL && context && context !== '本地') {
      const mappedCategory = Object.entries(CITY_CATEGORY_MAP).find(([key, val]) =>
        context.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(context.toLowerCase())
      )?.[1];
      if (mappedCategory) {
        effectiveCategory = mappedCategory;
        // When using a mapped category, the context (city name) is implicit in the category logic
        // But we can keep it or clear it. Let's keep it as is, fetchNewsFromAI handles mapped categories.
      }
    }

    console.log(`Crawler running for ${effectiveCategory} (Context: ${effectiveContext})...`);
    const news = await fetchNewsFromAI(effectiveCategory, effectiveContext);
    if (news.length > 0) {
      await NewsDatabase.save(news);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('NEWS_DB_UPDATED'));
      }
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
    const response = await generateWithRetry("gemini-2.0-flash", {
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
  },

  deletePost: async (postId: string): Promise<boolean> => {
    if (!supabaseUrl) return false;
    const { error } = await supabase.from('forum').delete().eq('id', postId);
    return !error;
  },

  deleteComment: async (commentId: string): Promise<boolean> => {
    if (!supabaseUrl) return false;
    const { error } = await supabase.from('forum_comments').delete().eq('id', commentId);
    return !error;
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
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('FORUM_DB_UPDATED'));
        }
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
      status: item.status,
      linkUrl: item.link_url
    }));
  }
};

export const generateAdCopy = async (rawText: string, productName: string) => {
  if (!apiKey) return { title: productName, content: rawText };
  try {
    const response = await generateWithRetry("gemini-2.0-flash", {
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
    const response = await generateWithRetry("gemini-2.0-flash", {
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
      status: item.status,
      linkUrl: item.link_url
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
