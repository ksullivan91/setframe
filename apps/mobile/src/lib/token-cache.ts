import * as SecureStore from 'expo-secure-store';

/**
 * Token cache for @clerk/clerk-expo, backed by expo-secure-store per
 * docs/adr/0002-auth-clerk.md ("Mobile: current Clerk Expo SDK +
 * expo-secure-store for token persistence"). SecureStore is unavailable
 * on web (Expo web build target), so this no-ops there rather than
 * throwing, keeping `expo start --web` usable for quick checks.
 */
export const tokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // no-op — e.g. web target where SecureStore isn't available
    }
  },
};
