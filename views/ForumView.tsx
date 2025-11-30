
import React, { useState, useEffect } from 'react';
import { ForumPost } from '../types';
import { ForumDatabase, ForumCrawler } from '../services/geminiService';
import { MessageCircle, Heart, Clock, Zap, Hash, Flame, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface ForumViewProps {
  city?: string;
}

const ForumView: React.FC<ForumViewProps> = ({ city }) => {
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [activeTab, setActiveTab] = useState<'trending' | 'latest'>('trending');
  const [loading, setLoading] = useState(true);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);

  // Load Data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const data = await ForumDatabase.getPosts();
      setPosts(data);
      setLoading(false);
    };
    loadData();

    // Trigger Auto-Generator if interval passed
    ForumCrawler.init();

    // Listen for updates
    const handleUpdate = () => loadData();
    window.addEventListener('FORUM_DB_UPDATED', handleUpdate);
    return () => window.removeEventListener('FORUM_DB_UPDATED', handleUpdate);
  }, []);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedPostId(expandedPostId === id ? null : id);
  };

  const filteredPosts = activeTab === 'trending' 
    ? [...posts].sort((a, b) => b.likes - a.likes)
    : [...posts].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="bg-gray-50 min-h-full pb-6">
      <header className="bg-white sticky top-0 z-30 shadow-sm px-5 pt-4 pb-2">
        <div className="flex justify-between items-center mb-5">
           <div>
             <h1 className="text-3xl font-black text-gray-900 tracking-tight">社区论坛</h1>
             <p className="text-sm text-gray-500 font-bold mt-1">热门话题实时更新</p>
           </div>
           {/* Admin Controlled: No manual generate button here anymore */}
           <div className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full text-xs font-black flex items-center">
              <Zap size={14} className="mr-1 fill-current" /> CitySquare 驱动
           </div>
        </div>

        <div className="flex space-x-8 text-lg font-extrabold border-b border-gray-100">
          <button 
            onClick={() => setActiveTab('trending')}
            className={`flex items-center pb-3 px-1 transition-colors ${activeTab === 'trending' ? 'text-indigo-600 border-b-4 border-indigo-600' : 'text-gray-400'}`}
          >
            <Flame size={20} className="mr-2" strokeWidth={2.5} /> 热门
          </button>
          <button 
            onClick={() => setActiveTab('latest')}
            className={`flex items-center pb-3 px-1 transition-colors ${activeTab === 'latest' ? 'text-indigo-600 border-b-4 border-indigo-600' : 'text-gray-400'}`}
          >
            <HelpCircle size={20} className="mr-2" strokeWidth={2.5} /> 最新
          </button>
        </div>
      </header>

      <div className="p-4 space-y-6">
        {loading && posts.length === 0 ? (
          <div className="py-20 text-center text-gray-400 font-bold text-lg">加载中...</div>
        ) : filteredPosts.map(post => {
          const isExpanded = expandedPostId === post.id;
          return (
          <div 
            key={post.id} 
            className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-gray-100 active:bg-gray-50 transition-colors"
            onClick={(e) => toggleExpand(post.id, e)}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex gap-2 mb-2 flex-wrap">
                {post.tags.slice(0, 3).map(tag => (
                   <span key={tag} className="text-xs font-bold bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg flex items-center">
                     <Hash size={12} className="mr-0.5" strokeWidth={3} /> {tag}
                   </span>
                ))}
                {post.isAiGenerated && (
                  <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg border border-indigo-100 flex items-center">
                    <Zap size={12} className="mr-0.5 fill-current" /> 话题
                  </span>
                )}
              </div>
              <span className="text-xs font-bold text-gray-400 flex items-center whitespace-nowrap ml-2">
                <Clock size={14} className="mr-1" />
                {Math.floor((Date.now() - post.timestamp) / 60000)}分钟前
              </span>
            </div>

            <h3 className="text-2xl md:text-3xl font-black text-gray-900 mb-4 leading-tight tracking-tight">{post.title}</h3>
            
            {/* Content with conditional truncation */}
            <div className={`text-gray-800 text-lg md:text-xl font-medium leading-relaxed mb-6 whitespace-pre-wrap ${isExpanded ? '' : 'line-clamp-4'}`}>
                {post.content}
            </div>

            <div className="flex items-center justify-between text-gray-500 border-t border-gray-100 pt-5">
              <div className="flex items-center space-x-6">
                 <button 
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center space-x-2 hover:text-red-500 transition-colors text-gray-500"
                 >
                   <Heart size={24} strokeWidth={2.5} />
                   <span className="text-base font-extrabold">{post.likes}</span>
                 </button>
                 <button className="flex items-center space-x-2 hover:text-blue-500 transition-colors text-gray-500">
                   <MessageCircle size={24} strokeWidth={2.5} />
                   <span className="text-base font-extrabold">{post.comments}</span>
                 </button>
              </div>
              
              <button 
                  onClick={(e) => toggleExpand(post.id, e)}
                  className="flex items-center text-indigo-600 font-extrabold text-base bg-indigo-50 px-4 py-2 rounded-xl active:scale-95 transition-transform"
              >
                  {isExpanded ? (
                    <>收起 <ChevronUp size={18} className="ml-1" strokeWidth={3}/></>
                  ) : (
                    <>展开 <ChevronDown size={18} className="ml-1" strokeWidth={3}/></>
                  )}
              </button>
            </div>
          </div>
        )})}
        {!loading && filteredPosts.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="font-bold text-lg">暂无帖子</p>
            <p className="text-sm">等待系统自动生成中...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForumView;
