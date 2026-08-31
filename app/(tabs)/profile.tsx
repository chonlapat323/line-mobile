import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  useWindowDimensions, Modal, FlatList, Image, RefreshControl,
  NativeSyntheticEvent, NativeScrollEvent, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getStoredUser, api } from "@/lib/api";
import { useAuthStore } from "@/lib/useAuthStore";
import { colors, radius, shadows } from "@/lib/theme";
import { RESULT_LABEL, CUSTOMER_TYPE_LABEL } from "@/lib/labels";
import { SkeletonBox } from "@/lib/Skeleton";
import { ImageViewer } from "@/lib/ImageViewer";
import { AppAlert, AlertButton } from "@/lib/AppModal";
import { OutstandingDebtCard } from "@/lib/OutstandingDebtCard";

// ── Types ─────────────────────────────────────────────────────
interface UserInfo { fullName: string; email: string; role: string; bankName?: string; bankAccount?: string; lineConnected?: boolean }

const THAI_BANKS = [
  "กรุงเทพ (BBL)",
  "กสิกรไทย (KBANK)",
  "กรุงไทย (KTB)",
  "ไทยพาณิชย์ (SCB)",
  "กรุงศรีอยุธยา (BAY)",
  "ทหารไทยธนชาต (TTB)",
  "ออมสิน (GSB)",
  "ธ.ก.ส. (BAAC)",
  "ซีไอเอ็มบี (CIMB)",
  "ยูโอบี (UOB)",
  "ทิสโก้ (TISCO)",
  "เกียรตินาคินภัทร (KKP)",
  "แลนด์แอนด์เฮ้าส์ (LH Bank)",
  "ไทยเครดิต (Thai Credit)",
];
interface VisitRecord {
  id: string; shopName: string; province: string; district?: string;
  tripType?: string; customerType: string; visitType?: string; result?: string;
  details?: string; orderAmount?: number | null; slipStatus?: string | null;
  slipUrl?: string | null; transRef?: string | null;
  latitude?: number | null; longitude?: number | null;
  imageUrls: string[]; createdAt: string;
  user?: { fullName: string; email: string };
}
// ── Helpers ───────────────────────────────────────────────────
const SLOT_LABELS = ["ลีคชีต", "หน้าร้าน 1", "หน้าร้าน 2", "ภายในร้าน 1", "ภายในร้าน 2", "หน้าจอ LINE"];

function getResultStyle(key: string) {
  if (key === "buy") return { bg: colors.successBg, text: colors.primaryDark };
  if (key === "no_buy") return { bg: colors.errorBg, text: colors.error };
  return { bg: colors.infoBg, text: colors.infoText };
}

