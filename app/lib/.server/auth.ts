import { createClient, type Session } from '@supabase/supabase-js';
import { anonKey } from './supabase';

// Create a single supabase client for interacting with your database
export const supabase = createClient('https://myyfwiyflnerjrdaoyxs.supabase.co', anonKey);

export async function getUserLocal(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.log(error);
  }

  return data.session;
}

export const signUserIn = async (provider: any, redirectUrl: string) => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: redirectUrl,
    },
  });

  if (error) {
    throw error;
  }

  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
};

export const getAccessToken = async () => {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  return sessionData.session?.access_token;
};
