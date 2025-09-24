// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase environment variables are not defined. Please check your .env.local file and restart the development server.');
  throw new Error('Supabase configuration is missing. Check VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your .env.local file.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
