import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
  console.warn(
    '⚠️ Supabase configuration missing or contains placeholder values. Please update your frontend/.env file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
