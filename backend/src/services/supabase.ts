import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

// Initialize the Supabase Client with the service role key for backend operations.
// service_role client has admin bypass for RLS and is kept strictly server-side.
export const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

/**
 * Health check utility to confirm the Supabase URL is reachable
 */
export const verifySupabaseConnection = async (): Promise<boolean> => {
  try {
    // Simply fetch schema to verify we can connect to the Supabase client API
    const { error } = await supabase.from('_dummy_health_check_table').select('*').limit(1);
    
    // An error code of PGRST116 (Object not found) or 404 is fine—it means the API is reachable, 
    // but the table doesn't exist. If we get a network connection error (e.g. fetch failed), it means it's down.
    if (error && error.message.includes('fetch failed')) {
      console.warn('⚠️ Supabase connection warning: Remote host fetch failed. Check network or SUPABASE_URL.');
      return false;
    }
    
    console.log('✅ Supabase client initialized and connected.');
    return true;
  } catch (err: any) {
    console.warn('⚠️ Supabase initialization test warning:', err.message || err);
    return false;
  }
};
