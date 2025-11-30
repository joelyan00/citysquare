import { createClient } from '@supabase/supabase-js';

// 使用提供的 Supabase 凭证
// 优先使用环境变量，如果不存在则使用硬编码的凭证
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
export const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);