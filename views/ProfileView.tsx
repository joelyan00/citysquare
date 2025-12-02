import React, { useState } from 'react';
import { ViewState, UserProfile, UserRole } from '../types';
import { Settings, Bell, Heart, LogOut, Wrench, X, Lock, Megaphone, User, LogIn, Eye, EyeOff, CreditCard, Shield } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface ProfileViewProps {
  onNavigate?: (view: ViewState) => void;
  city?: string;
  user: UserProfile | null;
}

const ProfileView: React.FC<ProfileViewProps> = ({ onNavigate, city = '本地', user }) => {
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [adminError, setAdminError] = useState('');

  const handleAction = (label: string) => {
    if (label === '系统设置') {
      // setShowAdminLogin(true); 
      alert('系统设置功能开发中...');
    } else {
      alert(`${label} 功能开发中...`);
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminUsername === 'admin' && adminPassword === 'chocolate,GOOD2') {
      setShowAdminLogin(false);
      if (onNavigate) onNavigate(ViewState.ADMIN);
    } else {
      setAdminError('账号或密码错误');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // App.tsx will handle state update via onAuthStateChange
  };

  if (!user) {
    return (
      <div className="bg-white dark:bg-gray-900 min-h-full flex flex-col items-center justify-center p-8 transition-colors duration-300">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
          <User size={48} className="text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">欢迎来到 City666</h2>
        <p className="text-gray-500 dark:text-gray-400 text-center mb-8">登录以发布内容、参与讨论并享受更多服务</p>

        <button
          onClick={() => onNavigate && onNavigate(ViewState.LOGIN)}
          className="w-full max-w-xs bg-brand-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-brand-500/30 active:scale-95 transition-transform flex items-center justify-center space-x-2"
        >
          <LogIn size={20} />
          <span>立即登录 / 注册</span>
        </button>

        {/* Hidden Admin Entry for non-logged in users too, or keep it? 
            Let's keep the hidden trigger somewhere discreet if needed, 
            but for now the main flow is user login. 
        */}


        {/* Admin Login Modal */}
        {showAdminLogin && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-6 animate-[fadeIn_0.2s]">
            <div className="bg-white w-full max-w-sm rounded-3xl p-8 relative shadow-2xl">
              <button
                onClick={() => setShowAdminLogin(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-2"
              >
                <X size={24} />
              </button>

              <div className="text-center mb-6">
                <div className="bg-brand-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-brand-600">
                  <Lock size={32} strokeWidth={2.5} />
                </div>
                <h2 className="text-2xl font-black text-gray-900">后台登录</h2>
                <p className="text-gray-500 text-sm font-bold mt-1">仅限管理员访问</p>
              </div>

              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <input
                    type="text"
                    placeholder="账号"
                    value={adminUsername}
                    onChange={e => setAdminUsername(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 font-bold text-gray-800 focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                  />
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="密码"
                    value={adminPassword}
                    onChange={e => setAdminPassword(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 font-bold text-gray-800 focus:ring-2 focus:ring-brand-500 outline-none transition-all pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>

                {adminError && <p className="text-red-500 text-xs font-bold text-center">{adminError}</p>}

                <button
                  type="submit"
                  className="w-full bg-brand-600 text-white font-black py-4 rounded-xl shadow-lg shadow-brand-500/30 active:scale-95 transition-transform"
                >
                  进入后台
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-full pb-10 transition-colors duration-300">
      {/* Profile Header */}
      <div className="bg-white dark:bg-gray-800 pb-8 pt-12 px-6 rounded-b-[2.5rem] shadow-sm mb-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600 to-indigo-600 opacity-10 dark:opacity-20"></div>
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 p-1 shadow-xl mb-4">
            <div className="w-full h-full rounded-full bg-white dark:bg-gray-800 flex items-center justify-center overflow-hidden border-4 border-white dark:border-gray-800">
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-black text-brand-600 dark:text-brand-400">
                  {user.name ? user.name.slice(0, 2).toUpperCase() : user.email.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
          </div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-1">{user.name || 'User'}</h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium text-sm mb-4">{user.email}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 px-3 py-1 rounded-lg text-xs font-bold border border-brand-100 dark:border-brand-900/50">
              {user.role === UserRole.ADMIN ? '管理员' : '普通用户'}
            </span>
            <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-3 py-1 rounded-lg text-xs font-bold">
              {city}
            </span>
          </div>
        </div>
      </div>

      <div className="p-6 -mt-2">
        {/* Ad Banner / Create Ad Button */}
        <button
          onClick={() => onNavigate && onNavigate(ViewState.CREATE_AD)}
          className="w-full bg-gradient-to-r from-brand-500 to-violet-600 text-white p-4 rounded-2xl shadow-lg shadow-brand-500/20 mb-3 flex items-center justify-between active:scale-95 transition-transform relative overflow-hidden group"
        >
          <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="flex items-center relative z-10">
            <div className="bg-white/20 p-2 rounded-xl mr-3 backdrop-blur-sm">
              <Megaphone size={24} strokeWidth={2.5} />
            </div>
            <div className="text-left">
              <h3 className="font-black text-lg">发布广告 / 推广</h3>
              <p className="text-xs font-bold text-white/90">City666 智能营销助手为您服务</p>
            </div>
          </div>
          <div className="bg-white text-brand-600 text-xs font-black px-3 py-1.5 rounded-lg relative z-10 shadow-sm">
            去发布
          </div>
        </button>

        {/* Menu Grid */}
        <div className="px-4 max-w-lg mx-auto space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-2 shadow-sm">
            {[
              { icon: Bell, label: '消息通知', badge: 2, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
              { icon: Heart, label: '我的收藏', color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/20' },
              { icon: Settings, label: '系统设置', color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-700' }
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => handleAction(item.label)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-2xl transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl ${item.bg} ${item.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <item.icon size={20} strokeWidth={2.5} />
                  </div>
                  <span className="font-bold text-gray-900 dark:text-white">{item.label}</span>
                </div>
                {item.badge && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-lg">{item.badge}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full bg-white dark:bg-gray-800 text-red-500 font-black py-4 rounded-3xl shadow-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center justify-center gap-2 mt-6"
        >
          <LogOut size={20} strokeWidth={2.5} />
          退出登录
        </button>

        {/* Hidden Admin Entry - Only for specific admin email */}
        {user?.email === 'joelyan00@gmail.com' && (
          <button
            onClick={() => setShowAdminLogin(true)}
            className="w-full mt-4 text-gray-300 text-xs font-bold flex justify-center items-center py-4 hover:text-brand-500 transition-colors"
          >
            <Wrench size={12} className="mr-1" /> 管理员后台
          </button>
        )}

        <div className="mt-2 text-center pb-20">
          <p className="text-xs font-bold text-gray-300 tracking-widest uppercase">City Square v1.0.0</p>
        </div>
      </div>



      {/* Admin Login Modal */}
      {showAdminLogin && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-6 animate-[fadeIn_0.2s]">
          <div className="bg-white w-full max-w-sm rounded-3xl p-8 relative shadow-2xl">
            <button
              onClick={() => setShowAdminLogin(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-2"
            >
              <X size={24} />
            </button>

            <div className="text-center mb-6">
              <div className="bg-brand-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-brand-600">
                <Lock size={32} strokeWidth={2.5} />
              </div>
              <h2 className="text-2xl font-black text-gray-900">后台登录</h2>
              <p className="text-gray-500 text-sm font-bold mt-1">仅限管理员访问</p>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="账号"
                  value={adminUsername}
                  onChange={e => setAdminUsername(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 font-bold text-gray-800 focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                />
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="密码"
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 font-bold text-gray-800 focus:ring-2 focus:ring-brand-500 outline-none transition-all pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              {adminError && <p className="text-red-500 text-xs font-bold text-center">{adminError}</p>}

              <button
                type="submit"
                className="w-full bg-brand-600 text-white font-black py-4 rounded-xl shadow-lg shadow-brand-500/30 active:scale-95 transition-transform"
              >
                进入后台
              </button>
            </form>
          </div>
        </div>
      )}
    </div>

  );
};

export default ProfileView;
