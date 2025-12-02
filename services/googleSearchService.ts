import { ConfigService } from "./configService";

const GOOGLE_SEARCH_API_URL = 'https://www.googleapis.com/customsearch/v1';

export interface GoogleSearchResult {
    title: string;
    link: string;
    snippet: string;
    pagemap?: {
        cse_image?: Array<{ src: string }>;
        metatags?: Array<Record<string, string>>;
    };
}

export const GoogleSearchService = {
    search: async (query: string, timeWindow: string = 'd1'): Promise<GoogleSearchResult[]> => {
        const apiKey = process.env.GOOGLE_SEARCH_API_KEY || process.env.API_KEY; // Fallback to main key if specific one not set
        const cx = process.env.GOOGLE_SEARCH_CX;

        if (!apiKey || !cx) {
            console.warn("Google Search API Key or CX not configured.");
            return [];
        }

        // Map timeWindow (e.g., "24 hours", "48 hours") to Google's format (e.g., "d1", "d2")
        let dateRestrict = 'd1';
        if (timeWindow.includes('48')) dateRestrict = 'd2';
        if (timeWindow.includes('week')) dateRestrict = 'w1';

        const url = new URL(GOOGLE_SEARCH_API_URL);
        url.searchParams.append('key', apiKey);
        url.searchParams.append('cx', cx);
        url.searchParams.append('q', query);
        url.searchParams.append('dateRestrict', dateRestrict);
        url.searchParams.append('num', '10'); // Fetch 10 results
        url.searchParams.append('sort', 'date'); // Sort by date

        try {
            const response = await fetch(url.toString());
            if (!response.ok) {
                console.error(`Google Search API Error: ${response.status} ${response.statusText}`);
                return [];
            }

            const data = await response.json();
            return data.items || [];
        } catch (error) {
            console.error("Google Search Exception:", error);
            return [];
        }
    }
};
