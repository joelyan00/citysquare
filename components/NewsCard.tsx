import React, { useState } from 'react';
import { NewsItem, NewsCategory } from '../types';
import { Share2, MoreVertical } from 'lucide-react';

interface NewsCardProps {
    item: NewsItem;
    city: string;
    staticCategoryLabels: Partial<Record<NewsCategory, string>>;
    customCategories: any[];
    expandedNewsId: string | null;
    toggleExpand: (id: string) => void;
    onShare: (item: NewsItem) => void;
    variant?: 'hero' | 'standard';
}

// Helper to reliably extract YouTube Video ID
const getYouTubeVideoId = (url: string) => {
    if (!url) return null;
    const regExp = /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regExp);
    return match ? match[1] : null;
};

const NewsCard: React.FC<NewsCardProps> = ({
    item,
    city,
    staticCategoryLabels,
    customCategories,
    expandedNewsId,
    toggleExpand,
    onShare,
    variant = 'standard'
}) => {
    const [imageError, setImageError] = useState(false);
    const videoId = item.youtubeUrl ? getYouTubeVideoId(item.youtubeUrl) : null;

    const handleShare = (e: React.MouseEvent) => {
        e.stopPropagation();
        onShare(item);
    };

    const timeAgo = (timestamp: number) => {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return '刚刚';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}分钟前`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}小时前`;
        return `${Math.floor(hours / 24)}天前`;
    };

    // --- Hero Variant (Top Story) ---
    if (variant === 'hero') {
        return (
            <article className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700 mb-6" onClick={() => toggleExpand(item.id)}>
                {/* Hero Image */}
                {item.imageUrl && !imageError && (
                    <div className="relative w-full aspect-video">
                        <img
                            src={item.imageUrl}
                            alt={item.title}
                            className="w-full h-full object-cover"
                            onError={() => setImageError(true)}
                        />
                    </div>
                )}

                <div className="p-5">
                    {/* Source & Time */}
                    <div className="flex items-center gap-2 mb-3">
                        {item.source && (
                            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {item.source}
                            </span>
                        )}
                        <span className="text-[11px] text-gray-400">• {timeAgo(item.timestamp)}</span>
                    </div>

                    {/* Title */}
                    <h2 className="text-2xl font-medium text-gray-900 dark:text-gray-100 leading-snug mb-3 font-sans">
                        {item.title}
                    </h2>

                    {/* Content/Summary (Expanded or truncated) */}
                    <div className={`text-gray-600 dark:text-gray-300 text-base leading-relaxed ${expandedNewsId === item.id ? '' : 'line-clamp-3'}`}>
                        {expandedNewsId === item.id ? (item.content || item.summary) : item.summary}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                        <div className="flex gap-4">
                            <button onClick={handleShare} className="text-gray-500 hover:text-brand-500">
                                <Share2 size={20} />
                            </button>
                        </div>
                        <button className="text-gray-400">
                            <MoreVertical size={20} />
                        </button>
                    </div>
                </div>
            </article>
        );
    }

    // --- Standard Variant (List Item) ---
    return (
        <article className="bg-white dark:bg-gray-800 rounded-2xl p-4 mb-4 border border-gray-100 dark:border-gray-700 shadow-sm active:bg-gray-50 dark:active:bg-gray-700/50 transition-colors" onClick={() => toggleExpand(item.id)}>
            <div className="flex gap-4">
                {/* Left Content */}
                <div className="flex-1 flex flex-col justify-between min-h-[6rem]">
                    <div>
                        {/* Source */}
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">
                                {item.source || 'CitySquare'}
                            </span>
                        </div>

                        {/* Title */}
                        <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 leading-snug mb-2 line-clamp-3 font-sans">
                            {item.title}
                        </h3>
                    </div>

                    {/* Time & Actions */}
                    <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-gray-400">{timeAgo(item.timestamp)}</span>
                        <div className="flex gap-3">
                            <button onClick={handleShare} className="text-gray-400 hover:text-brand-500">
                                <Share2 size={16} />
                            </button>
                            <button className="text-gray-400">
                                <MoreVertical size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Image (Thumbnail) */}
                {item.imageUrl && !imageError && (
                    <div className="w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700">
                        <img
                            src={item.imageUrl}
                            alt={item.title}
                            className="w-full h-full object-cover"
                            onError={() => setImageError(true)}
                        />
                    </div>
                )}
            </div>

            {/* Expanded Content for Standard Card */}
            {expandedNewsId === item.id && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-sm leading-relaxed animate-[fadeIn_0.2s]">
                    {item.content || item.summary}
                    {videoId && (
                        <div className="mt-4 rounded-xl overflow-hidden aspect-video">
                            <iframe
                                width="100%"
                                height="100%"
                                src={`https://www.youtube.com/embed/${videoId}`}
                                title="YouTube video player"
                                frameBorder="0"
                                allowFullScreen
                            ></iframe>
                        </div>
                    )}
                </div>
            )}
        </article>
    );
};

export default NewsCard;
