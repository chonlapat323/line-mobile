import { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Image, Modal, ScrollView, TextInput,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { colors, radius, shadows } from "@/lib/theme";

interface SlipSubmission {
  id: string;
  shopName: string;
  amount?: number | null;
  details?: string | null;
  slipUrl: string;
  slipStatus: string;
  transRef?: string | null;
  lineStatus?: string | null;
  isProxy?: boolean;
  createdAt: string;
  user?: { fullName: string; email: string };
}

const STATUS_OPTS = [
  { key: "", label: "ทั้งหมด" },
  { key: "pending_approval", label: "รอยืนยัน" },
  { key: "verified", label: "QR ผ่าน" },
  { key: "approved", label: "อนุมัติแล้ว" },
  { key: "rejected", label: "ปฏิเสธ" },
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; border: string; text: string; label: string }> = {
    verified:          { bg: "#f0fdf4", border: "#86efac", text: "#15803d", label: "QR ผ่าน" },
    approved:          { bg: "#f0fdf4", border: "#86efac", text: "#15803d", label: "อนุมัติแล้ว" },
    pending_approval:  { bg: "#fffbeb", border: "#fde68a", text: "#92400e", label: "รอยืนยัน" },
    rejected:          { bg: "#fef2f2", border: "#fecaca", text: "#991b1b", label: "ปฏิเสธ" },
  };
  const s = map[status] ?? { bg: "#f3f4f6", border: "#d1d5db", text: "#6b7280", label: status };
  return (
    <View style={{ backgroundColor: s.bg, borderWidth: 1, borderColor: s.border, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ fontSize: 15, fontWeight: "700", color: s.text }}>{s.label}</Text>
    </View>
  );
}

function LineStatusBadge({ status }: { status?: string | null }) {
  if (!status) return null;
  if (status === "sent") return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
      <Ionicons name="checkmark-circle" size={12} color="#16a34a" />
      <Text style={{ fontSize: 16, color: "#16a34a" }}>ส่ง LINE แล้ว</Text>
    </View>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
      <Ionicons name="close-circle" size={12} color={colors.error} />
      <Text style={{ fontSize: 16, color: colors.error }}>LINE ล้มเหลว</Text>
    </View>
  );
}

