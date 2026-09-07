import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  useWindowDimensions, Modal, FlatList, Image, RefreshControl,
  TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getStoredUser, api } from "@/lib/api";
import { useAuthStore } from "@/lib/useAuthStore";
import { colors, radius, shadows } from "@/lib/theme";
import { SkeletonBox } from "@/lib/Skeleton";
import { AppAlert, AlertButton } from "@/lib/AppModal";
import { OutstandingDebtCard } from "@/lib/OutstandingDebtCard";

// ── Types ─────────────────────────────────────────────────────
interface UserInfo { fullName: string; email: string; role: string; bankName?: string; bankAccount?: string; lineConnected?: boolean }

interface SlipSubmission {
  id: string; shopName: string; amount?: number | null;
  slipUrl: string; slipStatus: string; transRef?: string | null;
  isProxy?: boolean; createdAt: string;
}

const THAI_BANKS = [
  "กรุงเทพ (BBL)", "กสิกรไทย (KBANK)", "กรุงไทย (KTB)", "ไทยพาณิชย์ (SCB)",
  "กรุงศรีอยุธยา (BAY)", "ทหารไทยธนชาต (TTB)", "ออมสิน (GSB)", "ธ.ก.ส. (BAAC)",
  "ซีไอเอ็มบี (CIMB)", "ยูโอบี (UOB)", "ทิสโก้ (TISCO)", "เกียรตินาคินภัทร (KKP)",
  "แลนด์แอนด์เฮ้าส์ (LH Bank)", "ไทยเครดิต (Thai Credit)",
];

