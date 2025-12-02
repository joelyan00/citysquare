import React, { useState, useEffect } from 'react';
import { ForumPost, Comment, UserRole } from '../types';
import { ViewState } from '../types';
import { supabase } from '../services/supabaseClient';
import {
  MessageCircle, Heart, Share2, MoreHorizontal, Image as ImageIcon, X,
  Send, Trash2, Video, ChevronDown, ChevronUp, UserPlus, UserMinus,
  Hash, Zap, Clock, Wand2, Link, Aperture, BookOpen, Sun, Moon, Plus
} from 'lucide-react';
import { ForumDatabase, ForumCrawler, AdminDatabase, uploadImageToSupabase, polishText } from '../services/geminiService';


interface ForumViewProps {
  city?: string;
  onNavigate?: (view: ViewState) => void;
  isDarkMode?: boolean;
  toggleTheme?: () => void;
}

const ForumView: React.FC<ForumViewProps> = ({ city, onNavigate, isDarkMode, toggleTheme }) => {
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [activeTab, setActiveTab] = useState<'following' | 'trending' | 'latest' | 'mine'>('trending');
  const [loading, setLoading] = useState(true);
  const [followedNames, setFollowedNames] = useState<string[]>([]);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostTags, setNewPostTags] = useState('');
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
  const [showShareModal, setShowShareModal] = useState<string | null>(null);


  // Comment Media State
  const [newCommentImages, setNewCommentImages] = useState<string[]>([]);
  const [isPolishingComment, setIsPolishingComment] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Upload to Supabase
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        // Convert to Base64
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
        const base64 = await base64Promise;

        const filename = `forum/${Date.now()}_${i}_${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
        const supabaseUrl = await uploadImageToSupabase(base64, filename);

        if (supabaseUrl) {
          setNewPostImages(prev => [...prev, supabaseUrl]);
        } else {
          alert('图片上传失败，请重试');
        }
      } catch (error) {
        console.error("Upload failed", error);
        alert('图片上传出错');
      }
    }
  };

  const handleCommentImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        // Convert to Base64
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
        const base64 = await base64Promise;

        const filename = `forum_comments/${Date.now()}_${i}_${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
        const supabaseUrl = await uploadImageToSupabase(base64, filename);

        if (supabaseUrl) {
          setNewCommentImages(prev => [...prev, supabaseUrl]);
        } else {
          alert('评论图片上传失败');
        }
      } catch (error) {
        console.error("Comment upload failed", error);
      }
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

  const handleCommentPolish = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!newCommentContent.trim()) return;
    setIsPolishingComment(true);
    try {
      const polished = await polishText(newCommentContent);
      setNewCommentContent(polished);
    } catch (error) {
      console.error("Polish failed", error);
    } finally {
      setIsPolishingComment(false);
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
        id: `user - post - ${Date.now()} `,
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
        id: `comment-${Date.now()}`,
        postId,
        author: user.email?.split('@')[0] || '匿名用户',
        content: newCommentContent,
        timestamp: Date.now(),
        images: newCommentImages,
        likes: 0
      };

      await ForumDatabase.addComment(postId, newComment);

      // Update local state
      const updatedPosts = posts.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            comments: p.comments + 1,
            commentsList: [...(p.commentsList || []), newComment]
          };
        }
        return p;
      });

      setPosts(updatedPosts);
      setNewCommentContent('');
      setNewCommentImages([]); // Reset images
    } catch (error) {
      console.error("Failed to comment:", error);
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
    <div className="bg-gray-50 dark:bg-gray-900 min-h-full pb-6 transition-colors duration-300">
      <header className="bg-white dark:bg-gray-800 sticky top-0 z-30 shadow-sm pt-4 pb-2 transition-all">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">社区论坛</h2>
            <div className="flex items-center gap-3">
              {/* Theme Toggle */}
              {toggleTheme && (
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-2xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                </button>
              )}
              {user ? (
                <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-sm border-2 border-white shadow-sm">
                  {user.email?.substring(0, 2).toUpperCase()}
                </div>
              ) : (
                <button onClick={() => onNavigate && onNavigate(ViewState.LOGIN)} className="text-sm font-bold text-gray-500 hover:text-gray-900">
                  登录
                </button>
              )}
              <button
                onClick={handleCreatePostClick}
                className="bg-indigo-600 text-white px-4 py-2 rounded-2xl font-bold shadow-lg shadow-indigo-200 active:scale-95 transition-all flex items-center"
              >
                <Plus size={18} className="mr-1" strokeWidth={3} /> 发帖
              </button>
            </div>
          </div>

          {/* Redesigned Tabs: Pill Style */}
          <div className="flex items-center gap-3 mb-2 overflow-x-auto no-scrollbar pb-1">
            {[
              { id: 'trending', label: '热门' },
              { id: 'latest', label: '最新' },
              { id: 'following', label: '关注' },
              ...(user ? [{ id: 'mine', label: '我的' }] : []),
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px - 6 py - 2.5 rounded - 2xl text - sm font - bold transition - all whitespace - nowrap shadow - sm ${activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-indigo-200'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  } `}
              >
                {tab.label}
              </button>
            ))}
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
                className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 active:bg-gray-50 dark:active:bg-gray-700 transition-colors"
                onClick={(e) => toggleExpand(post.id, e)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {/* Author Name */}
                    <span className="text-base font-black text-gray-900 dark:text-white">
                      @{post.author}
                    </span>

                    {/* Follow Button (Moved here) */}
                    {user && post.author !== (user.email?.split('@')[0]) && (
                      <button
                        onClick={(e) => followedNames.includes(post.author) ? handleUnfollow(post.author, e) : handleFollow(post.author, e)}
                        className={`text-xs font-bold px-3 py-1 rounded-lg flex items-center transition-all ${followedNames.includes(post.author)
                          ? 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          : 'border border-indigo-600 text-indigo-600 bg-transparent hover:bg-indigo-50'
                          } `}
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
                  </div>

                  {/* Right Side: Timestamp & Delete */}
                  <div className="flex flex-col items-end ml-2 gap-2">
                    <span className="text-xs font-bold text-gray-400 flex items-center whitespace-nowrap">
                      <Clock size={14} className="mr-1" />
                      {Math.floor((Date.now() - post.timestamp) / 60000)}分钟前
                    </span>

                    {/* Delete Button (Admin or Author) */}
                    {(user?.role === UserRole.ADMIN || (user?.email && user.email.split('@')[0] === post.author)) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('确定要删除这条帖子吗？')) {
                            ForumDatabase.deletePost(post.id).then(() => {
                              setPosts(prev => prev.filter(p => p.id !== post.id));
                            });
                          }
                        }}
                        className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                        title="删除帖子"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Tags Row */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {/* Other Tags (excluding '用户发布') */}
                  {post.tags.filter(t => t !== '用户发布').map(tag => (
                    <span key={tag} className="text-xs font-bold bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg flex items-center">
                      <Hash size={12} className="mr-0.5" strokeWidth={3} /> {tag}
                    </span>
                  ))}

                  {post.images && post.images.length > 0 && (
                    <span className="text-xs font-bold bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg border border-blue-100 flex items-center">
                      <ImageIcon size={12} className="mr-0.5" /> {post.images.length}图
                    </span>
                  )}

                  {post.isAiGenerated && (
                    <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg border border-indigo-100 flex items-center">
                      <Zap size={12} className="mr-0.5 fill-current" /> 话题
                    </span>
                  )}
                </div>

                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-3 leading-snug">
                  {post.title}
                </h3>
                <div className={`text-gray-700 dark:text-gray-300 text-base leading-relaxed whitespace-pre-wrap ${isExpanded ? '' : 'line-clamp-3'}`}>
                  {isExpanded ? (
                    post.content ? polishText(post.content) : post.content // Just display content, polish is manual
                  ) : post.content}
                </div>{/* Video Player */}
                {post.videoUrl && (
                  <div className="mb-6 rounded-xl overflow-hidden shadow-sm">
                    {post.videoUrl.includes('youtube.com') || post.videoUrl.includes('youtu.be') ? (
                      <iframe
                        width="100%"
                        height="315"
                        src={`https://www.youtube.com/embed/${post.videoUrl.match(/(?:v=|youtu\.be\/)([^&]+)/)?.[1]}`}
                        title="YouTube video player"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="w-full aspect-video"
                      ></iframe >
                    ) : post.videoUrl.includes('bilibili.com') ? (
                      <iframe
                        width="100%"
                        height="315"
                        src={`https://player.bilibili.com/player.html?bvid=${post.videoUrl.match(/video\/(BV[a-zA-Z0-9]+)/)?.[1]}&page=1&high_quality=1&danmaku=0`}
                        title="Bilibili video player"
                        frameBorder="0"
                        allowFullScreen
                        className="w-full aspect-video"
                      ></iframe>
                    ) : (
                      <a href={post.videoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center">
                        <Video size={20} className="mr-2" /> 观看视频
                      </a>
                    )}
                  </div >
                )}

                {/* Image Grid */}
                {
                  post.images && post.images.length > 0 && (
                    <div className={`grid gap-2 mb-6 ${post.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-3'}`}>
                      {post.images.map((img, idx) => (
                        <img
                          key={idx}
                          src={img}
                          alt={`Post image ${idx + 1}`}
                          className={`rounded-xl object-cover w-full h-full ${post.images!.length === 1 ? 'max-h-96' : 'aspect-square'}`}
                        />
                      ))}
                    </div>
                  )
                }

                <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-5">
                  <div className="flex items-center space-x-6">
                    <button
                      onClick={(e) => handleLike(post, e)}
                      className="flex items-center space-x-2 hover:text-red-500 transition-colors text-gray-500"
                    >
                      <Heart size={20} className={post.likes > 0 ? "fill-red-500 text-red-500" : ""} />
                      <span className="font-bold">{post.likes}</span>
                    </button>
                    <button
                      onClick={(e) => handleCommentClick(post, e)}
                      className="flex items-center space-x-2 hover:text-blue-500 transition-colors text-gray-500"
                    >
                      <MessageCircle size={20} />
                      <span className="font-bold">{post.comments}</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowShareModal(post.id);
                      }}
                      className="flex items-center space-x-2 hover:text-indigo-500 transition-colors text-gray-500"
                    >
                      <Share2 size={20} />
                      <span className="font-bold">分享</span>
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
                {
                  expandedCommentPostId === post.id && (
                    <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700 animate-[fadeIn_0.2s]" onClick={e => e.stopPropagation()}>
                      <h4 className="font-bold text-gray-900 dark:text-white mb-4">评论 ({post.comments})</h4>

                      {/* Comment List */}
                      <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
                        {post.commentsList?.map(comment => (
                          <div key={comment.id} className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl">
                            <div className="flex justify-between items-start mb-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-gray-900 dark:text-white">@{comment.author}</span>
                                <span className="text-xs text-gray-400">{Math.floor((Date.now() - comment.timestamp) / 60000)}分钟前</span>
                              </div>
                              {(user?.role === UserRole.ADMIN || (user?.email && user.email.split('@')[0] === comment.author)) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm('确定要删除这条评论吗？')) {
                                      ForumDatabase.deleteComment(comment.id).then(() => {
                                        // Update local state
                                        setPosts(prevPosts => prevPosts.map(p => {
                                          if (p.id === post.id) {
                                            return {
                                              ...p,
                                              comments: Math.max(0, p.comments - 1),
                                              commentsList: p.commentsList?.filter(c => c.id !== comment.id)
                                            };
                                          }
                                          return p;
                                        }));
                                      });
                                    }
                                  }}
                                  className="text-gray-400 hover:text-red-500 p-1"
                                  title="删除评论"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                            <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap">{comment.content}</p>

                            {/* Comment YouTube Video */}
                            {comment.content.match(/(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[^\s]+)/) && (
                              <div className="mt-2 rounded-lg overflow-hidden">
                                <iframe
                                  width="100%"
                                  height="200"
                                  src={`https://www.youtube.com/embed/${comment.content.match(/(?:v=|youtu\.be\/)([^&]+)/)?.[1]}`}
                                  title="YouTube video player"
                                  frameBorder="0"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                  className="w-full aspect-video"
                                ></iframe>
                              </div>
                            )}

                            {/* Comment Images */}
                            {comment.images && comment.images.length > 0 && (
                              <div className="mt-2 grid grid-cols-3 gap-2">
                                {comment.images.map((img, idx) => (
                                  <img
                                    key={idx}
                                    src={img}
                                    alt="Comment image"
                                    className="rounded-lg object-cover w-full h-24 cursor-pointer hover:opacity-90"
                                    onClick={() => window.open(img, '_blank')}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                        {(!post.commentsList || post.commentsList.length === 0) && (
                          <p className="text-gray-400 text-sm text-center py-2">暂无评论，快来抢沙发吧！</p>
                        )}
                      </div>

                      {/* Add Comment Form */}
                      <div className="flex flex-col gap-2">
                        {/* Image Preview */}
                        {newCommentImages.length > 0 && (
                          <div className="flex gap-2 overflow-x-auto py-2">
                            {newCommentImages.map((img, idx) => (
                              <div key={idx} className="relative shrink-0">
                                <img src={img} className="h-16 w-16 object-cover rounded-lg" />
                                <button
                                  onClick={() => setNewCommentImages(prev => prev.filter((_, i) => i !== idx))}
                                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <form onSubmit={(e) => handleSubmitComment(post.id, e)} className="w-full">
                          <div className="bg-gray-100 dark:bg-gray-700/50 rounded-2xl p-3 transition-colors focus-within:bg-white dark:focus-within:bg-gray-700 focus-within:ring-2 focus-within:ring-indigo-500/20 border border-transparent focus-within:border-indigo-500/50">
                            <textarea
                              placeholder="写下你的评论..."
                              value={newCommentContent}
                              onChange={e => setNewCommentContent(e.target.value)}
                              rows={2}
                              className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm text-gray-900 dark:text-white placeholder-gray-400 resize-none outline-none"
                              style={{ minHeight: '48px' }}
                            />

                            <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200 dark:border-gray-600/50">
                              <div className="flex items-center gap-3">
                                {/* AI Polish Button */}
                                <button
                                  type="button"
                                  onClick={handleCommentPolish}
                                  disabled={isPolishingComment || !newCommentContent.trim()}
                                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-all ${isPolishingComment
                                    ? 'bg-indigo-100 text-indigo-600 animate-pulse'
                                    : newCommentContent.trim()
                                      ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                                      : 'text-gray-400 cursor-not-allowed'
                                    }`}
                                  title="AI 润色"
                                >
                                  <Wand2 size={14} />
                                  <span>AI 润色</span>
                                </button>

                                {/* Image Upload */}
                                <label className="cursor-pointer text-gray-400 hover:text-indigo-600 p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                                  <input type="file" multiple accept="image/*" className="hidden" onChange={handleCommentImageUpload} />
                                  <ImageIcon size={18} />
                                </label>
                              </div>

                              <button
                                type="submit"
                                disabled={!newCommentContent.trim() && newCommentImages.length === 0}
                                className="bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                              >
                                <Send size={16} className="ml-0.5" />
                              </button>
                            </div>
                          </div>
                        </form>
                      </div>
                    </div>
                  )
                }

                {/* Share Modal */}
                {showShareModal === post.id && (
                  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center animate-[fadeIn_0.2s]" onClick={() => setShowShareModal(null)}>
                    <div className="bg-white dark:bg-gray-800 w-full sm:w-[28rem] rounded-t-[2rem] sm:rounded-[2rem] p-6 animate-[slideUp_0.3s]" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-black text-gray-900 dark:text-white">分享至</h3>
                        <button onClick={() => setShowShareModal(null)} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-xl text-gray-500">
                          <X size={20} />
                        </button>
                      </div>

                      <div className="grid grid-cols-4 gap-4 mb-8">
                        {[
                          { id: 'wechat', label: '微信好友', icon: MessageCircle, color: 'bg-green-500 text-white' },
                          { id: 'moments', label: '朋友圈', icon: Aperture, color: 'bg-gradient-to-tr from-green-400 to-blue-500 text-white' },
                          { id: 'xhs', label: '小红书', icon: BookOpen, color: 'bg-red-500 text-white' },
                          { id: 'copy', label: '复制链接', icon: Link, color: 'bg-gray-500 text-white' },
                        ].map((item) => (
                          <button
                            key={item.id}
                            onClick={() => {
                              const url = window.location.href;
                              const text = `【City666】${post.title}\n${post.content?.slice(0, 50)}...\n${url}`;

                              if (navigator.clipboard) {
                                navigator.clipboard.writeText(item.id === 'copy' ? url : text).then(() => {
                                  alert(item.id === 'copy' ? '链接已复制' : '内容已复制，请打开APP粘贴分享');
                                  setShowShareModal(null);
                                });
                              } else {
                                // Fallback
                                const textArea = document.createElement("textarea");
                                textArea.value = item.id === 'copy' ? url : text;
                                document.body.appendChild(textArea);
                                textArea.select();
                                document.execCommand('copy');
                                document.body.removeChild(textArea);
                                alert(item.id === 'copy' ? '链接已复制' : '内容已复制，请打开APP粘贴分享');
                                setShowShareModal(null);
                              }
                            }}
                            className="flex flex-col items-center gap-2 group"
                          >
                            <div className={`w-14 h-14 rounded-2xl ${item.color} flex items-center justify-center shadow-lg group-active:scale-95 transition-transform`}>
                              <item.icon size={28} strokeWidth={2} />
                            </div>
                            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{item.label}</span>
                          </button>
                        ))}
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 flex items-center gap-3">
                        <div className="bg-white dark:bg-gray-600 p-2 rounded-lg">
                          <Link size={20} className="text-gray-400" />
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{window.location.href}</p>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(window.location.href);
                            alert('链接已复制');
                          }}
                          className="text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-lg"
                        >
                          复制
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {
            !loading && filteredPosts.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <p className="font-bold text-lg">暂无帖子</p>
                <p className="text-sm">等待系统自动生成中...</p>
              </div>
            )
          }
        </div >
      </div >

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

                  {/* Content Input - Fixed Height for Mobile Cursor Issue */}
                  <div className="border border-gray-200 rounded-md p-3 focus-within:border-blue-500 transition-all bg-gray-50/50 min-h-[200px]">
                    <textarea
                      placeholder="展开叙述..."
                      value={newPostContent}
                      onChange={e => setNewPostContent(e.target.value)}
                      className="w-full h-full bg-transparent outline-none text-gray-600 resize-none placeholder-gray-300 text-base leading-relaxed"
                      style={{ minHeight: '180px' }}
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

                  {/* Left: Image Upload */}
                  <div className="flex items-center justify-between md:justify-start space-x-4">
                    {/* Image Upload Trigger */}
                    <label className="cursor-pointer flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-colors" title="上传图片">
                      <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
                      <ImageIcon size={20} />
                      <span className="text-sm font-bold">添加图片</span>
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
