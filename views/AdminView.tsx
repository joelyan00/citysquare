
import React, { useState, useEffect } from 'react';
import { AppConfig, NewsCategory, AdPricing } from '../types';
import { ConfigService } from '../services/configService';
import { NewsCrawler, NewsDatabase, ForumDatabase, generateTrendingTopic } from '../services/geminiService';
import { Save, RefreshCw, Trash2, ArrowLeft, Zap, CheckCircle, List, Type, DollarSign, Database, Clock, Plus, X } from 'lucide-react';
import { CustomCategory } from '../types';

interface AdminViewProps {
  onBack: () => void;
}

const AdminView: React.FC<AdminViewProps> = ({ onBack }) => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState<string>('');
  const [syncStatus, setSyncStatus] = useState<Record<string, number>>({});

  // New Category Form State
  const [newCatName, setNewCatName] = useState('');
  const [newCatTopic, setNewCatTopic] = useState('');
  const [newCatKeywords, setNewCatKeywords] = useState('');

  useEffect(() => {
    loadConfig();
    loadSyncStatus();
  }, []);

  const loadConfig = async () => {
    const data = await ConfigService.get();
    setConfig(data);
  };

  const loadSyncStatus = async () => {
    const local = await NewsDatabase.getLastUpdateTime(NewsCategory.LOCAL);
    const canada = await NewsDatabase.getLastUpdateTime(NewsCategory.CANADA);
    const usa = await NewsDatabase.getLastUpdateTime(NewsCategory.USA);
    const international = await NewsDatabase.getLastUpdateTime(NewsCategory.INTERNATIONAL);
    const china = await NewsDatabase.getLastUpdateTime(NewsCategory.CHINA);
    const forum = await ForumDatabase.getLastUpdateTime();

    setSyncStatus({
      [NewsCategory.LOCAL]: local,
      [NewsCategory.CANADA]: canada,
      [NewsCategory.USA]: usa,
      [NewsCategory.INTERNATIONAL]: international,
      [NewsCategory.CHINA]: china,
      'FORUM': forum
    });
  };

  const handleSave = async () => {
    if (!config) return;
    setLoading(true);
    await ConfigService.save(config);
    setLoading(false);
    showStatus('配置已保存');
  };

  const showStatus = (msg: string) => {
    setActionStatus(msg);
    setTimeout(() => setActionStatus(''), 3000);
  };

  const handleTriggerNews = async (category: NewsCategory) => {
    setLoading(true);
    showStatus(`正在抓取 ${category} 新闻...`);
    await NewsCrawler.forceRefresh(category);
    await loadSyncStatus(); // Update status
    setLoading(false);
    showStatus(`${category} 新闻抓取完成`);
  };

  const handleTriggerForum = async () => {
    setLoading(true);
    showStatus('正在生成 CitySquare 话题...');
    const result = await generateTrendingTopic();
    await loadSyncStatus(); // Update status
    setLoading(false);
    showStatus(result ? `成功生成: ${result.title}` : '话题生成失败');
  };

  const handleClearData = async () => {
    if (!confirm('确定要清空所有新闻和论坛数据吗？此操作不可恢复。')) return;
    setLoading(true);
    await NewsDatabase.clearAll();
    await ForumDatabase.clearAll();
    await loadSyncStatus();
    setLoading(false);
    showStatus('数据库已清空');
  };

  const handleAddCategory = () => {
    if (!config || !newCatName || !newCatTopic) return;

    const newCat: CustomCategory = {
      id: `cat-${Date.now()}`,
      name: newCatName,
      topic: newCatTopic,
      keywords: newCatKeywords,
      articleCount: 10,
      timeWindow: '24 hours',
      retentionLimit: 50,
      refreshInterval: 120
    };

    const updatedCategories = [...(config.news.customCategories || []), newCat];
    setConfig({ ...config, news: { ...config.news, customCategories: updatedCategories } });

    setNewCatName('');
    setNewCatTopic('');
    setNewCatKeywords('');
    showStatus('分类已添加 (记得保存)');
  };

  const handleRemoveCategory = (id: string) => {
    if (!config) return;
    if (!confirm('确定要删除这个分类吗？')) return;

    const updatedCategories = (config.news.customCategories || []).filter(c => c.id !== id);
    setConfig({ ...config, news: { ...config.news, customCategories: updatedCategories } });
  };

  const formatTime = (ts: number) => {
    if (!ts || ts === 0) return '从未更新';
    return new Date(ts).toLocaleString();
  };

  if (!config) return <div className="p-10 text-center">加载配置中...</div>;

  return (
    <div className="bg-gray-50 min-h-full pb-20">
      <header className="bg-gray-900 text-white p-5 sticky top-0 z-30 shadow-md">
        <div className="flex items-center space-x-3">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-black tracking-wide">后台管理控制台</h1>
        </div>
      </header>

      <div className="p-5 space-y-6">
        {actionStatus && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-xl flex items-center animate-bounce">
            <CheckCircle size={20} className="mr-2" />
            {actionStatus}
          </div>
        )}

        {/* System Status Panel */}
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-black text-gray-800 mb-4 flex items-center">
            <Database size={20} className="mr-2 text-blue-600" /> 系统数据状态 (云同步)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(syncStatus).map(([key, ts]) => (
              <div key={key} className="bg-gray-50 p-3 rounded-xl flex justify-between items-center">
                <span className="text-xs font-bold text-gray-500 uppercase">{key === 'FORUM' ? '论坛话题' : key}</span>
                <div className="flex items-center text-sm font-medium text-gray-800">
                  <Clock size={14} className="mr-1.5 text-gray-400" />
                  {formatTime(ts as number)}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Custom Category Management */}
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-black text-gray-800 mb-4 flex items-center">
            <List size={20} className="mr-2 text-purple-600" /> 新闻分类管理
          </h2>

          <div className="space-y-4">
            {/* List Existing Custom Categories */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {config.news.customCategories?.map(cat => (
                <div key={cat.id} className="bg-purple-50 border border-purple-100 p-4 rounded-xl relative group">
                  <button
                    onClick={() => handleRemoveCategory(cat.id)}
                    className="absolute top-2 right-2 text-purple-300 hover:text-red-500 transition-colors"
                  >
                    <X size={18} />
                  </button>
                  <h3 className="font-bold text-purple-900">{cat.name}</h3>
                  <p className="text-xs text-purple-600 mt-1">Topic: {cat.topic}</p>
                  <p className="text-xs text-purple-500 mt-0.5">Keywords: {cat.keywords || 'None'}</p>
                </div>
              ))}
              {(!config.news.customCategories || config.news.customCategories.length === 0) && (
                <div className="text-gray-400 text-sm italic p-2">暂无自定义分类</div>
              )}
            </div>

            {/* Add New Form */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mt-4">
              <h3 className="text-sm font-bold text-gray-700 mb-3">添加新分类</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="显示名称 (如: 科技)"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  className="bg-white border border-gray-200 rounded-lg p-2.5 text-sm font-medium focus:ring-2 focus:ring-purple-500 outline-none"
                />
                <input
                  type="text"
                  placeholder="搜索主题 (如: Technology)"
                  value={newCatTopic}
                  onChange={e => setNewCatTopic(e.target.value)}
                  className="bg-white border border-gray-200 rounded-lg p-2.5 text-sm font-medium focus:ring-2 focus:ring-purple-500 outline-none"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="关键词 (可选)"
                    value={newCatKeywords}
                    onChange={e => setNewCatKeywords(e.target.value)}
                    className="bg-white border border-gray-200 rounded-lg p-2.5 text-sm font-medium focus:ring-2 focus:ring-purple-500 outline-none flex-grow"
                  />
                  <button
                    onClick={handleAddCategory}
                    disabled={!newCatName || !newCatTopic}
                    className="bg-purple-600 text-white px-4 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* AI News Config */}
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-black text-gray-800 mb-4 flex items-center">
            <RefreshCw size={20} className="mr-2 text-brand-600" /> 新闻生成参数
          </h2>

          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">全局额外关键词 (逗号分隔)</label>
              <input
                type="text"
                value={config.news.extraKeywords}
                onChange={e => setConfig({ ...config, news: { ...config.news, extraKeywords: e.target.value } })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-medium text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>

            {/* Local News */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold text-gray-700">本地新闻 (Local)</h3>
                <button
                  onClick={() => handleTriggerNews(NewsCategory.LOCAL)}
                  disabled={loading}
                  className="text-xs bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg font-bold hover:bg-gray-100 active:scale-95 transition-transform flex items-center"
                >
                  <RefreshCw size={12} className="mr-1" /> 立即更新
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">每次抓取数量</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={config.news.localArticleCount}
                    onChange={e => {
                      if (/^\d*$/.test(e.target.value)) {
                        setConfig({ ...config, news: { ...config.news, localArticleCount: e.target.value === '' ? 0 : parseInt(e.target.value) } })
                      }
                    }}
                    className="w-full bg-white border border-gray-200 rounded-xl p-3 font-medium text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">最大保留数量</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={config.news.localRetentionLimit || 50}
                    onChange={e => {
                      if (/^\d*$/.test(e.target.value)) {
                        setConfig({ ...config, news: { ...config.news, localRetentionLimit: e.target.value === '' ? 0 : parseInt(e.target.value) } })
                      }
                    }}
                    className="w-full bg-white border border-gray-200 rounded-xl p-3 font-medium text-sm text-green-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">更新间隔 (分钟)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={config.news.localRefreshInterval || 720}
                    onChange={e => {
                      if (/^\d*$/.test(e.target.value)) {
                        setConfig({ ...config, news: { ...config.news, localRefreshInterval: e.target.value === '' ? 0 : parseInt(e.target.value) } })
                      }
                    }}
                    className="w-full bg-white border border-gray-200 rounded-xl p-3 font-medium text-sm"
                  />
                </div>
              </div>
            </div>

            {/* USA News */}
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold text-blue-800">美国新闻 (USA)</h3>
                <button
                  onClick={() => handleTriggerNews(NewsCategory.USA)}
                  disabled={loading}
                  className="text-xs bg-white border border-blue-200 text-blue-600 px-3 py-1.5 rounded-lg font-bold hover:bg-blue-100 active:scale-95 transition-transform flex items-center"
                >
                  <RefreshCw size={12} className="mr-1" /> 立即更新
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-blue-400 uppercase mb-1">数量</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={config.news.usaArticleCount || 10}
                    onChange={e => {
                      if (/^\d*$/.test(e.target.value)) {
                        setConfig({ ...config, news: { ...config.news, usaArticleCount: e.target.value === '' ? 0 : parseInt(e.target.value) } })
                      }
                    }}
                    className="w-full bg-white border border-blue-200 rounded-xl p-3 font-medium text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-blue-400 uppercase mb-1">最大保留数量</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={config.news.usaRetentionLimit || 50}
                    onChange={e => {
                      if (/^\d*$/.test(e.target.value)) {
                        setConfig({ ...config, news: { ...config.news, usaRetentionLimit: e.target.value === '' ? 0 : parseInt(e.target.value) } })
                      }
                    }}
                    className="w-full bg-white border border-blue-200 rounded-xl p-3 font-medium text-sm text-blue-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-blue-400 uppercase mb-1">更新间隔 (分钟)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={config.news.usaRefreshInterval || 120}
                    onChange={e => {
                      if (/^\d*$/.test(e.target.value)) {
                        setConfig({ ...config, news: { ...config.news, usaRefreshInterval: e.target.value === '' ? 0 : parseInt(e.target.value) } })
                      }
                    }}
                    className="w-full bg-white border border-blue-200 rounded-xl p-3 font-medium text-sm"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-xs font-bold text-blue-400 uppercase mb-1">USA 关键词</label>
                  <input
                    type="text"
                    value={config.news.usaKeywords || ''}
                    onChange={e => setConfig({ ...config, news: { ...config.news, usaKeywords: e.target.value } })}
                    className="w-full bg-white border border-blue-200 rounded-xl p-3 font-medium text-sm"
                    placeholder="Tech, Politics..."
                  />
                </div>
              </div>
            </div>

            {/* Canada News */}
            <div className="bg-red-50 p-4 rounded-xl border border-red-100">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold text-red-800">加拿大新闻 (Canada)</h3>
                <button
                  onClick={() => handleTriggerNews(NewsCategory.CANADA)}
                  disabled={loading}
                  className="text-xs bg-white border border-red-200 text-red-600 px-3 py-1.5 rounded-lg font-bold hover:bg-red-100 active:scale-95 transition-transform flex items-center"
                >
                  <RefreshCw size={12} className="mr-1" /> 立即更新
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-red-400 uppercase mb-1">数量</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={config.news.canadaArticleCount || 10}
                    onChange={e => {
                      if (/^\d*$/.test(e.target.value)) {
                        setConfig({ ...config, news: { ...config.news, canadaArticleCount: e.target.value === '' ? 0 : parseInt(e.target.value) } })
                      }
                    }}
                    className="w-full bg-white border border-red-200 rounded-xl p-3 font-medium text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-red-400 uppercase mb-1">最大保留数量</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={config.news.canadaRetentionLimit || 50}
                    onChange={e => {
                      if (/^\d*$/.test(e.target.value)) {
                        setConfig({ ...config, news: { ...config.news, canadaRetentionLimit: e.target.value === '' ? 0 : parseInt(e.target.value) } })
                      }
                    }}
                    className="w-full bg-white border border-red-200 rounded-xl p-3 font-medium text-sm text-red-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-red-400 uppercase mb-1">更新间隔 (分钟)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={config.news.canadaRefreshInterval || 120}
                    onChange={e => {
                      if (/^\d*$/.test(e.target.value)) {
                        setConfig({ ...config, news: { ...config.news, canadaRefreshInterval: e.target.value === '' ? 0 : parseInt(e.target.value) } })
                      }
                    }}
                    className="w-full bg-white border border-red-200 rounded-xl p-3 font-medium text-sm"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-xs font-bold text-red-400 uppercase mb-1">加拿大关键词</label>
                  <input
                    type="text"
                    value={config.news.canadaKeywords || ''}
                    onChange={e => setConfig({ ...config, news: { ...config.news, canadaKeywords: e.target.value } })}
                    className="w-full bg-white border border-red-200 rounded-xl p-3 font-medium text-sm"
                  />
                </div>
              </div>
            </div>

            {/* China News */}
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold text-amber-800">中国新闻 (China)</h3>
                <button
                  onClick={() => handleTriggerNews(NewsCategory.CHINA)}
                  disabled={loading}
                  className="text-xs bg-white border border-amber-200 text-amber-600 px-3 py-1.5 rounded-lg font-bold hover:bg-amber-100 active:scale-95 transition-transform flex items-center"
                >
                  <RefreshCw size={12} className="mr-1" /> 立即更新
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-amber-400 uppercase mb-1">数量</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={config.news.chinaArticleCount || 10}
                    onChange={e => {
                      if (/^\d*$/.test(e.target.value)) {
                        setConfig({ ...config, news: { ...config.news, chinaArticleCount: e.target.value === '' ? 0 : parseInt(e.target.value) } })
                      }
                    }}
                    className="w-full bg-white border border-amber-200 rounded-xl p-3 font-medium text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-amber-400 uppercase mb-1">最大保留数量</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={config.news.chinaRetentionLimit || 50}
                    onChange={e => {
                      if (/^\d*$/.test(e.target.value)) {
                        setConfig({ ...config, news: { ...config.news, chinaRetentionLimit: e.target.value === '' ? 0 : parseInt(e.target.value) } })
                      }
                    }}
                    className="w-full bg-white border border-amber-200 rounded-xl p-3 font-medium text-sm text-amber-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-amber-400 uppercase mb-1">更新间隔 (分钟)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={config.news.chinaRefreshInterval || 720}
                    onChange={e => {
                      if (/^\d*$/.test(e.target.value)) {
                        setConfig({ ...config, news: { ...config.news, chinaRefreshInterval: e.target.value === '' ? 0 : parseInt(e.target.value) } })
                      }
                    }}
                    className="w-full bg-white border border-amber-200 rounded-xl p-3 font-medium text-sm"
                  />
                </div>
              </div>
            </div>

            {/* International News */}
            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold text-indigo-800">国际新闻 (Intl)</h3>
                <button
                  onClick={() => handleTriggerNews(NewsCategory.INTERNATIONAL)}
                  disabled={loading}
                  className="text-xs bg-white border border-indigo-200 text-indigo-600 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-100 active:scale-95 transition-transform flex items-center"
                >
                  <RefreshCw size={12} className="mr-1" /> 立即更新
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-indigo-400 uppercase mb-1">数量</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={config.news.intlArticleCount || 8}
                    onChange={e => {
                      if (/^\d*$/.test(e.target.value)) {
                        setConfig({ ...config, news: { ...config.news, intlArticleCount: e.target.value === '' ? 0 : parseInt(e.target.value) } })
                      }
                    }}
                    className="w-full bg-white border border-indigo-200 rounded-xl p-3 font-medium text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-indigo-400 uppercase mb-1">最大保留数量</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={config.news.intlRetentionLimit || 50}
                    onChange={e => {
                      if (/^\d*$/.test(e.target.value)) {
                        setConfig({ ...config, news: { ...config.news, intlRetentionLimit: e.target.value === '' ? 0 : parseInt(e.target.value) } })
                      }
                    }}
                    className="w-full bg-white border border-indigo-200 rounded-xl p-3 font-medium text-sm text-indigo-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-indigo-400 uppercase mb-1">更新间隔 (分钟)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={config.news.intlRefreshInterval || 120}
                    onChange={e => {
                      if (/^\d*$/.test(e.target.value)) {
                        setConfig({ ...config, news: { ...config.news, intlRefreshInterval: e.target.value === '' ? 0 : parseInt(e.target.value) } })
                      }
                    }}
                    className="w-full bg-white border border-indigo-200 rounded-xl p-3 font-medium text-sm"
                  />
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Forum Config */}
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-black text-gray-800 mb-4 flex items-center">
            <Zap size={20} className="mr-2 text-indigo-600" /> 论坛生成参数
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">搜索热门话题关键词</label>
              <input
                type="text"
                value={config.forum.topicKeywords}
                onChange={e => setConfig({ ...config, forum: { ...config.forum, topicKeywords: e.target.value } })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-medium text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="例如：房价, 交通, 美食"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center"><List size={14} className="mr-1" /> 话题类别库 (逗号分隔)</label>
              <textarea
                rows={3}
                value={config.forum.categories}
                onChange={e => setConfig({ ...config, forum: { ...config.forum, categories: e.target.value } })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-medium text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="例如：军事, 历史, 科技, 哲学..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center"><Type size={14} className="mr-1" /> 提问风格类型 (逗号分隔)</label>
              <textarea
                rows={3}
                value={config.forum.questionTypes}
                onChange={e => setConfig({ ...config, forum: { ...config.forum, questionTypes: e.target.value } })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-medium text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="例如：无知提问, 尖锐问题, 理性讨论..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">生成频率 (分钟)</label>
              <input
                type="text"
                inputMode="numeric"
                value={config.forum.generateInterval}
                onChange={e => {
                  if (/^\d*$/.test(e.target.value)) {
                    setConfig({ ...config, forum: { ...config.forum, generateInterval: e.target.value === '' ? 0 : parseInt(e.target.value) } })
                  }
                }}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-medium text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
        </section>

        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full bg-brand-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-brand-500/30 flex justify-center items-center active:scale-95 transition-transform"
        >
          <Save size={20} className="mr-2" /> 保存配置
        </button>

        <hr className="border-gray-200 my-4" />

        {/* Manual Triggers */}
        <section className="space-y-3">
          <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest ml-1">测试工具</h3>
          <div className="grid grid-cols-1 gap-3">
            <button onClick={handleTriggerForum} disabled={loading} className="bg-white border-2 border-indigo-100 text-indigo-700 font-bold py-3 rounded-xl hover:bg-indigo-50 col-span-2">
              生成 CitySquare 话题 (测试)
            </button>
          </div>
        </section>

        {/* Danger Zone */}
        <button
          onClick={handleClearData}
          disabled={loading}
          className="w-full bg-red-50 text-red-600 font-bold py-4 rounded-2xl flex justify-center items-center mt-8 border border-red-100"
        >
          <Trash2 size={20} className="mr-2" /> 清空所有数据 (重置)
        </button>
      </div>
    </div>
  );
};

export default AdminView;
