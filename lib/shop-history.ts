import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "shop_history_v1";
const MAX = 20;

export async function getShopHistory(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function saveShopToHistory(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  const history = await getShopHistory();
  const updated = [trimmed, ...history.filter((s) => s !== trimmed)].slice(0, MAX);
  await AsyncStorage.setItem(KEY, JSON.stringify(updated));
}
