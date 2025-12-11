import * as cheerio from 'cheerio';

const url = "https://cn.nytimes.com/business/20251211/taiwan-tsmc-trade-secrets/";

async function testFetch() {
    console.log(`Fetching ${url}...`);
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            console.error(`Failed to fetch: ${response.status} ${response.statusText}`);
            return;
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        console.log("--- HTML Preview ---");
        console.log($('body').html()?.substring(0, 2000));
        console.log("--------------------");

        // Remove unwanted elements
        $('script, style, nav, header, footer, .ad, .advertisement, .menu, .sidebar, .cookie-banner, .popup').remove();

        // Fallback to body to see if we can find ANY text
        let container = $('body');

        // Extract text
        let text = '';
        container.find('p').each((i, el) => {
            const $el = $(el);
            if ($el.closest('.related-posts, .comments, .share-buttons').length > 0) return;

            const tag = el.tagName.toLowerCase();
            const content = $el.text().trim();

            if (content.length > 10) {
                if (tag.startsWith('h')) {
                    text += `\n### ${content}\n`;
                } else if (tag === 'li') {
                    text += `- ${content}\n`;
                } else {
                    text += content + '\n\n';
                }
            }
        });

        console.log("--- Extracted Content ---");
        console.log(text.substring(0, 500) + "..."); // Print first 500 chars
        console.log("-------------------------");
        console.log(`Total Length: ${text.length}`);

    } catch (error) {
        console.error("Error:", error);
    }
}

testFetch();
