import React, { useState, useEffect } from 'react';
import { AppConfig, NewsCategory, AdPricing, UserRole } from '../types';
import { ConfigService } from '../services/configService';
import { NewsCrawler, NewsDatabase, ForumDatabase, generateTrendingTopic, AdminDatabase } from '../services/geminiService';
import { Save, RefreshCw, Trash2, ArrowLeft, Zap, CheckCircle, List, Type, DollarSign, Database, Clock, Plus, X, Users, Shield, PlayCircle, AlertCircle } from 'lucide-react';
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

    setSyncStatus({
      [NewsCategory.LOCAL]: local,
      [NewsCategory.CANADA]: canada,
      [NewsCategory.USA]: usa,
      [NewsCategory.INTERNATIONAL]: international,
      [NewsCategory.CHINA]: china,
      'FORUM': forum
    });
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
      retentionLimit: 50
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
      showStatus('广告申请已通过');
    }
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
            {/* Data Sync Status */}
            <section className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <RefreshCw size={20} className="mr-2 text-blue-500" /> 数据同步状态
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(syncStatus).map(([key, time]) => (
                  <div key={key} className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div className="text-xs font-bold text-gray-500 uppercase mb-1">{key}</div>
                    <div className="text-sm font-mono text-gray-800">
                      {time > 0 ? new Date(time).toLocaleString() : '无数据'}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button onClick={() => handleTriggerNews(NewsCategory.LOCAL)} className="btn-secondary text-xs">抓取本地新闻</button>
                <button onClick={() => handleTriggerNews(NewsCategory.CANADA)} className="btn-secondary text-xs">抓取加拿大新闻</button>
                <button onClick={handleTriggerForum} className="btn-secondary text-xs">生成论坛话题</button>
                <button onClick={handleClearData} className="ml-auto text-red-500 hover:bg-red-50 px-3 py-1 rounded text-xs font-bold transition-colors">清空所有数据</button>
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
                  <div key={ad.id} className="border border-gray-200 rounded-lg p-4 flex gap-4">
                    {ad.imageUrl && <img src={ad.imageUrl} className="w-24 h-24 object-cover rounded" alt="ad" />}
                    <div className="flex-1">
                      <div className="font-bold text-lg">{ad.title}</div>
                      <div className="text-sm text-gray-600 mt-1">{ad.description}</div>
                      <div className="mt-2 flex gap-2">
                        <button onClick={() => handleApproveAd(ad.id)} className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600">通过</button>
                        <button className="bg-red-100 text-red-600 px-3 py-1 rounded text-sm hover:bg-red-200">拒绝</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
};

export default AdminView;
