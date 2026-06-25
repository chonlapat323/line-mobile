import { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, Image,
  ActivityIndicator, RefreshControl, useWindowDimensions,
  Modal, TouchableOpacity, ScrollView,
  NativeSyntheticEvent, NativeScrollEvent,
} from "react-native";
import { useNavigation, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
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
  orderAmount?: number | null;
  slipStatus?: string | null;
  imageUrls: string[];
  createdAt: string;
  user?: { fullName: string; email: string };
}

function SlipStatusBadge({ status }: { status?: string | null }) {
  if (!status || status === "verified" || status === "approved") return null;
  if (status === "pending_approval") {
    return (
      <View style={{ backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#fde68a", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
        <Text style={{ fontSize: 10, fontWeight: "700", color: "#92400e" }}>⏳ รอยืนยัน</Text>
      </View>
    );
  }
  if (status === "rejected") {
    return (
      <View style={{ backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
        <Text style={{ fontSize: 10, fontWeight: "700", color: "#991b1b" }}>✕ ปฏิเสธ</Text>
      </View>
    );
  }
  return null;
}

const TRIP_LABEL: Record<string, string> = { plan: "ตามแผน", off_plan: "นอกแผน" };
const MISSION_LABEL: Record<string, string> = { tak: "ทัก", dem: "เดม", tel: "โทร" };
const RESULT_LABEL: Record<string, string> = { buy: "ซื้อ", no_buy: "ไม่ซื้อ", not_found: "ไม่พบ" };
const SLOT_LABELS = ["หน้าร้าน 1", "หน้าร้าน 2", "ภายในร้าน 1", "ภายในร้าน 2", "หน้าจอ Line", "X-ray"];

const AVATAR_COLORS = ["#16a34a", "#d97706", "#4f46e5", "#db2777", "#0f766e", "#0369a1", "#9333ea", "#dc2626"];
function getAvatarColor(name: string): string {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

function getResultStyle(key: string) {
  if (key === "buy") return { bg: colors.successBg, text: colors.primaryDark };
  if (key === "no_buy") return { bg: colors.errorBg, text: colors.error };
  return { bg: colors.infoBg, text: colors.infoText };
}

// ── Detail Modal ──────────────────────────────────────────────
function DetailModal({ record, onClose }: { record: VisitRecord; onClose: () => void }) {
  const { width } = useWindowDimensions();
  const [imgIndex, setImgIndex] = useState(0);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setImgIndex(idx);
  };

  const locationLabel = record.district
    ? `${record.province} · ${record.district}`
    : record.province;

  const resKey = record.result || "";
  const rs = getResultStyle(resKey);

  const infoRows: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; value: string }[] = [
    { icon: "location-outline", label: "สถานที่", value: locationLabel },
    { icon: "swap-horizontal-outline", label: "ทริป", value: TRIP_LABEL[record.tripType || ""] || "-" },
    { icon: "people-outline", label: "ลูกค้า", value: record.customerType === "new" ? "ลูกค้าใหม่" : "ลูกค้าเก่า" },
    { icon: "checkmark-circle-outline", label: "ภารกิจ", value: MISSION_LABEL[record.visitType || ""] || "-" },
    { icon: "calendar-outline", label: "วันที่", value: new Date(record.createdAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) },
  ];

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={det.overlay}>
        <View style={det.sheet}>
          {/* Header */}
          <View style={det.header}>
            <View style={{ flex: 1 }}>
              <Text style={det.shopName} numberOfLines={1}>{record.shopName}</Text>
              {record.user && (
                <Text style={det.byUser}>โดย {record.user.fullName}</Text>
              )}
            </View>
            <TouchableOpacity style={det.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Image gallery — outside ScrollView to allow horizontal swipe */}
          {record.imageUrls.length > 0 ? (
            <View>
              <FlatList
                data={record.imageUrls}
                keyExtractor={(_, i) => String(i)}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
                renderItem={({ item }) => (
                  <Image
                    source={{ uri: item }}
                    style={[det.galleryImg, { width }]}
                    resizeMode="cover"
                  />
                )}
              />
              <View style={det.galleryMeta}>
                <Text style={det.slotLabel}>{SLOT_LABELS[imgIndex] ?? `รูป ${imgIndex + 1}`}</Text>
                <View style={det.dots}>
                  {record.imageUrls.map((_, i) => (
                    <View key={i} style={[det.dot, i === imgIndex && det.dotActive]} />
                  ))}
                </View>
              </View>
            </View>
          ) : (
            <View style={det.noImg}>
              <Ionicons name="image-outline" size={40} color={colors.textDisabled} />
              <Text style={det.noImgText}>ไม่มีรูปภาพ</Text>
            </View>
          )}

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={det.body}>
              {/* Result badge */}
              {resKey ? (
                <View style={det.resultRow}>
                  <View style={[det.resultBadge, { backgroundColor: rs.bg }]}>
                    <Text style={[det.resultBadgeText, { color: rs.text }]}>
                      ผลตอบรับ: {RESULT_LABEL[resKey]}
                    </Text>
                  </View>
                  {resKey === "buy" && record.orderAmount != null && (
                    <View style={det.orderBadge}>
                      <Text style={det.orderText}>
                        ฿{record.orderAmount.toLocaleString("th-TH")}
                      </Text>
                    </View>
                  )}
                  {resKey === "buy" && <SlipStatusBadge status={record.slipStatus} />}
                </View>
              ) : null}

              {/* Info rows */}
              {infoRows.map((row) => (
                <View key={row.label} style={det.infoRow}>
                  <Ionicons name={row.icon} size={16} color={colors.textMuted} style={det.infoIcon} />
                  <Text style={det.infoLabel}>{row.label}</Text>
                  <Text style={det.infoValue}>{row.value}</Text>
                </View>
              ))}

              {/* Details note */}
              {record.details ? (
                <View style={det.noteBox}>
                  <Text style={det.noteLabel}>สรุปผล</Text>
                  <Text style={det.noteText}>{record.details}</Text>
                </View>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────
export default function HistoryScreen() {
  const [records, setRecords] = useState<VisitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<VisitRecord | null>(null);
  const navigation = useNavigation();
  const { fontScale } = useWindowDimensions();

  async function loadVisits() {
    try {
      const res = await api.getVisits();
      setRecords(res?.data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { loadVisits(); }, []));

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
    <>
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

          const resKey = item.result || "";
          const resLabel = RESULT_LABEL[resKey] || "";
          const rs = getResultStyle(resKey);

          const tags: string[] = [
            item.customerType === "new" ? "ลูกค้าใหม่" : "ลูกค้าเก่า",
            item.visitType ? MISSION_LABEL[item.visitType] : "",
            item.tripType ? TRIP_LABEL[item.tripType] : "",
            item.province ? item.province.replace("กรุงเทพมหานคร", "กรุงเทพฯ") : "",
          ].filter(Boolean);

          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => setSelected(item)}
              activeOpacity={0.8}
            >
              {item.imageUrls?.[0] ? (
                <Image source={{ uri: item.imageUrls[0] }} style={styles.visitThumb} resizeMode="cover" />
              ) : (
                <View style={[styles.visitThumb, { backgroundColor: getAvatarColor(item.shopName), justifyContent: "center", alignItems: "center" }]}>
                  <Text style={styles.visitThumbText}>{item.shopName.charAt(0)}</Text>
                </View>
              )}
              <View style={styles.info}>
                <Text style={[styles.shopName, { fontSize: fs(13) }]} numberOfLines={1}>
                  {item.shopName}
                </Text>
                <View style={styles.tagRow}>
                  {tags.map((t) => (
                    <Text key={t} style={styles.tag}>{t}</Text>
                  ))}
                </View>
                <Text style={[styles.date, { fontSize: fs(11) }]}>
                  {new Date(item.createdAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                </Text>
              </View>
              {resLabel ? (
                <View style={styles.badgeCol}>
                  <View style={[styles.badge, { backgroundColor: rs.bg }]}>
                    <Text style={[styles.badgeText, { color: rs.text }]}>{resLabel}</Text>
                  </View>
                  {resKey === "buy" && item.orderAmount != null && (
                    <Text style={styles.orderAmt}>
                      ฿{item.orderAmount.toLocaleString("th-TH")}
                    </Text>
                  )}
                  {resKey === "buy" && <SlipStatusBadge status={item.slipStatus} />}
                </View>
              ) : null}
            </TouchableOpacity>
          );
        }}
      />

      {selected && (
        <DetailModal record={selected} onClose={() => setSelected(null)} />
      )}
    </>
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
  visitThumb: {
    width: 50, height: 50,
    borderRadius: radius.md,
    justifyContent: "center", alignItems: "center", flexShrink: 0,
  },
  visitThumbText: { fontSize: 20, fontWeight: "800", color: "#fff" },
  info: { flex: 1, minWidth: 0 },
  shopName: { fontSize: 13, fontWeight: "700", color: colors.textPrimary, marginBottom: 2 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 3, marginBottom: 2 },
  tag: {
    fontSize: 10, fontWeight: "600", color: colors.textMuted,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderLight,
    paddingHorizontal: 7, paddingVertical: 1, borderRadius: radius.full,
  },
  date: { fontSize: 10, color: colors.textDisabled },

  headerBadge: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1, borderColor: colors.primaryBorder,
    borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 3, marginRight: 14,
  },
  headerBadgeText: { fontSize: 12, fontWeight: "600", color: colors.primaryDark },

  badgeCol: { alignItems: "flex-end", gap: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  badgeText: { fontSize: 11, fontWeight: "600" },
  orderAmt: { fontSize: 11, fontWeight: "700", color: "#15803d" },
});

const det = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: "92%", overflow: "hidden",
  },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
    gap: 12,
  },
  shopName: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  byUser: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.borderLight,
    alignItems: "center", justifyContent: "center",
  },

  galleryImg: { height: 240 },
  galleryMeta: {
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4,
    alignItems: "center", gap: 6,
  },
  slotLabel: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
  dots: { flexDirection: "row", gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.borderLight },
  dotActive: { backgroundColor: colors.primary, width: 14 },

  noImg: {
    height: 140, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.primaryLight, gap: 8,
  },
  noImgText: { fontSize: 13, color: colors.textDisabled },

  body: { padding: 18 },

  resultRow: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap",
  },
  resultBadge: {
    borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 6,
  },
  resultBadgeText: { fontSize: 13, fontWeight: "700" },
  orderBadge: {
    borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: "#f0fdf4", borderWidth: 1, borderColor: "#bbf7d0",
  },
  orderText: { fontSize: 13, fontWeight: "700", color: "#15803d" },

  infoRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  infoIcon: { marginRight: 10 },
  infoLabel: { fontSize: 13, color: colors.textMuted, width: 70 },
  infoValue: { flex: 1, fontSize: 13, color: colors.textPrimary, fontWeight: "500" },

  noteBox: {
    marginTop: 16, backgroundColor: colors.surface,
    borderRadius: radius.lg, padding: 14,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  noteLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "600", marginBottom: 6 },
  noteText: { fontSize: 13, color: colors.textPrimary, lineHeight: 20 },
});
