
import React, { useState, useEffect, useCallback } from 'react';
import { NewsCategory, NewsItem, AdItem, UserProfile, ViewState } from '../types';
import { NewsDatabase, NewsCrawler, AdDatabase } from '../services/geminiService';
import { ConfigService } from '../services/configService';
import { Share2, ChevronDown, ChevronUp, MapPin, Edit2, X, Check, RefreshCw, Sun, Moon, ChevronRight, MessageCircle, Aperture, BookOpen, Link, Search, Menu, User } from 'lucide-react';
import NewsCard from '../components/NewsCard';
import ShareCard from '../components/ShareCard';
import html2canvas from 'html2canvas';

const POPULAR_CITIES = [
  { label: '大多伦多 (GTA)', value: 'Toronto' },
  { label: '温哥华 (Vancouver)', value: 'Vancouver' },
  { label: '蒙特利尔 (Montreal)', value: 'Montreal' },
  { label: '卡尔加里 (Calgary)', value: 'Calgary' },
  { label: '埃德蒙顿 (Edmonton)', value: 'Edmonton' },
  { label: '滑铁卢 (Waterloo)', value: 'Waterloo' },
  { label: '圭尔夫 (Guelph)', value: 'Guelph' },
  { label: '温莎 (Windsor)', value: 'Windsor' },
  { label: '伦敦 (London)', value: 'London' },
];

const staticCategoryLabels: Partial<Record<NewsCategory, string>> = {
  [NewsCategory.CANADA]: '加拿大',
  [NewsCategory.USA]: '美国',
  [NewsCategory.INTERNATIONAL]: '东亚', // Was International
  [NewsCategory.CHINA]: '科技',      // Was China
};

const CATEGORY_STORAGE_KEY = 'urbanhub_active_category';



interface NewsViewProps {
  city: string;
  onCityUpdate: (city: string) => void;
  user?: UserProfile | null;
  onNavigate?: (view: ViewState, data?: any) => void;
  isDarkMode?: boolean;
  toggleTheme?: () => void;
}

