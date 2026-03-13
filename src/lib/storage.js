import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const STATE_KEY = "opencode-mobile-state";
const SECRET_PREFIX = "opencode-host-secret.";

function secureStoreKey(hostId) {
  const normalizedHostId = String(hostId || "").replace(/[^0-9A-Za-z._-]/g, "_");
  return `${SECRET_PREFIX}${normalizedHostId}`;
}

function shouldUseAsyncSecretFallback() {
  return Platform.OS === "web";
}

async function readSecretFallback(hostId) {
  const raw = await AsyncStorage.getItem(secureStoreKey(hostId));

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeSecretFallback(hostId, secret) {
  await AsyncStorage.setItem(secureStoreKey(hostId), JSON.stringify(secret));
}

async function deleteSecretFallback(hostId) {
  await AsyncStorage.removeItem(secureStoreKey(hostId));
}

export async function loadPersistedState() {
  const raw = await AsyncStorage.getItem(STATE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function savePersistedState(state) {
  await AsyncStorage.setItem(STATE_KEY, JSON.stringify(state));
}

export async function saveHostSecret(hostId, secret) {
  if (shouldUseAsyncSecretFallback()) {
    await writeSecretFallback(hostId, secret);
    return;
  }

  await SecureStore.setItemAsync(secureStoreKey(hostId), JSON.stringify(secret));
}

export async function readHostSecret(hostId) {
  if (shouldUseAsyncSecretFallback()) {
    return readSecretFallback(hostId);
  }

  const raw = await SecureStore.getItemAsync(secureStoreKey(hostId));

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function deleteHostSecret(hostId) {
  if (shouldUseAsyncSecretFallback()) {
    await deleteSecretFallback(hostId);
    return;
  }

  await SecureStore.deleteItemAsync(secureStoreKey(hostId));
}
