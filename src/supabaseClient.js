// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  // Evite le crash silencieux : message clair en console et throw
  console.error('Missing Supabase env vars:', { supabaseUrl, hasKey: !!supabaseKey });
  throw new Error('supabaseUrl and supabaseKey are required (check .env.local).');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
