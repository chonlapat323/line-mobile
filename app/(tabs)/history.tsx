import { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, RefreshControl,
} from "react-native";
import { api } from "@/lib/api";

interface Log {
  id: string;
  imageUrl: string;
  details: { title: string; price: string; note: string };
  status: string;
  errorMessage?: string;
  createdAt: string;
}

export default function HistoryScreen() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadHistory() {
    try {
      const data = await api.getHistory();
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { loadHistory(); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadHistory();
  }, []);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#22c55e" /></View>;
  }

  return (
    <FlatList
      data={logs}
      keyExtractor={(item) => item.id}
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />}
      ListEmptyComponent={<Text style={styles.empty}>ยังไม่มีประวัติการส่ง</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Image source={{ uri: item.imageUrl }} style={styles.image} />
          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={1}>{item.details?.title}</Text>
            {item.details?.price ? <Text style={styles.price}>ราคา: {item.details.price}</Text> : null}
            <Text style={styles.date}>{new Date(item.createdAt).toLocaleString("th-TH")}</Text>
          </View>
          <View style={[styles.badge, item.status === "success" ? styles.badgeSuccess : styles.badgeFail]}>
            <Text style={[styles.badgeText, item.status === "success" ? styles.badgeTextSuccess : styles.badgeTextFail]}>
              {item.status === "success" ? "สำเร็จ" : "ล้มเหลว"}
            </Text>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  empty: { textAlign: "center", color: "#9ca3af", fontSize: 14, marginTop: 60 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  image: { width: 60, height: 60, borderRadius: 8, backgroundColor: "#e5e7eb" },
  info: { flex: 1 },
  title: { fontSize: 14, fontWeight: "600", color: "#1f2937" },
  price: { fontSize: 12, color: "#ef4444", marginTop: 2 },
  date: { fontSize: 11, color: "#9ca3af", marginTop: 3 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  badgeSuccess: { backgroundColor: "#dcfce7" },
  badgeFail: { backgroundColor: "#fee2e2" },
  badgeText: { fontSize: 11, fontWeight: "600" },
  badgeTextSuccess: { color: "#16a34a" },
  badgeTextFail: { color: "#dc2626" },
});
