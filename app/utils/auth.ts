import { createClient, type Session } from '@supabase/supabase-js';

// Create a single supabase client for interacting with your database
export const supabase = createClient(
  'https://myyfwiyflnerjrdaoyxs.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15eWZ3aXlmbG5lcmpyZGFveXhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ5NzgwMzMsImV4cCI6MjA1MDU1NDAzM30.lxjcKW5Mwd-Tw3NU7TzmyKhydjEBmBfc0IID1U167XM',
);

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
