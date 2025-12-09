
import { supabase } from './supabaseClient';
import { AppConfig, NewsSettings, ForumSettings } from '../types';

const DEFAULT_CONFIG: AppConfig = {
  news: {
    localArticleCount: 10,
    globalArticleCount: 10,
    localTimeWindow: '48 hours',
    globalTimeWindow: '7 days',
    extraKeywords: 'Sports, Military, Technology, Heartwarming stories, Science, Health, Education',

    // Default Refresh Intervals (minutes)
    // Default Refresh Intervals (minutes)
    localRefreshInterval: 120, // 2 hours
    canadaRefreshInterval: 120, // 2 hours
    usaRefreshInterval: 120,    // 2 hours
    chinaRefreshInterval: 120,  // 2 hours
    intlRefreshInterval: 120,   // 2 hours

    // Default Retention Limits
    localRetentionLimit: 50,
    canadaRetentionLimit: 50,
    usaRetentionLimit: 50,
    chinaRetentionLimit: 50,
    intlRetentionLimit: 50,

    // Default values for new regional settings
    usaArticleCount: 10,
    usaTimeWindow: '24 hours',
    usaKeywords: 'Politics, Tech, Wall Street, Hollywood, Silicon Valley, NASA',

    canadaArticleCount: 10,
    canadaTimeWindow: '24 hours',

    chinaArticleCount: 10,
    chinaTimeWindow: '24 hours',

    intlArticleCount: 10,
    intlTimeWindow: '48 hours',

    customCategories: [
      {
        id: 'europe',
        name: '欧洲',
        keywords: 'Russia Ukraine War, Europe News, EU Politics, Germany News, UK News, France News, 俄乌局势, 欧洲局势',
        topic: 'Europe News',
        timeWindow: '24 hours',
        refreshInterval: 120,
        articleCount: 10,
        retentionLimit: 50
      }
    ]
  },
  forum: {
    topicKeywords: 'Cost of living, Traffic, New Restaurants, Weekend Events',
    categories: '军事, 国力, 人生追求, 男女关系, 科技, 历史, 哲学',
    questionTypes: '无知提问 (求科普), 尖锐问题 (引发争议), 理性讨论 (深度分析), 吐槽抱怨 (情感共鸣)',
    generateInterval: 60 // minutes
  },
  adPricing: {
    scope: { local: 5, city: 15, province: 30, national: 50 },
    duration: { '1': 2, '3': 5, '7': 10, '14': 18, '30': 30 },
    position: { news_feed: 10, top_banner: 30 }
  }
};

export const ConfigService = {
  // Get config (or default)
  get: async (): Promise<AppConfig> => {
    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('*');

      if (error || !data) return DEFAULT_CONFIG;

      const newsConfig = data.find(r => r.key === 'news_settings')?.value || DEFAULT_CONFIG.news;
      const forumConfig = data.find(r => r.key === 'forum_settings')?.value || DEFAULT_CONFIG.forum;
      const adPricing = data.find(r => r.key === 'ad_pricing')?.value || DEFAULT_CONFIG.adPricing;

      // Merge defaults to handle missing new fields in existing DB records
      return {
        news: { ...DEFAULT_CONFIG.news, ...newsConfig },
        forum: { ...DEFAULT_CONFIG.forum, ...forumConfig },
        adPricing: { ...DEFAULT_CONFIG.adPricing, ...adPricing }
      };
    } catch (e) {
      return DEFAULT_CONFIG;
    }
  },

  // Save config
  save: async (config: AppConfig) => {
    try {
      await supabase.from('app_config').upsert([
        { key: 'news_settings', value: config.news },
        { key: 'forum_settings', value: config.forum },
        { key: 'ad_pricing', value: config.adPricing }
      ]);
    } catch (e) {
      console.error("Config Save Error", e);
    }
  }
};
