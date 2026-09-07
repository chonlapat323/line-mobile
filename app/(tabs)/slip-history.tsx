import { useState, useCallback, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Image, Modal, ScrollView,
} from "react-native";
import { useFocusEffect } from "expo-router";
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
  { key: "verified", label: "QR ผ่าน" },
  { key: "", label: "ทั้งหมด" },
  { key: "pending_approval", label: "รอยืนยัน" },
  { key: "approved", label: "อนุมัติแล้ว" },
  { key: "rejected", label: "ปฏิเสธ" },
];

// ── Date helpers ──────────────────────────────────────────────
type DateFilter = "today" | "month" | "all" | "custom";
const DATE_OPTS: { value: DateFilter; label: string }[] = [
  { value: "today", label: "วันนี้" },
  { value: "month", label: "เดือนนี้" },
  { value: "all", label: "ทั้งหมด" },
  { value: "custom", label: "กำหนดเอง" },
];

// ── Calendar Picker ───────────────────────────────────────────
const MONTH_TH = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
const DAY_TH = ["อา","จ","อ","พ","พฤ","ศ","ส"];
function CalendarPicker({ visible, initialValue, onConfirm, onClose }: {
  visible: boolean; initialValue: string;
  onConfirm: (date: string) => void; onClose: () => void;
}) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const getInit = (v: string) => { const d = v ? new Date(v) : new Date(); return { y: d.getFullYear(), m: d.getMonth() }; };
  const [viewYear, setViewYear] = useState(() => getInit(initialValue).y);
  const [viewMonth, setViewMonth] = useState(() => getInit(initialValue).m);
  const [selected, setSelected] = useState(initialValue || todayStr);
  useEffect(() => {
    if (visible) { const { y, m } = getInit(initialValue); setViewYear(y); setViewMonth(m); setSelected(initialValue || todayStr); }
  }, [visible]);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const rows: (number | null)[][] = [];
  let row: (number | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    row.push(d);
    if (row.length === 7) { rows.push(row); row = []; }
  }
  if (row.length > 0) { while (row.length < 7) row.push(null); rows.push(row); }
  function prevMonth() { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); }
  function nextMonth() { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); }
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={cal.overlay}>
        <View style={cal.sheet}>
          <View style={cal.navRow}>
            <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={cal.monthLabel}>{MONTH_TH[viewMonth]} {viewYear + 543}</Text>
            <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="chevron-forward" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <View style={cal.dowRow}>{DAY_TH.map(d => <Text key={d} style={cal.dowText}>{d}</Text>)}</View>
          {rows.map((r, ri) => (
            <View key={ri} style={{ flexDirection: "row" }}>
              {r.map((day, ci) => {
                if (!day) return <View key={ci} style={cal.cell} />;
                const ds = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const isSel = ds === selected; const isToday = ds === todayStr;
                return (
                  <TouchableOpacity key={ci} style={cal.cell} onPress={() => setSelected(ds)}>
                    <View style={[cal.cellInner, isSel && cal.cellInnerSel, !isSel && isToday && cal.cellInnerToday]}>
                      <Text style={[cal.cellText, isSel && cal.cellTextSel, !isSel && isToday && cal.cellTextToday]}>{day}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
          <View style={cal.btnRow}>
            <TouchableOpacity style={cal.cancelBtn} onPress={onClose}>
              <Text style={cal.cancelText}>ยกเลิก</Text>
            </TouchableOpacity>
            <TouchableOpacity style={cal.confirmBtn} onPress={() => { onConfirm(selected); onClose(); }}>
              <Text style={cal.confirmText}>ตกลง</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
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
  const [dateFilter, setDateFilter] = useState<DateFilter>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showDatePicker, setShowDatePicker] = useState<"from" | "to" | null>(null);

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

  function toDateStr(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function buildParams(df: DateFilter, cf: string, ct: string, sf: string) {
    let dateFrom: string | undefined;
    let dateTo: string | undefined;
    if (df === "today") {
      const t = toDateStr(new Date());
      dateFrom = t; dateTo = t;
    } else if (df === "month") {
      const now = new Date();
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      dateFrom = toDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
      dateTo = toDateStr(last);
    } else if (df === "custom") {
      dateFrom = cf || undefined;
      dateTo = ct || undefined;
    }
    return { status: sf || undefined, dateFrom, dateTo };
  }

  useFocusEffect(useCallback(() => {
    setLoading(true);
    loadData(buildParams(dateFilter, customFrom, customTo, statusFilter));
  }, []));

  const filterInitRef = useRef(false);
  useEffect(() => {
    if (!filterInitRef.current) { filterInitRef.current = true; return; }
    setLoading(true);
    loadData(buildParams(dateFilter, customFrom, customTo, statusFilter));
  }, [dateFilter, customFrom, customTo, statusFilter]);

  function onRefresh() {
    setRefreshing(true);
    loadData(buildParams(dateFilter, customFrom, customTo, statusFilter));
  }

  if (loading) {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <View style={st.screen}>
      {/* ── Filter bar ── */}
      <View style={st.filterBar}>
        {/* Date chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips}>
          {DATE_OPTS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[st.chip, dateFilter === opt.value && st.chipActive]}
              onPress={() => {
                setDateFilter(opt.value);
                if (opt.value !== "custom") { setCustomFrom(""); setCustomTo(""); }
              }}
              activeOpacity={0.75}
            >
              <Text style={[st.chipText, dateFilter === opt.value && st.chipTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Custom date inputs */}
        {dateFilter === "custom" && (
          <View style={st.customDateRow}>
            <TouchableOpacity style={st.dateInput} onPress={() => setShowDatePicker("from")}>
              <Text style={customFrom ? st.dateInputText : st.dateInputPlaceholder}>
                {customFrom ? customFrom.split("-").reverse().join("/") : "วันที่เริ่ม"}
              </Text>
            </TouchableOpacity>
            <Text style={st.dateSep}>—</Text>
            <TouchableOpacity style={st.dateInput} onPress={() => setShowDatePicker("to")}>
              <Text style={customTo ? st.dateInputText : st.dateInputPlaceholder}>
                {customTo ? customTo.split("-").reverse().join("/") : "วันที่สิ้นสุด"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        <CalendarPicker visible={showDatePicker === "from"} initialValue={customFrom} onConfirm={setCustomFrom} onClose={() => setShowDatePicker(null)} />
        <CalendarPicker visible={showDatePicker === "to"} initialValue={customTo} onConfirm={setCustomTo} onClose={() => setShowDatePicker(null)} />

        {/* Status chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[st.chips, { paddingTop: 6 }]}>
          {STATUS_OPTS.map((opt) => {
            const active = statusFilter === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[st.chip, active && st.chipActive]}
                onPress={() => setStatusFilter(active ? "" : opt.key)}
                activeOpacity={0.75}
              >
                <Text style={[st.chipText, active && st.chipTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
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
    paddingTop: 8, paddingBottom: 8,
  },
  chips: { paddingHorizontal: 14, gap: 8, alignItems: "center" },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.borderLight,
    backgroundColor: colors.bg, marginRight: 0,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 17, fontWeight: "600", color: colors.textMuted },
  chipTextActive: { color: "#fff" },

  customDateRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingTop: 8, gap: 8 },
  dateInput: { flex: 1, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderLight, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 9, justifyContent: "center" },
  dateInputText: { fontSize: 14, color: colors.textPrimary },
  dateInputPlaceholder: { fontSize: 14, color: colors.textDisabled },
  dateSep: { fontSize: 16, color: colors.textDisabled },

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

const cal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: 32 },
  navRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 },
  monthLabel: { fontSize: 17, fontWeight: "700", color: colors.textPrimary },
  dowRow: { flexDirection: "row", marginBottom: 4 },
  dowText: { flex: 1, textAlign: "center", fontSize: 13, fontWeight: "600", color: colors.textMuted, paddingVertical: 6 },
  cell: { flex: 1, height: 44, alignItems: "center", justifyContent: "center" },
  cellInner: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  cellInnerSel: { backgroundColor: colors.primary },
  cellInnerToday: { borderWidth: 1.5, borderColor: colors.primary },
  cellText: { fontSize: 15, color: colors.textPrimary },
  cellTextSel: { color: "#fff", fontWeight: "700" },
  cellTextToday: { color: colors.primary, fontWeight: "600" },
  btnRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  cancelBtn: { flex: 1, paddingVertical: 13, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderLight, alignItems: "center" },
  cancelText: { fontSize: 16, fontWeight: "600", color: colors.textSecondary },
  confirmBtn: { flex: 1, paddingVertical: 13, borderRadius: radius.xl, backgroundColor: colors.primary, alignItems: "center" },
  confirmText: { fontSize: 16, fontWeight: "700", color: "#fff" },
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
