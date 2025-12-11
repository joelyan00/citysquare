import * as cheerio from 'cheerio';

const url = "https://www.163.com/news/article/KGHASGGQ000189FH.html";

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

        // Remove unwanted elements
        $('script, style, nav, header, footer, .ad, .advertisement, .menu, .sidebar, .cookie-banner, .popup').remove();

        // Try to find main article container
        let container = $('.post_body');
        if (container.length === 0) container = $('#endText');
        if (container.length === 0) container = $('article');
        if (container.length === 0) container = $('main');
        if (container.length === 0) container = $('.post-content');
        if (container.length === 0) container = $('.article-body');
        if (container.length === 0) container = $('body'); // Fallback

        // Extract text
        let text = '';
        container.find('h1, h2, h3, p, li').each((i, el) => {
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