// ── Visit Detail Modal ────────────────────────────────────────
function VisitDetailModal({ record, onClose }: { record: VisitRecord; onClose: () => void }) {
  const { width } = useWindowDimensions();
  const [imgIndex, setImgIndex] = useState(0);
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setImgIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };
  const resKey = record.result || "";
  const rs = getResultStyle(resKey);
  const locationLabel = record.district ? `${record.province} · ${record.district}` : record.province;
  const allImages = [
    ...record.imageUrls,
    ...(record.slipUrl ? [record.slipUrl] : []),
  ];
  const allLabels = [...SLOT_LABELS, "สลิปการชำระเงิน"];

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={det.overlay}>
        <View style={det.sheet}>
          <View style={det.header}>
            <View style={{ flex: 1 }}>
              <Text style={det.shopName} numberOfLines={1}>{record.shopName}</Text>
              <Text style={det.byUser}>{locationLabel}</Text>
            </View>
            <TouchableOpacity style={det.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {allImages.length > 0 && (
            <View>
              <FlatList
                data={allImages}
                keyExtractor={(_, i) => String(i)}
                horizontal pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={onScroll} scrollEventThrottle={16}
                renderItem={({ item, index }) => (
                  <TouchableOpacity activeOpacity={0.92} onPress={() => setViewerIdx(index)}>
                    <Image source={{ uri: item }} style={[det.galleryImg, { width }]} resizeMode="cover" />
                    <View style={det.zoomHint}>
                      <Ionicons name="expand-outline" size={14} color="#fff" />
                    </View>
                  </TouchableOpacity>
                )}
              />
              <View style={det.galleryMeta}>
                <Text style={det.slotLabel}>{allLabels[imgIndex] ?? `รูป ${imgIndex + 1}`}</Text>
                <View style={det.dots}>
                  {allImages.map((_, i) => (
                    <View key={i} style={[det.dot, i === imgIndex && det.dotActive]} />
                  ))}
                </View>
              </View>
            </View>
          )}
          {viewerIdx !== null && (
            <ImageViewer
              images={allImages}
              labels={allLabels}
              initialIndex={viewerIdx}
              onClose={() => setViewerIdx(null)}
            />
          )}

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={det.body}>
              {/* Result + order amount */}
              {resKey ? (
                <View style={det.resultRow}>
                  <View style={[det.resultBadge, { backgroundColor: rs.bg }]}>
                    <Text style={[det.resultBadgeText, { color: rs.text }]}>
                      ผลตอบรับ: {RESULT_LABEL[resKey]}
                    </Text>
                  </View>
                  {resKey === "buy" && record.orderAmount != null && (
                    <View style={det.orderBadge}>
                      <Text style={det.orderText}>฿{record.orderAmount.toLocaleString("th-TH")}</Text>
                    </View>
                  )}
                </View>
              ) : null}

              {/* Transaction ref */}
              {record.transRef ? (
                <View style={det.transRefBox}>
                  <Ionicons name="barcode-outline" size={14} color={colors.textMuted} />
                  <Text style={det.transRefText}>เลขอ้างอิงสลิป: {record.transRef}</Text>
                </View>
              ) : null}

              {[
                { icon: "location-outline" as const, label: "สถานที่", value: locationLabel },
                { icon: "swap-horizontal-outline" as const, label: "ทริป", value: record.tripType === "plan" ? "ตามแผน" : record.tripType === "off_plan" ? "นอกแผน" : "-" },
                { icon: "people-outline" as const, label: "ลูกค้า", value: CUSTOMER_TYPE_LABEL[record.customerType] ?? record.customerType },
                { icon: "checkmark-circle-outline" as const, label: "ภารกิจ", value: record.visitType === "tak" ? "ทัก" : record.visitType === "dem" ? "เดม" : record.visitType === "tel" ? "โทร" : "-" },
                { icon: "calendar-outline" as const, label: "วันที่", value: new Date(record.createdAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) },
                ...(record.latitude && record.longitude
                  ? [{ icon: "navigate-outline" as const, label: "พิกัด GPS", value: `${record.latitude.toFixed(6)}, ${record.longitude.toFixed(6)}` }]
                  : []),
              ].map((row) => (
                <View key={row.label} style={det.infoRow}>
                  <Ionicons name={row.icon} size={16} color={colors.textMuted} style={det.infoIcon} />
                  <Text style={det.infoLabel}>{row.label}</Text>
                  <Text style={det.infoValue}>{row.value}</Text>
                </View>
              ))}
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

// ── Province List Sheet ───────────────────────────────────────
function ProvinceListSheet({
  province, records, onBack, onSelectRecord,
}: {
  province: string; records: VisitRecord[];
  onBack: () => void; onSelectRecord: (r: VisitRecord) => void;
}) {
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onBack}>
      <View style={prov.overlay}>
        <View style={prov.sheet}>
          <View style={prov.header}>
            <TouchableOpacity style={prov.backBtn} onPress={onBack}>
              <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={prov.title}>{province}</Text>
              <Text style={prov.count}>{records.length} รายการ</Text>
            </View>
            <TouchableOpacity style={prov.closeBtn} onPress={onBack}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={records}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 12 }}
            renderItem={({ item }) => {
              const resKey = item.result || "";
              const rs = getResultStyle(resKey);
              return (
                <TouchableOpacity style={prov.card} onPress={() => onSelectRecord(item)} activeOpacity={0.8}>
                  <Image source={item.imageUrls?.[0] ? { uri: item.imageUrls[0] } : undefined} style={prov.thumb} />
                  <View style={prov.cardInfo}>
                    <Text style={prov.shopName} numberOfLines={1}>{item.shopName}</Text>
                    <Text style={prov.cardDate}>
                      {new Date(item.createdAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                    </Text>
                  </View>
                  {resKey ? (
                    <View style={[prov.badge, { backgroundColor: rs.bg }]}>
                      <Text style={[prov.badgeText, { color: rs.text }]}>{RESULT_LABEL[resKey]}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

// ── Profile Screen ────────────────────────────────────────────
const INFO_ROWS: {
  icon: keyof typeof Ionicons.glyphMap; label: string;
  key: keyof UserInfo; iconBg: string; iconColor: string;
}[] = [
  { icon: "person-outline",    label: "ชื่อ",     key: "fullName", iconBg: colors.primaryLight, iconColor: colors.primaryDark },
  { icon: "mail-outline",      label: "อีเมล",    key: "email",    iconBg: "#eff6ff",            iconColor: "#3b82f6" },
  { icon: "briefcase-outline", label: "ตำแหน่ง", key: "role",     iconBg: "#fefce8",            iconColor: "#ca8a04" },
];

export default function ProfileScreen() {
  const router = useRouter();
  const signOut = useAuthStore((s) => s.signOut);
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const fs = (base: number) => base / fontScale;

  // ── State ────────────────────────────────────────────────────
  const [user, setUser] = useState<UserInfo | null>(null);
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);

  // Commission
  const [commMonth, setCommMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [commData, setCommData] = useState<{
    visitCount: number;
    slipAmount: number;
    proxySlipAmount: number;
    adjustThisMonth: number;
    adjustCarryover: number;
    totalAmount: number;
    pendingAmount: number;
    confirmedCount: number; pendingCount: number;
    reachedThreshold: boolean;
    commission: number; remaining: number;
    proxyCommission: number; proxyRate: number;
    settings: { rate: number; threshold: number };
  } | null>(null);
  const [commLoading, setCommLoading] = useState(false);

  // Bank account editing
  const [editingBank, setEditingBank] = useState(false);
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankSaving, setBankSaving] = useState(false);
  const [bankPickerVisible, setBankPickerVisible] = useState(false);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [provinceView, setProvinceView] = useState<"info" | "list" | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<VisitRecord | null>(null);

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwErrors, setPwErrors] = useState<{ current: string; new: string; confirm: string }>({ current: "", new: "", confirm: "" });
  const newPwRef = useRef<TextInput>(null);
  const confirmPwRef = useRef<TextInput>(null);

  const scrollRef = useRef<ScrollView>(null);
  const [appAlert, setAppAlert] = useState<{ visible: boolean; type: "error" | "confirm" | "info"; title: string; message: string; buttons: AlertButton[] }>({ visible: false, type: "error", title: "", message: "", buttons: [] });

  function showAlert(type: "error" | "confirm" | "info", title: string, message = "", buttons?: AlertButton[]) {
    setAppAlert({ visible: true, type, title, message, buttons: buttons ?? [{ text: "ตกลง", onPress: () => setAppAlert((p) => ({ ...p, visible: false })) }] });
  }

  // ── Derived data ─────────────────────────────────────────────
  const provinceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    visits.forEach((v) => { counts[v.province] = (counts[v.province] || 0) + 1; });
    return counts;
  }, [visits]);

  const maxCount = useMemo(() =>
    Math.max(...Object.values(provinceCounts), 1), [provinceCounts]);

  const stats = useMemo(() => ({
    total: visits.length,
    bought: visits.filter((v) => v.result === "buy").length,
    provinces: Object.keys(provinceCounts).length,
  }), [visits, provinceCounts]);

  const provinceRecords = useMemo(() =>
    selectedProvince ? visits.filter((v) => v.province === selectedProvince) : [],
    [selectedProvince, visits]);

  const topProvinces = useMemo(() =>
    Object.entries(provinceCounts).sort((a, b) => b[1] - a[1]).slice(0, 3),
    [provinceCounts]);

  const tierInfo = useMemo(() => {
    if (!commData) return null;
    const tiers: { min: number; max: number | null; rate: number }[] = commData.settings?.tiers ?? [];
    if (tiers.length === 0) return null;
    const total = commData.totalAmount;
    let currentIdx = 0;
    for (let i = 0; i < tiers.length; i++) {
      if (total >= tiers[i].min) currentIdx = i;
    }
    const current = tiers[currentIdx];
    const next = tiers[currentIdx + 1] ?? null;
    const progressMax = next ? next.min : (current.max ?? total + 1);
    const progress = progressMax > current.min
      ? Math.min((total - current.min) / (progressMax - current.min), 1)
      : 1;
    return { current, next, isMax: !next, progress, amountToNext: next ? Math.round(Math.max(next.min - total, 0)) : 0 };
  }, [commData]);

  // ── Province navigation ──────────────────────────────────────
  function openProvince(name: string) {
    if (!provinceCounts[name]) return;
    setSelectedProvince(name);
    setProvinceView("list");
  }

  // ── Data loading ─────────────────────────────────────────────
  async function loadData(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    try {
      const [u, me, data] = await Promise.all([getStoredUser(), api.getMe(), api.getVisits()]);
      const base = u ?? useAuthStore.getState().user ?? {};
      const merged = {
        ...base,
        fullName: me?.fullName ?? (base as any).fullName ?? "",
        email: me?.email ?? (base as any).email ?? "",
        role: me?.role ?? (base as any).role ?? "",
        bankName: me?.bankName ?? "",
        bankAccount: me?.bankAccount ?? "",
        lineConnected: me?.lineConnected ?? false,
      };
      setUser(merged);
      setBankName(me?.bankName ?? "");
      setBankAccount(me?.bankAccount ?? "");
      setVisits(data?.data ?? data ?? []);
    } catch (err: any) {
      // ถ้า error ไม่ใช่ network/timeout ให้ logout ออก (เช่น token หมดอายุ)
      const isNetworkErr = err?.message?.includes("เชื่อมต่อ") || err?.message?.includes("หมดเวลา");
      if (!isNetworkErr) {
        signOut();
        router.replace("/login");
        return;
      }
    } finally { setRefreshing(false); }
    if (isRefresh) {
      loadCommission(commMonth);
      setRefreshCount((c) => c + 1);
    }
  }

  async function handleSaveBank() {
    setBankSaving(true);
    try {
      await api.updateMe({ bankName: bankName.trim(), bankAccount: bankAccount.trim() });
      setUser((u) => u ? { ...u, bankName: bankName.trim(), bankAccount: bankAccount.trim() } : u);
      setEditingBank(false);
    } catch (err: any) {
      showAlert("error", "เกิดข้อผิดพลาด", err?.message ?? "ไม่สามารถบันทึกได้ กรุณาลองใหม่");
    } finally { setBankSaving(false); }
  }

  async function loadCommission(month: string) {
    setCommLoading(true);
    api.getMyCommission(month)
      .then(setCommData)
      .catch(() => {})
      .finally(() => setCommLoading(false));
  }

  useFocusEffect(useCallback(() => { loadData(); }, []));
  useEffect(() => { loadCommission(commMonth); }, [commMonth]);

  function prevMonth() {
    const [y, m] = commMonth.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    setCommMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  function nextMonth() {
    const [y, m] = commMonth.split("-").map(Number);
    const d = new Date(y, m, 1);
    const now = new Date();
    const nowKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    if (`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` > nowKey) return;
    setCommMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  function closePwModal() {
    setShowChangePassword(false);
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    setShowCurrentPw(false); setShowNewPw(false); setShowConfirmPw(false);
    setPwErrors({ current: "", new: "", confirm: "" });
  }

  async function handleChangePassword() {
    const errs = { current: "", new: "", confirm: "" };
    if (!currentPassword) errs.current = "กรุณากรอกรหัสผ่านเดิม";
    if (newPassword.length < 6) errs.new = "ต้องมีอย่างน้อย 6 ตัวอักษร";
    if (newPassword && confirmPassword && newPassword !== confirmPassword) errs.confirm = "รหัสผ่านไม่ตรงกัน";
    if (errs.current || errs.new || errs.confirm) { setPwErrors(errs); return; }
    setPasswordSaving(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      closePwModal();
      showAlert("info", "เปลี่ยนรหัสผ่านสำเร็จ", "รหัสผ่านของคุณถูกเปลี่ยนเรียบร้อยแล้ว");
    } catch (err: any) {
      setPwErrors((p) => ({ ...p, current: err?.message || "ไม่สามารถเปลี่ยนรหัสผ่านได้" }));
    } finally { setPasswordSaving(false); }
  }

  function handleLogout() {
    showAlert("confirm", "ออกจากระบบ", "ต้องการออกจากระบบใช่ไหม?", [
      { text: "ยกเลิก", style: "cancel", onPress: () => setAppAlert((p) => ({ ...p, visible: false })) },
      { text: "ออกจากระบบ", style: "destructive", onPress: async () => { setAppAlert((p) => ({ ...p, visible: false })); signOut(); router.replace("/login"); } },
    ]);
  }

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {/* Hero skeleton */}
        <View style={{ backgroundColor: "#16a34a", paddingTop: insets.top + 16, paddingBottom: 28, alignItems: "center", gap: 10 }}>
          <SkeletonBox width={68} height={68} borderRadius={34} style={{ backgroundColor: "rgba(255,255,255,0.25)" }} />
          <SkeletonBox width={120} height={16} borderRadius={8} style={{ backgroundColor: "rgba(255,255,255,0.25)" }} />
          <SkeletonBox width={80} height={12} borderRadius={6} style={{ backgroundColor: "rgba(255,255,255,0.2)" }} />
        </View>
        {/* Stats row skeleton */}
        <View style={{ flexDirection: "row", backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={{ flex: 1, alignItems: "center", paddingVertical: 14, gap: 6, borderRightWidth: i < 3 ? 1 : 0, borderRightColor: colors.borderLight }}>
              <SkeletonBox width={40} height={22} borderRadius={6} />
              <SkeletonBox width={48} height={10} borderRadius={4} />
            </View>
          ))}
        </View>
        {/* Card skeleton */}
        <View style={{ margin: 14, gap: 10 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: 16, gap: 12, borderWidth: 1, borderColor: colors.borderLight, ...shadows.card }}>
            <SkeletonBox height={16} width="50%" borderRadius={6} />
            <SkeletonBox height={48} borderRadius={10} />
            <SkeletonBox height={34} borderRadius={10} />
          </View>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: 16, gap: 12, borderWidth: 1, borderColor: colors.borderLight, ...shadows.card }}>
            <SkeletonBox height={16} width="40%" borderRadius={6} />
            <SkeletonBox height={80} borderRadius={10} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={colors.primary} />}
      >
        {/* Green hero */}
        <View style={[styles.hero, { paddingTop: (insets.top || 16) + 16 }]}>
          <View style={styles.heroDecor1} />
          <View style={styles.heroDecor2} />
          <TouchableOpacity
            style={[styles.heroLineBtn, { top: (insets.top || 16) + 10 }]}
            onPress={() => router.push("/(tabs)/connect")}
            activeOpacity={0.7}
          >
            <Ionicons
              name={user?.lineConnected ? "checkmark-circle" : "link-outline"}
              size={14}
              color={user?.lineConnected ? "#86efac" : "rgba(255,255,255,0.9)"}
            />
            <Text style={[styles.heroLineBtnText, user?.lineConnected && { color: "#86efac" }]}>
              {user?.lineConnected ? "LINE เชื่อมแล้ว" : "เชื่อม LINE"}
            </Text>
          </TouchableOpacity>
          <View style={styles.heroAvatar}>
            <Text style={styles.heroAvatarText}>{user.fullName?.charAt(0)?.toUpperCase() ?? "?"}</Text>
          </View>
          <Text style={styles.heroName}>{user.fullName}</Text>
          <Text style={styles.heroEmail}>{user.email}</Text>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{user.role === "admin" ? "แอดมิน" : "เซล"}</Text>
          </View>
        </View>

        {/* Commission tier progress */}
        <View style={styles.tierBar}>
          {commLoading || !commData ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 6 }} />
          ) : tierInfo ? (
            <>
              <Text style={styles.tierLabel}>ค่าคอมเดือนนี้</Text>
              <Text style={styles.tierAmount}>฿{(commData.commission + (commData.proxyCommission ?? 0)).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</Text>
              <View style={styles.tierTrackRow}>
                <Text style={styles.tierRateCurrent}>{tierInfo.current.rate}%</Text>
                <View style={styles.tierTrack}>
                  <View style={[styles.tierFill, { width: `${Math.round(tierInfo.progress * 100)}%` as any }]} />
                </View>
                {tierInfo.next && <Text style={styles.tierRateNext}>{tierInfo.next.rate}%</Text>}
              </View>
              <Text style={styles.tierCaption}>
                {tierInfo.isMax
                  ? "ถึงอัตราสูงสุดแล้ว"
                  : `อีก ฿${tierInfo.amountToNext.toLocaleString("th-TH")} ถึงได้ ${tierInfo.next!.rate}%`}
              </Text>
            </>
          ) : (
            <View style={styles.tierHeader}>
              <Text style={styles.tierLabel}>ค่าคอมเดือนนี้</Text>
              <Text style={styles.tierAmount}>฿{(commData.commission + (commData.proxyCommission ?? 0)).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</Text>
            </View>
          )}
        </View>

        {/* Commission */}
        <View style={styles.commSection}>
          {/* Month nav */}
          <View style={styles.commMonthRow}>
            <TouchableOpacity onPress={prevMonth} style={styles.monthNavBtn}>
              <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.commMonthText}>
              {(() => {
                const [y, m] = commMonth.split("-").map(Number);
                return new Date(y, m - 1, 1).toLocaleDateString("th-TH", { month: "long", year: "numeric" });
              })()}
            </Text>
            <TouchableOpacity onPress={nextMonth} style={styles.monthNavBtn}>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {commLoading ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 16 }} />
          ) : commData ? (
            <View style={{ gap: 12 }}>
              {/* Stats row */}
              <View style={styles.commStatsRow}>
                <View style={styles.commStat}>
                  <Text style={styles.commStatNum}>{commData.visitCount}</Text>
                  <Text style={styles.commStatLabel}>ออเดอร์</Text>
                </View>
                <View style={[styles.commStat, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.borderLight }]}>
                  <Text style={styles.commStatNum}>฿{commData.totalAmount.toLocaleString("th-TH")}</Text>
                  <Text style={styles.commStatLabel}>ยอดคำนวณ</Text>
                </View>
                <View style={styles.commStat}>
                  <Text style={[styles.commStatNum, { color: commData.commission > 0 ? colors.primary : colors.textDisabled }]}>
                    ฿{commData.commission.toLocaleString("th-TH")}
                  </Text>
                  <Text style={styles.commStatLabel}>ค่าคอม</Text>
                </View>
              </View>

              {/* ยอดเติม breakdown */}
              {(commData.adjustThisMonth > 0 || commData.adjustCarryover > 0) && (
                <View style={styles.commBreakdownBox}>
                  <View style={styles.commBreakdownRow}>
                    <Text style={styles.commBreakdownLabel}>ยอดสลิป</Text>
                    <Text style={styles.commBreakdownVal}>฿{commData.slipAmount.toLocaleString("th-TH")}</Text>
                  </View>
                  {commData.adjustCarryover > 0 && (
                    <View style={styles.commBreakdownRow}>
                      <Text style={styles.commBreakdownLabel}>+ ยอดเติมยกมา</Text>
                      <Text style={[styles.commBreakdownVal, { color: "#3b82f6" }]}>฿{commData.adjustCarryover.toLocaleString("th-TH")}</Text>
                    </View>
                  )}
                  {commData.adjustThisMonth > 0 && (
                    <View style={styles.commBreakdownRow}>
                      <Text style={styles.commBreakdownLabel}>+ ยอดเติมเดือนนี้</Text>
                      <Text style={[styles.commBreakdownVal, { color: "#3b82f6" }]}>฿{commData.adjustThisMonth.toLocaleString("th-TH")}</Text>
                    </View>
                  )}
                  <View style={[styles.commBreakdownRow, { borderTopWidth: 1, borderTopColor: colors.borderLight, marginTop: 4, paddingTop: 6 }]}>
                    <Text style={[styles.commBreakdownLabel, { fontWeight: "700", color: colors.textPrimary }]}>ยอดคำนวณ</Text>
                    <Text style={[styles.commBreakdownVal, { fontWeight: "700", color: colors.textPrimary }]}>฿{commData.totalAmount.toLocaleString("th-TH")}</Text>
                  </View>
                </View>
              )}

              {/* Status breakdown */}
              {(commData.confirmedCount > 0 || commData.pendingCount > 0) && (
                <View style={styles.commStatusRow}>
                  {commData.confirmedCount > 0 && (
                    <View style={styles.commStatusChip}>
                      <Text style={styles.commStatusDot}>✓</Text>
                      <Text style={styles.commStatusText}>ยืนยันแล้ว {commData.confirmedCount} รายการ</Text>
                    </View>
                  )}
                  {commData.pendingCount > 0 && (
                    <View style={[styles.commStatusChip, styles.commStatusChipPending]}>
                      <Text style={[styles.commStatusDot, { color: "#d97706" }]}>⏳</Text>
                      <Text style={[styles.commStatusText, { color: "#92400e" }]}>
                        รอยืนยัน {commData.pendingCount} รายการ
                        {commData.pendingAmount > 0 ? ` (฿${commData.pendingAmount.toLocaleString("th-TH")})` : ""}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Progress bar (threshold) */}
              {commData.settings.threshold > 0 && (
                <View>
                  <View style={styles.commProgressHeader}>
                    <Text style={styles.commProgressLabel}>
                      ยอดขั้นต่ำ ฿{commData.settings.threshold.toLocaleString("th-TH")}
                    </Text>
                    <Text style={[styles.commProgressLabel, { color: commData.reachedThreshold ? colors.primary : colors.textMuted }]}>
                      {commData.reachedThreshold ? "✓ ถึงเป้า" : `ขาดอีก ฿${commData.remaining.toLocaleString("th-TH")}`}
                    </Text>
                  </View>
                  <View style={styles.commProgressTrack}>
                    <View style={[styles.commProgressFill, {
                      width: `${Math.min((commData.totalAmount / commData.settings.threshold) * 100, 100)}%` as any,
                      backgroundColor: commData.reachedThreshold ? colors.primary : "#f59e0b",
                    }]} />
                  </View>
                </View>
              )}

              {/* Commission result */}
              <View style={[styles.commResult, {
                backgroundColor: commData.reachedThreshold ? colors.primaryLight : "#fef9ee",
                borderColor: commData.reachedThreshold ? colors.primaryBorder : "#fde68a",
              }]}>
                {commData.reachedThreshold ? (
                  <>
                    <Text style={[styles.commResultLabel, { color: colors.primaryDark }]}>ค่าคอมปกติ ({commData.settings.rate}%)</Text>
                    <Text style={[styles.commResultAmount, { color: colors.primary }]}>
                      ฿{commData.commission.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.commResultLabel, { color: "#b45309" }]}>
                      {commData.settings.threshold === 0
                        ? `ค่าคอม ${commData.settings.rate}% ของยอดขาย`
                        : `ยังไม่ถึงเป้า — ขาดอีก ฿${commData.remaining.toLocaleString("th-TH")}`}
                    </Text>
                    <Text style={[styles.commResultAmount, { color: "#d97706" }]}>
                      ฿{commData.commission.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                    </Text>
                  </>
                )}
              </View>

              {/* Proxy commission */}
              {commData.proxyRate > 0 && commData.proxySlipAmount > 0 && (
                <View style={[styles.commResult, { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.commResultLabel, { color: "#1d4ed8" }]}>
                      ค่าคอมเก็บแทน ({commData.proxyRate}%)
                    </Text>
                    <Text style={{ fontSize: 13, color: "#3b82f6", marginTop: 2 }}>
                      ยอดสลิปเก็บแทน ฿{commData.proxySlipAmount.toLocaleString("th-TH")}
                    </Text>
                  </View>
                  <Text style={[styles.commResultAmount, { color: "#1d4ed8" }]}>
                    ฿{commData.proxyCommission.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              )}

              {/* Grand total (รวมทั้ง 2 ประเภท) */}
              {commData.proxyRate > 0 && commData.proxySlipAmount > 0 && commData.reachedThreshold && (
                <View style={[styles.commResult, { backgroundColor: "#f0fdf4", borderColor: "#86efac" }]}>
                  <Text style={[styles.commResultLabel, { color: "#166534", fontWeight: "700" }]}>รวมค่าคอมทั้งหมด</Text>
                  <Text style={[styles.commResultAmount, { color: "#16a34a" }]}>
                    ฿{(commData.commission + commData.proxyCommission).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={{ color: colors.textDisabled, fontSize: 18, textAlign: "center", marginVertical: 12 }}>
              ไม่มีข้อมูล
            </Text>
          )}
        </View>

        {/* Outstanding debt */}
        <OutstandingDebtCard refreshKey={refreshCount} />

        {/* Bank account */}
        <View style={styles.bankSection}>
          <View style={styles.bankHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bankTitle}>ข้อมูลธนาคาร</Text>
              <Text style={styles.bankSubtitle}>สำหรับรับค่าคอมมิชชัน</Text>
            </View>
            {!editingBank && (
              <TouchableOpacity onPress={() => setEditingBank(true)} style={styles.editBtn}>
                <Ionicons name="pencil-outline" size={14} color={colors.primaryDark} />
                <Text style={styles.editBtnText}>แก้ไข</Text>
              </TouchableOpacity>
            )}
          </View>

          {!editingBank ? (
            <View>
              <View style={styles.bankRow}>
                <View style={styles.bankIconWrap}>
                  <Ionicons name="home-outline" size={16} color="#3b82f6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bankLabel}>ธนาคาร</Text>
                  <Text style={[styles.bankValue, !user?.bankName && styles.bankEmpty]}>
                    {user?.bankName || "ยังไม่ระบุ"}
                  </Text>
                </View>
              </View>
              <View style={[styles.bankRow, { borderBottomWidth: 0 }]}>
                <View style={[styles.bankIconWrap, { backgroundColor: "#f5f3ff" }]}>
                  <Ionicons name="card-outline" size={16} color="#8b5cf6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bankLabel}>เลขบัญชี</Text>
                  <Text style={[styles.bankValue, !user?.bankAccount && styles.bankEmpty]}>
                    {user?.bankAccount || "ยังไม่ระบุ"}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <View>
                <Text style={styles.inputLabel}>ธนาคาร</Text>
                <TouchableOpacity onPress={() => setBankPickerVisible(true)} style={[styles.bankInput, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
                  <Text style={{ fontSize: 19, color: bankName ? colors.textPrimary : colors.textDisabled }}>
                    {bankName || "— เลือกธนาคาร —"}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <View>
                <Text style={styles.inputLabel}>เลขบัญชี</Text>
                <TextInput value={bankAccount} onChangeText={setBankAccount}
                  placeholder="xxx-x-xxxxx-x"
                  placeholderTextColor={colors.textDisabled}
                  keyboardType="numeric"
                  style={styles.bankInput} />
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 2 }}>
                <TouchableOpacity onPress={() => { setEditingBank(false); setBankName(user?.bankName ?? ""); setBankAccount(user?.bankAccount ?? ""); }}
                  style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>ยกเลิก</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveBank} disabled={bankSaving}
                  style={[styles.saveBtn, bankSaving && { opacity: 0.6 }]}>
                  {bankSaving
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.saveBtnText}>บันทึก</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Province list */}
        <View style={styles.mapSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>สรุปตามจังหวัด</Text>
            <Text style={styles.sectionHint}>กดเพื่อดูรายละเอียด</Text>
          </View>

          {Object.keys(provinceCounts).length === 0 ? (
            <View style={styles.emptyProvince}>
              <Ionicons name="location-outline" size={32} color={colors.textDisabled} />
              <Text style={styles.emptyProvinceText}>ยังไม่มีข้อมูลการเยี่ยม</Text>
            </View>
          ) : (
            <View style={styles.provinceList}>
              {Object.entries(provinceCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([name, count]) => {
                  const pv = visits.filter((v) => v.province === name);
                  const buy = pv.filter((v) => v.result === "buy").length;
                  const noBuy = pv.filter((v) => v.result === "no_buy").length;
                  const notFound = pv.filter((v) => v.result === "not_found").length;
                  const barWidth = `${Math.round((count / maxCount) * 100)}%` as any;
                  return (
                    <TouchableOpacity
                      key={name}
                      style={styles.provinceRow}
                      onPress={() => openProvince(name)}
                      activeOpacity={0.75}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={styles.provinceRowTop}>
                          <Text style={styles.provinceRowName}>{name}</Text>
                          <Text style={styles.provinceRowCount}>{count} บันทึก</Text>
                        </View>
                        <View style={styles.provinceBar}>
                          <View style={[styles.provinceBarFill, { width: barWidth }]} />
                        </View>
                        <View style={styles.provinceChips}>
                          {buy > 0 && <Text style={[styles.pChipTxt, { color: "#16a34a" }]}>ออเดอร์ {buy}</Text>}
                          {noBuy > 0 && <Text style={[styles.pChipTxt, { color: "#dc2626" }]}>ไม่ออเดอร์ {noBuy}</Text>}
                          {notFound > 0 && <Text style={[styles.pChipTxt, { color: "#2563eb" }]}>ไม่พบ {notFound}</Text>}
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={14} color={colors.textDisabled} style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                  );
                })}
            </View>
          )}
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={18} color={colors.error} style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>ออกจากระบบ</Text>
        </TouchableOpacity>
      </ScrollView>

      {selectedProvince && provinceView === "list" && (
        <ProvinceListSheet
          province={selectedProvince}
          records={provinceRecords}
          onBack={() => setProvinceView(null)}
          onSelectRecord={(r) => { setProvinceView(null); setSelectedVisit(r); }}
        />
      )}
      {selectedVisit && (
        <VisitDetailModal
          record={selectedVisit}
          onClose={() => { setSelectedVisit(null); if (selectedProvince) setProvinceView("list"); }}
        />
      )}

      {/* Bank picker modal */}
      <Modal visible={bankPickerVisible} transparent animationType="slide" onRequestClose={() => setBankPickerVisible(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} activeOpacity={1} onPress={() => setBankPickerVisible(false)} />
        <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32, maxHeight: "60%", position: "absolute", bottom: 0, left: 0, right: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb" }}>
            <Text style={{ fontSize: 21, fontWeight: "700", color: colors.textPrimary }}>เลือกธนาคาร</Text>
            <TouchableOpacity onPress={() => setBankPickerVisible(false)}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={THAI_BANKS}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => { setBankName(item); setBankPickerVisible(false); }}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: "#f3f4f6" }}
              >
                <Text style={{ fontSize: 20, color: colors.textPrimary }}>{item}</Text>
                {bankName === item && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
      {/* Change password modal */}
      <Modal visible={showChangePassword} transparent animationType="slide" onRequestClose={closePwModal}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <TouchableOpacity style={pw.overlay} activeOpacity={1} onPress={closePwModal}>
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <View style={pw.sheet}>
                {/* Drag handle */}
                <View style={pw.dragHandle} />

                {/* Header */}
                <View style={pw.header}>
                  <View style={pw.headerLeft}>
                    <View style={pw.lockIcon}>
                      <Ionicons name="lock-closed" size={16} color={colors.primary} />
                    </View>
                    <View>
                      <Text style={pw.title}>เปลี่ยนรหัสผ่าน</Text>
                      <Text style={pw.subtitle}>ตั้งรหัสผ่านใหม่ที่คาดเดายาก</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={closePwModal} style={pw.closeBtn} hitSlop={8}>
                    <Ionicons name="close" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={pw.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                  {/* รหัสผ่านเดิม */}
                  <Text style={pw.label}>รหัสผ่านเดิม</Text>
                  <View style={[pw.inputRow, !!pwErrors.current && pw.inputRowError]}>
                    <Ionicons name="key-outline" size={17} color={pwErrors.current ? "#ef4444" : colors.textDisabled} style={{ marginRight: 8 }} />
                    <TextInput
                      style={pw.input}
                      value={currentPassword}
                      onChangeText={(v) => { setCurrentPassword(v); setPwErrors((p) => ({ ...p, current: "" })); }}
                      placeholder="กรอกรหัสผ่านเดิม"
                      placeholderTextColor={colors.textDisabled}
                      secureTextEntry={!showCurrentPw}
                      autoCapitalize="none"
                      returnKeyType="next"
                      onSubmitEditing={() => newPwRef.current?.focus()}
                      blurOnSubmit={false}
                      autoFocus
                    />
                    <TouchableOpacity onPress={() => setShowCurrentPw((v) => !v)} style={pw.eyeBtn} hitSlop={8}>
                      <Ionicons name={showCurrentPw ? "eye-off-outline" : "eye-outline"} size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                  {!!pwErrors.current && <Text style={pw.errorText}>{pwErrors.current}</Text>}

                  {/* รหัสผ่านใหม่ */}
                  <Text style={[pw.label, pw.labelGap]}>รหัสผ่านใหม่</Text>
                  <View style={[pw.inputRow, !!pwErrors.new && pw.inputRowError]}>
                    <Ionicons name="shield-outline" size={17} color={pwErrors.new ? "#ef4444" : colors.textDisabled} style={{ marginRight: 8 }} />
                    <TextInput
                      ref={newPwRef}
                      style={pw.input}
                      value={newPassword}
                      onChangeText={(v) => { setNewPassword(v); setPwErrors((p) => ({ ...p, new: "" })); }}
                      placeholder="อย่างน้อย 6 ตัวอักษร"
                      placeholderTextColor={colors.textDisabled}
                      secureTextEntry={!showNewPw}
                      autoCapitalize="none"
                      returnKeyType="next"
                      onSubmitEditing={() => confirmPwRef.current?.focus()}
                      blurOnSubmit={false}
                    />
                    <TouchableOpacity onPress={() => setShowNewPw((v) => !v)} style={pw.eyeBtn} hitSlop={8}>
                      <Ionicons name={showNewPw ? "eye-off-outline" : "eye-outline"} size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                  {!!pwErrors.new && <Text style={pw.errorText}>{pwErrors.new}</Text>}
                  {/* Strength bar */}
                  {newPassword.length > 0 && (() => {
                    const len = newPassword.length;
                    const hasNum = /\d/.test(newPassword);
                    const hasUpper = /[A-Z]/.test(newPassword);
                    const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
                    const score = (len >= 8 ? 1 : 0) + (hasNum ? 1 : 0) + (hasUpper ? 1 : 0) + (hasSpecial ? 1 : 0);
                    const levels = [
                      { label: "อ่อน", color: "#ef4444" },
                      { label: "พอใช้", color: "#f97316" },
                      { label: "ดี", color: "#eab308" },
                      { label: "แข็งแกร่ง", color: "#22c55e" },
                    ];
                    const lv = levels[Math.min(score, 3)];
                    return (
                      <View style={pw.strengthWrap}>
                        <View style={pw.strengthBars}>
                          {[0,1,2,3].map((i) => (
                            <View key={i} style={[pw.strengthBar, i <= score && { backgroundColor: lv.color }]} />
                          ))}
                        </View>
                        <Text style={[pw.strengthLabel, { color: lv.color }]}>{lv.label}</Text>
                      </View>
                    );
                  })()}

                  {/* ยืนยันรหัสผ่านใหม่ */}
                  <Text style={[pw.label, pw.labelGap]}>ยืนยันรหัสผ่านใหม่</Text>
                  <View style={[pw.inputRow, !!pwErrors.confirm && pw.inputRowError]}>
                    <Ionicons name="checkmark-circle-outline" size={17}
                      color={confirmPassword && confirmPassword === newPassword ? "#22c55e" : pwErrors.confirm ? "#ef4444" : colors.textDisabled}
                      style={{ marginRight: 8 }}
                    />
                    <TextInput
                      ref={confirmPwRef}
                      style={pw.input}
                      value={confirmPassword}
                      onChangeText={(v) => { setConfirmPassword(v); setPwErrors((p) => ({ ...p, confirm: "" })); }}
                      placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                      placeholderTextColor={colors.textDisabled}
                      secureTextEntry={!showConfirmPw}
                      autoCapitalize="none"
                      returnKeyType="done"
                      onSubmitEditing={handleChangePassword}
                    />
                    <TouchableOpacity onPress={() => setShowConfirmPw((v) => !v)} style={pw.eyeBtn} hitSlop={8}>
                      <Ionicons name={showConfirmPw ? "eye-off-outline" : "eye-outline"} size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                  {!!pwErrors.confirm && <Text style={pw.errorText}>{pwErrors.confirm}</Text>}

                  {/* Buttons */}
                  <TouchableOpacity
                    style={[pw.saveBtn, (passwordSaving || !currentPassword || newPassword.length < 6 || !confirmPassword) && pw.saveBtnDisabled]}
                    onPress={handleChangePassword}
                    disabled={passwordSaving || !currentPassword || newPassword.length < 6 || !confirmPassword}
                    activeOpacity={0.85}
                  >
                    {passwordSaving
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={pw.saveText}>บันทึกรหัสผ่าน</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={pw.cancelBtn} onPress={closePwModal}>
                    <Text style={pw.cancelText}>ยกเลิก</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      <AppAlert {...appAlert} />
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  hero: {
    backgroundColor: "#16a34a", paddingTop: 24, paddingBottom: 32,
    paddingHorizontal: 20, alignItems: "center", gap: 6,
    position: "relative", overflow: "hidden",
  },
  heroDecor1: {
    position: "absolute", width: 200, height: 200, borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.06)", top: -60, right: -40,
  },
  heroDecor2: {
    position: "absolute", width: 120, height: 120, borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.04)", bottom: -20, left: 20,
  },
  heroAvatar: {
    width: 68, height: 68, borderRadius: 34,
    borderWidth: 3, borderColor: "rgba(255,255,255,0.4)",
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center", alignItems: "center", zIndex: 1,
  },
  heroAvatarText: { color: "#fff", fontSize: 31, fontWeight: "900" },
  heroName: { fontSize: 21, fontWeight: "800", color: "#fff", zIndex: 1 },
  heroEmail: { fontSize: 17, color: "rgba(255,255,255,0.65)", zIndex: 1 },
  heroBadge: {
    backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 14, paddingVertical: 3,
    borderRadius: radius.full, zIndex: 1,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
  },
  heroBadgeText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  tierBar: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  tierLabel: { fontSize: 24, color: colors.textMuted, fontWeight: "600", textAlign: "center", marginBottom: 4 },
  tierAmount: { fontSize: 44, fontWeight: "900", color: colors.primary, textAlign: "center", marginBottom: 12 },
  tierTrackRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  tierRateCurrent: { fontSize: 18, fontWeight: "800", color: colors.primary, width: 40 },
  tierRateNext: { fontSize: 18, fontWeight: "700", color: colors.textDisabled, width: 40, textAlign: "right" },
  tierTrack: { flex: 1, height: 10, backgroundColor: colors.bg, borderRadius: 5, overflow: "hidden", borderWidth: 0.5, borderColor: colors.borderLight },
  tierFill: { height: 10, backgroundColor: colors.primary, borderRadius: 5 },
  tierCaption: { fontSize: 15, color: colors.textMuted, textAlign: "center" },

  mapSection: { marginHorizontal: 16, marginTop: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  sectionTitle: { fontSize: 19, fontWeight: "700", color: colors.textPrimary },
  sectionHint: { fontSize: 16, color: colors.textDisabled },

  emptyProvince: { alignItems: "center", paddingVertical: 24, gap: 8 },
  emptyProvinceText: { fontSize: 18, color: colors.textDisabled },

  provinceList: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 0.5, borderColor: colors.borderLight, overflow: "hidden", ...shadows.card,
  },
  provinceRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: colors.bg,
  },
  provinceRowTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  provinceRowName: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  provinceRowCount: { fontSize: 17, color: colors.textMuted },
  provinceBar: { height: 6, backgroundColor: colors.bg, borderRadius: 3, overflow: "hidden", marginBottom: 6 },
  provinceBarFill: { height: 6, backgroundColor: colors.primary, borderRadius: 3 },
  provinceChips: { flexDirection: "row", gap: 5 },
  pChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  pChipTxt: { fontSize: 16, fontWeight: "600" },

  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.primaryLight, borderWidth: 1,
    borderColor: colors.primaryBorder, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  chipText: { fontSize: 17, color: colors.primaryDark, fontWeight: "600" },
  chipBadge: {
    backgroundColor: colors.primary, borderRadius: radius.full,
    paddingHorizontal: 5, paddingVertical: 1, minWidth: 18, alignItems: "center",
  },
  chipBadgeText: { fontSize: 15, color: "#fff", fontWeight: "700" },

  infoSection: {
    marginHorizontal: 16, marginTop: 12, backgroundColor: colors.surface,
    borderRadius: radius.xl, borderWidth: 0.5, borderColor: colors.borderLight,
    overflow: "hidden", ...shadows.card,
  },
  infoRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 13,
    borderBottomWidth: 0.5, borderBottomColor: colors.bg,
  },
  infoRowLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoIcon: { width: 32, height: 32, borderRadius: radius.sm, justifyContent: "center", alignItems: "center" },
  infoLabel: { fontSize: 19, color: colors.textSecondary, fontWeight: "500" },
  infoValue: { fontSize: 18, color: colors.textDisabled, maxWidth: 160 },

  commSection: {
    marginHorizontal: 16, marginTop: 12, backgroundColor: colors.surface,
    borderRadius: radius.xl, borderWidth: 0.5, borderColor: colors.borderLight,
    padding: 16, ...shadows.card,
  },
  commMonthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  monthNavBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bg, borderWidth: 0.5, borderColor: colors.borderLight, alignItems: "center", justifyContent: "center" },
  commMonthText: { fontSize: 19, fontWeight: "700", color: colors.textPrimary },
  commStatsRow: { flexDirection: "row", borderWidth: 0.5, borderColor: colors.borderLight, borderRadius: radius.lg, overflow: "hidden" },
  commStat: { flex: 1, paddingVertical: 12, alignItems: "center" },
  commStatNum: { fontSize: 20, fontWeight: "700", color: colors.textPrimary, marginBottom: 2 },
  commStatLabel: { fontSize: 16, color: colors.textDisabled },
  commStatusRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  commStatusChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#f0fdf4", borderWidth: 1, borderColor: "#bbf7d0", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  commStatusChipPending: { backgroundColor: "#fffbeb", borderColor: "#fde68a" },
  commStatusDot: { fontSize: 16, color: colors.primary },
  commStatusText: { fontSize: 17, color: "#166534", fontWeight: "600" },
  commProgressHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  commProgressLabel: { fontSize: 17, color: colors.textMuted },
  commProgressTrack: { height: 8, backgroundColor: colors.bg, borderRadius: 4, overflow: "hidden", borderWidth: 0.5, borderColor: colors.borderLight },
  commProgressFill: { height: "100%", borderRadius: 4 },
  commResult: { borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  commResultLabel: { fontSize: 18, fontWeight: "600", flex: 1 },
  commResultAmount: { fontSize: 21, fontWeight: "800" },
  commBreakdownBox: {
    backgroundColor: colors.bg,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight,
    paddingHorizontal: 14, paddingVertical: 10, gap: 4,
  },
  commBreakdownRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  commBreakdownLabel: { fontSize: 16, color: colors.textMuted },
  commBreakdownVal: { fontSize: 16, fontWeight: "600", color: colors.textSecondary },

  bankSection: {
    marginHorizontal: 16, marginTop: 12, backgroundColor: colors.surface,
    borderRadius: radius.xl, borderWidth: 0.5, borderColor: colors.borderLight,
    padding: 16, ...shadows.card,
  },
  bankHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 14 },
  bankTitle: { fontSize: 19, fontWeight: "700", color: colors.textPrimary },
  bankSubtitle: { fontSize: 16, color: colors.textDisabled, marginTop: 2 },
  editBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primaryBorder,
    borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5,
  },
  editBtnText: { fontSize: 17, color: colors.primaryDark, fontWeight: "600" },
  bankRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight,
  },
  bankIconWrap: {
    width: 32, height: 32, borderRadius: radius.sm,
    backgroundColor: "#eff6ff", justifyContent: "center", alignItems: "center",
    marginRight: 12, flexShrink: 0,
  },
  bankLabel: { fontSize: 16, color: colors.textMuted, fontWeight: "600" },
  bankValue: { fontSize: 19, color: colors.textPrimary, fontWeight: "700", marginTop: 1 },
  bankEmpty: { color: colors.textDisabled, fontWeight: "400" },
  inputLabel: { fontSize: 17, color: colors.textMuted, fontWeight: "600", marginBottom: 5 },
  bankInput: {
    borderWidth: 1, borderColor: colors.borderLight, borderRadius: radius.lg,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 19,
    color: colors.textPrimary, backgroundColor: colors.bg,
  },
  cancelBtn: {
    flex: 1, paddingVertical: 11, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderLight, alignItems: "center",
  },
  cancelBtnText: { fontSize: 19, color: colors.textSecondary, fontWeight: "600" },
  saveBtn: {
    flex: 2, paddingVertical: 11, borderRadius: radius.lg,
    backgroundColor: colors.primary, alignItems: "center",
  },
  saveBtnText: { fontSize: 19, color: "#fff", fontWeight: "700" },

  heroLineBtn: {
    position: "absolute", right: 16, zIndex: 2,
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
    borderRadius: radius.full,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  heroLineBtnText: { fontSize: 17, fontWeight: "600", color: "rgba(255,255,255,0.9)" },

  logoutButton: {
    marginHorizontal: 16, marginTop: 8, backgroundColor: colors.errorBg,
    borderWidth: 0.5, borderColor: "#fecaca", borderRadius: radius.xl,
    paddingVertical: 14, alignItems: "center", flexDirection: "row", justifyContent: "center",
  },
  logoutText: { color: colors.error, fontWeight: "700", fontSize: 20 },

  changePwBtn: {
    marginHorizontal: 16, marginTop: 12, backgroundColor: "#eff6ff",
    borderWidth: 0.5, borderColor: "#bfdbfe", borderRadius: radius.xl,
    paddingVertical: 14, alignItems: "center", flexDirection: "row", justifyContent: "center",
  },
  changePwBtnText: { color: "#3b82f6", fontWeight: "700", fontSize: 20 },

});

