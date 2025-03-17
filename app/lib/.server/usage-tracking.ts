import { createClient } from '@supabase/supabase-js';

import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('usage-tracking');

// Create a single supabase client for interacting with your database
export const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Define the types for our usage data
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface UsageStatus {
  isOverLimit: boolean;
  currentUsage: number;
  remainingTokens: number;
  limit: number;
}

/**
 * Updates the user's token usage for the current month
 */
export async function updateUserTokenUsage(userId: string, usage: TokenUsage): Promise<void> {
  try {
    // Get current month in YYYY-MM format
    const currentDate = new Date();
    const monthYear = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

    // First, check if record exists
    const { data: existingRecord } = await supabase
      .from('user_token_usage')
      .select('*')
      .eq('user_id', userId)
      .eq('month_year', monthYear)
      .single();

    if (existingRecord) {
      // Update existing record with increments
      const { error } = await supabase
        .from('user_token_usage')
        .update({
          prompt_tokens: existingRecord.prompt_tokens + (usage.promptTokens || 0),
          completion_tokens: existingRecord.completion_tokens + (usage.completionTokens || 0),
          total_tokens: existingRecord.total_tokens + (usage.totalTokens || 0),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingRecord.id);

      if (error) {
        logger.error('Error updating token usage:', error.message);
      }
    } else {
      // Insert new record
      const { error } = await supabase.from('user_token_usage').insert({
        user_id: userId,
        month_year: monthYear,
        prompt_tokens: usage.promptTokens || 0,
        completion_tokens: usage.completionTokens || 0,
        total_tokens: usage.totalTokens || 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) {
        logger.error('Error updating token usage:', error);
        throw error;
      }
    }
  } catch (error) {
    logger.error('Failed to update user token usage', error);

    // Don't throw error to avoid disrupting the main flow
  }
}

/**
 * Checks if a user has exceeded their monthly token limit
 */
export async function checkUserTokenLimit(userId: string, limit = 100000): Promise<UsageStatus> {
  try {
    // Get current month in YYYY-MM format
    const currentDate = new Date();
    const monthYear = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

    // Get user's current usage for this month
    const { data, error } = await supabase
      .from('user_token_usage')
      .select('total_tokens')
      .eq('user_id', userId)
      .eq('month_year', monthYear)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "no rows returned" which is fine
      logger.error('Error checking token limit:', error);
      throw error;
    }

    // If no data or tokens less than limit, user is under limit
    const currentUsage = data?.total_tokens || 0;

    return {
      isOverLimit: currentUsage >= limit,
      currentUsage,
      remainingTokens: Math.max(0, limit - currentUsage),
      limit,
    };
  } catch (error) {
    logger.error('Failed to check user token limit', JSON.stringify(error));
    console.log(error);

    // Return a default status assuming user is under limit

    return {
      isOverLimit: false,
      currentUsage: 0,
      remainingTokens: limit,
      limit,
    };
  }
}

/**
 * Get a user's subscription tier token limit
 * This could be expanded based on your subscription model
 */
export function getUserTokenLimit(userId: string, subscriptionTier: string = 'free'): number {
  const LIMITS = {
    launch: 1000, //1000000,
    orbit: 1500, //2000000,
  };

  return LIMITS[subscriptionTier as keyof typeof LIMITS];
}