const NewsView: React.FC<NewsViewProps> = ({ city, onCityUpdate, user, onNavigate, isDarkMode, toggleTheme }) => {
  // Initialize state from localStorage if available
  const [activeCategory, setActiveCategory] = useState<string>(() => {
    const saved = localStorage.getItem(CATEGORY_STORAGE_KEY);
    return saved || NewsCategory.LOCAL;
  });

  const [customCategories, setCustomCategories] = useState<any[]>([]);

  const [newsData, setNewsData] = useState<NewsItem[]>([]);
  const [ads, setAds] = useState<AdItem[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingDb, setLoadingDb] = useState(true);
  const [expandedNewsId, setExpandedNewsId] = useState<string | null>(null);

  // Manual Location Input State
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [manualCityInput, setManualCityInput] = useState('');

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState<NewsItem | null>(null);
  const [generatedShareImage, setGeneratedShareImage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const shareCardRef = React.useRef<HTMLDivElement>(null);



  // Persist active category whenever it changes
  useEffect(() => {
    localStorage.setItem(CATEGORY_STORAGE_KEY, activeCategory);
  }, [activeCategory]);

  // Prepare all categories list for easy rendering
  const allCategories = React.useMemo(() => [
    ...Object.values(NewsCategory)
      .filter(cat => ![
        NewsCategory.GTA, NewsCategory.VANCOUVER, NewsCategory.MONTREAL,
        NewsCategory.CALGARY, NewsCategory.EDMONTON, NewsCategory.WATERLOO,
        NewsCategory.GUELPH, NewsCategory.WINDSOR, NewsCategory.LONDON
      ].includes(cat))
      .map(cat => ({
        id: cat,
        label: cat === NewsCategory.LOCAL ? city : (staticCategoryLabels[cat] || cat),
        isLocal: cat === NewsCategory.LOCAL
      })),
    ...customCategories.map(cat => ({
      id: cat.id,
      label: cat.name,
      isLocal: false
    }))
  ], [city, customCategories]);

  // Overflow Detection
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const checkOverflow = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollWidth, clientWidth } = scrollContainerRef.current;
      setShowScrollButton(scrollWidth > clientWidth);
    }
  }, []);

  useEffect(() => {
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [checkOverflow, allCategories]); // Re-check when categories change

  // 1. Initial Data Load from DB
  const loadFromDB = useCallback(async () => {
    setLoadingDb(true);

    // Load Config for Custom Categories
    const config = await ConfigService.get();
    setCustomCategories(config.news.customCategories || []);

    const data = await NewsDatabase.getByCategory(activeCategory as NewsCategory, city); // Cast for now, service handles string
    setNewsData(data);

    // Load Ads
    const activeAds = await AdDatabase.getActiveAds();
    setAds(activeAds);

    setLoadingDb(false);
  }, [activeCategory, city]);

  useEffect(() => {
    loadFromDB();

    // Listen for background updates
    const handleDbUpdate = () => {
      console.log("[View] DB Updated, refreshing view.");
      loadFromDB();
    };
    window.addEventListener('NEWS_DB_UPDATED', handleDbUpdate);
    return () => window.removeEventListener('NEWS_DB_UPDATED', handleDbUpdate);
  }, [loadFromDB]);

  // 2. Crawler Logic
  // Only trigger crawler if we switched categories or if the city changed (and we are on local tab)
  useEffect(() => {
    const checkAndRunCrawler = async () => {
      // Local News Update
      if (activeCategory === NewsCategory.LOCAL) {
        const needsUpdate = await NewsCrawler.shouldUpdate(NewsCategory.LOCAL);
        if (needsUpdate) {
          setIsRefreshing(true);
          await NewsCrawler.run(NewsCategory.LOCAL, city);
          setIsRefreshing(false);
        }
      }
      // Other Categories Update
      else {
        // For custom categories, we might need to pass the custom config
        const needsUpdate = await NewsCrawler.shouldUpdate(activeCategory as NewsCategory);
        if (needsUpdate) {
          if (newsData.length === 0) setIsRefreshing(true);
          NewsCrawler.run(activeCategory as NewsCategory).then(() => setIsRefreshing(false));
        }
      }
    };

    checkAndRunCrawler();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, city]); // Run when category or city changes

  // 3. Manual Refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    const context = activeCategory === NewsCategory.LOCAL ? city : undefined;
    await NewsCrawler.forceRefresh(activeCategory as NewsCategory, context);
    setIsRefreshing(false);
  };

  const toggleExpand = async (id: string) => {
    if (expandedNewsId === id) {
      setExpandedNewsId(null);
      return;
    }

    // Lazy Load Content if missing
    const item = newsData.find(n => n.id === id);
    if (item && !item.content) {
      // Optimistically expand (show loading)
      setExpandedNewsId(id);

      const content = await NewsDatabase.getNewsContent(id);
      if (content) {
        setNewsData(prev => prev.map(n => n.id === id ? { ...n, content } : n));
      }
    } else {
      setExpandedNewsId(id);
    }
  };

  const handleManualCitySubmit = async () => {
    if (!manualCityInput.trim()) return;
    const newCity = manualCityInput.trim();

    // Update global state via prop
    onCityUpdate(newCity);
    setShowLocationModal(false);

    // Trigger refresh for new city immediately
    if (activeCategory === NewsCategory.LOCAL) {
      setIsRefreshing(true);
      await NewsCrawler.forceRefresh(NewsCategory.LOCAL, newCity);
      setIsRefreshing(false);
    }
  };

  const handleShare = async (item: NewsItem) => {
    setShowShareModal(item);
    setGeneratedShareImage(null);
    setIsGeneratingImage(true);

    // Wait for render
    setTimeout(async () => {
      if (shareCardRef.current) {
        try {
          const canvas = await html2canvas(shareCardRef.current, {
            useCORS: true,
            scale: 2, // Retina quality
            backgroundColor: '#ffffff',
            logging: false
          });
          setGeneratedShareImage(canvas.toDataURL('image/png'));
        } catch (error) {
          console.error("Screenshot generation failed:", error);
        } finally {
          setIsGeneratingImage(false);
        }
      }
    }, 100);
  };



  // Inject Ads Logic
  const renderList = () => {
    const mixedList: React.ReactNode[] = [];
    newsData.forEach((item, index) => {
      // Render News Card (Unified Layout)
      mixedList.push(
        <NewsCard
          key={item.id}
          item={item}
          city={city}
          staticCategoryLabels={staticCategoryLabels}
          customCategories={customCategories}
          expandedNewsId={expandedNewsId}
          toggleExpand={toggleExpand}
          onShare={handleShare}
        />
      );

      // Inject Ad every 4 items (starting after item 3)
      if ((index + 1) % 4 === 0 && ads.length > 0) {
        const adIndex = Math.floor((index + 1) / 4) - 1;
        const ad = ads[adIndex % ads.length];
        mixedList.push(
          <div
            key={`ad-${index}`}
            onClick={() => {
              if (ad.linkUrl) {
                window.open(ad.linkUrl, '_blank');
              } else {
                onNavigate && onNavigate(ViewState.AD_DETAIL, ad);
              }
            }}
            className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 mb-4 shadow-sm relative overflow-hidden cursor-pointer hover:shadow-md active:scale-[0.99] transition-all"
          >
            <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">Ad</div>
            <div className="flex items-start gap-4">
              {ad.imageUrl && <img src={ad.imageUrl} alt={ad.title} className="w-20 h-20 object-cover rounded-lg shadow-sm flex-shrink-0" />}
              <div className="flex-1">
                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1 line-clamp-2">{ad.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-xs line-clamp-2 mb-2">{ad.content}</p>
                {ad.contactInfo && (
                  <div className="text-[10px] font-bold text-gray-400 bg-gray-50 dark:bg-gray-700 inline-block px-1.5 py-0.5 rounded">
                    {ad.contactInfo}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      }
    });
    return mixedList;
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-full transition-colors duration-300">
      {/* Google News Style Header */}
      <header className="bg-white dark:bg-gray-800 sticky top-0 z-30 shadow-sm transition-all">
        <div className="max-w-4xl mx-auto">
          {/* Top Bar: Menu - Logo - Search - Profile */}
          <div className="px-4 py-3 flex justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-baseline gap-1 select-none">
                <span className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 tracking-tighter">City666</span>
                <span className="text-sm font-bold text-gray-400 dark:text-gray-500 tracking-widest uppercase">News</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Search Button Removed */}

              {/* Theme Toggle */}
              {toggleTheme && (
                <button
                  onClick={toggleTheme}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                  <span className="text-xs font-bold">切换背景</span>
                </button>
              )}

              {/* User Avatar */}
              {user ? (
                <button
                  onClick={() => onNavigate && onNavigate(ViewState.PROFILE)}
                  className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-sm ml-1"
                >
                  {user.name ? user.name.slice(0, 1).toUpperCase() : user.email.slice(0, 1).toUpperCase()}
                </button>
              ) : (
                <button
                  onClick={() => onNavigate && onNavigate(ViewState.LOGIN)}
                  className="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-sm shadow-sm ml-1"
                >
                  <User size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Categories (Tabs) */}
          <div className="relative border-b border-gray-200 dark:border-gray-700">
            <div
              ref={scrollContainerRef}
              className={`flex overflow-x-auto px-4 no-scrollbar gap-6 w-full ${showScrollButton ? 'pr-12' : ''}`}
            >
              {allCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex-shrink-0 whitespace-nowrap py-3 text-sm font-medium transition-all relative ${activeCategory === cat.id
                    ? 'text-brand-600 dark:text-brand-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                >
                  {cat.isLocal && (
                    <span className="flex items-center">
                      <MapPin size={14} className="mr-1" />
                      {cat.label}
                      {activeCategory === NewsCategory.LOCAL && (
                        <span
                          onClick={(e) => { e.stopPropagation(); setShowLocationModal(true); }}
                          className="ml-1 text-gray-400 hover:text-brand-600"
                        >
                          <Edit2 size={10} />
                        </span>
                      )}
                    </span>
                  )}
                  {!cat.isLocal && cat.label}

                  {/* Active Indicator Line */}
                  {activeCategory === cat.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600 dark:bg-brand-400 rounded-t-full"></div>
                  )}
                </button>
              ))}
            </div>

            {/* Expand Button */}
            {showScrollButton && (
              <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white via-white to-transparent dark:from-gray-800 dark:via-gray-800 flex justify-end items-center pr-2 pointer-events-none">
                <button
                  onClick={() => setShowCategoryModal(true)}
                  className="pointer-events-auto text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white p-1"
                >
                  <ChevronDown size={20} />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Content - Responsive Container */}
      <div className="p-4 max-w-4xl mx-auto">
        {loadingDb ? (
          // Simple Loading Spinner for DB fetch
          <div className="py-20 flex justify-center text-brand-500">
            <RefreshCw className="animate-spin" size={32} />
          </div>
        ) : isRefreshing && newsData.length === 0 ? (
          // Skeletons
          [1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-[2rem] p-6 shadow-sm animate-pulse border border-gray-100 mb-6">
              <div className="h-64 md:h-96 bg-gray-200 rounded-2xl mb-6"></div>
              <div className="h-8 bg-gray-200 rounded-lg w-3/4 mb-4"></div>
              <div className="h-5 bg-gray-200 rounded w-full mb-3"></div>
              <div className="h-5 bg-gray-200 rounded w-2/3"></div>
            </div>
          ))
        ) : (
          renderList()
        )}

        {/* Empty State */}
        {!loadingDb && !isRefreshing && newsData.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-xl font-black mb-2">暂无新闻</p>
            <p className="text-base font-medium mb-4">云端数据库为空</p>
            <button
              onClick={handleRefresh}
              className="bg-brand-600 text-white px-6 py-2 rounded-2xl font-bold shadow-lg"
            >
              立即抓取
            </button>
          </div>
        )}
      </div>

      {/* Category Selection Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col justify-end sm:justify-center animate-fadeIn" onClick={() => setShowCategoryModal(false)}>
          <div className="bg-white w-full sm:max-w-lg sm:mx-auto rounded-t-3xl sm:rounded-3xl p-6 relative shadow-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-gray-900">全部分类</h3>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 bg-gray-100 rounded-xl"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {allCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setShowCategoryModal(false);
                  }}
                  className={`py-3 px-2 rounded-xl text-sm font-bold transition-all border-2 ${activeCategory === cat.id
                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-transparent bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                >
                  {cat.isLocal ? (
                    <span className="flex items-center justify-center">
                      <MapPin size={14} className="mr-1" /> {cat.label}
                    </span>
                  ) : cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Manual Location Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 relative shadow-2xl">
            <button
              onClick={() => setShowLocationModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-2"
            >
              <X size={24} />
            </button>

            <div className="text-center mb-6">
              <div className="bg-brand-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-brand-600">
                <MapPin size={32} strokeWidth={2.5} />
              </div>
              <h2 className="text-2xl font-black text-gray-900">设置城市</h2>
              <p className="text-gray-500 text-sm font-bold mt-1">请输入您想关注的城市名称</p>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  value={manualCityInput}
                  onChange={e => setManualCityInput(e.target.value)}
                  placeholder="例如: Guelph, Barrie, Ottawa"
                  list="popular-cities"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 font-bold text-gray-800 focus:ring-2 focus:ring-brand-500 outline-none transition-all text-lg"
                />
                <datalist id="popular-cities">
                  {POPULAR_CITIES.map(city => (
                    <option key={city.value} value={city.value}>{city.label}</option>
                  ))}
                </datalist>
              </div>

              <button
                onClick={handleManualCitySubmit}
                className="w-full bg-brand-600 text-white font-black py-4 rounded-xl shadow-lg shadow-brand-500/30 active:scale-95 transition-transform flex items-center justify-center"
              >
                <Check className="mr-2" size={20} strokeWidth={3} />
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center animate-[fadeIn_0.2s] p-4" onClick={() => setShowShareModal(null)}>
          <div className="bg-transparent w-full max-w-sm flex flex-col items-center" onClick={e => e.stopPropagation()}>

            {/* Generated Image Preview */}
            <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl mb-6 bg-white min-h-[400px] flex items-center justify-center">
              {isGeneratingImage ? (
                <div className="flex flex-col items-center text-gray-400">
                  <RefreshCw className="animate-spin mb-2" size={32} />
                  <span className="text-sm font-bold">正在生成海报...</span>
                </div>
              ) : generatedShareImage ? (
                <img src={generatedShareImage} alt="Share Card" className="w-full h-auto" />
              ) : (
                <div className="text-red-500 font-bold">生成失败</div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col w-full gap-3">
              <p className="text-white/80 text-center text-sm font-medium mb-2">
                长按上方图片保存，或点击下方按钮
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowShareModal(null)}
                  className="bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-bold backdrop-blur-md transition-colors"
                >
                  关闭
                </button>
                <button
                  onClick={() => {
                    if (generatedShareImage) {
                      const link = document.createElement('a');
                      link.href = generatedShareImage;
                      link.download = `city666-news-${showShareModal.id}.png`;
                      link.click();
                    }
                  }}
                  className="bg-brand-600 hover:bg-brand-500 text-white py-3 rounded-xl font-bold shadow-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Share2 size={18} />
                  保存图片
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Share Card for Generation */}
      <div className="fixed left-[-9999px] top-0 pointer-events-none">
        {showShareModal && (
          <ShareCard ref={shareCardRef} item={showShareModal} />
        )}
      </div>
    </div>
  );
};

export default NewsView;
