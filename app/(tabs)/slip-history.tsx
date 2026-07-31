import { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Image, Modal, ScrollView,
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
  createdAt: string;
  user?: { fullName: string; email: string };
}

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

  async function loadData() {
    try {
      const res = await api.getSlips();
      setData(res?.data ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { loadData(); }, []));

  function onRefresh() { setRefreshing(true); loadData(); }

  if (loading) {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <View style={st.screen}>
      <FlatList
        data={data}
        keyExtractor={(i) => i.id}
        contentContainerStyle={st.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={st.empty}>
            <Ionicons name="receipt-outline" size={44} color={colors.textDisabled} />
            <Text style={st.emptyText}>ยังไม่มีประวัติส่งสลิป</Text>
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
                  <StatusBadge status={item.slipStatus} />
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
  slipImg: { width: "100%", height: 220, borderRadius: radius.md, backgroundColor: colors.bgAlt, marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { fontSize: 18, color: colors.textMuted, fontWeight: "500" },
  value: { fontSize: 18, color: colors.textPrimary, fontWeight: "600", textAlign: "right", flex: 1, marginLeft: 16 },
});
