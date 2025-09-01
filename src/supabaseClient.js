// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Petit log safe pour debug (n’affiche pas la clé)
console.log('[Supabase] Bundler=CRA, URL OK ?', !!supabaseUrl);

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase env vars (CRA expected REACT_APP_*)', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseKey,
  });
  throw new Error('supabaseUrl and supabaseKey are required (check .env.local).');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
