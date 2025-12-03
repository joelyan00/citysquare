import React, { useState } from 'react';
import { NewsItem, NewsCategory } from '../types';
import { Share2, MoreVertical, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';

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

    // --- Unified Vertical Layout ---
    return (
        <article className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700 mb-8 transition-all hover:shadow-md">
            {/* 1. Image (Top) */}
            {item.imageUrl && !imageError && (
                <div className="relative w-full aspect-video bg-gray-100 dark:bg-gray-700">
                    <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        onError={() => setImageError(true)}
                    />
                    {/* Category Label Overlay */}
                    <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                        {item.category === NewsCategory.LOCAL ? city :
                            staticCategoryLabels[item.category as NewsCategory] ||
                            customCategories.find(c => c.id === item.category)?.name ||
                            item.category}
                    </div>
                </div>
            )}

            <div className="p-5 md:p-6">
                {/* 2. Meta: Source · Time */}
                <div className="flex items-center gap-2 mb-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                    <span className="uppercase tracking-wider font-bold text-brand-600 dark:text-brand-400">
                        {item.source || 'CitySquare'}
                    </span>
                    <span>·</span>
                    <span>{timeAgo(item.timestamp)}</span>
                </div>

                {/* 3. Title (Chinese) */}
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white leading-snug mb-3 font-sans tracking-tight">
                    {item.sourceUrl ? (
                        <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-brand-600 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {item.title}
                        </a>
                    ) : (
                        item.title
                    )}
                </h2>

                {/* 4. Summary (Chinese) */}
                <div className={`text-gray-600 dark:text-gray-300 text-base leading-relaxed mb-4 text-justify ${expandedNewsId === item.id ? '' : 'line-clamp-3'}`}>
                    {expandedNewsId === item.id ? (item.content || item.summary) : item.summary}
                </div>

                {/* YouTube Embed (if expanded) */}
                {expandedNewsId === item.id && videoId && (
                    <div className="mb-5 rounded-xl overflow-hidden shadow-md bg-black aspect-video">
                        <iframe
                            width="100%"
                            height="100%"
                            src={`https://www.youtube.com/embed/${videoId}`}
                            title="YouTube video player"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        ></iframe>
                    </div>
                )}

                {/* 5. Actions & Read Original Link */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700 mt-2">
                    {/* Actions: Expand & Read Original */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(item.id);
                            }}
                            className="flex items-center gap-1 text-gray-600 dark:text-gray-300 font-bold text-sm hover:text-brand-600 transition-colors"
                        >
                            {expandedNewsId === item.id ? '收起' : '展开'}
                            {expandedNewsId === item.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>

                        {item.sourceUrl && (
                            <a
                                href={item.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-brand-600 dark:text-brand-400 font-bold text-sm hover:underline"
                                onClick={(e) => e.stopPropagation()}
                            >
                                阅读原文
                                <ChevronRight size={16} strokeWidth={3} />
                            </a>
                        )}
                    </div>

                    {/* Share & More Actions */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleShare}
                            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-brand-500 transition-colors"
                            title="生成海报分享"
                        >
                            <Share2 size={20} strokeWidth={2} />
                        </button>
                        <button className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 transition-colors">
                            <MoreVertical size={20} strokeWidth={2} />
                        </button>
                    </div>
                </div>
            </div>
        </article>
    );
};

export default NewsCard;
