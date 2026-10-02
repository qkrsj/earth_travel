import * as SecureStore from 'expo-secure-store';

const KEY = 'earth_travel_token';

// iOS Keychain / Android Keystore 에 토큰 저장
export const tokenStore = {
  get: () => SecureStore.getItemAsync(KEY),
  set: (token: string) => SecureStore.setItemAsync(KEY, token),
  clear: () => SecureStore.deleteItemAsync(KEY),
};
