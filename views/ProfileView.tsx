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
      <div className="bg-white min-h-full flex flex-col items-center justify-center p-8">
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <User size={48} className="text-gray-400" />
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-2">欢迎来到 CitySquare</h2>
        <p className="text-gray-500 text-center mb-8">登录以发布内容、参与讨论并享受更多服务</p>

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
    <div className="bg-gray-50 min-h-full">
      <div className="max-w-4xl mx-auto bg-white min-h-full shadow-2xl overflow-hidden min-h-screen">
        <div className="bg-gradient-to-br from-violet-600 to-indigo-600 text-white p-8 pt-14 rounded-b-[3rem] shadow-xl shadow-indigo-500/20">
          <div className="flex items-center space-x-5">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt="User"
                className="w-24 h-24 rounded-full border-[5px] border-white/30 shadow-sm object-cover"
              />
            ) : (
              <div className="w-24 h-24 rounded-full border-[5px] border-white/30 shadow-sm bg-white/20 flex items-center justify-center text-3xl font-bold">
                {user.name[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-3xl font-black tracking-tight">{user.name}</h1>
              <p className="text-indigo-100 text-base font-bold mt-1">{city} • {user.role === UserRole.SERVICE_PROVIDER ? '服务商' : '普通用户'}</p>
              <div className="mt-3 flex space-x-4 text-sm font-bold text-indigo-50">
                <span className="bg-white/10 px-3 py-1 rounded-full">ID: {user.id.slice(0, 6)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 -mt-2">
          {/* Ad Banner / Create Ad Button */}
          <button
            onClick={() => onNavigate && onNavigate(ViewState.CREATE_AD)}
            className="w-full bg-gradient-to-r from-orange-400 to-pink-500 text-white p-4 rounded-2xl shadow-lg mb-6 flex items-center justify-between active:scale-95 transition-transform"
          >
            <div className="flex items-center">
              <div className="bg-white/20 p-2 rounded-xl mr-3">
                <Megaphone size={24} strokeWidth={2.5} />
              </div>
              <div className="text-left">
                <h3 className="font-black text-lg">发布广告 / 推广</h3>
                <p className="text-xs font-bold text-white/90">CitySquare 智能营销助手为您服务</p>
              </div>
            </div>
            <div className="bg-white text-orange-600 text-xs font-black px-3 py-1.5 rounded-full">
              去发布
            </div>
          </button>

          <div className="bg-white rounded-3xl shadow-lg border border-gray-50 p-3 space-y-2">
            {[
              { icon: Bell, label: '消息通知', badge: '3' },
              { icon: Heart, label: '我的收藏', badge: '' },
              { icon: Shield, label: '账号安全 (邮箱/密码)', badge: '' },
              { icon: CreditCard, label: '支付方式', badge: '' },
              { icon: Settings, label: '系统设置', badge: '' },
            ].map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleAction(item.label)}
                className="w-full flex items-center justify-between p-5 hover:bg-gray-50 rounded-2xl transition-colors group active:scale-[0.98]"
              >
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-gray-100 text-gray-500 rounded-xl group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                    <item.icon size={24} strokeWidth={2.5} />
                  </div>
                  <span className="text-lg font-bold text-gray-800">{item.label}</span>
                </div>
                {item.badge && (
                  <span className="bg-red-500 text-white text-xs font-black px-2.5 py-1 rounded-full shadow-sm shadow-red-200">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          <button
            onClick={handleLogout}
            className="w-full mt-8 flex items-center justify-center space-x-2 p-5 text-red-500 font-bold text-lg bg-red-50 rounded-2xl hover:bg-red-100 transition-colors active:scale-95"
          >
            <LogOut size={22} strokeWidth={3} />
            <span>退出登录</span>
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
    </div>
  );
};

export default ProfileView;
