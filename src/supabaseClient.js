// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://iejytndopjcloyqefbae.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imllanl0bmRvcGpjbG95cWVmYmFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1NjIxOTAsImV4cCI6MjA2ODEzODE5MH0.GnF3IZ5SttFsAKZtWfBWsc1VROrvOZKwC47kPxIMQRY';

if (!supabaseUrl) {
  alert("VITE_SUPABASE_URL is required");
  throw new Error("VITE_SUPABASE_URL is required");
}
if (!supabaseKey) {
  alert("VITE_SUPABASE_PUBLISHABLE_KEY is required");
  throw new Error("VITE_SUPABASE_PUBLISHABLE_KEY is required");
}

// Log environment variables for debugging (remove in production)
console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key:', supabaseKey ? 'Present' : 'Missing');

export const supabase = createClient(supabaseUrl, supabaseKey, {
  // Add realtime configuration to potentially improve WebSocket handling
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
