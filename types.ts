
export enum ViewState {
  NEWS = 'NEWS',
  FORUM = 'FORUM',
  SERVICES = 'SERVICES',
  PROFILE = 'PROFILE',
  CREATE_SERVICE = 'CREATE_SERVICE',
  CREATE_AD = 'CREATE_AD',
  ADMIN = 'ADMIN',
  LOGIN = 'LOGIN',
  REGISTER = 'REGISTER'
}

export enum UserRole {
  ORDINARY = 'Ordinary',
  SERVICE_PROVIDER = 'Service Provider',
  ADMIN = 'Admin'
}

export interface UserProfile {
  email: string;
  role: UserRole;
  id?: string;
}

export enum NewsCategory {
  LOCAL = 'Local',
  CANADA = 'Canada',
  USA = 'USA',
  INTERNATIONAL = 'International',
  CHINA = 'China'
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  content: string; // Full content
  category: string;
  timestamp: number;
  imageUrl: string;
  source: string;
  sourceUrl?: string;
  youtubeUrl?: string;
}

export interface Comment {
  id: string;
  author: string;
  content: string;
  timestamp: number;
  likes: number;
}

export interface ForumPost {
  id: string;
  title: string;
  content: string;
  author: string;
  likes: number;
  comments: number;
  commentsList?: Comment[];
  timestamp: number;
  isAiGenerated: boolean;
  tags: string[];
  images?: string[];
  videoUrl?: string;
}

export enum ServiceType {
  RENT = 'Rent',
  REPAIR = 'Repair',
  MARKETPLACE = 'Marketplace',
  DEALS = 'Deals'
}

export interface ServiceItem {
  id: string;
  type: ServiceType;
  title: string;
  description: string;
  price: string;
  location: string;
  imageUrl?: string;
  contactName: string;
  timestamp: number;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: UserRole;
  joinedDate: string;
}

// Admin Config Types
export interface CustomCategory {
  id: string;
  name: string; // Display Name (e.g. "Tech")
  topic: string; // Search Topic (e.g. "Artificial Intelligence")
  keywords: string;
  articleCount: number;
  timeWindow: string;
  retentionLimit: number;
  refreshInterval: number;
}

export interface NewsSettings {
  localArticleCount: number;
  globalArticleCount: number;
  localTimeWindow: string; // e.g. "48 hours"
  globalTimeWindow: string; // e.g. "7 days"
  extraKeywords: string; // e.g. "Sports, Technology"

  // Refresh Intervals (in minutes)
  localRefreshInterval: number;
  canadaRefreshInterval: number;
  usaRefreshInterval: number;
  chinaRefreshInterval: number;
  intlRefreshInterval: number;

  // Database Retention Limits (Max items to keep)
  localRetentionLimit: number;
  canadaRetentionLimit: number;
  usaRetentionLimit: number;
  chinaRetentionLimit: number;
  intlRetentionLimit: number;

  // Regional Overrides
  canadaArticleCount?: number;
  canadaTimeWindow?: string;
  canadaKeywords?: string;

  usaArticleCount?: number;
  usaTimeWindow?: string;
  usaKeywords?: string;

  chinaArticleCount?: number;
  chinaTimeWindow?: string;
  chinaKeywords?: string;

  intlArticleCount?: number;
  intlTimeWindow?: string;
  intlKeywords?: string;

  customCategories?: CustomCategory[];
}

export interface ForumSettings {
  topicKeywords: string; // Search keywords
  categories: string; // Comma separated list: "Military, History, Tech..."
  questionTypes: string; // Comma separated list: "Ignorant, Sharp, Rational..."
  generateInterval: number; // minutes
}

// Ad Types
export type AdScope = 'local' | 'city' | 'province' | 'national';

export interface AdPricing {
  scope: Record<string, number>;
  duration: Record<string, number>;
  position: Record<string, number>;
}

export interface AdItem {
  id?: string;
  title: string;
  content: string; // AI Generated
  rawContent: string;
  imageUrl?: string;
  linkUrl?: string;
  contactInfo?: string;
  scope: AdScope;
  durationDays: number;
  priceTotal: number;
  status?: 'active' | 'pending' | 'expired';
}

export interface AppConfig {
  news: NewsSettings;
  forum: ForumSettings;
  adPricing?: AdPricing;
}
