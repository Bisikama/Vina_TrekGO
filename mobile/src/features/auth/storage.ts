import AsyncStorage from "@react-native-async-storage/async-storage";

import { StoredAuthState } from "@/features/auth/types";

const AUTH_STORAGE_KEY = "@trekgo/auth-session";

export async function readStoredAuth(): Promise<StoredAuthState | null> {
  const value = await AsyncStorage.getItem(AUTH_STORAGE_KEY);

  if (!value) return null;

  try {
    return JSON.parse(value) as StoredAuthState;
  } catch {
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export async function writeStoredAuth(value: StoredAuthState): Promise<void> {
  await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(value));
}

export async function clearStoredAuth(): Promise<void> {
  await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
}