const det = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "92%", overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderLight, gap: 12 },
  shopName: { fontSize: 21, fontWeight: "700", color: colors.textPrimary },
  byUser: { fontSize: 16, color: colors.textMuted, marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderLight, alignItems: "center", justifyContent: "center" },
  galleryImg: { height: 240 },
  zoomHint: {
    position: "absolute", bottom: 8, right: 8,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center",
  },
  galleryMeta: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, alignItems: "center", gap: 6 },
  slotLabel: { fontSize: 17, color: colors.textMuted, fontWeight: "600" },
  dots: { flexDirection: "row", gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.borderLight },
  dotActive: { backgroundColor: colors.primary, width: 14 },
  body: { padding: 18 },
  resultBadge: { borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 6, alignSelf: "flex-start", marginBottom: 16 },
  resultBadgeText: { fontSize: 18, fontWeight: "700" },
  infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  infoIcon: { marginRight: 10 },
  infoLabel: { fontSize: 18, color: colors.textMuted, width: 70 },
  infoValue: { flex: 1, fontSize: 18, color: colors.textPrimary, fontWeight: "500" },
  noteBox: { marginTop: 16, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: colors.borderLight },
  noteLabel: { fontSize: 16, color: colors.textMuted, fontWeight: "600", marginBottom: 6 },
  noteText: { fontSize: 18, color: colors.textPrimary, lineHeight: 20 },

  resultRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  orderBadge: { borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: "#f0fdf4", borderWidth: 1, borderColor: "#bbf7d0" },
  orderText: { fontSize: 18, fontWeight: "700", color: "#15803d" },
  transRefBox: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginBottom: 12, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  transRefText: { fontSize: 17, color: colors.textMuted, fontWeight: "500", flex: 1 },
});

