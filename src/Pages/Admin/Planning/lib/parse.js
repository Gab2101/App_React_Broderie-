// src/Pages/Admin/Planning/lib/parse.js
export const parseISOAny = (v) => {
  if (v instanceof Date) return v;
  if (typeof v === "string") {
    // Si Supabase renvoie toujours ISO avec Z → juste new Date(v)
    return new Date(v);
  }
  return new Date(v);
};
