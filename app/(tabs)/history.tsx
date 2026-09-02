import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, Image, Modal, TouchableOpacity,
  ScrollView, Alert, TextInput, RefreshControl, ActivityIndicator,
  useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent,
  KeyboardAvoidingView, Platform,
} from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useNavigation, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, getStoredUser } from "@/lib/api";
import { colors, radius, shadows } from "@/lib/theme";
import { SkeletonBox } from "@/lib/Skeleton";
import { ImageViewer } from "@/lib/ImageViewer";
import { TRIP_LABEL, MISSION_LABEL, RESULT_LABEL, CUSTOMER_TYPE_LABEL } from "@/lib/labels";

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
  slipUrl?: string | null;
  transRef?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  imageUrls: string[];
  createdAt: string;
  user?: { fullName: string; email: string };
}

const SLOT_LABELS = ["ลีคชีต", "หน้าร้าน 1", "หน้าร้าน 2", "ภายในร้าน 1", "ภายในร้าน 2", "หน้าจอ LINE"];
const AVATAR_COLORS = ["#16a34a", "#d97706", "#4f46e5", "#db2777", "#0f766e", "#0369a1", "#9333ea", "#dc2626"];

function getAvatarColor(name: string): string {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}
function getResultStyle(key: string) {
  if (key === "buy") return { bg: colors.successBg, text: colors.primaryDark };
  if (key === "no_buy") return { bg: colors.errorBg, text: colors.error };
  return { bg: colors.infoBg, text: colors.infoText };
}

