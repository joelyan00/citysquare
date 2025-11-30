
import React, { useState, useEffect } from 'react';
import { ForumPost, Comment } from '../types';
import { ForumDatabase, ForumCrawler } from '../services/geminiService';
import { MessageCircle, Heart, Clock, Zap, Hash, Flame, HelpCircle, ChevronDown, ChevronUp, Plus, Send } from 'lucide-react';

import { ViewState } from '../types';
import { supabase } from '../services/supabaseClient';

interface ForumViewProps {
  city?: string;
  onNavigate?: (view: ViewState) => void;
}

const ForumView: React.FC<ForumViewProps> = ({ city, onNavigate }) => {
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [activeTab, setActiveTab] = useState<'trending' | 'latest'>('trending');
  const [loading, setLoading] = useState(true);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Comment State
  const [expandedCommentPostId, setExpandedCommentPostId] = useState<string | null>(null);
  const [newCommentContent, setNewCommentContent] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

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

  const handleCreatePostClick = () => {
    if (!user) {
      if (onNavigate) onNavigate(ViewState.LOGIN);
    } else {
      setShowCreateModal(true);
    }
  };

  const handleSubmitPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostTitle.trim() || !newPostContent.trim()) return;

    setIsSubmitting(true);
    try {
      const newPost: ForumPost = {
        id: `user-post-${Date.now()}`,
        title: newPostTitle,
        content: newPostContent,
        author: user.email?.split('@')[0] || '匿名用户',
        likes: 0,
        comments: 0,
        timestamp: Date.now(),
        isAiGenerated: false,
        tags: ['用户发布']
      };

      await ForumDatabase.save(newPost);
      setPosts([newPost, ...posts]);
      setShowCreateModal(false);
      setNewPostTitle('');
      setNewPostContent('');
    } catch (error) {
      console.error("Failed to post:", error);
      alert("发布失败，请重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLike = async (post: ForumPost, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      if (onNavigate) onNavigate(ViewState.LOGIN);
      return;
    }
    // Optimistic update
    const updatedPosts = posts.map(p =>
      p.id === post.id ? { ...p, likes: p.likes + 1 } : p
    );
    setPosts(updatedPosts);
    // In real app, call API here
  };

  const handleCommentClick = (post: ForumPost, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      if (onNavigate) onNavigate(ViewState.LOGIN);
    } else {
      // Toggle comment section
      if (expandedCommentPostId === post.id) {
        setExpandedCommentPostId(null);
      } else {
        setExpandedCommentPostId(post.id);
        // If no comments list yet, we could fetch it here. 
        // For now we assume commentsList might be empty or undefined.
      }
    }
  };

  const handleSubmitComment = async (postId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      if (onNavigate) onNavigate(ViewState.LOGIN);
      return;
    }
    if (!newCommentContent.trim()) return;

    setSubmittingComment(true);
    try {
      const newComment: Comment = {
        id: `c-${Date.now()}`,
        author: user.email?.split('@')[0] || '匿名用户',
        content: newCommentContent,
        timestamp: Date.now(),
        likes: 0
      };

      // Optimistic Update
      const updatedPosts = posts.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            comments: p.comments + 1,
            commentsList: [newComment, ...(p.commentsList || [])]
          };
        }
        return p;
      });

      setPosts(updatedPosts);
      // In real app: await ForumDatabase.addComment(postId, newComment);

      setNewCommentContent('');
    } catch (err) {
      console.error(err);
      alert("评论失败");
    } finally {
      setSubmittingComment(false);
    }
  };

  const filteredPosts = activeTab === 'trending'
    ? [...posts].sort((a, b) => b.likes - a.likes)
    : [...posts].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="bg-gray-50 min-h-full pb-6">
      <header className="bg-white sticky top-0 z-30 shadow-sm pt-4 pb-2">
        <div className="max-w-4xl mx-auto px-5">
          <div className="flex justify-between items-center mb-5">
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">社区论坛</h1>
              <p className="text-sm text-gray-500 font-bold mt-1">热门话题实时更新</p>
            </div>

            <div className="flex items-center space-x-3">
              {/* Admin Controlled: No manual generate button here anymore */}
              <div className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full text-xs font-black flex items-center">
                <Zap size={14} className="mr-1 fill-current" /> CitySquare 驱动
              </div>

              <button
                onClick={handleCreatePostClick}
                className="bg-indigo-600 text-white px-4 py-2 rounded-full font-bold text-sm flex items-center shadow-lg shadow-indigo-500/30 active:scale-95 transition-transform"
              >
                <Plus size={18} className="mr-1" strokeWidth={3} /> 发帖
              </button>
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
        </div>
      </header>

      <div className="max-w-4xl mx-auto">


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
                      onClick={(e) => handleLike(post, e)}
                      className="flex items-center space-x-2 hover:text-red-500 transition-colors text-gray-500"
                    >
                      <Heart size={24} strokeWidth={2.5} />
                      <span className="text-base font-extrabold">{post.likes}</span>
                    </button>
                    <button
                      onClick={(e) => handleCommentClick(post, e)}
                      className="flex items-center space-x-2 hover:text-blue-500 transition-colors text-gray-500"
                    >
                      <MessageCircle size={24} strokeWidth={2.5} />
                      <span className="text-base font-extrabold">{post.comments}</span>
                    </button>
                  </div>

                  <button
                    onClick={(e) => toggleExpand(post.id, e)}
                    className="flex items-center text-indigo-600 font-extrabold text-base bg-indigo-50 px-4 py-2 rounded-xl active:scale-95 transition-transform"
                  >
                    {isExpanded ? (
                      <>收起 <ChevronUp size={18} className="ml-1" strokeWidth={3} /></>
                    ) : (
                      <>展开 <ChevronDown size={18} className="ml-1" strokeWidth={3} /></>
                    )}
                  </button>
                </div>

                {/* Comments Section */}
                {expandedCommentPostId === post.id && (
                  <div className="mt-6 pt-6 border-t border-gray-100 animate-[fadeIn_0.3s]" onClick={e => e.stopPropagation()}>
                    <h4 className="font-bold text-gray-900 mb-4">评论 ({post.comments})</h4>

                    {/* Comment List */}
                    <div className="space-y-4 mb-6">
                      {post.commentsList && post.commentsList.length > 0 ? (
                        post.commentsList.map(comment => (
                          <div key={comment.id} className="bg-gray-50 p-4 rounded-xl">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-bold text-indigo-600 text-sm">{comment.author}</span>
                              <span className="text-xs text-gray-400">{new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-gray-700 text-sm">{comment.content}</p>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-gray-400 text-sm py-4">暂无评论，快来抢沙发吧！</div>
                      )}
                    </div>

                    {/* Quick Comment Input */}
                    <form onSubmit={(e) => handleSubmitComment(post.id, e)} className="relative">
                      <input
                        type="text"
                        placeholder="写下你的评论..."
                        value={newCommentContent}
                        onChange={e => setNewCommentContent(e.target.value)}
                        className="w-full bg-gray-100 border-none rounded-full py-3 pl-5 pr-14 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                        autoFocus
                      />
                      <button
                        type="submit"
                        disabled={submittingComment || !newCommentContent.trim()}
                        className="absolute right-2 top-1.5 bg-indigo-600 text-white p-1.5 rounded-full hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                      >
                        <Send size={16} />
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )
          })}
          {!loading && filteredPosts.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="font-bold text-lg">暂无帖子</p>
              <p className="text-sm">等待系统自动生成中...</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Post Modal */}
      {
        showCreateModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-[fadeIn_0.2s]" onClick={() => setShowCreateModal(false)}>
            <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-2xl font-black text-gray-900 mb-4">发布新话题</h3>
              <form onSubmit={handleSubmitPost} className="space-y-4">
                <div>
                  <input
                    type="text"
                    placeholder="标题 (必填)"
                    value={newPostTitle}
                    onChange={e => setNewPostTitle(e.target.value)}
                    className="w-full text-lg font-bold border-b-2 border-gray-100 focus:border-indigo-500 outline-none py-2"
                    autoFocus
                  />
                </div>
                <div>
                  <textarea
                    placeholder="分享你的想法..."
                    value={newPostContent}
                    onChange={e => setNewPostContent(e.target.value)}
                    className="w-full h-32 text-gray-600 resize-none outline-none bg-gray-50 rounded-xl p-4 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-5 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !newPostTitle.trim() || !newPostContent.trim()}
                    className="px-6 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 disabled:opacity-50 flex items-center"
                  >
                    {isSubmitting ? '发布中...' : <><Send size={18} className="mr-2" /> 发布</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default ForumView;
