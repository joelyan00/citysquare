
import React, { useState, useEffect, useCallback } from 'react';
import { NewsCategory, NewsItem, AdItem } from '../types';
import { NewsDatabase, NewsCrawler, AdDatabase } from '../services/geminiService';
import { Share2, ChevronDown, ChevronUp, MapPin, Edit2, X, Check, RefreshCw } from 'lucide-react';

const staticCategoryLabels: Partial<Record<NewsCategory, string>> = {
  [NewsCategory.CANADA]: '加拿大',
  [NewsCategory.USA]: '美国',
  [NewsCategory.INTERNATIONAL]: '国际',
  [NewsCategory.CHINA]: '中国',
};

const CATEGORY_STORAGE_KEY = 'urbanhub_active_category';

// Helper to reliably extract YouTube Video ID from various URL formats
const getYouTubeVideoId = (url: string) => {
  if (!url) return null;
  // Robust regex for YouTube IDs (11 chars, alphanumeric + _ -)
  const regExp = /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regExp);
  return match ? match[1] : null;
};

interface NewsViewProps {
  city: string;
  onCityUpdate: (city: string) => void;
}

const NewsView: React.FC<NewsViewProps> = ({ city, onCityUpdate }) => {
  // Initialize state from localStorage if available
  const [activeCategory, setActiveCategory] = useState<NewsCategory>(() => {
    const saved = localStorage.getItem(CATEGORY_STORAGE_KEY);
    return (saved as NewsCategory) || NewsCategory.LOCAL;
  });

  const [newsData, setNewsData] = useState<NewsItem[]>([]);
  const [ads, setAds] = useState<AdItem[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingDb, setLoadingDb] = useState(true);
  const [expandedNewsId, setExpandedNewsId] = useState<string | null>(null);
  
  // Manual Location Input State
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [manualCityInput, setManualCityInput] = useState('');

  // Persist active category whenever it changes
  useEffect(() => {
    localStorage.setItem(CATEGORY_STORAGE_KEY, activeCategory);
  }, [activeCategory]);

  // 1. Initial Data Load from DB
  const loadFromDB = useCallback(async () => {
    setLoadingDb(true);
    const data = await NewsDatabase.getByCategory(activeCategory);
    setNewsData(data);
    
    // Load Ads
    const activeAds = await AdDatabase.getActiveAds();
    setAds(activeAds);
    
    setLoadingDb(false);
  }, [activeCategory]);

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
        const needsUpdate = await NewsCrawler.shouldUpdate(activeCategory);
        if (needsUpdate) {
           if (newsData.length === 0) setIsRefreshing(true);
           NewsCrawler.run(activeCategory).then(() => setIsRefreshing(false));
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
    await NewsCrawler.forceRefresh(activeCategory, context);
    setIsRefreshing(false);
  };

  const toggleExpand = (id: string) => {
    setExpandedNewsId(expandedNewsId === id ? null : id);
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

  // Inject Ads Logic
  const renderList = () => {
    const mixedList: React.ReactNode[] = [];
    newsData.forEach((item, index) => {
        // Render News Card
        const videoId = item.youtubeUrl ? getYouTubeVideoId(item.youtubeUrl) : null;
        mixedList.push(
            <article key={item.id} className="bg-white rounded-[2rem] shadow-sm overflow-hidden border border-gray-100 transition-all hover:shadow-md mb-8">
              {/* Responsive Image Height: h-64 on mobile, h-[500px] on desktop */}
              <div className="relative h-64 md:h-[500px] bg-gray-200 group">
                <img 
                  src={item.imageUrl} 
                  alt={item.title}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                />
                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white text-xs font-black px-3 py-1.5 rounded-lg">
                  {item.category === NewsCategory.LOCAL ? city : staticCategoryLabels[item.category] || item.category}
                </div>
              </div>
              
              <div className="p-6 md:p-8">
                <h2 className="text-2xl md:text-4xl font-black text-gray-900 leading-tight mb-4 tracking-tight">
                  {item.title}
                </h2>
                
                <div className={`text-gray-700 text-lg md:text-xl font-medium leading-relaxed mb-5 whitespace-pre-wrap ${expandedNewsId === item.id ? '' : 'line-clamp-3'}`}>
                  {expandedNewsId === item.id ? item.content : item.summary}
                </div>

                {/* YouTube Embed */}
                {expandedNewsId === item.id && videoId && (
                  <div className="mb-5 rounded-xl overflow-hidden shadow-md bg-black">
                     <iframe 
                       width="100%" 
                       height="100%"
                       className="aspect-video" 
                       src={`https://www.youtube.com/embed/${videoId}`}
                       title="YouTube video player" 
                       frameBorder="0" 
                       allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                       allowFullScreen
                     ></iframe>
                  </div>
                )}

                <div className="flex items-center justify-between pt-5 border-t border-gray-100 mt-2">
                   <div className="flex items-center space-x-3">
                    <span className="text-xs text-gray-400 font-bold font-mono">
                      {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                   </div>

                   <div className="flex items-center space-x-5">
                      <button 
                        onClick={() => toggleExpand(item.id)}
                        className="flex items-center text-base font-extrabold text-brand-600 active:text-brand-800 p-1 hover:bg-brand-50 rounded-lg px-3 transition-colors"
                      >
                        {expandedNewsId === item.id ? (
                          <>收起 <ChevronUp size={18} className="ml-1" strokeWidth={3} /></>
                        ) : (
                          <>阅读 <ChevronDown size={18} className="ml-1" strokeWidth={3} /></>
                        )}
                      </button>
                      <button className="text-gray-400 hover:text-brand-600 active:scale-90 transition-transform">
                        <Share2 size={22} strokeWidth={2.5} />
                      </button>
                   </div>
                </div>
                
                <div className="mt-5 pt-3 border-t border-dashed border-gray-100 flex flex-col gap-2">
                   <div className="text-xs font-bold text-gray-300 text-center py-1 mt-1">
                    信息来源：{item.source || '互联网'}
                   </div>
                </div>
              </div>
            </article>
        );

        // Inject Ad every 4 items (starting after item 3)
        if ((index + 1) % 4 === 0 && ads.length > 0) {
            const ad = ads[(index / 4) % ads.length];
            mixedList.push(
                <div key={`ad-${index}`} className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-100 rounded-[2rem] p-6 mb-8 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-xs font-black px-3 py-1 rounded-bl-xl">Sponsored 广告</div>
                    <div className="flex items-start gap-4">
                        {ad.imageUrl && <img src={ad.imageUrl} alt={ad.title} className="w-24 h-24 object-cover rounded-xl shadow-md flex-shrink-0" />}
                        <div className="flex-1">
                            <h3 className="text-xl font-black text-gray-900 mb-2">{ad.title}</h3>
                            <p className="text-gray-700 font-medium text-sm line-clamp-3 mb-3">{ad.content}</p>
                            {ad.contactInfo && (
                                <div className="text-xs font-bold text-gray-500 bg-white/50 inline-block px-2 py-1 rounded">
                                    联系方式: {ad.contactInfo}
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
    <div className="bg-gray-50 min-h-full">
      {/* Header - Constrained width on desktop */}
      <header className="bg-white sticky top-0 z-30 shadow-sm transition-shadow">
        <div className="max-w-5xl mx-auto">
          <div className="px-5 py-4 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">City<span className="text-brand-600">Square</span></h1>
            </div>
            {/* Refresh button removed per user request */}
          </div>
          
          {/* Categories */}
          <div className="flex overflow-x-auto px-4 pb-4 no-scrollbar gap-2 md:gap-3 w-full">
            {Object.values(NewsCategory).map((cat) => {
              let label = staticCategoryLabels[cat] || cat;
              if (cat === NewsCategory.LOCAL) {
                  label = city;
              }

              return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex-shrink-0 whitespace-nowrap px-4 md:px-6 py-2.5 rounded-full text-base font-extrabold transition-all flex items-center ${
                  activeCategory === cat 
                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/30 transform scale-105' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat === NewsCategory.LOCAL && (
                  <div className="flex items-center">
                    <MapPin size={14} className="mr-1 -mt-0.5" strokeWidth={3} />
                    <span className="mr-1">{label}</span>
                    {activeCategory === NewsCategory.LOCAL && (
                       <div 
                         onClick={(e) => { e.stopPropagation(); setShowLocationModal(true); }}
                         className="ml-1 bg-white/20 rounded-full p-1 hover:bg-white/40 active:scale-95 transition-all"
                       >
                         <Edit2 size={10} strokeWidth={3} />
                       </div>
                    )}
                  </div>
                )}
                {cat !== NewsCategory.LOCAL && label}
              </button>
            )})}
          </div>
        </div>
      </header>

      {/* Content - Responsive Container */}
      <div className="p-4 max-w-5xl mx-auto">
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
               className="bg-brand-600 text-white px-6 py-2 rounded-full font-bold shadow-lg"
            >
              立即抓取
            </button>
          </div>
        )}
      </div>

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
              <input 
                type="text" 
                placeholder="例如：多伦多、上海、纽约..." 
                value={manualCityInput}
                onChange={e => setManualCityInput(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 font-bold text-gray-800 focus:ring-2 focus:ring-brand-500 outline-none transition-all text-center text-lg"
                autoFocus
              />

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
    </div>
  );
};

export default NewsView;
