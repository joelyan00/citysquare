import React, { forwardRef } from 'react';
import { NewsItem } from '../types';

interface ShareCardProps {
    item: NewsItem;
}

const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(({ item }, ref) => {
    const currentUrl = window.location.href;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(currentUrl)}`;

    return (
        <div
            ref={ref}
            className="bg-white text-gray-900 w-[375px] min-h-[600px] p-6 flex flex-col relative overflow-hidden"
            style={{ fontFamily: 'Inter, sans-serif' }}
        >
            {/* Header */}
            <div className="flex items-center gap-2 mb-6 border-b border-gray-100 pb-4">
                <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-black text-sm">
                    C
                </div>
                <div>
                    <h1 className="text-lg font-black tracking-tight text-gray-900">City<span className="text-brand-600">666</span></h1>
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Global News • Local Perspective</p>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1">
                {item.imageUrl && (
                    <div className="mb-5 rounded-2xl overflow-hidden shadow-sm aspect-video relative">
                        <img
                            src={item.imageUrl}
                            alt={item.title}
                            className="w-full h-full object-cover"
                            crossOrigin="anonymous" // Important for html2canvas
                        />
                        <div className="absolute inset-0 ring-1 ring-inset ring-black/10 rounded-2xl"></div>
                    </div>
                )}

                <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold rounded uppercase tracking-wide">
                        {item.source || 'News'}
                    </span>
                    <span className="text-[10px] text-gray-400">
                        {new Date(item.timestamp).toLocaleDateString()}
                    </span>
                </div>

                <h2 className="text-2xl font-black leading-tight mb-4 text-gray-900">
                    {item.title}
                </h2>

                <p className="text-gray-600 text-sm leading-relaxed mb-6 line-clamp-6 text-justify">
                    {item.summary}
                </p>
            </div>

            {/* Footer */}
            <div className="mt-auto pt-6 border-t border-dashed border-gray-200 flex items-center justify-between">
                <div className="flex-1 pr-4">
                    <p className="text-xs font-bold text-gray-900 mb-1">长按识别二维码</p>
                    <p className="text-[10px] text-gray-500 leading-tight">
                        阅读全文及更多精彩内容<br />
                        请访问 City666 News
                    </p>
                </div>
                <div className="w-20 h-20 bg-white p-1 rounded-lg border border-gray-100 shadow-sm">
                    <img src={qrCodeUrl} alt="QR Code" className="w-full h-full" crossOrigin="anonymous" />
                </div>
            </div>

            {/* Decorative Elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-50 rounded-full blur-3xl -mr-16 -mt-16 opacity-50 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-50 rounded-full blur-2xl -ml-12 -mb-12 opacity-50 pointer-events-none"></div>
        </div>
    );
});

ShareCard.displayName = 'ShareCard';

export default ShareCard;