const SLIP_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  verified:         { label: "QR ผ่าน",    color: colors.primaryDark, bg: colors.primaryLight },
  pending_approval: { label: "รอยืนยัน",   color: "#d97706",          bg: "#fffbeb" },
  approved:         { label: "อนุมัติแล้ว", color: "#16a34a",          bg: "#f0fdf4" },
  rejected:         { label: "ปฏิเสธ",      color: "#dc2626",          bg: "#fef2f2" },
};

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

  // ── State ────────────────────────────────────────────────────
  const [user, setUser] = useState<UserInfo | null>(null);
  const [slips, setSlips] = useState<SlipSubmission[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);

  // Commission
  const [commMonth, setCommMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [commData, setCommData] = useState<{
    visitCount: number; slipAmount: number; proxySlipAmount: number;
    adjustThisMonth: number; adjustCarryover: number;
    totalAmount: number; pendingAmount: number;
    confirmedCount: number; pendingCount: number;
    reachedThreshold: boolean; commission: number; remaining: number;
    proxyCommission: number; proxyRate: number;
    settings: { rate: number; threshold: number };
  } | null>(null);
  const [commLoading, setCommLoading] = useState(false);

  // Bank account editing
  const [editingBank, setEditingBank] = useState(false);
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankSaving, setBankSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [bankPickerVisible, setBankPickerVisible] = useState(false);

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

  // ── Tier info ─────────────────────────────────────────────────
  const tierInfo = useMemo(() => {
    if (!commData) return null;
    const tiers: { min: number; max: number | null; rate: number }[] = (commData.settings as any)?.tiers ?? [];
    if (tiers.length === 0) return null;
    const total = commData.totalAmount;
    let currentIdx = 0;
    for (let i = 0; i < tiers.length; i++) { if (total >= tiers[i].min) currentIdx = i; }
    const current = tiers[currentIdx];
    const next = tiers[currentIdx + 1] ?? null;
    const progressMax = next ? next.min : (current.max ?? total + 1);
    const progress = progressMax > current.min ? Math.min((total - current.min) / (progressMax - current.min), 1) : 1;
    return { current, next, isMax: !next, progress, amountToNext: next ? Math.round(Math.max(next.min - total, 0)) : 0 };
  }, [commData]);

  // ── Data loading ─────────────────────────────────────────────
  async function loadData(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    try {
      const [u, me, slipData] = await Promise.all([getStoredUser(), api.getMe(), api.getSlips()]);
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
      setSlips(slipData?.data ?? slipData ?? []);
    } catch (err: any) {
      const isNetworkErr = err?.message?.includes("เชื่อมต่อ") || err?.message?.includes("หมดเวลา");
      if (!isNetworkErr) { signOut(); router.replace("/login"); return; }
    } finally { setRefreshing(false); }
    if (isRefresh) { loadCommission(commMonth); setRefreshCount((c) => c + 1); }
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
    api.getMyCommission(month).then(setCommData).catch(() => {}).finally(() => setCommLoading(false));
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
    if (loggingOut) return;
    showAlert("confirm", "ออกจากระบบ", "ต้องการออกจากระบบใช่ไหม?", [
      { text: "ยกเลิก", style: "cancel", onPress: () => setAppAlert((p) => ({ ...p, visible: false })) },
      { text: "ออกจากระบบ", style: "destructive", onPress: async () => { setLoggingOut(true); setAppAlert((p) => ({ ...p, visible: false })); signOut(); router.replace("/login"); } },
    ]);
  }

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ backgroundColor: "#16a34a", paddingTop: insets.top + 16, paddingBottom: 28, alignItems: "center", gap: 10 }}>
          <SkeletonBox width={68} height={68} borderRadius={34} style={{ backgroundColor: "rgba(255,255,255,0.25)" }} />
          <SkeletonBox width={120} height={16} borderRadius={8} style={{ backgroundColor: "rgba(255,255,255,0.25)" }} />
          <SkeletonBox width={80} height={12} borderRadius={6} style={{ backgroundColor: "rgba(255,255,255,0.2)" }} />
        </View>
        <View style={{ margin: 14, gap: 10 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: 16, gap: 12, borderWidth: 1, borderColor: colors.borderLight, ...shadows.card }}>
            <SkeletonBox height={16} width="50%" borderRadius={6} />
            <SkeletonBox height={48} borderRadius={10} />
            <SkeletonBox height={34} borderRadius={10} />
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
                {tierInfo.isMax ? "ถึงอัตราสูงสุดแล้ว" : `อีก ฿${tierInfo.amountToNext.toLocaleString("th-TH")} ถึงได้ ${tierInfo.next!.rate}%`}
              </Text>
            </>
          ) : (
            <View style={styles.tierHeader}>
              <Text style={styles.tierLabel}>ค่าคอมเดือนนี้</Text>
              <Text style={styles.tierAmount}>฿{((commData?.commission ?? 0) + (commData?.proxyCommission ?? 0)).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</Text>
            </View>
          )}
        </View>

        {/* Commission */}
        <View style={styles.commSection}>
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

              {commData.settings.threshold > 0 && (
                <View>
                  <View style={styles.commProgressHeader}>
                    <Text style={styles.commProgressLabel}>ยอดขั้นต่ำ ฿{commData.settings.threshold.toLocaleString("th-TH")}</Text>
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

              <View style={[styles.commResult, {
                backgroundColor: commData.reachedThreshold ? colors.primaryLight : "#fef9ee",
                borderColor: commData.reachedThreshold ? colors.primaryBorder : "#fde68a",
              }]}>
                {commData.reachedThreshold ? (
                  <>
                    <Text style={[styles.commResultLabel, { color: colors.primaryDark }]}>ค่าคอมปกติ ({commData.settings.rate}%)</Text>
                    <Text style={[styles.commResultAmount, { color: colors.primary }]}>฿{commData.commission.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.commResultLabel, { color: "#b45309" }]}>
                      {commData.settings.threshold === 0
                        ? `ค่าคอม ${commData.settings.rate}% ของยอดขาย`
                        : `ยังไม่ถึงเป้า — ขาดอีก ฿${commData.remaining.toLocaleString("th-TH")}`}
                    </Text>
                    <Text style={[styles.commResultAmount, { color: "#d97706" }]}>฿{commData.commission.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</Text>
                  </>
                )}
              </View>

              {commData.proxyRate > 0 && commData.proxySlipAmount > 0 && (
                <View style={[styles.commResult, { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.commResultLabel, { color: "#1d4ed8" }]}>ค่าคอมเก็บแทน ({commData.proxyRate}%)</Text>
                    <Text style={{ fontSize: 13, color: "#3b82f6", marginTop: 2 }}>ยอดสลิปเก็บแทน ฿{commData.proxySlipAmount.toLocaleString("th-TH")}</Text>
                  </View>
                  <Text style={[styles.commResultAmount, { color: "#1d4ed8" }]}>฿{commData.proxyCommission.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</Text>
                </View>
              )}

              {commData.proxyRate > 0 && commData.proxySlipAmount > 0 && commData.reachedThreshold && (
                <View style={[styles.commResult, { backgroundColor: "#f0fdf4", borderColor: "#86efac" }]}>
                  <Text style={[styles.commResultLabel, { color: "#166534", fontWeight: "700" }]}>รวมค่าคอมทั้งหมด</Text>
                  <Text style={[styles.commResultAmount, { color: "#16a34a" }]}>฿{(commData.commission + commData.proxyCommission).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={{ color: colors.textDisabled, fontSize: 18, textAlign: "center", marginVertical: 12 }}>ไม่มีข้อมูล</Text>
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
                  <Text style={[styles.bankValue, !user?.bankName && styles.bankEmpty]}>{user?.bankName || "ยังไม่ระบุ"}</Text>
                </View>
              </View>
              <View style={[styles.bankRow, { borderBottomWidth: 0 }]}>
                <View style={[styles.bankIconWrap, { backgroundColor: "#f5f3ff" }]}>
                  <Ionicons name="card-outline" size={16} color="#8b5cf6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bankLabel}>เลขบัญชี</Text>
                  <Text style={[styles.bankValue, !user?.bankAccount && styles.bankEmpty]}>{user?.bankAccount || "ยังไม่ระบุ"}</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <View>
                <Text style={styles.inputLabel}>ธนาคาร</Text>
                <TouchableOpacity onPress={() => setBankPickerVisible(true)} style={[styles.bankInput, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
                  <Text style={{ fontSize: 19, color: bankName ? colors.textPrimary : colors.textDisabled }}>{bankName || "— เลือกธนาคาร —"}</Text>
                  <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <View>
                <Text style={styles.inputLabel}>เลขบัญชี</Text>
                <TextInput value={bankAccount} onChangeText={setBankAccount}
                  placeholder="xxx-x-xxxxx-x" placeholderTextColor={colors.textDisabled}
                  keyboardType="numeric" style={styles.bankInput} />
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 2 }}>
                <TouchableOpacity onPress={() => { setEditingBank(false); setBankName(user?.bankName ?? ""); setBankAccount(user?.bankAccount ?? ""); }} style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>ยกเลิก</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveBank} disabled={bankSaving} style={[styles.saveBtn, bankSaving && { opacity: 0.6 }]}>
                  {bankSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>บันทึก</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* ── Slip history ───────────────────────────────────────── */}
        <View style={styles.slipSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>ประวัติส่งสลิป</Text>
            <Text style={styles.sectionHint}>{slips.length} รายการ</Text>
          </View>

          {slips.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="receipt-outline" size={32} color={colors.textDisabled} />
              <Text style={styles.emptyText}>ยังไม่มีประวัติส่งสลิป</Text>
            </View>
          ) : (
            <View style={styles.slipList}>
              {slips.slice(0, 30).map((s, i) => {
                const st = SLIP_STATUS[s.slipStatus] ?? { label: s.slipStatus, color: colors.textMuted, bg: colors.bg };
                return (
                  <View key={s.id} style={[styles.slipRow, i === Math.min(slips.length, 30) - 1 && { borderBottomWidth: 0 }]}>
                    <Image source={{ uri: s.slipUrl }} style={styles.slipThumb} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.slipShop} numberOfLines={1}>{s.shopName}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
                        <Text style={styles.slipDate}>
                          {new Date(s.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                        </Text>
                        {s.isProxy && (
                          <View style={styles.proxyBadge}>
                            <Text style={styles.proxyBadgeText}>เก็บแทน</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 5 }}>
                      {s.amount != null && (
                        <Text style={styles.slipAmount}>฿{s.amount.toLocaleString("th-TH")}</Text>
                      )}
                      <View style={[styles.slipBadge, { backgroundColor: st.bg }]}>
                        <Text style={[styles.slipBadgeText, { color: st.color }]}>{st.label}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Change password */}
        <TouchableOpacity style={styles.changePwBtn} onPress={() => setShowChangePassword(true)} activeOpacity={0.85}>
          <Ionicons name="lock-closed-outline" size={18} color="#3b82f6" style={{ marginRight: 8 }} />
          <Text style={styles.changePwBtnText}>เปลี่ยนรหัสผ่าน</Text>
        </TouchableOpacity>

        {/* Logout */}
        <TouchableOpacity style={[styles.logoutButton, loggingOut && { opacity: 0.5 }]} onPress={handleLogout} disabled={loggingOut} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={18} color={colors.error} style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>ออกจากระบบ</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Bank picker */}
      <Modal visible={bankPickerVisible} transparent animationType="slide" onRequestClose={() => setBankPickerVisible(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} activeOpacity={1} onPress={() => setBankPickerVisible(false)} />
        <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32, maxHeight: "60%", position: "absolute", bottom: 0, left: 0, right: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb" }}>
            <Text style={{ fontSize: 21, fontWeight: "700", color: colors.textPrimary }}>เลือกธนาคาร</Text>
            <TouchableOpacity onPress={() => setBankPickerVisible(false)}><Ionicons name="close" size={22} color={colors.textSecondary} /></TouchableOpacity>
          </View>
          <FlatList
            data={THAI_BANKS} keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => { setBankName(item); setBankPickerVisible(false); }}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: "#f3f4f6" }}>
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
                <View style={pw.dragHandle} />
                <View style={pw.header}>
                  <View style={pw.headerLeft}>
                    <View style={pw.lockIcon}><Ionicons name="lock-closed" size={16} color={colors.primary} /></View>
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
                  <Text style={pw.label}>รหัสผ่านเดิม</Text>
                  <View style={[pw.inputRow, !!pwErrors.current && pw.inputRowError]}>
                    <Ionicons name="key-outline" size={17} color={pwErrors.current ? "#ef4444" : colors.textDisabled} style={{ marginRight: 8 }} />
                    <TextInput style={pw.input} value={currentPassword}
                      onChangeText={(v) => { setCurrentPassword(v); setPwErrors((p) => ({ ...p, current: "" })); }}
                      placeholder="กรอกรหัสผ่านเดิม" placeholderTextColor={colors.textDisabled}
                      secureTextEntry={!showCurrentPw} autoCapitalize="none" returnKeyType="next"
                      onSubmitEditing={() => newPwRef.current?.focus()} blurOnSubmit={false} autoFocus />
                    <TouchableOpacity onPress={() => setShowCurrentPw((v) => !v)} style={pw.eyeBtn} hitSlop={8}>
                      <Ionicons name={showCurrentPw ? "eye-off-outline" : "eye-outline"} size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                  {!!pwErrors.current && <Text style={pw.errorText}>{pwErrors.current}</Text>}

                  <Text style={[pw.label, pw.labelGap]}>รหัสผ่านใหม่</Text>
                  <View style={[pw.inputRow, !!pwErrors.new && pw.inputRowError]}>
                    <Ionicons name="shield-outline" size={17} color={pwErrors.new ? "#ef4444" : colors.textDisabled} style={{ marginRight: 8 }} />
                    <TextInput ref={newPwRef} style={pw.input} value={newPassword}
                      onChangeText={(v) => { setNewPassword(v); setPwErrors((p) => ({ ...p, new: "" })); }}
                      placeholder="อย่างน้อย 6 ตัวอักษร" placeholderTextColor={colors.textDisabled}
                      secureTextEntry={!showNewPw} autoCapitalize="none" returnKeyType="next"
                      onSubmitEditing={() => confirmPwRef.current?.focus()} blurOnSubmit={false} />
                    <TouchableOpacity onPress={() => setShowNewPw((v) => !v)} style={pw.eyeBtn} hitSlop={8}>
                      <Ionicons name={showNewPw ? "eye-off-outline" : "eye-outline"} size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                  {!!pwErrors.new && <Text style={pw.errorText}>{pwErrors.new}</Text>}
                  {newPassword.length > 0 && (() => {
                    const len = newPassword.length;
                    const hasNum = /\d/.test(newPassword);
                    const hasUpper = /[A-Z]/.test(newPassword);
                    const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
                    const score = (len >= 8 ? 1 : 0) + (hasNum ? 1 : 0) + (hasUpper ? 1 : 0) + (hasSpecial ? 1 : 0);
                    const levels = [{ label: "อ่อน", color: "#ef4444" }, { label: "พอใช้", color: "#f97316" }, { label: "ดี", color: "#eab308" }, { label: "แข็งแกร่ง", color: "#22c55e" }];
                    const lv = levels[Math.min(score, 3)];
                    return (
                      <View style={pw.strengthWrap}>
                        <View style={pw.strengthBars}>
                          {[0,1,2,3].map((i) => <View key={i} style={[pw.strengthBar, i <= score && { backgroundColor: lv.color }]} />)}
                        </View>
                        <Text style={[pw.strengthLabel, { color: lv.color }]}>{lv.label}</Text>
                      </View>
                    );
                  })()}

                  <Text style={[pw.label, pw.labelGap]}>ยืนยันรหัสผ่านใหม่</Text>
                  <View style={[pw.inputRow, !!pwErrors.confirm && pw.inputRowError]}>
                    <Ionicons name="checkmark-circle-outline" size={17}
                      color={confirmPassword && confirmPassword === newPassword ? "#22c55e" : pwErrors.confirm ? "#ef4444" : colors.textDisabled}
                      style={{ marginRight: 8 }} />
                    <TextInput ref={confirmPwRef} style={pw.input} value={confirmPassword}
                      onChangeText={(v) => { setConfirmPassword(v); setPwErrors((p) => ({ ...p, confirm: "" })); }}
                      placeholder="กรอกรหัสผ่านใหม่อีกครั้ง" placeholderTextColor={colors.textDisabled}
                      secureTextEntry={!showConfirmPw} autoCapitalize="none" returnKeyType="done"
                      onSubmitEditing={handleChangePassword} />
                    <TouchableOpacity onPress={() => setShowConfirmPw((v) => !v)} style={pw.eyeBtn} hitSlop={8}>
                      <Ionicons name={showConfirmPw ? "eye-off-outline" : "eye-outline"} size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                  {!!pwErrors.confirm && <Text style={pw.errorText}>{pwErrors.confirm}</Text>}

                  <TouchableOpacity
                    style={[pw.saveBtn, (passwordSaving || !currentPassword || newPassword.length < 6 || !confirmPassword) && pw.saveBtnDisabled]}
                    onPress={handleChangePassword}
                    disabled={passwordSaving || !currentPassword || newPassword.length < 6 || !confirmPassword}
                    activeOpacity={0.85}>
                    {passwordSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={pw.saveText}>บันทึกรหัสผ่าน</Text>}
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
  heroDecor1: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(255,255,255,0.06)", top: -60, right: -40 },
  heroDecor2: { position: "absolute", width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(255,255,255,0.04)", bottom: -20, left: 20 },
  heroAvatar: { width: 68, height: 68, borderRadius: 34, borderWidth: 3, borderColor: "rgba(255,255,255,0.4)", backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center", zIndex: 1 },
  heroAvatarText: { color: "#fff", fontSize: 31, fontWeight: "900" },
  heroName: { fontSize: 21, fontWeight: "800", color: "#fff", zIndex: 1 },
  heroEmail: { fontSize: 17, color: "rgba(255,255,255,0.65)", zIndex: 1 },
  heroBadge: { backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 14, paddingVertical: 3, borderRadius: radius.full, zIndex: 1, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  heroBadgeText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  heroLineBtn: { position: "absolute", right: 16, zIndex: 2, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  heroLineBtnText: { fontSize: 17, fontWeight: "600", color: "rgba(255,255,255,0.9)" },

  tierBar: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderLight, paddingHorizontal: 16, paddingVertical: 12 },
  tierHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tierLabel: { fontSize: 24, color: colors.textMuted, fontWeight: "600", textAlign: "center", marginBottom: 4 },
  tierAmount: { fontSize: 44, fontWeight: "900", color: colors.primary, textAlign: "center", marginBottom: 12 },
  tierTrackRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  tierRateCurrent: { fontSize: 18, fontWeight: "800", color: colors.primary, width: 40 },
  tierRateNext: { fontSize: 18, fontWeight: "700", color: colors.textDisabled, width: 40, textAlign: "right" },
  tierTrack: { flex: 1, height: 10, backgroundColor: colors.bg, borderRadius: 5, overflow: "hidden", borderWidth: 0.5, borderColor: colors.borderLight },
  tierFill: { height: 10, backgroundColor: colors.primary, borderRadius: 5 },
  tierCaption: { fontSize: 15, color: colors.textMuted, textAlign: "center" },

  commSection: { marginHorizontal: 16, marginTop: 12, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 0.5, borderColor: colors.borderLight, padding: 16, ...shadows.card },
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
  commBreakdownBox: { backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  commBreakdownRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  commBreakdownLabel: { fontSize: 16, color: colors.textMuted },
  commBreakdownVal: { fontSize: 16, fontWeight: "600", color: colors.textSecondary },

  bankSection: { marginHorizontal: 16, marginTop: 12, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 0.5, borderColor: colors.borderLight, padding: 16, ...shadows.card },
  bankHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 14 },
  bankTitle: { fontSize: 19, fontWeight: "700", color: colors.textPrimary },
  bankSubtitle: { fontSize: 16, color: colors.textDisabled, marginTop: 2 },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primaryBorder, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5 },
  editBtnText: { fontSize: 17, color: colors.primaryDark, fontWeight: "600" },
  bankRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  bankIconWrap: { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: "#eff6ff", justifyContent: "center", alignItems: "center", marginRight: 12, flexShrink: 0 },
  bankLabel: { fontSize: 16, color: colors.textMuted, fontWeight: "600" },
  bankValue: { fontSize: 19, color: colors.textPrimary, fontWeight: "700", marginTop: 1 },
  bankEmpty: { color: colors.textDisabled, fontWeight: "400" },
  inputLabel: { fontSize: 17, color: colors.textMuted, fontWeight: "600", marginBottom: 5 },
  bankInput: { borderWidth: 1, borderColor: colors.borderLight, borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 10, fontSize: 19, color: colors.textPrimary, backgroundColor: colors.bg },
  cancelBtn: { flex: 1, paddingVertical: 11, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, alignItems: "center" },
  cancelBtnText: { fontSize: 19, color: colors.textSecondary, fontWeight: "600" },
  saveBtn: { flex: 2, paddingVertical: 11, borderRadius: radius.lg, backgroundColor: colors.primary, alignItems: "center" },
  saveBtnText: { fontSize: 19, color: "#fff", fontWeight: "700" },

  slipSection: { marginHorizontal: 16, marginTop: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  sectionTitle: { fontSize: 19, fontWeight: "700", color: colors.textPrimary },
  sectionHint: { fontSize: 16, color: colors.textDisabled },
  emptyBox: { alignItems: "center", paddingVertical: 28, gap: 8 },
  emptyText: { fontSize: 18, color: colors.textDisabled },
  slipList: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 0.5, borderColor: colors.borderLight, overflow: "hidden", ...shadows.card },
  slipRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: colors.bg },
  slipThumb: { width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.primaryLight },
  slipShop: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  slipDate: { fontSize: 15, color: colors.textDisabled },
  slipAmount: { fontSize: 17, fontWeight: "700", color: colors.textPrimary },
  slipBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  slipBadgeText: { fontSize: 14, fontWeight: "600" },
  proxyBadge: { backgroundColor: "#eff6ff", borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 2 },
  proxyBadgeText: { fontSize: 13, color: "#3b82f6", fontWeight: "600" },

  logoutButton: { marginHorizontal: 16, marginTop: 8, backgroundColor: colors.errorBg, borderWidth: 0.5, borderColor: "#fecaca", borderRadius: radius.xl, paddingVertical: 14, alignItems: "center", flexDirection: "row", justifyContent: "center" },
  logoutText: { color: colors.error, fontWeight: "700", fontSize: 20 },
  changePwBtn: { marginHorizontal: 16, marginTop: 12, backgroundColor: "#eff6ff", borderWidth: 0.5, borderColor: "#bfdbfe", borderRadius: radius.xl, paddingVertical: 14, alignItems: "center", flexDirection: "row", justifyContent: "center" },
  changePwBtnText: { color: "#3b82f6", fontWeight: "700", fontSize: 20 },
});

const pw = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, shadowColor: "#000", shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 28 },
  dragHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderLight, alignSelf: "center", marginTop: 10, marginBottom: 4 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  lockIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36 },
  label: { fontSize: 14, fontWeight: "600", color: colors.textMuted, marginBottom: 8 },
  labelGap: { marginTop: 18 },
  inputRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.borderLight, paddingHorizontal: 12, height: 52 },
  inputRowError: { borderColor: "#ef4444", backgroundColor: "#fff5f5" },
  input: { flex: 1, height: 52, fontSize: 16, color: colors.textPrimary },
  eyeBtn: { paddingHorizontal: 4, paddingVertical: 8 },
  errorText: { fontSize: 13, color: "#ef4444", marginTop: 5, marginLeft: 2 },
  strengthWrap: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  strengthBars: { flexDirection: "row", gap: 4, flex: 1 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.borderLight },
  strengthLabel: { fontSize: 12, fontWeight: "600", width: 60, textAlign: "right" },
  saveBtn: { height: 52, borderRadius: radius.lg, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: 28 },
  saveBtnDisabled: { opacity: 0.45 },
  saveText: { fontSize: 17, fontWeight: "700", color: "#fff", letterSpacing: 0.3 },
  cancelBtn: { alignItems: "center", paddingVertical: 14 },
  cancelText: { fontSize: 16, color: colors.textMuted, fontWeight: "500" },
});
