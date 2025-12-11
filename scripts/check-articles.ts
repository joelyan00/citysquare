import { createClient } from '@supabase/supabase-js';
import path from 'path';

// Env vars are loaded via --env-file flag
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const urlsToCheck = [
    "https://www.163.com/news/article/KGHASGGQ000189FH.html",
    "https://www.bbc.com/zhongwen/articles/cm20ep54395o/simp"
];

async function checkArticles() {
    console.log("Checking database for articles...");

    for (const url of urlsToCheck) {
        const { data, error } = await supabase
            .from('news')
            .select('id, title, created_at')
            .eq('source_url', url);

        if (error) {
            console.error(`Error checking ${url}:`, error.message);
        } else if (data && data.length > 0) {
            console.log(`[FOUND] ${url}`);
            console.log(`  Title: ${data[0].title}`);
            console.log(`  Created: ${data[0].created_at}`);
        } else {
            console.log(`[NOT FOUND] ${url}`);
        }
    }
}

checkArticles();