// ── Slip Status Badge ─────────────────────────────────────────
function SlipStatusBadge({ status }: { status?: string | null }) {
  if (!status || status === "verified" || status === "approved") return null;
  if (status === "pending_approval") {
    return (
      <View style={{ backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#fde68a", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: "#92400e" }}>⏳ รอยืนยัน</Text>
      </View>
    );
  }
  if (status === "rejected") {
    return (
      <View style={{ backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: "#991b1b" }}>✕ ปฏิเสธ</Text>
      </View>
    );
  }
  return null;
}

// ── Picker Modal ──────────────────────────────────────────────
function PickerModal({ visible, title, options, selected, onSelect, onClose }: {
  visible: boolean;
  title: string;
  options: { value: string; label: string }[];
  selected: string;
  onSelect: (v: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={pm.overlay}>
        <View style={pm.sheet}>
          <View style={pm.header}>
            <Text style={pm.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={pm.closeBtn}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={options}
            keyExtractor={item => item.value || "__all__"}
            contentContainerStyle={{ paddingBottom: 24 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[pm.option, item.value === selected && pm.optionActive]}
                onPress={() => { onSelect(item.value); onClose(); }}
              >
                <Text style={[pm.optionText, item.value === selected && pm.optionTextActive]} numberOfLines={1}>
                  {item.label}
                </Text>
                {item.value === selected && (
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

// ── Detail Modal ──────────────────────────────────────────────
function DetailModal({ record, onClose, onEdit, onDelete, deleting }: {
  record: VisitRecord;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const { width } = useWindowDimensions();
  const [imgIndex, setImgIndex] = useState(0);
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setImgIndex(idx);
  };

  const isBkk = record.province === "กรุงเทพมหานคร" || record.province === "กทม" || record.province === "กรุงเทพฯ";
  const locationLabel = record.district
    ? (isBkk ? `${record.district} กทม.` : `${record.province} · ${record.district}`)
    : record.province;
  const resKey = record.result || "";
  const rs = getResultStyle(resKey);

  const allImages = [...record.imageUrls, ...(record.slipUrl ? [record.slipUrl] : [])];
  const allLabels = [...SLOT_LABELS, "สลิปการชำระเงิน"];

  const infoRows: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; value: string }[] = [
    { icon: "calendar-outline", label: "วันที่ทำภารกิจ", value: new Date(record.createdAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) },
    { icon: "location-outline", label: "สถานที่", value: locationLabel },
    { icon: "swap-horizontal-outline", label: "ทริป", value: TRIP_LABEL[record.tripType || ""] || "-" },
    { icon: "people-outline", label: "ลูกค้า", value: CUSTOMER_TYPE_LABEL[record.customerType] ?? record.customerType },
    { icon: "checkmark-circle-outline", label: "ภารกิจ", value: MISSION_LABEL[record.visitType || ""] || "-" },
    ...(record.latitude && record.longitude
      ? [{ icon: "navigate-outline" as const, label: "พิกัด GPS", value: `${record.latitude.toFixed(6)}, ${record.longitude.toFixed(6)}` }]
      : []),
  ];

  return (
    <Modal visible animationType="slide" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={det.overlay}>
        <View style={det.sheet}>
          <View style={det.header}>
            <View style={{ flex: 1 }}>
              <Text style={det.shopName} numberOfLines={1}>{record.shopName}</Text>
              {record.user && <Text style={det.byUser}>โดย {record.user.fullName}</Text>}
            </View>
            <TouchableOpacity style={det.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {allImages.length > 0 ? (
            <View style={det.galleryClip}>
              <FlatList
                data={allImages}
                keyExtractor={(_, i) => String(i)}
                horizontal pagingEnabled showsHorizontalScrollIndicator={false}
                onScroll={onScroll} scrollEventThrottle={16}
                renderItem={({ item, index }) => (
                  <TouchableOpacity activeOpacity={0.92} onPress={() => setViewerIdx(index)}>
                    <Image source={{ uri: item }} style={[det.galleryImg, { width }]} resizeMode="cover" />
                    <View style={det.zoomHint}><Ionicons name="expand-outline" size={14} color="#fff" /></View>
                  </TouchableOpacity>
                )}
              />
              <View style={det.galleryMeta}>
                <Text style={det.slotLabel}>{allLabels[imgIndex] ?? `รูป ${imgIndex + 1}`}</Text>
                <View style={det.dots}>
                  {allImages.map((_, i) => <View key={i} style={[det.dot, i === imgIndex && det.dotActive]} />)}
                </View>
              </View>
            </View>
          ) : (
            <View style={det.noImg}>
              <Ionicons name="image-outline" size={40} color={colors.textDisabled} />
              <Text style={det.noImgText}>ไม่มีรูปภาพ</Text>
            </View>
          )}

          {viewerIdx !== null && (
            <ImageViewer images={allImages} labels={allLabels} initialIndex={viewerIdx} onClose={() => setViewerIdx(null)} />
          )}

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
            <View style={det.body}>
              {(resKey || record.details) ? (
                <View style={det.resultRow}>
                  {resKey ? (
                    <View style={[det.resultBadge, { backgroundColor: rs.bg }]}>
                      <Text style={[det.resultBadgeText, { color: rs.text }]}>ผลตอบรับ: {RESULT_LABEL[resKey]}</Text>
                    </View>
                  ) : null}
                  {resKey === "buy" && record.orderAmount != null && (
                    <View style={det.orderBadge}>
                      <Text style={det.orderText}>ประมาณการออเดอร์ ฿{record.orderAmount.toLocaleString("th-TH")}</Text>
                    </View>
                  )}
                  {record.details ? (
                    <Text style={det.noteInline} numberOfLines={2}>{record.details}</Text>
                  ) : null}
                </View>
              ) : null}

              {infoRows.map((row) => (
                <View key={row.label} style={det.infoRow}>
                  <Ionicons name={row.icon} size={16} color={colors.textMuted} style={det.infoIcon} />
                  <Text style={det.infoLabel}>{row.label}</Text>
                  <Text style={det.infoValue}>{row.value}</Text>
                </View>
              ))}

              {/* Edit / Delete buttons */}
              <View style={det.actionRow}>
                <TouchableOpacity style={det.editBtn} onPress={onEdit}>
                  <Ionicons name="pencil-outline" size={16} color={colors.primary} />
                  <Text style={det.editBtnText}>แก้ไข</Text>
                </TouchableOpacity>
                <TouchableOpacity style={det.deleteBtn} onPress={onDelete} disabled={deleting}>
                  {deleting
                    ? <ActivityIndicator size="small" color="#dc2626" />
                    : <Ionicons name="trash-outline" size={16} color="#dc2626" />}
                  <Text style={det.deleteBtnText}>ลบรายการ</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Edit Modal ────────────────────────────────────────────────
function EditModal({ record, onClose, onDone }: {
  record: VisitRecord;
  onClose: () => void;
  onDone: (updated: VisitRecord) => void;
}) {
  const [shopName, setShopName] = useState(record.shopName);
  const [result, setResult] = useState(record.result ?? "");
  const [orderAmount, setOrderAmount] = useState(record.orderAmount != null ? String(record.orderAmount) : "");
  const [details, setDetails] = useState(record.details ?? "");
  const [loading, setLoading] = useState(false);

  const resultOpts = [
    { value: "buy", label: "ออเดอร์" },
    { value: "no_buy", label: "ไม่ออเดอร์" },
    { value: "not_found", label: "ไม่พบ" },
  ];

  async function handleSave() {
    if (!shopName.trim()) { Alert.alert("กรุณากรอกชื่อร้าน"); return; }
    setLoading(true);
    try {
      const updated = await api.updateVisit(record.id, {
        shopName: shopName.trim(),
        result,
        orderAmount: result === "buy" && orderAmount ? Number(orderAmount) : null,
        details: details.trim(),
      });
      onDone({ ...record, ...updated });
    } catch (e) {
      Alert.alert("เกิดข้อผิดพลาด", (e as Error).message);
    } finally { setLoading(false); }
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={ed.overlay}>
          <View style={ed.sheet}>
            <View style={ed.header}>
              <Text style={ed.title}>แก้ไขรายการ</Text>
              <TouchableOpacity onPress={onClose} style={ed.closeBtn}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={ed.body} showsVerticalScrollIndicator={false}>
              <Text style={ed.label}>ชื่อร้าน</Text>
              <TextInput
                style={ed.input}
                value={shopName}
                onChangeText={setShopName}
                placeholder="ชื่อร้าน"
                placeholderTextColor={colors.textDisabled}
              />

              <Text style={ed.label}>ผลตอบรับ</Text>
              <View style={ed.chipRow}>
                {resultOpts.map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[ed.chip, result === opt.value && ed.chipActive]}
                    onPress={() => setResult(opt.value)}
                  >
                    <Text style={[ed.chipText, result === opt.value && ed.chipTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {result === "buy" && (
                <>
                  <Text style={ed.label}>ประมาณการออเดอร์ (บาท)</Text>
                  <TextInput
                    style={ed.input}
                    value={orderAmount}
                    onChangeText={setOrderAmount}
                    placeholder="ระบุยอด"
                    placeholderTextColor={colors.textDisabled}
                    keyboardType="numeric"
                  />
                </>
              )}

              <Text style={ed.label}>สรุปผล / หมายเหตุ</Text>
              <TextInput
                style={[ed.input, ed.inputMulti]}
                value={details}
                onChangeText={setDetails}
                placeholder="สรุปผลการเยี่ยม..."
                placeholderTextColor={colors.textDisabled}
                multiline
                numberOfLines={3}
              />

              <View style={ed.btnRow}>
                <TouchableOpacity style={ed.cancelBtn} onPress={onClose}>
                  <Text style={ed.cancelText}>ยกเลิก</Text>
                </TouchableOpacity>
                <TouchableOpacity style={ed.saveBtn} onPress={handleSave} disabled={loading}>
                  {loading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={ed.saveText}>บันทึก</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Date helpers ──────────────────────────────────────────────
type DateFilter = "today" | "month" | "all" | "custom";

function getDateBounds(f: DateFilter, customFrom: string, customTo: string): { dateFrom?: string; dateTo?: string } {
  if (f === "today") {
    const now = new Date();
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const end = new Date(now); end.setHours(23, 59, 59, 999);
    return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
  }
  if (f === "month") {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
  }
  if (f === "custom") {
    return {
      dateFrom: customFrom ? `${customFrom}T00:00:00` : undefined,
      dateTo: customTo ? `${customTo}T23:59:59` : undefined,
    };
  }
  return {};
}

// ── Main Screen ───────────────────────────────────────────────
export default function HistoryScreen() {
  const [records, setRecords] = useState<VisitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<VisitRecord | null>(null);
  const [editRecord, setEditRecord] = useState<VisitRecord | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [dateFilter, setDateFilter] = useState<DateFilter>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showDatePicker, setShowDatePicker] = useState<"from" | "to" | null>(null);
  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [shopFilter, setShopFilter] = useState("");

  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<{ id: string; fullName: string }[]>([]);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [showShopPicker, setShowShopPicker] = useState(false);

  const navigation = useNavigation();
  const { fontScale } = useWindowDimensions();
  const mountedRef = useRef(true);

  useEffect(() => {
    getStoredUser().then(u => {
      if (u?.role === "admin") {
        setIsAdmin(true);
        api.getUsers().then((res: any) => {
          const list = Array.isArray(res) ? res : res?.data ?? [];
          setUsers(list.map((u: any) => ({ id: u.id, fullName: u.fullName })));
        }).catch(() => {});
      }
    });
    return () => { mountedRef.current = false; };
  }, []);

  const doLoad = useCallback(async (df: DateFilter, from: string, to: string, uid: string) => {
    const bounds = getDateBounds(df, from, to);
    try {
      const res = await api.getVisits({ ...bounds, filterUserId: uid || undefined });
      if (mountedRef.current) {
        setRecords(res?.data ?? []);
        setShopFilter("");
      }
    } catch (err) { console.error(err); }
    finally { if (mountedRef.current) { setLoading(false); setRefreshing(false); } }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    doLoad(dateFilter, customFrom, customTo, userFilter);
  }, [dateFilter, customFrom, customTo, userFilter, doLoad]));

  const uniqueShops = useMemo(() => [...new Set(records.map(r => r.shopName))].sort(), [records]);

  const hasActiveFilter =
    search.trim().length > 0 ||
    !!shopFilter ||
    !!userFilter ||
    (dateFilter !== "all" && dateFilter !== "custom") ||
    (dateFilter === "custom" && !!customFrom && !!customTo);

  const displayedRecords = useMemo(() => {
    if (!hasActiveFilter) return [];
    const q = search.toLowerCase().trim();
    return records.filter(r => {
      if (shopFilter && r.shopName !== shopFilter) return false;
      if (q && !r.shopName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [records, search, shopFilter, hasActiveFilter]);

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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    doLoad(dateFilter, customFrom, customTo, userFilter);
  }, [dateFilter, customFrom, customTo, userFilter, doLoad]);

  function handleDeletePress(id: string) {
    Alert.alert("ยืนยันการลบ", "ต้องการลบรายการนี้ใช่ไหม?", [
      { text: "ยกเลิก", style: "cancel" },
      {
        text: "ลบ", style: "destructive",
        onPress: async () => {
          setDeleting(id);
          try {
            await api.deleteVisit(id);
            setSelected(null);
            setRecords(prev => prev.filter(r => r.id !== id));
          } catch (e) {
            Alert.alert("เกิดข้อผิดพลาด", (e as Error).message);
          } finally { setDeleting(null); }
        },
      },
    ]);
  }

  const fs = (base: number) => base / fontScale;

  const DATE_OPTS: { value: DateFilter; label: string }[] = [
    { value: "today", label: "วันนี้" },
    { value: "month", label: "เดือนนี้" },
    { value: "all", label: "ทั้งหมด" },
    { value: "custom", label: "กำหนดเอง" },
  ];

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={{ padding: 14, gap: 10 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={skSt.card}>
              <View style={skSt.row}>
                <SkeletonBox width={44} height={44} borderRadius={12} />
                <View style={{ flex: 1, gap: 8 }}>
                  <SkeletonBox height={14} width="65%" borderRadius={6} />
                  <SkeletonBox height={10} width="45%" borderRadius={6} />
                  <SkeletonBox height={10} width="55%" borderRadius={6} />
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <>
      {/* ── Filter section ── */}
      <View style={styles.filterSection}>
        {/* Date chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {DATE_OPTS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.filterChip, dateFilter === opt.value && styles.filterChipActive]}
              onPress={() => {
                setDateFilter(opt.value);
                if (opt.value !== "custom") { setCustomFrom(""); setCustomTo(""); }
              }}
            >
              <Text style={[styles.filterChipText, dateFilter === opt.value && styles.filterChipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Custom date inputs */}
        {dateFilter === "custom" && (
          <View style={styles.customDateRow}>
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => {
                if (Platform.OS === "android") {
                  DateTimePickerAndroid.open({
                    value: customFrom ? new Date(customFrom) : new Date(),
                    mode: "date",
                    locale: "th-TH",
                    onChange: (_, d) => {
                      if (d) setCustomFrom(d.toISOString().slice(0, 10));
                    },
                  });
                } else {
                  setShowDatePicker("from");
                }
              }}
            >
              <Text style={customFrom ? styles.dateInputText : styles.dateInputPlaceholder}>
                {customFrom ? customFrom.split("-").reverse().join("/") : "วันที่เริ่ม"}
              </Text>
            </TouchableOpacity>
            <Text style={styles.dateSep}>—</Text>
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => {
                if (Platform.OS === "android") {
                  DateTimePickerAndroid.open({
                    value: customTo ? new Date(customTo) : new Date(),
                    mode: "date",
                    locale: "th-TH",
                    onChange: (_, d) => {
                      if (d) setCustomTo(d.toISOString().slice(0, 10));
                    },
                  });
                } else {
                  setShowDatePicker("to");
                }
              }}
            >
              <Text style={customTo ? styles.dateInputText : styles.dateInputPlaceholder}>
                {customTo ? customTo.split("-").reverse().join("/") : "วันที่สิ้นสุด"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {/* iOS Date Picker Modal */}
        {showDatePicker !== null && Platform.OS === "ios" && (
          <Modal transparent animationType="slide">
            <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.3)" }}>
              <View style={{ backgroundColor: "#fff", paddingBottom: 20 }}>
                <View style={{ flexDirection: "row", justifyContent: "flex-end", padding: 12 }}>
                  <TouchableOpacity onPress={() => setShowDatePicker(null)}>
                    <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 16 }}>เสร็จสิ้น</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={
                    showDatePicker === "from"
                      ? (customFrom ? new Date(customFrom) : new Date())
                      : (customTo ? new Date(customTo) : new Date())
                  }
                  mode="date"
                  display="spinner"
                  locale="th-TH"
                  onChange={(_, d) => {
                    if (!d) return;
                    const val = d.toISOString().slice(0, 10);
                    if (showDatePicker === "from") setCustomFrom(val);
                    else setCustomTo(val);
                  }}
                />
              </View>
            </View>
          </Modal>
        )}

        {/* Search by shop name */}
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} style={{ marginLeft: 12 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="ค้นหาชื่อร้าน..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={colors.textDisabled}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")} style={{ padding: 8 }}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Admin: user + shop pickers */}
        {isAdmin && (
          <View style={styles.adminFilterRow}>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowUserPicker(true)}>
              <Text style={styles.pickerLabel}>เซล์</Text>
              <Text style={styles.pickerValue} numberOfLines={1}>
                {userFilter ? (users.find(u => u.id === userFilter)?.fullName ?? "เซล์") : "ทุกเซล์"}
              </Text>
              <Ionicons name="chevron-down" size={13} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pickerBtn, !records.length && styles.pickerBtnDisabled]}
              onPress={() => records.length && setShowShopPicker(true)}
            >
              <Text style={styles.pickerLabel}>ร้าน</Text>
              <Text style={styles.pickerValue} numberOfLines={1}>{shopFilter || "ทุกร้าน"}</Text>
              <Ionicons name="chevron-down" size={13} color={colors.textMuted} />
            </TouchableOpacity>
            {(userFilter || shopFilter) && (
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => { setUserFilter(""); setShopFilter(""); }}
              >
                <Text style={styles.clearBtnText}>ล้าง</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* ── List ── */}
      <FlatList
        data={displayedRecords}
        keyExtractor={(item) => item.id}
        style={styles.container}
        contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>{hasActiveFilter ? "📋" : "🔍"}</Text>
            <Text style={styles.emptyTitle}>
              {hasActiveFilter ? "ไม่พบรายการ" : "ค้นหาชื่อร้าน"}
            </Text>
            <Text style={styles.emptyDesc}>
              {hasActiveFilter ? "ลองเปลี่ยนคำค้นหา" : "พิมพ์ชื่อร้านเพื่อดูประวัติออกทริป"}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const locationLabel = item.district ? `${item.province} · ${item.district}` : item.province;
          const resKey = item.result || "";
          const resLabel = RESULT_LABEL[resKey] || "";
          const rs = getResultStyle(resKey);
          const tags: string[] = [
            CUSTOMER_TYPE_LABEL[item.customerType] ?? item.customerType,
            item.visitType ? MISSION_LABEL[item.visitType] : "",
            item.tripType ? TRIP_LABEL[item.tripType] : "",
            item.province ? item.province.replace("กรุงเทพมหานคร", "กรุงเทพฯ") : "",
          ].filter(Boolean);

          return (
            <TouchableOpacity style={styles.card} onPress={() => setSelected(item)} activeOpacity={0.8}>
              {item.imageUrls?.[0] ? (
                <Image source={{ uri: item.imageUrls[0] }} style={styles.visitThumb} resizeMode="cover" />
              ) : (
                <View style={[styles.visitThumb, { backgroundColor: getAvatarColor(item.shopName), justifyContent: "center", alignItems: "center" }]}>
                  <Text style={styles.visitThumbText}>{item.shopName.charAt(0)}</Text>
                </View>
              )}
              <View style={styles.info}>
                <Text style={[styles.shopName, { fontSize: fs(13) }]} numberOfLines={1}>{item.shopName}</Text>
                {isAdmin && item.user && (
                  <Text style={[styles.userLabel, { fontSize: fs(11) }]} numberOfLines={1}>{item.user.fullName}</Text>
                )}
                <View style={styles.tagRow}>
                  {tags.map((t) => <Text key={t} style={styles.tag}>{t}</Text>)}
                </View>
                <Text style={[styles.date, { fontSize: fs(11) }]}>
                  {new Date(item.createdAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                </Text>
              </View>
              <View style={styles.rightCol}>
                <View style={styles.iconRow}>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => { setEditRecord(item); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
                  >
                    <Ionicons name="pencil-outline" size={15} color={colors.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.iconBtn, { borderColor: "#fecaca" }]}
                    onPress={() => handleDeletePress(item.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={15} color="#dc2626" />
                  </TouchableOpacity>
                </View>
                {resLabel ? (
                  <View style={styles.badgeCol}>
                    <View style={[styles.badge, { backgroundColor: rs.bg }]}>
                      <Text style={[styles.badgeText, { color: rs.text }]}>{resLabel}</Text>
                    </View>
                    {resKey === "buy" && item.orderAmount != null && (
                      <Text style={styles.orderAmt}>฿{item.orderAmount.toLocaleString("th-TH")}</Text>
                    )}
                    {resKey === "buy" && <SlipStatusBadge status={item.slipStatus} />}
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* ── Pickers ── */}
      <PickerModal
        visible={showUserPicker}
        title="เลือกเซล์"
        options={[{ value: "", label: "ทุกเซล์" }, ...users.map(u => ({ value: u.id, label: u.fullName }))]}
        selected={userFilter}
        onSelect={setUserFilter}
        onClose={() => setShowUserPicker(false)}
      />
      <PickerModal
        visible={showShopPicker}
        title="เลือกร้าน"
        options={[{ value: "", label: "ทุกร้าน" }, ...uniqueShops.map(s => ({ value: s, label: s }))]}
        selected={shopFilter}
        onSelect={setShopFilter}
        onClose={() => setShowShopPicker(false)}
      />

      {/* ── Modals ── */}
      {selected && (
        <DetailModal
          record={selected}
          onClose={() => setSelected(null)}
          onEdit={() => { setEditRecord(selected); setSelected(null); }}
          onDelete={() => handleDeletePress(selected.id)}
          deleting={deleting === selected.id}
        />
      )}
      {editRecord && (
        <EditModal
          record={editRecord}
          onClose={() => setEditRecord(null)}
          onDone={(updated) => {
            setEditRecord(null);
            setRecords(prev => prev.map(r => r.id === updated.id ? updated : r));
          }}
        />
      )}
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────
const skSt = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 12, borderWidth: 1, borderColor: colors.borderLight, ...shadows.card },
  row: { flexDirection: "row", gap: 10, alignItems: "center" },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  filterSection: { backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.borderLight, paddingBottom: 8 },
  filterRow: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 2 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: colors.borderLight, backgroundColor: colors.surface, marginRight: 8 },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: 17, fontWeight: "600", color: colors.textMuted },
  filterChipTextActive: { color: "#fff" },

  customDateRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingTop: 8, gap: 8 },
  dateInput: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 9, justifyContent: "center" },
  dateInputText: { fontSize: 14, color: colors.textPrimary },
  dateInputPlaceholder: { fontSize: 14, color: colors.textDisabled },
  dateSep: { fontSize: 16, color: colors.textDisabled },

  searchRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 14, marginTop: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, borderRadius: radius.xl },
  searchInput: { flex: 1, paddingHorizontal: 8, paddingVertical: 9, fontSize: 16, color: colors.textPrimary },

  adminFilterRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingTop: 8, gap: 8 },
  pickerBtn: { flex: 1, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, borderRadius: radius.xl, paddingHorizontal: 10, paddingVertical: 7 },
  pickerBtnDisabled: { opacity: 0.4 },
  pickerLabel: { fontSize: 14, color: colors.textMuted, fontWeight: "600" },
  pickerValue: { flex: 1, fontSize: 14, color: colors.textPrimary, fontWeight: "600" },
  clearBtn: { paddingHorizontal: 10, paddingVertical: 7 },
  clearBtnText: { fontSize: 14, color: colors.textMuted },

  emptyWrap: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyIcon: { fontSize: 47, marginBottom: 4 },
  emptyTitle: { fontSize: 20, fontWeight: "600", color: colors.textSecondary },
  emptyDesc: { fontSize: 18, color: colors.textDisabled },

  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 12, flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 10, borderWidth: 0.5, borderColor: colors.borderLight, ...shadows.card },
  visitThumb: { width: 50, height: 50, borderRadius: radius.md, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  visitThumbText: { fontSize: 23, fontWeight: "800", color: "#fff" },
  info: { flex: 1, minWidth: 0 },
  shopName: { fontSize: 18, fontWeight: "700", color: colors.textPrimary, marginBottom: 1 },
  userLabel: { fontSize: 15, color: colors.textMuted, marginBottom: 2 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 2, marginBottom: 2 },
  tag: { fontSize: 15, fontWeight: "600", color: colors.textMuted, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderLight, paddingHorizontal: 7, paddingVertical: 1, borderRadius: radius.full },
  date: { fontSize: 15, color: colors.textDisabled },
  rightCol: { alignItems: "flex-end", gap: 6 },
  iconRow: { flexDirection: "row", gap: 4 },
  iconBtn: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: colors.borderLight, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  badgeCol: { alignItems: "flex-end", gap: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  badgeText: { fontSize: 16, fontWeight: "600" },
  orderAmt: { fontSize: 16, fontWeight: "700", color: "#15803d" },

  headerBadge: { backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primaryBorder, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3, marginRight: 14 },
  headerBadgeText: { fontSize: 17, fontWeight: "600", color: colors.primaryDark },
});

const det = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "92%" },
  galleryClip: { overflow: "hidden", borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderLight, gap: 12 },
  shopName: { fontSize: 21, fontWeight: "700", color: colors.textPrimary },
  byUser: { fontSize: 16, color: colors.textMuted, marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderLight, alignItems: "center", justifyContent: "center" },
  galleryImg: { height: 240 },
  zoomHint: { position: "absolute", bottom: 8, right: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  galleryMeta: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, alignItems: "center", gap: 6 },
  slotLabel: { fontSize: 17, color: colors.textMuted, fontWeight: "600" },
  dots: { flexDirection: "row", gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.borderLight },
  dotActive: { backgroundColor: colors.primary, width: 14 },
  noImg: { height: 140, alignItems: "center", justifyContent: "center", backgroundColor: colors.primaryLight, gap: 8 },
  noImgText: { fontSize: 18, color: colors.textDisabled },
  body: { padding: 18, paddingBottom: 32 },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  resultBadge: { borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 6 },
  resultBadgeText: { fontSize: 18, fontWeight: "700" },
  orderBadge: { borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: "#f0fdf4", borderWidth: 1, borderColor: "#bbf7d0" },
  orderText: { fontSize: 18, fontWeight: "700", color: "#15803d" },
  noteInline: { flex: 1, fontSize: 16, color: colors.textSecondary, textAlign: "right", marginLeft: 8 },
  infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  infoIcon: { marginRight: 10 },
  infoLabel: { fontSize: 18, color: colors.textMuted, width: 70 },
  infoValue: { flex: 1, fontSize: 18, color: colors.textPrimary, fontWeight: "500" },
  noteBox: { marginTop: 16, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: colors.borderLight },
  noteLabel: { fontSize: 16, color: colors.textMuted, fontWeight: "600", marginBottom: 6 },
  noteText: { fontSize: 18, color: colors.textPrimary, lineHeight: 20 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 20 },
  editBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.primaryBorder, backgroundColor: colors.primaryLight },
  editBtnText: { fontSize: 16, fontWeight: "600", color: colors.primary },
  deleteBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: radius.xl, borderWidth: 1, borderColor: "#fecaca", backgroundColor: "#fef2f2" },
  deleteBtnText: { fontSize: 16, fontWeight: "600", color: "#dc2626" },
  transRefBox: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight },
  transRefText: { fontSize: 17, color: colors.textMuted, fontWeight: "500", flex: 1 },
});

const ed = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "85%" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  title: { flex: 1, fontSize: 19, fontWeight: "700", color: colors.textPrimary },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderLight, alignItems: "center", justifyContent: "center" },
  body: { padding: 18, paddingBottom: 32 },
  label: { fontSize: 16, fontWeight: "600", color: colors.textSecondary, marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, borderRadius: radius.xl, paddingHorizontal: 14, paddingVertical: 11, fontSize: 16, color: colors.textPrimary },
  inputMulti: { minHeight: 80, textAlignVertical: "top" },
  chipRow: { flexDirection: "row", gap: 8 },
  chip: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: colors.borderLight, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 16, fontWeight: "600", color: colors.textMuted },
  chipTextActive: { color: "#fff" },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 24 },
  cancelBtn: { flex: 1, paddingVertical: 13, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderLight, alignItems: "center" },
  cancelText: { fontSize: 16, fontWeight: "600", color: colors.textSecondary },
  saveBtn: { flex: 1, paddingVertical: 13, borderRadius: radius.xl, backgroundColor: colors.primary, alignItems: "center" },
  saveText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});

const pm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "70%" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  title: { flex: 1, fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderLight, alignItems: "center", justifyContent: "center" },
  option: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  optionActive: { backgroundColor: colors.primaryLight },
  optionText: { flex: 1, fontSize: 17, color: colors.textPrimary },
  optionTextActive: { fontWeight: "700", color: colors.primary },
});
