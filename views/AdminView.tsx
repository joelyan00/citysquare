import React, { useState, useEffect } from 'react';
import { AppConfig, NewsCategory, AdPricing, UserRole } from '../types';
import { ConfigService } from '../services/configService';
import { NewsCrawler, NewsDatabase, ForumDatabase, generateTrendingTopic, AdminDatabase } from '../services/geminiService';
import { Save, RefreshCw, Trash2, ArrowLeft, Zap, CheckCircle, List, Type, DollarSign, Database, Clock, Plus, X, Users, Shield, PlayCircle, AlertCircle, MessageCircle } from 'lucide-react';
import { CustomCategory } from '../types';

interface AdminViewProps {
  onBack: () => void;
}

const AdminView: React.FC<AdminViewProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'config' | 'users' | 'services' | 'ads'>('config');
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState<string>('');
  const [syncStatus, setSyncStatus] = useState<Record<string, number>>({});

  // Management Data
  const [users, setUsers] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [ads, setAds] = useState<any[]>([]);

  // New Category Form State
  const [newCatName, setNewCatName] = useState('');
  const [newCatTopic, setNewCatTopic] = useState('');
  const [newCatKeywords, setNewCatKeywords] = useState('');

  // Ad Review State
  const [selectedAd, setSelectedAd] = useState<any | null>(null);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (!selectedAd) {
      setShowRejectInput(false);
      setRejectReason('');
    }
  }, [selectedAd]);

  useEffect(() => {
    loadConfig();
    loadSyncStatus();
  }, []);

  useEffect(() => {
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'services') loadServices();
    if (activeTab === 'ads') loadAds();
  }, [activeTab]);

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

    const statusObj: Record<string, number> = {
      [NewsCategory.LOCAL]: local,
      [NewsCategory.CANADA]: canada,
      [NewsCategory.USA]: usa,
      [NewsCategory.INTERNATIONAL]: international,
      [NewsCategory.CHINA]: china,
      'FORUM': forum
    };

    // Load sync status for custom categories
    if (config?.news.customCategories) {
      for (const cat of config.news.customCategories) {
        statusObj[cat.id] = await NewsDatabase.getLastUpdateTime(cat.id);
      }
    }

    setSyncStatus(statusObj);
  };

  const loadUsers = async () => {
    setLoading(true);
    const data = await AdminDatabase.getUsers();
    setUsers(data);
    setLoading(false);
  };

  const loadServices = async () => {
    setLoading(true);
    const data = await AdminDatabase.getPendingServices();
    setServices(data);
    setLoading(false);
  };

  const loadAds = async () => {
    setLoading(true);
    const data = await AdminDatabase.getPendingAds();
    setAds(data);
    setLoading(false);
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

  const handleTriggerNews = async (category: string) => {
    setLoading(true);
    showStatus(`正在抓取 ${category} 新闻...`);
    await NewsCrawler.forceRefresh(category);
    await loadSyncStatus(); // Update status
    setLoading(false);
    showStatus(`${category} 新闻抓取完成`);
  };

  const handleTriggerForum = async () => {
    setLoading(true);
    showStatus('正在生成 City666 话题...');
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
      refreshInterval: 60
    };

    setConfig({
      ...config,
      news: {
        ...config.news,
        customCategories: [...(config.news.customCategories || []), newCat]
      }
    });

    setNewCatName('');
    setNewCatTopic('');
    setNewCatKeywords('');
  };

  const handleRemoveCategory = (id: string) => {
    if (!config) return;
    if (!confirm('确定要删除这个分类吗？')) return;
    setConfig({
      ...config,
      news: {
        ...config.news,
        customCategories: (config.news.customCategories || []).filter(c => c.id !== id)
      }
    });
  };

  // --- Management Actions ---
  const handleToggleUserRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === UserRole.ADMIN ? UserRole.ORDINARY : UserRole.ADMIN;
    if (confirm(`确定要将用户权限修改为 ${newRole} 吗？`)) {
      await AdminDatabase.updateUserRole(userId, newRole);
      loadUsers();
      showStatus('用户权限已更新');
    }
  };

  const handleApproveService = async (id: string) => {
    if (confirm('确定通过该服务商申请吗？')) {
      await AdminDatabase.approveService(id);
      loadServices();
      showStatus('服务商申请已通过');
    }
  };

  const handleApproveAd = async (id: string) => {
    if (confirm('确定通过该广告申请吗？')) {
      await AdminDatabase.approveAd(id);
      loadAds();
      setSelectedAd(null);
      showStatus('广告申请已通过');
    }
  };

  const handleRejectAdConfirm = async () => {
    if (!selectedAd || !rejectReason.trim()) return;

    await AdminDatabase.rejectAd(selectedAd.id, rejectReason);
    loadAds();
    setSelectedAd(null);
    showStatus('广告已拒绝');
  };

  if (!config) return <div className="p-8 text-center">加载配置中...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={onBack} className="mr-4 p-2 hover:bg-gray-100 rounded-full transition-colors">
              <ArrowLeft size={24} className="text-gray-600" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Shield size={28} className="mr-2 text-indigo-600" />
              管理后台
            </h1>
          </div>
          <div className="flex items-center gap-4">
            {loading && <span className="text-sm text-gray-500 flex items-center"><RefreshCw className="animate-spin mr-1" size={14} /> 处理中...</span>}
            {actionStatus && <span className="text-sm font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full">{actionStatus}</span>}
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              <Save size={18} className="mr-2" /> 保存配置
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-5xl mx-auto px-4 flex gap-6 border-b border-gray-200">
          {[
            { id: 'config', label: '系统配置', icon: Database },
            { id: 'users', label: '用户管理', icon: Users },
            { id: 'services', label: '服务商审核', icon: CheckCircle },
            { id: 'ads', label: '广告审核', icon: PlayCircle },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center py-3 px-2 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              <tab.icon size={16} className="mr-2" />
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">

        {/* CONFIG TAB */}
        {activeTab === 'config' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Data Sync Status & Refresh Config */}
            <section className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <RefreshCw size={20} className="mr-2 text-blue-500" /> 新闻抓取配置
              </h2>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">分类</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">上次更新</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">抓取间隔 (小时)</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {/* Static Categories */}
                    {[
                      { id: NewsCategory.LOCAL, label: '本地新闻', intervalKey: 'localRefreshInterval' },
                      { id: NewsCategory.CANADA, label: '加拿大新闻', intervalKey: 'canadaRefreshInterval' },
                      { id: NewsCategory.USA, label: '美国新闻', intervalKey: 'usaRefreshInterval' },
                      { id: NewsCategory.CHINA, label: '科技新闻', intervalKey: 'chinaRefreshInterval' }, // Was China
                      { id: NewsCategory.INTERNATIONAL, label: '东亚新闻', intervalKey: 'intlRefreshInterval' }, // Was International
                    ].map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.label}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                          {syncStatus[item.id] > 0 ? new Date(syncStatus[item.id]).toLocaleString() : '无数据'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center">
                            <input
                              type="number"
                              min="1"
                              value={Math.round((config.news[item.intervalKey as keyof typeof config.news] as number) / 60)}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 1;
                                setConfig({
                                  ...config,
                                  news: {
                                    ...config.news,
                                    [item.intervalKey]: val * 60
                                  }
                                });
                              }}
                              className="w-16 border border-gray-300 rounded px-2 py-1 text-center mr-2"
                            />
                            <span className="text-xs text-gray-400">小时</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleTriggerNews(item.id as NewsCategory)}
                            className="text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 px-3 py-1 rounded transition-colors"
                          >
                            立即抓取
                          </button>
                        </td>
                      </tr>
                    ))}

                    {/* Custom Categories */}
                    {config.news.customCategories?.map((cat) => (
                      <tr key={cat.id} className="bg-purple-50/50">
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-purple-900 flex items-center">
                          <List size={14} className="mr-2 text-purple-500" />
                          {cat.name}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                          {syncStatus[cat.id] > 0 ? new Date(syncStatus[cat.id]).toLocaleString() : '无数据'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center">
                            <input
                              type="number"
                              min="1"
                              value={Math.round((cat.refreshInterval || 60) / 60)}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 1;
                                const updatedCats = config.news.customCategories?.map(c =>
                                  c.id === cat.id ? { ...c, refreshInterval: val * 60 } : c
                                );
                                setConfig({
                                  ...config,
                                  news: {
                                    ...config.news,
                                    customCategories: updatedCats
                                  }
                                });
                              }}
                              className="w-16 border border-purple-200 rounded px-2 py-1 text-center mr-2 focus:ring-purple-500 focus:border-purple-500"
                            />
                            <span className="text-xs text-gray-400">小时</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleTriggerNews(cat.id)}
                            className="text-purple-600 hover:text-purple-900 hover:bg-purple-50 px-3 py-1 rounded transition-colors"
                          >
                            立即抓取
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex flex-wrap gap-3 border-t border-gray-100 pt-4">
                <button onClick={handleTriggerForum} className="btn-secondary text-xs flex items-center">
                  <Zap size={14} className="mr-1" /> 生成论坛话题
                </button>
                <button onClick={handleClearData} className="ml-auto text-red-500 hover:bg-red-50 px-3 py-1 rounded text-xs font-bold transition-colors flex items-center">
                  <Trash2 size={14} className="mr-1" /> 清空所有数据
                </button>
              </div>
            </section>

            {/* Custom Categories */}
            <section className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <List size={20} className="mr-2 text-purple-500" /> 自定义新闻分类
              </h2>

              <div className="space-y-3 mb-6">
                {config.news.customCategories?.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg group">
                    <div>
                      <span className="font-bold text-gray-800 mr-3">{cat.name}</span>
                      <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">Topic: {cat.topic}</span>
                    </div>
                    <button onClick={() => handleRemoveCategory(cat.id)} className="text-gray-400 hover:text-red-500">
                      <X size={18} />
                    </button>
                  </div>
                ))}
                {(!config.news.customCategories || config.news.customCategories.length === 0) && (
                  <div className="text-gray-400 text-sm italic">暂无自定义分类</div>
                )}
              </div>

              <div className="flex gap-2 items-end bg-gray-50 p-4 rounded-lg">
                <div className="flex-1">
                  <label className="text-xs font-bold text-gray-500 mb-1 block">分类名称 (如: 科技)</label>
                  <input
                    type="text"
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    placeholder="显示在标签上"
                  />
                </div>
                <div className="flex-[2]">
                  <label className="text-xs font-bold text-gray-500 mb-1 block">搜索主题 (英文/中文)</label>
                  <input
                    type="text"
                    value={newCatTopic}
                    onChange={e => setNewCatTopic(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    placeholder="AI Search Topic"
                  />
                </div>
                <button
                  onClick={handleAddCategory}
                  disabled={!newCatName || !newCatTopic}
                  className="bg-black text-white p-1.5 rounded hover:bg-gray-800 disabled:opacity-50"
                >
                  <Plus size={20} />
                </button>
              </div>
            </section>

            {/* Forum Configuration */}
            <section className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <MessageCircle size={20} className="mr-2 text-indigo-500" /> 论坛话题配置
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">话题分类 (逗号分隔)</label>
                  <textarea
                    value={config.forum.categories}
                    onChange={(e) => setConfig({ ...config, forum: { ...config.forum, categories: e.target.value } })}
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm h-24 focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="例如: 军事, 科技, 历史..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">生成关键词 (逗号分隔)</label>
                  <textarea
                    value={config.forum.topicKeywords}
                    onChange={(e) => setConfig({ ...config, forum: { ...config.forum, topicKeywords: e.target.value } })}
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm h-24 focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="例如: Cost of living, Traffic..."
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">提问风格 (逗号分隔)</label>
                  <textarea
                    value={config.forum.questionTypes}
                    onChange={(e) => setConfig({ ...config, forum: { ...config.forum, questionTypes: e.target.value } })}
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm h-20 focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="例如: 无知提问, 尖锐问题..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">自动生成间隔 (分钟)</label>
                  <div className="flex items-center">
                    <input
                      type="number"
                      min="10"
                      value={config.forum.generateInterval}
                      onChange={(e) => setConfig({ ...config, forum: { ...config.forum, generateInterval: parseInt(e.target.value) || 60 } })}
                      className="w-32 border border-gray-300 rounded-lg p-2 text-center mr-2"
                    />
                    <span className="text-sm text-gray-500">分钟</span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">用户</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">角色</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">注册时间</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs mr-3">
                          {u.email?.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="text-sm font-medium text-gray-900">{u.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${u.role === UserRole.ADMIN ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
                        }`}>
                        {u.role || 'Ordinary'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleToggleUserRole(u.id, u.role)}
                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                      >
                        {u.role === UserRole.ADMIN ? '降级为普通用户' : '设为管理员'}
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={4} className="px-6 py-10 text-center text-gray-500">暂无用户数据</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* SERVICES TAB */}
        {activeTab === 'services' && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-lg font-bold text-gray-900 mb-4">待审核服务商</h3>
            {services.length === 0 ? (
              <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-lg">暂无待审核服务商</div>
            ) : (
              <div className="space-y-4">
                {services.map(s => (
                  <div key={s.id} className="border border-gray-200 rounded-lg p-4 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-lg">{s.title}</div>
                      <div className="text-sm text-gray-500">{s.category} - {s.contact}</div>
                      <div className="text-sm text-gray-600 mt-1">{s.description}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleApproveService(s.id)} className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600">通过</button>
                      <button className="bg-red-100 text-red-600 px-3 py-1 rounded text-sm hover:bg-red-200">拒绝</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ADS TAB */}
        {activeTab === 'ads' && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-lg font-bold text-gray-900 mb-4">待审核广告</h3>
            {ads.length === 0 ? (
              <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-lg">暂无待审核广告</div>
            ) : (
              <div className="space-y-4">
                {ads.map(ad => (
                  <div
                    key={ad.id}
                    onClick={() => setSelectedAd(ad)}
                    className="border border-gray-200 rounded-lg p-4 flex gap-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    {ad.imageUrl && <img src={ad.imageUrl} className="w-24 h-24 object-cover rounded" alt="ad" />}
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div className="font-bold text-lg">{ad.title}</div>
                        <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-1 rounded">ID: {ad.id?.slice(0, 8)}</span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1 line-clamp-2">{ad.description || ad.content}</div>
                      <div className="mt-2 text-xs text-blue-600 font-bold">点击审核</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Ad Details Modal */}
        {selectedAd && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn" onClick={() => setSelectedAd(null)}>
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-xl font-black text-gray-900">广告审核</h3>
                <button onClick={() => setSelectedAd(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto">
                <div className="flex flex-col md:flex-row gap-6">
                  {selectedAd.imageUrl && (
                    <img src={selectedAd.imageUrl} className="w-full md:w-1/2 rounded-xl object-cover shadow-sm" alt="Ad Preview" />
                  )}
                  <div className="flex-1 space-y-4">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase flex justify-between">
                        标题
                        <span className="font-mono text-gray-400">ID: {selectedAd.id}</span>
                      </label>
                      <div className="text-xl font-bold text-gray-900">{selectedAd.title}</div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">内容</label>
                      <div className="text-gray-700 whitespace-pre-wrap">{selectedAd.content}</div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">原始需求</label>
                      <div className="text-gray-500 text-sm bg-gray-50 p-2 rounded">{selectedAd.rawContent}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">联系方式</label>
                        <div className="font-medium">{selectedAd.contactInfo || '未提供'}</div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">总价</label>
                        <div className="font-bold text-green-600">${selectedAd.priceTotal}</div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">投放范围</label>
                        <div className="font-medium capitalize">{selectedAd.scope}</div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">时长</label>
                        <div className="font-medium">{selectedAd.durationDays} 天</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rejection Form */}
                {showRejectInput && (
                  <div className="mt-6 bg-red-50 p-4 rounded-xl border border-red-100 animate-in slide-in-from-top-2">
                    <label className="block text-sm font-bold text-red-800 mb-2">拒绝理由</label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="w-full border-red-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                      placeholder="请详细说明拒绝原因，以便用户修改..."
                      rows={3}
                      autoFocus
                    />
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                {showRejectInput ? (
                  <>
                    <button
                      onClick={() => setShowRejectInput(false)}
                      className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleRejectAdConfirm}
                      disabled={!rejectReason.trim()}
                      className="px-6 py-2 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 disabled:opacity-50 shadow-sm transition-colors"
                    >
                      确认拒绝
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setShowRejectInput(true)}
                      className="px-6 py-2 bg-white border border-red-200 text-red-600 font-bold rounded-lg hover:bg-red-50 transition-colors"
                    >
                      拒绝
                    </button>
                    <button
                      onClick={() => handleApproveAd(selectedAd.id)}
                      className="px-6 py-2 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 shadow-lg shadow-green-200 transition-colors"
                    >
                      通过审核
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default AdminView;
