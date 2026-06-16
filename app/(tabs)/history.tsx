import { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, Image,
  ActivityIndicator, RefreshControl, useWindowDimensions,
} from "react-native";
import { useNavigation } from "expo-router";
import { api } from "@/lib/api";
import { colors, radius, shadows } from "@/lib/theme";

interface VisitRecord {
  id: string;
  shopName: string;
  province: string;
  district?: string;
  tripType?: string;
  customerType: string;
  visitType?: string;
  result?: string;
  details?: string;
  imageUrls: string[];
  createdAt: string;
  user?: { fullName: string; email: string };
}

const TRIP_LABEL: Record<string, string> = {
  plan: "ตามแผน", off_plan: "นอกแผน",
};
const MISSION_LABEL: Record<string, string> = {
  tak: "ทัก", dem: "เดม",
};
const RESULT_LABEL: Record<string, string> = {
  buy: "ซื้อ", no_buy: "ไม่ซื้อ", not_found: "ไม่พบ",
};

export default function HistoryScreen() {
  const [records, setRecords] = useState<VisitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();
  const { fontScale } = useWindowDimensions();

  async function loadVisits() {
    try {
      const data = await api.getVisits();
      setRecords(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { loadVisits(); }, []);

  useEffect(() => {
    if (loading) return;
    navigation.setOptions({
      headerRight: () =>
        records.length > 0 ? (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>ทั้งหมด {records.length}</Text>
          </View>
        ) : null,
    });
  }, [records, loading]);

  const onRefresh = useCallback(() => { setRefreshing(true); loadVisits(); }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const fs = (base: number) => base / fontScale;

  return (
    <FlatList
      data={records}
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
        const locationLabel = item.district
          ? `${item.province} · ${item.district}`
          : item.province;
        const subParts = [
          item.customerType === "new" ? "ลูกค้าใหม่" : "ลูกค้าเก่า",
          item.visitType ? MISSION_LABEL[item.visitType] : "",
          item.tripType ? TRIP_LABEL[item.tripType] : "",
          locationLabel,
        ].filter(Boolean);

        const resultKey = item.result || "";
        const resultLabel = RESULT_LABEL[resultKey] || "";
        const resultStyle = resultKey === "buy"
          ? { bg: styles.badgeSuccess, text: styles.badgeSuccessText }
          : resultKey === "no_buy"
          ? { bg: styles.badgeFail, text: styles.badgeFailText }
          : { bg: styles.badgeNew, text: styles.badgeNewText };

        return (
          <View style={styles.card}>
            <Image
              source={item.imageUrls?.[0] ? { uri: item.imageUrls[0] } : undefined}
              style={styles.image}
            />
            <View style={styles.info}>
              <Text style={[styles.shopName, { fontSize: fs(13) }]} numberOfLines={1}>
                {item.shopName}
              </Text>
              <Text style={[styles.subLabel, { fontSize: fs(11) }]} numberOfLines={1}>
                {subParts.join(" · ")}
              </Text>
              <Text style={[styles.date, { fontSize: fs(11) }]}>
                {new Date(item.createdAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
              </Text>
            </View>
            {resultLabel ? (
              <View style={[styles.badge, resultStyle.bg]}>
                <Text style={[styles.badgeText, resultStyle.text]}>{resultLabel}</Text>
              </View>
            ) : null}
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
