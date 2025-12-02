
import React, { useState, useEffect } from 'react';
import { ViewState, AdScope, AdItem, AdPricing } from '../types';
import { ConfigService } from '../services/configService';
import { generateAdCopy, AdDatabase, uploadImageToSupabase } from '../services/geminiService';
import { ArrowLeft, Sparkles, Upload, CheckCircle, CreditCard, Layout } from 'lucide-react';

interface AdCreateViewProps {
  onBack: () => void;
}

const AdCreateView: React.FC<AdCreateViewProps> = ({ onBack }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [pricing, setPricing] = useState<AdPricing | null>(null);

  // Form State
  const [productName, setProductName] = useState('');
  const [rawContent, setRawContent] = useState('');
  const [adTitle, setAdTitle] = useState('');
  const [finalContent, setFinalContent] = useState('');
  const [scope, setScope] = useState<AdScope>('local');
  const [duration, setDuration] = useState('7');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [totalPrice, setTotalPrice] = useState(0);

  useEffect(() => {
    const loadConfig = async () => {
      const cfg = await ConfigService.get();
      if (cfg.adPricing) setPricing(cfg.adPricing);
    };
    loadConfig();
  }, []);

  useEffect(() => {
    if (pricing) {
      const scopePrice = pricing.scope[scope] || 0;
      const durationPrice = pricing.duration[duration] || 0;
      setTotalPrice(scopePrice + durationPrice);
    }
  }, [scope, duration, pricing]);

  const handleAIOptimize = async () => {
    if (!rawContent || !productName) return alert('请先填写产品名称和描述');
    setLoading(true);
    const result = await generateAdCopy(rawContent, productName);
    setAdTitle(result.title);
    setFinalContent(result.content);
    setLoading(false);
    setStep(2);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      // Local preview
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) setImageUrl(e.target.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePublish = async () => {
    setLoading(true);

    // Upload image if selected
    let uploadedUrl = imageUrl;
    if (imageFile) {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(imageFile);
      });
      const base64 = await base64Promise;
      const url = await uploadImageToSupabase(base64, `ads/${Date.now()}_ad.png`);
      if (url) uploadedUrl = url;
    }

    const newAd: AdItem = {
      title: adTitle,
      content: finalContent,
      rawContent: rawContent,
      imageUrl: uploadedUrl,
      contactInfo: contactInfo,
      linkUrl: linkUrl,
      scope: scope,
      durationDays: parseInt(duration),
      priceTotal: totalPrice
    };

    await AdDatabase.saveAd(newAd);
    setLoading(false);
    setStep(4); // Success
  };

  const renderStep1 = () => (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">产品/服务名称</label>
        <input
          type="text"
          value={productName}
          onChange={e => setProductName(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 font-medium"
          placeholder="例如：王阿姨家政服务"
        />
      </div>
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">广告描述 (草稿)</label>
        <textarea
          value={rawContent}
          onChange={e => setRawContent(e.target.value)}
          rows={4}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 font-medium"
          placeholder="简单描述您的服务内容，不用担心文笔，City666会帮您润色..."
        />
      </div>
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">上传图片</label>
        <div className="border-2 border-dashed border-gray-300 rounded-2xl p-6 text-center bg-gray-50 hover:bg-gray-100 transition-colors relative">
          <input type="file" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
          {imageUrl ? (
            <img src={imageUrl} alt="Preview" className="h-32 mx-auto rounded-lg object-cover" />
          ) : (
            <div className="text-gray-400">
              <Upload className="mx-auto mb-2" />
              <p className="text-xs">点击上传图片</p>
            </div>
          )}
        </div>
      </div>
      <button
        onClick={handleAIOptimize}
        disabled={loading}
        className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl shadow-lg shadow-indigo-200 flex items-center justify-center active:scale-95 transition-transform"
      >
        {loading ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" /> : <><Sparkles className="mr-2" /> City666 智能润色</>}
      </button>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">City666 生成预览</h3>
        <h2 className="text-xl font-black text-gray-900 mb-2">{adTitle}</h2>
        <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{finalContent}</p>
      </div>
      <div className="flex gap-3">
        <button onClick={() => setStep(1)} className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl">返回修改</button>
        <button onClick={() => setStep(3)} className="flex-1 py-3 bg-brand-600 text-white font-bold rounded-xl shadow-md">下一步：投放设置</button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-3">投放范围</label>
        <div className="grid grid-cols-2 gap-3">
          {['local', 'city', 'province', 'national'].map(s => (
            <button
              key={s}
              onClick={() => setScope(s as AdScope)}
              className={`p-3 rounded-xl border-2 font-bold text-sm ${scope === s ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500'}`}
            >
              {s === 'local' ? '本地 (周边)' : s === 'city' ? '全城' : s === 'province' ? '全省' : '全国'}
              <span className="block text-xs font-normal mt-1">${pricing?.scope[s]}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-3">投放时长</label>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {['1', '3', '7', '14', '30'].map(d => (
            <button
              key={d}
              onClick={() => setDuration(d)}
              className={`min-w-[60px] p-3 rounded-xl border-2 font-bold text-sm flex-shrink-0 ${duration === d ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500'}`}
            >
              {d}天
              <span className="block text-xs font-normal mt-1">${pricing?.duration[d]}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">联系方式 (展示给客户)</label>
        <input
          type="text"
          value={contactInfo}
          onChange={e => setContactInfo(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 font-medium"
          placeholder="电话 / 微信 / 邮箱"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">广告链接 (可选)</label>
        <div className="text-xs text-gray-500 mb-2">如果不填，系统将自动为您生成一个详情页。</div>
        <input
          type="text"
          value={linkUrl}
          onChange={e => setLinkUrl(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 font-medium"
          placeholder="https://example.com"
        />
      </div>

      <div className="bg-gray-900 text-white p-6 rounded-2xl flex justify-between items-center shadow-xl">
        <div>
          <p className="text-gray-400 text-xs font-bold">总计费用</p>
          <p className="text-3xl font-black">${totalPrice}</p>
        </div>
        <button
          onClick={handlePublish}
          disabled={loading}
          className="bg-brand-500 hover:bg-brand-400 text-white px-6 py-3 rounded-xl font-bold flex items-center transition-colors"
        >
          {loading ? '处理中...' : <><CreditCard className="mr-2" size={18} /> 支付并发布</>}
        </button>
      </div>
    </div>
  );

  const renderSuccess = () => (
    <div className="text-center py-10 animate-scaleIn">
      <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle size={40} strokeWidth={3} />
      </div>
      <h2 className="text-2xl font-black text-gray-900 mb-2">发布成功！</h2>
      <p className="text-gray-500 font-medium mb-8">您的广告已提交审核，即将上线。</p>
      <button onClick={onBack} className="bg-gray-100 text-gray-700 font-bold px-8 py-3 rounded-xl">返回首页</button>
    </div>
  );

  return (
    <div className="bg-gray-50 min-h-screen pb-safe">
      <header className="bg-white p-4 sticky top-0 z-30 shadow-sm flex items-center space-x-3">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full"><ArrowLeft /></button>
        <h1 className="text-lg font-black">发布广告</h1>
      </header>

      <div className="p-5 max-w-lg mx-auto">
        {step < 4 && (
          <div className="flex justify-between mb-8 px-2">
            {[1, 2, 3].map(i => (
              <div key={i} className={`h-3 flex-1 rounded-full mx-1 transition-colors ${i <= step ? 'bg-brand-500' : 'bg-gray-200'}`} />
            ))}
          </div>
        )}

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderSuccess()}
      </div>
    </div>
  );
};

export default AdCreateView;
