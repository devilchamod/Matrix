import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://supabase.com/dashboard/project/bythnqwriaiiavlwacby';
const SUPABASE_ANON_KEY = 'sb_publishable_AyWpbYzR7LjpFi8QtdXh4w_fromsAMp';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
});
