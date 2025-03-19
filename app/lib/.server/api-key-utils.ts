// Create this file at: ~/lib/.server/api-key-utils.ts

import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api-key-utils');

/**
 * Checks if the user is using their own API key for a specific provider
 * @param apiKeys User-provided API keys from cookies
 * @param provider The provider being used (e.g., 'openai', 'anthropic')
 * @param env Environment variables containing system API keys
 * @returns boolean True if user is using their own key, false if using system key
 */
export function isUserUsingOwnKey(apiKeys: Record<string, string>, provider: string, env: any): boolean {
  // If no provider specified, assume using system key
  if (!provider) {
    return false;
  }

  // If no API key for this provider, using system key
  if (!apiKeys[provider]) {
    return false;
  }

  // Get the system key from environment variables
  const systemKeyName = `${provider.toUpperCase()}_API_KEY`;
  const systemKey = env[systemKeyName];

  // If there's no system key for this provider, user must be using their own
  if (!systemKey) {
    return true;
  }

  // Compare keys - if they're different, user is using their own
  const isUsingOwnKey = apiKeys[provider] !== systemKey;

  logger.debug(`User is ${isUsingOwnKey ? 'using their own' : 'using system'} ${provider} API key`);

  return isUsingOwnKey;
}

/**
 * Gets a list of providers for which the user is using their own API keys
 * @param apiKeys User-provided API keys from cookies
 * @param env Environment variables containing system API keys
 * @returns string[] Array of provider names where user is using their own key
 */
export function getUserProvidedKeyProviders(apiKeys: Record<string, string>, env: any): string[] {
  const providers = Object.keys(apiKeys);
  return providers.filter((provider) => isUserUsingOwnKey(apiKeys, provider, env));
}
