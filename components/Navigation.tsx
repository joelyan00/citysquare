import React from 'react';
import { ViewState } from '../types';
import { Newspaper, MessageSquare, Store, User } from 'lucide-react';

interface NavigationProps {
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
}

const Navigation: React.FC<NavigationProps> = ({ currentView, onNavigate }) => {
  const navItems = [
    { view: ViewState.NEWS, label: '新闻', icon: Newspaper },
    { view: ViewState.FORUM, label: '论坛', icon: MessageSquare },
    { view: ViewState.SERVICES, label: '服务', icon: Store },
    { view: ViewState.PROFILE, label: '我的', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-40 pb-safe">
      <div className="flex justify-center gap-8 items-center h-16">
        {navItems.map((item) => {
          const isActive = currentView === item.view;
          const Icon = item.icon;

          return (
            <button
              key={item.view}
              onClick={() => onNavigate(item.view)}
              className={`flex flex-col items-center justify-center w-full h-full transition-all duration-200 active:scale-95 ${isActive ? 'text-brand-600' : 'text-gray-400 hover:text-gray-600'
                }`}
            >
              <Icon
                size={26}
                className={`mb-1 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className={`tracking-wide ${isActive ? 'text-xs font-extrabold' : 'text-xs font-bold'}`}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default Navigation;