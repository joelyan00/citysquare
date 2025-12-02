
import React, { useState } from 'react';
import { ServiceType, ServiceItem } from '../types';
import { MapPin, Search, Plus, Tag } from 'lucide-react';

const serviceLabels: Record<ServiceType, string> = {
  [ServiceType.RENT]: '房屋出租',
  [ServiceType.REPAIR]: '维修服务',
  [ServiceType.MARKETPLACE]: '二手市场',
  [ServiceType.DEALS]: '本地优惠',
};

const ServicesView: React.FC = () => {
  const [activeType, setActiveType] = useState<ServiceType | 'All'>('All');
  const [showModal, setShowModal] = useState(false);

  // Mock Data
  const [services, setServices] = useState<ServiceItem[]>([
    {
      id: 's1',
      type: ServiceType.RENT,
      title: '市中心高级公寓 1室1厅',
      description: '全套家具，近地铁站，随时入住。包水暖网。',
      price: '$1,800/月',
      location: '市中心',
      contactName: '王房东',
      timestamp: Date.now(),
      imageUrl: 'https://picsum.photos/seed/apt/400/300'
    },
    {
      id: 's2',
      type: ServiceType.REPAIR,
      title: '专业水电维修 24小时上门',
      description: '解决漏水、电路故障、安装灯具等问题。持牌师傅。',
      price: '$80/起',
      location: '大都会区',
      contactName: '李师傅',
      timestamp: Date.now() - 100000,
      imageUrl: 'https://picsum.photos/seed/plumber/400/300'
    },
    {
      id: 's3',
      type: ServiceType.MARKETPLACE,
      title: '99新 Sony 微单相机转让',
      description: '买了没怎么用，带镜头，箱说全。',
      price: '$650',
      location: '西区',
      contactName: '小张',
      timestamp: Date.now() - 500000,
      imageUrl: 'https://picsum.photos/seed/camera/400/300'
    },
    {
      id: 's4',
      type: ServiceType.DEALS,
      title: '周五超市大特价',
      description: '本周五全场海鲜8折，新鲜到货。',
      price: '8折',
      location: '阳光超市',
      contactName: '店长',
      timestamp: Date.now() - 200000,
      imageUrl: 'https://picsum.photos/seed/market/400/300'
    }
  ]);

  const filteredServices = activeType === 'All'
    ? services
    : services.filter(s => s.type === activeType);

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-full transition-colors duration-300">
      {/* Search & Filter Header */}
      <div className="bg-white dark:bg-gray-800 sticky top-0 z-30 shadow-sm pb-3 transition-colors">
        <div className="p-4 max-w-4xl mx-auto w-full">
          <div className="relative">
            <input
              type="text"
              placeholder="搜索服务、物品..."
              className="w-full bg-gray-100 dark:bg-gray-700 rounded-2xl py-3.5 pl-11 pr-4 text-base font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-800 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
            />
            <Search className="absolute left-4 top-4 text-gray-500" size={20} strokeWidth={2.5} />
          </div>
        </div>

        <div className="max-w-4xl mx-auto w-full">
          <div className="flex overflow-x-auto px-4 gap-2 no-scrollbar pb-1">
            <button
              onClick={() => setActiveType('All')}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap border transition-colors ${activeType === 'All' ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                }`}
            >
              全部
            </button>
            {Object.values(ServiceType).map(type => (
              <button
                key={type}
                onClick={() => setActiveType(type)}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap border transition-colors ${activeType === type ? 'bg-brand-600 text-white border-brand-600' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
              >
                {serviceLabels[type]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid Content */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl mx-auto">
        {filteredServices.map(item => (
          <div key={item.id} className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col h-full active:shadow-md transition-shadow group">
            {/* Responsive Height: h-48 mobile, h-64 desktop */}
            <div className="relative h-48 md:h-64 overflow-hidden">
              <img src={item.imageUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt={item.title} />
              <span className="absolute top-3 right-3 bg-white/95 backdrop-blur text-brand-700 text-sm font-extrabold px-3 py-1.5 rounded-lg shadow-sm">
                {item.price}
              </span>
              <span className="absolute bottom-3 left-3 bg-black/70 text-white text-xs font-bold px-2.5 py-1 rounded-md flex items-center backdrop-blur-sm">
                <Tag size={12} className="mr-1" strokeWidth={3} /> {serviceLabels[item.type]}
              </span>
            </div>
            <div className="p-4 flex flex-col flex-grow">
              <h3 className="font-extrabold text-gray-900 dark:text-white text-base line-clamp-1 mb-1.5">{item.title}</h3>
              <div className="flex items-center text-gray-500 dark:text-gray-400 text-sm font-semibold mb-3">
                <MapPin size={14} className="mr-1" strokeWidth={2.5} /> {item.location}
              </div>
              <p className="text-gray-600 dark:text-gray-300 text-sm font-medium line-clamp-2 mb-4 flex-grow leading-relaxed">{item.description}</p>
              <button className="w-full bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-sm font-extrabold py-3 rounded-xl hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors">
                联系 {item.contactName}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-20 right-5 lg:right-20 bg-brand-600 text-white p-4 rounded-full shadow-xl shadow-brand-500/40 hover:bg-brand-700 transition-transform active:scale-95 z-40"
      >
        <Plus size={28} strokeWidth={3} />
      </button>

      {/* Fake Modal for Posting */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-5">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl p-7 relative animate-[fadeIn_0.2s_ease-out] shadow-2xl">
            <h2 className="text-2xl font-black mb-5 text-gray-900 dark:text-white">发布新信息</h2>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-2">分类</label>
                <select className="w-full bg-gray-50 dark:bg-gray-700 p-4 rounded-xl text-base font-medium border-none focus:ring-2 focus:ring-brand-500 text-gray-800 dark:text-white">
                  {Object.values(ServiceType).map(t => <option key={t} value={t}>{serviceLabels[t]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-2">标题</label>
                <input type="text" className="w-full bg-gray-50 dark:bg-gray-700 p-4 rounded-xl text-base font-medium border-none focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-white" placeholder="例如：闲置 iPhone 转让" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-2">图片</label>
                <input type="file" className="block w-full text-sm font-medium text-gray-500 dark:text-gray-400 file:mr-4 file:py-2.5 file:px-5 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-brand-50 dark:file:bg-brand-900/30 file:text-brand-700 dark:file:text-brand-300 hover:file:bg-brand-100 dark:hover:file:bg-brand-900/50" />
              </div>
              <div className="flex gap-3 pt-3">
                <button onClick={() => setShowModal(false)} className="flex-1 py-3.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl font-bold text-base">取消</button>
                <button onClick={() => setShowModal(false)} className="flex-1 py-3.5 bg-brand-600 text-white rounded-xl font-bold text-base shadow-lg shadow-brand-200">立即发布</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServicesView;