const prov = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "transparent", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: "80%", overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 16, elevation: 20,
    borderTopWidth: 0.5, borderLeftWidth: 0.5, borderRightWidth: 0.5,
    borderColor: colors.borderLight,
  },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderLight, gap: 8 },
  backBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderLight, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 21, fontWeight: "700", color: colors.textPrimary },
  count: { fontSize: 17, color: colors.textMuted, marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderLight, alignItems: "center", justifyContent: "center" },
  card: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surface, borderRadius: radius.xl, padding: 12, marginBottom: 8, borderWidth: 0.5, borderColor: colors.borderLight, ...shadows.card },
  thumb: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.primaryLight },
  cardInfo: { flex: 1, minWidth: 0 },
  shopName: { fontSize: 18, fontWeight: "700", color: colors.textPrimary, marginBottom: 2 },
  cardDate: { fontSize: 16, color: colors.textDisabled },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  badgeText: { fontSize: 16, fontWeight: "600" },
});

const pw = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    shadowColor: "#000", shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 28,
  },
  dragHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.borderLight,
    alignSelf: "center", marginTop: 10, marginBottom: 4,
  },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  lockIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight,
    alignItems: "center", justifyContent: "center",
  },
  body: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36 },
  label: { fontSize: 14, fontWeight: "600", color: colors.textMuted, marginBottom: 8 },
  labelGap: { marginTop: 18 },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.borderLight, paddingHorizontal: 12,
    height: 52,
  },
  inputRowError: { borderColor: "#ef4444", backgroundColor: "#fff5f5" },
  input: { flex: 1, height: 52, fontSize: 16, color: colors.textPrimary },
  eyeBtn: { paddingHorizontal: 4, paddingVertical: 8 },
  errorText: { fontSize: 13, color: "#ef4444", marginTop: 5, marginLeft: 2 },
  strengthWrap: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  strengthBars: { flexDirection: "row", gap: 4, flex: 1 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.borderLight },
  strengthLabel: { fontSize: 12, fontWeight: "600", width: 60, textAlign: "right" },
  saveBtn: {
    height: 52, borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
    marginTop: 28,
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveText: { fontSize: 17, fontWeight: "700", color: "#fff", letterSpacing: 0.3 },
  cancelBtn: { alignItems: "center", paddingVertical: 14 },
  cancelText: { fontSize: 16, color: colors.textMuted, fontWeight: "500" },
});
