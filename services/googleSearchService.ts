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
    search: async (query: string, timeWindow: string = 'd1', maxResults: number = 50): Promise<GoogleSearchResult[]> => {
        const apiKey = process.env.GOOGLE_SEARCH_API_KEY || process.env.API_KEY;
        const cx = process.env.GOOGLE_SEARCH_CX;

        if (!apiKey || !cx) {
            console.warn(`Google Search API Key or CX not configured. API_KEY present: ${!!apiKey}, CX present: ${!!cx}`);
            return [];
        }

        let dateRestrict = 'd1';
        if (timeWindow.includes('48')) dateRestrict = 'd2';
        if (timeWindow.includes('week')) dateRestrict = 'w1';

        const allResults: GoogleSearchResult[] = [];
        let startIndex = 1;

        // Fetch up to maxResults (Google API allows max 10 per request)
        while (allResults.length < maxResults) {
            const url = new URL(GOOGLE_SEARCH_API_URL);
            url.searchParams.append('key', apiKey);
            url.searchParams.append('cx', cx);
            url.searchParams.append('q', query);
            url.searchParams.append('dateRestrict', dateRestrict);
            url.searchParams.append('num', '10');
            url.searchParams.append('start', startIndex.toString());
            url.searchParams.append('sort', 'date');

            try {
                const response = await fetch(url.toString());
                if (!response.ok) {
                    console.error(`Google Search API Error: ${response.status} ${response.statusText}`);
                    break;
                }

                const data = await response.json();
                if (!data.items || data.items.length === 0) break;

                allResults.push(...data.items);
                startIndex += 10;

                // Safety break to avoid infinite loops if API behaves unexpectedly
                if (startIndex > 100) break;

            } catch (error) {
                console.error("Google Search Exception:", error);
                break;
            }
        }

        return allResults;
    }
};
