import { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, Image,
  ActivityIndicator, RefreshControl, useWindowDimensions,
} from "react-native";
import { useNavigation } from "expo-router";
import { api } from "@/lib/api";
import { colors, radius, shadows } from "@/lib/theme";

interface Log {
  id: string;
  imageUrl: string;
  shopName?: string;
  province?: string;
  customerType?: "new" | "existing";
  visitType?: string;
  details?: { title: string; price: string; note: string };
  status: string;
  createdAt: string;
}

const VISIT_TYPE_LABEL: Record<string, string> = {
  visit: "เยี่ยมเยือน",
  order: "จดยอด",
  delivery: "เดิมงาน",
};

export default function HistoryScreen() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();
  const { fontScale } = useWindowDimensions();

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

  // อัปเดต header badge เมื่อโหลดข้อมูลแล้ว
  useEffect(() => {
    if (loading) return;
    navigation.setOptions({
      headerRight: () =>
        logs.length > 0 ? (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>ทั้งหมด {logs.length}</Text>
          </View>
        ) : null,
    });
  }, [logs, loading]);

  const onRefresh = useCallback(() => { setRefreshing(true); loadHistory(); }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      data={logs}
      keyExtractor={(item) => item.id}
      style={styles.container}
      contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      ListEmptyComponent={
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>ยังไม่มีประวัติการเยี่ยม</Text>
          <Text style={styles.emptyDesc}>เริ่มบันทึกการเยี่ยมร้านค้าได้เลย</Text>
        </View>
      }
      renderItem={({ item }) => {
        const isNew = item.customerType === "new";
        const isSuccess = item.status === "success";
        const shopLabel = item.shopName || item.details?.title || "—";
        const locationLabel = item.province || "";
        const visitLabel = item.visitType ? VISIT_TYPE_LABEL[item.visitType] : "";
        const subLabel = [isNew ? "ลูกค้าใหม่" : visitLabel, locationLabel].filter(Boolean).join(" · ");

        const fs = (base: number) => base / fontScale;
        return (
          <View style={styles.card}>
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.image}
              defaultSource={undefined}
            />
            <View style={styles.info}>
              <Text style={[styles.shopName, { fontSize: fs(13) }]} numberOfLines={1}>{shopLabel}</Text>
              {subLabel ? <Text style={[styles.subLabel, { fontSize: fs(11) }]} numberOfLines={1}>{subLabel}</Text> : null}
              <Text style={[styles.date, { fontSize: fs(11) }]}>
                {new Date(item.createdAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
              </Text>
            </View>
            <View style={[
              styles.badge,
              isNew ? styles.badgeNew : isSuccess ? styles.badgeSuccess : styles.badgeFail,
            ]}>
              <Text style={[
                styles.badgeText,
                isNew ? styles.badgeNewText : isSuccess ? styles.badgeSuccessText : styles.badgeFailText,
              ]}>
                {isNew ? "ใหม่" : isSuccess ? "สำเร็จ" : "ล้มเหลว"}
              </Text>
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  emptyWrap: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyIcon: { fontSize: 44, marginBottom: 4 },
  emptyTitle: { fontSize: 15, fontWeight: "600", color: colors.textSecondary },
  emptyDesc: { fontSize: 13, color: colors.textDisabled },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: colors.borderLight,
    ...shadows.card,
  },
  image: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
  },
  info: { flex: 1, minWidth: 0 },
  shopName: { fontSize: 13, fontWeight: "700", color: colors.textPrimary, marginBottom: 2 },
  subLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 2 },
  date: { fontSize: 11, color: colors.textDisabled },

  headerBadge: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginRight: 14,
  },
  headerBadgeText: { fontSize: 12, fontWeight: "600", color: colors.primaryDark },

  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  badgeText: { fontSize: 11, fontWeight: "600" },
  badgeSuccess: { backgroundColor: colors.successBg },
  badgeSuccessText: { color: colors.primaryDark },
  badgeFail: { backgroundColor: colors.errorBg },
  badgeFailText: { color: colors.error },
  badgeNew: { backgroundColor: colors.infoBg },
  badgeNewText: { color: colors.infoText },
});
