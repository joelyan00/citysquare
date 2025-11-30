
import React, { useState, useEffect } from 'react';
import { ForumPost, Comment } from '../types';
import { ForumDatabase, ForumCrawler } from '../services/geminiService';
import { MessageCircle, Heart, Clock, Zap, Hash, Flame, HelpCircle, ChevronDown, ChevronUp, Plus, Send, UserPlus, UserMinus, Users, Image, Video, Mic, Wand2, X } from 'lucide-react';
import { polishText } from '../services/geminiService';

import { ViewState } from '../types';
import { supabase } from '../services/supabaseClient';

interface ForumViewProps {
  city?: string;
  onNavigate?: (view: ViewState) => void;
}

const ForumView: React.FC<ForumViewProps> = ({ city, onNavigate }) => {
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [activeTab, setActiveTab] = useState<'following' | 'trending' | 'latest' | 'mine'>('trending');
  const [loading, setLoading] = useState(true);
  const [followedNames, setFollowedNames] = useState<string[]>([]);
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

  // New Feature States
  const [newPostImages, setNewPostImages] = useState<string[]>([]);
  const [newPostVideo, setNewPostVideo] = useState('');
  const [showVideoInput, setShowVideoInput] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // For demo, we'll use base64. In production, upload to Supabase Storage.
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setNewPostImages(prev => [...prev, e.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAiPolish = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent form submission
    if (!newPostContent.trim()) return;
    setIsPolishing(true);
    try {
      const polished = await polishText(newPostContent);
      setNewPostContent(polished);
    } catch (error) {
      console.error("Polish failed", error);
    } finally {
      setIsPolishing(false);
    }
  };

  const handleVoiceInput = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent form submission
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('您的浏览器不支持语音输入');
      return;
    }

    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsRecording(true);
    recognition.onend = () => setIsRecording(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setNewPostContent(prev => prev + transcript);
    };

    recognition.start();
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) {
        setActiveTab('following'); // Default to following if logged in
        ForumDatabase.getFollowedNames().then(setFollowedNames);
      }
    });
  }, []);

  // Load Data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      let data: ForumPost[] = [];

      if (activeTab === 'following') {
        if (user) {
          data = await ForumDatabase.getFollowedPosts();
        } else {
          data = []; // Or redirect to login? For now just empty.
        }
      } else if (activeTab === 'mine') {
        if (user) {
          data = await ForumDatabase.getPostsByAuthor(user.email?.split('@')[0] || '');
        } else {
          data = [];
        }
      } else {
        data = await ForumDatabase.getPosts();
      }

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
  }, [activeTab, user]); // Reload when tab changes

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
      // Auto-extract video URL if not set
      let finalVideoUrl = newPostVideo;
      if (!finalVideoUrl) {
        const urlRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|bilibili\.com\/video\/)[^\s]+)/g;
        const match = newPostContent.match(urlRegex);
        if (match) {
          finalVideoUrl = match[0];
        }
      }

      const newPost: ForumPost = {
        id: `user-post-${Date.now()}`,
        title: newPostTitle,
        content: newPostContent,
        author: user.email?.split('@')[0] || '匿名用户',
        likes: 0,
        comments: 0,
        timestamp: Date.now(),
        isAiGenerated: false,
        tags: ['用户发布'],
        images: newPostImages,
        videoUrl: finalVideoUrl
      };

      await ForumDatabase.save(newPost);
      setPosts([newPost, ...posts]);
      setShowCreateModal(false);
      setNewPostTitle('');
      setShowCreateModal(false);
      setNewPostTitle('');
      setNewPostContent('');
      setNewPostImages([]);
      setNewPostVideo('');
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

  const handleFollow = async (authorName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      if (onNavigate) onNavigate(ViewState.LOGIN);
      return;
    }
    // Optimistic
    setFollowedNames([...followedNames, authorName]);
    await ForumDatabase.followUser(authorName);
  };

  const handleUnfollow = async (authorName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    // Optimistic
    setFollowedNames(followedNames.filter(n => n !== authorName));
    await ForumDatabase.unfollowUser(authorName);
  };

  const handleCommentClick = (post: ForumPost, e: React.MouseEvent) => {
    e.stopPropagation();
    // Allow guests to view comments

    // Toggle comment section
    if (expandedCommentPostId === post.id) {
      setExpandedCommentPostId(null);
    } else {
      setExpandedCommentPostId(post.id);
      // Fetch comments
      ForumDatabase.getCommentsByPostId(post.id).then(comments => {
        setPosts(prevPosts => prevPosts.map(p =>
          p.id === post.id ? { ...p, commentsList: comments } : p
        ));
      });
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

      // Persist to Backend
      await ForumDatabase.addComment(postId, newComment);

      setNewCommentContent('');
    } catch (err) {
      console.error(err);
      alert("评论失败");
    } finally {
      setSubmittingComment(false);
    }
  };

  const filteredPosts = activeTab === 'following'
    ? posts // Already fetched correctly in loadData
    : activeTab === 'trending'
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
              {/* User Status / Avatar */}
              {user ? (
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md ${['bg-red-500', 'bg-orange-500', 'bg-green-500', 'bg-blue-500', 'bg-purple-500', 'bg-pink-500'][
                    (user.email?.charCodeAt(0) || 0) % 6
                  ]
                    }`}
                  title={user.email}
                >
                  {user.email?.split('@')[0].slice(0, 2).toUpperCase()}
                </div>
              ) : (
                <div
                  onClick={() => onNavigate && onNavigate(ViewState.LOGIN)}
                  className="bg-gray-100 text-gray-500 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer hover:bg-gray-200 transition-colors"
                >
                  未登录
                </div>
              )}

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
              onClick={() => setActiveTab('following')}
              className={`flex items-center pb-3 px-1 transition-colors ${activeTab === 'following' ? 'text-indigo-600 border-b-4 border-indigo-600' : 'text-gray-400'}`}
            >
              <Users size={20} className="mr-2" strokeWidth={2.5} /> 关注
            </button>
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
            {user && (
              <button
                onClick={() => setActiveTab('mine')}
                className={`flex items-center pb-3 px-1 transition-colors ${activeTab === 'mine' ? 'text-indigo-600 border-b-4 border-indigo-600' : 'text-gray-400'}`}
              >
                <Users size={20} className="mr-2" strokeWidth={2.5} /> 我的
              </button>
            )}
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
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    {/* Author Name */}
                    <span className="text-base font-black text-gray-900">
                      @{post.author}
                    </span>

                    {/* Follow Button (Moved here) */}
                    {user && post.author !== (user.email?.split('@')[0]) && (
                      <button
                        onClick={(e) => followedNames.includes(post.author) ? handleUnfollow(post.author, e) : handleFollow(post.author, e)}
                        className={`text-xs font-bold px-3 py-1 rounded-full flex items-center transition-colors ${followedNames.includes(post.author)
                          ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                          }`}
                      >
                        {followedNames.includes(post.author) ? (
                          <>
                            <UserMinus size={12} className="mr-1" /> 已关注
                          </>
                        ) : (
                          <>
                            <UserPlus size={12} className="mr-1" /> 关注
                          </>
                        )}
                      </button>
                    )}

                    {/* Other Tags (excluding '用户发布') */}
                    {post.tags.filter(t => t !== '用户发布').map(tag => (
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

                  {/* Right Side: Timestamp Only */}
                  <div className="flex flex-col items-end ml-2">
                    <span className="text-xs font-bold text-gray-400 flex items-center whitespace-nowrap">
                      <Clock size={14} className="mr-1" />
                      {Math.floor((Date.now() - post.timestamp) / 60000)}分钟前
                    </span>
                  </div>
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
                        placeholder={user ? "写下你的评论..." : "登录后发表评论..."}
                        value={newCommentContent}
                        onChange={e => setNewCommentContent(e.target.value)}
                        onFocus={() => {
                          if (!user && onNavigate) onNavigate(ViewState.LOGIN);
                        }}
                        className="w-full bg-gray-100 border-none rounded-full py-3 pl-5 pr-14 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                        autoFocus={!!user}
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
          <div className="fixed inset-0 z-[60] flex md:items-center md:justify-center bg-white md:bg-black/60 md:backdrop-blur-sm animate-[fadeIn_0.2s]">
            <div className="bg-white w-full h-full md:h-auto md:max-w-2xl md:rounded-xl shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="flex justify-between items-center p-4 md:p-6 border-b md:border-none shrink-0">
                <h3 className="text-xl font-medium text-emerald-800 flex items-center">
                  <span className="mr-2"><Plus size={20} /></span> 发表新话题
                </h3>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                  <X size={24} />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 md:pt-0">
                <form id="create-post-form" onSubmit={handleSubmitPost} className="h-full flex flex-col space-y-4">
                  {/* Title Input */}
                  <div className="border border-gray-300 rounded-md px-3 py-2 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all shrink-0">
                    <input
                      type="text"
                      placeholder="标题：今日有何高见？"
                      value={newPostTitle}
                      onChange={e => setNewPostTitle(e.target.value)}
                      className="w-full text-lg outline-none text-gray-700 placeholder-gray-300"
                      autoFocus
                    />
                  </div>

                  {/* Content Input */}
                  <div className="border border-gray-200 rounded-md p-3 focus-within:border-blue-500 transition-all bg-gray-50/50 flex-1 min-h-[200px]">
                    <textarea
                      placeholder="展开叙述..."
                      value={newPostContent}
                      onChange={e => setNewPostContent(e.target.value)}
                      className="w-full h-full bg-transparent outline-none text-gray-600 resize-none placeholder-gray-300 text-base leading-relaxed"
                    />
                  </div>

                  {/* Tip */}
                  <div className="flex items-center text-xs text-gray-700 font-medium shrink-0">
                    <span className="bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded mr-2 font-bold">TIP</span>
                    支持粘贴 YouTube 视频链接，发布后将自动显示为播放器。
                  </div>

                  {/* Media Previews */}
                  {newPostImages.length > 0 && (
                    <div className="flex gap-2 mt-2 overflow-x-auto pb-2 shrink-0">
                      {newPostImages.map((img, idx) => (
                        <div key={idx} className="relative flex-shrink-0">
                          <img src={img} alt="Preview" className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
                          <button
                            type="button"
                            onClick={() => setNewPostImages(prev => prev.filter((_, i) => i !== idx))}
                            className="absolute -top-1 -right-1 bg-black/50 text-white rounded-full p-0.5"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </form>
              </div>

              {/* Footer Toolbar */}
              <div className="p-4 md:p-6 border-t md:border-none bg-white shrink-0">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

                  {/* Left: Category & Image */}
                  <div className="flex items-center justify-between md:justify-start space-x-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <span className="mr-2">发布至:</span>
                      <div className="relative">
                        <select className="appearance-none bg-white border border-gray-300 text-gray-700 py-1 pl-3 pr-8 rounded leading-tight focus:outline-none focus:border-gray-500">
                          <option>国际时事</option>
                          <option>社会热点</option>
                          <option>生活杂谈</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                          <ChevronDown size={14} />
                        </div>
                      </div>
                    </div>

                    {/* Image Upload Trigger */}
                    <label className="cursor-pointer text-gray-400 hover:text-gray-600 transition-colors p-2" title="上传图片">
                      <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
                      <Image size={24} />
                    </label>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center justify-end space-x-2 md:space-x-3">
                    <button
                      type="button"
                      onClick={handleAiPolish}
                      disabled={isPolishing || !newPostContent}
                      className="flex items-center px-3 md:px-4 py-2 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      <Wand2 size={18} className="md:mr-1.5" /> <span className="hidden md:inline">AI 润色</span>
                    </button>

                    <button
                      type="submit"
                      form="create-post-form"
                      disabled={isSubmitting || !newPostTitle.trim() || !newPostContent.trim()}
                      className="px-6 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 text-sm font-medium shadow-sm transition-colors disabled:opacity-50 disabled:bg-gray-300"
                    >
                      发布
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default ForumView;
