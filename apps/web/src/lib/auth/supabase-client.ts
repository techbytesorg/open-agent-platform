import { createClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

let supabaseInstance: ReturnType<typeof createClient> | null = null;

// Mock Supabase client for build/SSR environments
const createMockClient = () => ({
  auth: {
    signUp: async () => ({ data: null, error: { message: 'Mock client - not available during build' } }),
    signInWithPassword: async () => ({ data: null, error: { message: 'Mock client - not available during build' } }),
    signInWithOAuth: async () => ({ data: null, error: { message: 'Mock client - not available during build' } }),
    signOut: async () => ({ error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    refreshSession: async () => ({ data: { session: null }, error: null }),
    updateUser: async () => ({ data: { user: null }, error: null }),
    resetPasswordForEmail: async () => ({ error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
});

/**
 * Validate Supabase URL format
 */
function isValidSupabaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname.includes('supabase');
  } catch {
    return false;
  }
}

/**
 * Get a Supabase client instance (creates a singleton)
 *
 * @returns A Supabase client instance
 */
export function getSupabaseClient() {
  if (supabaseInstance) return supabaseInstance;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // During build/SSR, environment variables might be missing or invalid
  if (!supabaseUrl || !supabaseKey) {
    console.warn('Missing Supabase configuration, using mock client for build');
    supabaseInstance = createMockClient() as any;
    return supabaseInstance;
  }

  // Validate URL format to prevent "Invalid URL" errors
  if (!isValidSupabaseUrl(supabaseUrl)) {
    console.warn(`Invalid Supabase URL format: ${supabaseUrl}, using mock client for build`);
    supabaseInstance = createMockClient() as any;
    return supabaseInstance;
  }

  try {
    // Use the browser client when in browser environment
    if (typeof window !== "undefined") {
      supabaseInstance = createBrowserClient(supabaseUrl, supabaseKey, {
        cookies: {
          get(name) {
            return document.cookie
              .split("; ")
              .find((row) => row.startsWith(`${name}=`))
              ?.split("=")?.[1];
          },
          set(name, value, options) {
            document.cookie = `${name}=${value}; path=${options?.path ?? "/"}; max-age=${options?.maxAge ?? 31536000}`;
          },
          remove(name, options) {
            document.cookie = `${name}=; path=${options?.path ?? "/"}; max-age=0`;
          },
        },
      });
    } else {
      // For server-side, use the regular client
      // The middleware will use createServerClient separately
      supabaseInstance = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    }
  } catch (error) {
    console.warn('Failed to create Supabase client, using mock client for build:', error);
    supabaseInstance = createMockClient() as any;
  }

  return supabaseInstance;
}