import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const STATE_KEY = "opencode-mobile-state";
const SECRET_PREFIX = "opencode-host-secret:";

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
  await SecureStore.setItemAsync(`${SECRET_PREFIX}${hostId}`, JSON.stringify(secret));
}

export async function readHostSecret(hostId) {
  const raw = await SecureStore.getItemAsync(`${SECRET_PREFIX}${hostId}`);

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
  await SecureStore.deleteItemAsync(`${SECRET_PREFIX}${hostId}`);
}
