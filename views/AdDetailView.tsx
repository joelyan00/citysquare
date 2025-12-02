import React from 'react';
import { AdItem } from '../types';
import { ArrowLeft, Calendar, MapPin, Phone, Tag, Clock, Share2, AlertCircle, X } from 'lucide-react';

interface AdDetailViewProps {
    ad: AdItem;
    onBack: () => void;
}

const AdDetailView: React.FC<AdDetailViewProps> = ({ ad, onBack }) => {
    return (
        <div className="bg-gray-100 dark:bg-black min-h-screen pb-safe flex flex-col md:justify-center md:py-10">
            <div className="max-w-2xl mx-auto w-full bg-white dark:bg-gray-900 md:rounded-[2.5rem] overflow-hidden shadow-2xl relative min-h-screen md:min-h-0">

                {/* Image Section */}
                <div className="relative w-full aspect-[4/3] bg-gray-200 dark:bg-gray-800">
                    {ad.imageUrl ? (
                        <img
                            src={ad.imageUrl}
                            alt={ad.title}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <span className="text-sm">暂无图片</span>
                        </div>
                    )}

                    {/* Overlays */}
                    <div className="absolute top-4 left-4 bg-yellow-400 text-yellow-900 text-xs font-black px-3 py-1.5 rounded-lg shadow-lg z-10">
                        Sponsored 广告
                    </div>
                    <button
                        onClick={onBack}
                        className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm transition-colors z-10"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content Section */}
                <div className="p-8">
                    <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white mb-6 leading-tight">
                        {ad.title}
                    </h1>

                    <div className="prose dark:prose-invert max-w-none mb-10">
                        <p className="text-gray-700 dark:text-gray-300 text-lg leading-relaxed whitespace-pre-wrap">
                            {ad.content}
                        </p>
                    </div>

                    {/* Contact Section - Integrated */}
                    <div className="bg-brand-50 dark:bg-brand-900/20 rounded-2xl p-6 border border-brand-100 dark:border-brand-900/30">
                        <h3 className="text-brand-900 dark:text-brand-100 font-bold mb-4 flex items-center">
                            <Phone className="mr-2" size={20} />
                            联系方式
                        </h3>
                        {ad.contactInfo ? (
                            <div className="text-2xl font-black text-brand-600 dark:text-brand-400 tracking-wide select-all">
                                {ad.contactInfo}
                            </div>
                        ) : (
                            <div className="text-gray-500 dark:text-gray-400 font-medium flex items-center">
                                <AlertCircle className="mr-2" size={18} />
                                暂无联系方式
                            </div>
                        )}
                        <p className="text-xs text-brand-400 dark:text-brand-600 mt-3">
                            联系时请说明来自 City666
                        </p>
                    </div>

                    {/* Disclaimer */}
                    <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-8 mb-4">
                        广告内容由发布者提供，City666 不对其真实性负责。交易前请谨慎核实。
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AdDetailView;