function DetailModal({ item, onClose }: { item: SlipSubmission; onClose: () => void }) {
  const dt = new Date(item.createdAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" });
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={md.overlay}>
        <View style={md.sheet}>
          <View style={md.header}>
            <Text style={md.title}>{item.shopName}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={md.body}>
            <Image source={{ uri: item.slipUrl }} style={md.slipImg} resizeMode="contain" />
            <View style={md.row}><Text style={md.label}>สถานะ</Text><StatusBadge status={item.slipStatus} /></View>
            <View style={md.row}><Text style={md.label}>ยอดเงิน</Text><Text style={md.value}>{item.amount ? `฿${item.amount.toLocaleString("th-TH")}` : "-"}</Text></View>
            {item.transRef ? <View style={md.row}><Text style={md.label}>อ้างอิง</Text><Text style={md.value}>{item.transRef}</Text></View> : null}
            {item.details ? <View style={md.row}><Text style={md.label}>รายละเอียด</Text><Text style={md.value}>{item.details}</Text></View> : null}
            {item.isProxy ? (
              <View style={md.row}>
                <Text style={md.label}>เก็บแทน</Text>
                <View style={{ backgroundColor: "#eff6ff", borderWidth: 1, borderColor: "#93c5fd", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: "#1d4ed8" }}>เก็บแทน</Text>
                </View>
              </View>
            ) : null}
            <View style={md.row}><Text style={md.label}>LINE</Text><LineStatusBadge status={item.lineStatus} /></View>
            <View style={md.row}><Text style={md.label}>วันที่</Text><Text style={md.value}>{dt}</Text></View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function SlipHistoryScreen() {
  const [data, setData] = useState<SlipSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<SlipSubmission | null>(null);

  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showDateFilter, setShowDateFilter] = useState(false);

  async function loadData(params?: { status?: string; dateFrom?: string; dateTo?: string }) {
    try {
      const res = await api.getSlips(params);
      setData(res?.data ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { loadData(); }, []));

  function onRefresh() {
    setRefreshing(true);
    loadData({ status: statusFilter || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined });
  }

  function applyFilter() {
    setLoading(true);
    loadData({ status: statusFilter || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined });
  }

  function clearFilter() {
    setStatusFilter("");
    setDateFrom("");
    setDateTo("");
    setShowDateFilter(false);
    setLoading(true);
    loadData();
  }

  const hasActiveFilter = !!statusFilter || !!dateFrom || !!dateTo;

  if (loading) {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <View style={st.screen}>
      {/* ── Filter bar ── */}
      <View style={st.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips}>
          {STATUS_OPTS.map((opt) => {
            const active = statusFilter === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[st.chip, active && st.chipActive]}
                onPress={() => {
                  const next = active ? "" : opt.key;
                  setStatusFilter(next);
                  setLoading(true);
                  loadData({ status: next || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined });
                }}
                activeOpacity={0.75}
              >
                <Text style={[st.chipText, active && st.chipTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={[st.chip, (showDateFilter || dateFrom || dateTo) && st.chipActive]}
            onPress={() => setShowDateFilter((v) => !v)}
            activeOpacity={0.75}
          >
            <Ionicons name="calendar-outline" size={14} color={(showDateFilter || dateFrom || dateTo) ? "#fff" : colors.textMuted} />
            <Text style={[st.chipText, (showDateFilter || dateFrom || dateTo) && st.chipTextActive]}>ช่วงวันที่</Text>
          </TouchableOpacity>
          {hasActiveFilter && (
            <TouchableOpacity style={[st.chip, st.chipClear]} onPress={clearFilter} activeOpacity={0.75}>
              <Ionicons name="close" size={14} color={colors.error} />
              <Text style={[st.chipText, { color: colors.error }]}>ล้าง</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {showDateFilter && (
          <View style={st.dateRow}>
            <View style={st.dateField}>
              <Text style={st.dateLabel}>จาก</Text>
              <TextInput
                style={st.dateInput}
                value={dateFrom}
                onChangeText={setDateFrom}
                placeholder="ปปปป-ดด-วว"
                placeholderTextColor={colors.textDisabled}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />
            </View>
            <Text style={st.dateSep}>—</Text>
            <View style={st.dateField}>
              <Text style={st.dateLabel}>ถึง</Text>
              <TextInput
                style={st.dateInput}
                value={dateTo}
                onChangeText={setDateTo}
                placeholder="ปปปป-ดด-วว"
                placeholderTextColor={colors.textDisabled}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />
            </View>
            <TouchableOpacity style={st.applyBtn} onPress={applyFilter} activeOpacity={0.85}>
              <Text style={st.applyBtnText}>กรอง</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <FlatList
        data={data}
        keyExtractor={(i) => i.id}
        contentContainerStyle={st.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={st.empty}>
            <Ionicons name="receipt-outline" size={44} color={colors.textDisabled} />
            <Text style={st.emptyText}>ไม่พบรายการ</Text>
          </View>
        }
        renderItem={({ item }) => {
          const dt = new Date(item.createdAt).toLocaleString("th-TH", {
            timeZone: "Asia/Bangkok", day: "numeric", month: "short",
            hour: "2-digit", minute: "2-digit",
          });
          return (
            <TouchableOpacity style={st.card} onPress={() => setSelected(item)} activeOpacity={0.85}>
              <Image source={{ uri: item.slipUrl }} style={st.thumb} resizeMode="cover" />
              <View style={st.cardBody}>
                <View style={st.cardTop}>
                  <Text style={st.shopName} numberOfLines={1}>{item.shopName}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    {item.isProxy && (
                      <View style={st.proxyBadge}>
                        <Text style={st.proxyBadgeText}>เก็บแทน</Text>
                      </View>
                    )}
                    <StatusBadge status={item.slipStatus} />
                  </View>
                </View>
                <Text style={st.amount}>
                  {item.amount ? `฿${item.amount.toLocaleString("th-TH")}` : "ยังไม่ระบุยอด"}
                </Text>
                <View style={st.cardBottom}>
                  <LineStatusBadge status={item.lineStatus} />
                  <Text style={st.date}>{dt}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
      {selected && <DetailModal item={selected} onClose={() => setSelected(null)} />}
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { padding: 12, paddingBottom: 40, gap: 8 },
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 19, color: colors.textDisabled },

  filterBar: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
    paddingVertical: 8,
  },
  chips: { paddingHorizontal: 12, gap: 6, alignItems: "center" },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipClear: { borderColor: colors.error, backgroundColor: "#fef2f2" },
  chipText: { fontSize: 16, color: colors.textMuted, fontWeight: "600" },
  chipTextActive: { color: "#fff" },

  dateRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingTop: 8,
  },
  dateField: { flex: 1, gap: 2 },
  dateLabel: { fontSize: 13, color: colors.textMuted, fontWeight: "600" },
  dateInput: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 10, paddingVertical: 7,
    fontSize: 17, color: colors.textPrimary, backgroundColor: colors.bg,
  },
  dateSep: { fontSize: 18, color: colors.textDisabled, marginTop: 16 },
  applyBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 9, marginTop: 16,
  },
  applyBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },

  card: {
    flexDirection: "row", backgroundColor: colors.surface,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight,
    overflow: "hidden", ...shadows.card,
  },
  thumb: { width: 80, height: 80 },
  cardBody: { flex: 1, padding: 10, justifyContent: "space-between" },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  shopName: { fontSize: 19, fontWeight: "700", color: colors.textPrimary, flex: 1 },
  amount: { fontSize: 21, fontWeight: "700", color: colors.primary, marginTop: 2 },
  cardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  date: { fontSize: 16, color: colors.textDisabled },

  proxyBadge: {
    backgroundColor: "#eff6ff", borderWidth: 1, borderColor: "#93c5fd",
    borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2,
  },
  proxyBadgeText: { fontSize: 13, fontWeight: "700", color: "#1d4ed8" },
});

const md = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: "85%",
  },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 16, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  title: { fontSize: 21, fontWeight: "700", color: colors.textPrimary, flex: 1 },
  body: { padding: 16, gap: 12 },
  slipImg: { width: "100%", height: 220, borderRadius: radius.md, backgroundColor: colors.bg, marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { fontSize: 18, color: colors.textMuted, fontWeight: "500" },
  value: { fontSize: 18, color: colors.textPrimary, fontWeight: "600", textAlign: "right", flex: 1, marginLeft: 16 },
});
