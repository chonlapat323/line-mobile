import { useState, useEffect, useMemo, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView,
  useWindowDimensions, Modal, FlatList, Image, RefreshControl,
  NativeSyntheticEvent, NativeScrollEvent, TextInput, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { clearToken, getStoredUser, api } from "@/lib/api";
import { colors, radius, shadows } from "@/lib/theme";

// ── Types ─────────────────────────────────────────────────────
interface UserInfo { fullName: string; email: string; role: string; bankName?: string; bankAccount?: string }

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
  details?: string; imageUrls: string[]; createdAt: string;
  user?: { fullName: string; email: string };
}
// ── Helpers ───────────────────────────────────────────────────
const RESULT_LABEL: Record<string, string> = { buy: "ซื้อ", no_buy: "ไม่ซื้อ", not_found: "ไม่พบ" };
const SLOT_LABELS = ["หน้าร้าน 1", "หน้าร้าน 2", "ภายในร้าน 1", "ภายในร้าน 2", "หน้าจอ Line", "X-ray"];

function getResultStyle(key: string) {
  if (key === "buy") return { bg: colors.successBg, text: colors.primaryDark };
  if (key === "no_buy") return { bg: colors.errorBg, text: colors.error };
  return { bg: colors.infoBg, text: colors.infoText };
}

// ── Visit Detail Modal ────────────────────────────────────────
function VisitDetailModal({ record, onClose }: { record: VisitRecord; onClose: () => void }) {
  const { width } = useWindowDimensions();
  const [imgIndex, setImgIndex] = useState(0);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setImgIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };
  const resKey = record.result || "";
  const rs = getResultStyle(resKey);
  const locationLabel = record.district ? `${record.province} · ${record.district}` : record.province;

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
          {record.imageUrls.length > 0 && (
            <View>
              <FlatList
                data={record.imageUrls}
                keyExtractor={(_, i) => String(i)}
                horizontal pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={onScroll} scrollEventThrottle={16}
                renderItem={({ item }) => (
                  <Image source={{ uri: item }} style={[det.galleryImg, { width }]} resizeMode="cover" />
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
          )}
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={det.body}>
              {resKey ? (
                <View style={[det.resultBadge, { backgroundColor: rs.bg }]}>
                  <Text style={[det.resultBadgeText, { color: rs.text }]}>
                    ผลตอบรับ: {RESULT_LABEL[resKey]}
                  </Text>
                </View>
              ) : null}
              {[
                { icon: "swap-horizontal-outline" as const, label: "ทริป", value: record.tripType === "plan" ? "ตามแผน" : record.tripType === "off_plan" ? "นอกแผน" : "-" },
                { icon: "people-outline" as const, label: "ลูกค้า", value: record.customerType === "new" ? "ลูกค้าใหม่" : "ลูกค้าเก่า" },
                { icon: "checkmark-circle-outline" as const, label: "ภารกิจ", value: record.visitType === "tak" ? "ทัก" : record.visitType === "dem" ? "เดม" : "-" },
                { icon: "calendar-outline" as const, label: "วันที่", value: new Date(record.createdAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) },
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
  const { fontScale } = useWindowDimensions();
  const fs = (base: number) => base / fontScale;

  // ── State ────────────────────────────────────────────────────
  const [user, setUser] = useState<UserInfo | null>(null);
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Commission
  const [commMonth, setCommMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [commData, setCommData] = useState<{
    visitCount: number; totalAmount: number; pendingAmount: number;
    confirmedCount: number; pendingCount: number;
    reachedThreshold: boolean;
    commission: number; remaining: number; settings: { rate: number; threshold: number };
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

  const scrollRef = useRef<ScrollView>(null);

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
      const merged = { ...u, bankName: me?.bankName ?? "", bankAccount: me?.bankAccount ?? "" };
      setUser(merged);
      setBankName(me?.bankName ?? "");
      setBankAccount(me?.bankAccount ?? "");
      setVisits(data?.data ?? data ?? []);
    } catch {}
    finally { setRefreshing(false); }
    if (isRefresh) loadCommission(commMonth);
  }

  async function handleSaveBank() {
    setBankSaving(true);
    try {
      await api.updateMe({ bankName: bankName.trim(), bankAccount: bankAccount.trim() });
      setUser((u) => u ? { ...u, bankName: bankName.trim(), bankAccount: bankAccount.trim() } : u);
      setEditingBank(false);
    } catch {
      Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถบันทึกได้ กรุณาลองใหม่");
    } finally { setBankSaving(false); }
  }

  async function loadCommission(month: string) {
    setCommLoading(true);
    api.getMyCommission(month)
      .then(setCommData)
      .catch(() => {})
      .finally(() => setCommLoading(false));
  }

  useEffect(() => { loadData(); }, []);
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

  async function handleLogout() {
    Alert.alert("ออกจากระบบ", "ต้องการออกจากระบบใช่ไหม?", [
      { text: "ยกเลิก", style: "cancel" },
      { text: "ออกจากระบบ", style: "destructive", onPress: async () => { await clearToken(); router.replace("/login"); } },
    ]);
  }

  if (!user) return null;

  return (
    <>
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={colors.primary} />}
      >
        {/* Avatar header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.fullName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={[styles.userName, { fontSize: fs(18) }]}>{user.fullName}</Text>
          <Text style={[styles.userEmail, { fontSize: fs(13) }]}>{user.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{user.role === "admin" ? "แอดมิน" : "เซล"}</Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { fontSize: fs(22) }]}>{stats.total}</Text>
            <Text style={[styles.statLabel, { fontSize: fs(11) }]}>เยี่ยมร้าน</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { fontSize: fs(22) }]}>{stats.bought}</Text>
            <Text style={[styles.statLabel, { fontSize: fs(11) }]}>ซื้อสินค้า</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { fontSize: fs(22) }]}>{stats.provinces}</Text>
            <Text style={[styles.statLabel, { fontSize: fs(11) }]}>จังหวัด</Text>
          </View>
        </View>

        {/* Province list */}
        <View style={styles.mapSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>สรุปการเยี่ยมตามจังหวัด</Text>
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
                          {buy > 0 && <View style={[styles.pChip, { backgroundColor: "#dcfce7" }]}><Text style={[styles.pChipTxt, { color: "#166534" }]}>ซื้อ {buy}</Text></View>}
                          {noBuy > 0 && <View style={[styles.pChip, { backgroundColor: "#fee2e2" }]}><Text style={[styles.pChipTxt, { color: "#dc2626" }]}>ไม่ซื้อ {noBuy}</Text></View>}
                          {notFound > 0 && <View style={[styles.pChip, { backgroundColor: "#dbeafe" }]}><Text style={[styles.pChipTxt, { color: "#1d4ed8" }]}>ไม่พบ {notFound}</Text></View>}
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={14} color={colors.textDisabled} style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                  );
                })}
            </View>
          )}

          {/* Top province chips */}
          {topProvinces.length > 0 && (
            <View style={styles.chipsRow}>
              {topProvinces.map(([name, count]) => (
                <TouchableOpacity
                  key={name}
                  style={styles.chip}
                  onPress={() => openProvince(name)}
                  activeOpacity={0.75}
                >
                  <Ionicons name="location" size={11} color={colors.primaryDark} />
                  <Text style={styles.chipText}>{name}</Text>
                  <View style={styles.chipBadge}>
                    <Text style={styles.chipBadgeText}>{count}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Info section */}
        <View style={styles.infoSection}>
          {INFO_ROWS.map((row, i) => (
            <View key={row.key} style={[styles.infoRow, i === INFO_ROWS.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={styles.infoRowLeft}>
                <View style={[styles.infoIcon, { backgroundColor: row.iconBg }]}>
                  <Ionicons name={row.icon} size={16} color={row.iconColor} />
                </View>
                <Text style={styles.infoLabel}>{row.label}</Text>
              </View>
              <Text style={styles.infoValue} numberOfLines={1}>
                {row.key === "role" ? (user.role === "admin" ? "แอดมิน" : "เซล") : user[row.key]}
              </Text>
            </View>
          ))}
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
                  <Text style={styles.commStatLabel}>ยอดขายรวม</Text>
                </View>
                <View style={styles.commStat}>
                  <Text style={[styles.commStatNum, { color: commData.commission > 0 ? colors.primary : colors.textDisabled }]}>
                    ฿{commData.commission.toLocaleString("th-TH")}
                  </Text>
                  <Text style={styles.commStatLabel}>ค่าคอม</Text>
                </View>
              </View>

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
                    <Text style={[styles.commResultLabel, { color: colors.primaryDark }]}>ค่าคอมที่ได้รับ ({commData.settings.rate}%)</Text>
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
            </View>
          ) : (
            <Text style={{ color: colors.textDisabled, fontSize: 13, textAlign: "center", marginVertical: 12 }}>
              ไม่มีข้อมูล
            </Text>
          )}
        </View>

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
            <View style={{ gap: 10 }}>
              <View style={styles.bankRow}>
                <Text style={styles.bankLabel}>ธนาคาร</Text>
                <Text style={[styles.bankValue, !user?.bankName && styles.bankEmpty]}>
                  {user?.bankName || "ยังไม่ระบุ"}
                </Text>
              </View>
              <View style={styles.bankRow}>
                <Text style={styles.bankLabel}>เลขบัญชี</Text>
                <Text style={[styles.bankValue, !user?.bankAccount && styles.bankEmpty]}>
                  {user?.bankAccount || "ยังไม่ระบุ"}
                </Text>
              </View>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <View>
                <Text style={styles.inputLabel}>ธนาคาร</Text>
                <TouchableOpacity onPress={() => setBankPickerVisible(true)} style={[styles.bankInput, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
                  <Text style={{ fontSize: 14, color: bankName ? colors.text : colors.textDisabled }}>
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
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>เลือกธนาคาร</Text>
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
                <Text style={{ fontSize: 15, color: colors.text }}>{item}</Text>
                {bankName === item && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: {
    backgroundColor: colors.surface, paddingTop: 36, paddingBottom: 24,
    paddingHorizontal: 16, alignItems: "center", gap: 6,
    borderBottomWidth: 0.5, borderBottomColor: colors.borderLight,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary,
    justifyContent: "center", alignItems: "center", marginBottom: 6,
  },
  avatarText: { color: "#fff", fontSize: 28, fontWeight: "700" },
  userName: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  userEmail: { fontSize: 13, color: colors.textDisabled },
  roleBadge: { backgroundColor: colors.successBg, paddingHorizontal: 14, paddingVertical: 4, borderRadius: radius.full, marginTop: 2 },
  roleText: { color: colors.primaryDark, fontWeight: "600", fontSize: 12 },

  statsRow: { flexDirection: "row", marginHorizontal: 16, marginTop: 14, gap: 10 },
  statCard: {
    flex: 1, backgroundColor: colors.surface, borderWidth: 0.5,
    borderColor: colors.borderLight, borderRadius: radius.lg,
    padding: 12, alignItems: "center", ...shadows.card,
  },
  statNum: { fontSize: 22, fontWeight: "700", color: colors.textPrimary, marginBottom: 2 },
  statLabel: { fontSize: 11, color: colors.textDisabled },

  mapSection: { marginHorizontal: 16, marginTop: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  sectionHint: { fontSize: 11, color: colors.textDisabled },

  emptyProvince: { alignItems: "center", paddingVertical: 24, gap: 8 },
  emptyProvinceText: { fontSize: 13, color: colors.textDisabled },

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
  provinceRowName: { fontSize: 13, fontWeight: "700", color: colors.textPrimary },
  provinceRowCount: { fontSize: 12, color: colors.textMuted },
  provinceBar: { height: 6, backgroundColor: colors.bg, borderRadius: 3, overflow: "hidden", marginBottom: 6 },
  provinceBarFill: { height: 6, backgroundColor: colors.primary, borderRadius: 3 },
  provinceChips: { flexDirection: "row", gap: 5 },
  pChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  pChipTxt: { fontSize: 11, fontWeight: "600" },

  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.primaryLight, borderWidth: 1,
    borderColor: colors.primaryBorder, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  chipText: { fontSize: 12, color: colors.primaryDark, fontWeight: "600" },
  chipBadge: {
    backgroundColor: colors.primary, borderRadius: radius.full,
    paddingHorizontal: 5, paddingVertical: 1, minWidth: 18, alignItems: "center",
  },
  chipBadgeText: { fontSize: 10, color: "#fff", fontWeight: "700" },

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
  infoLabel: { fontSize: 14, color: colors.textSecondary, fontWeight: "500" },
  infoValue: { fontSize: 13, color: colors.textDisabled, maxWidth: 160 },

  commSection: {
    marginHorizontal: 16, marginTop: 12, backgroundColor: colors.surface,
    borderRadius: radius.xl, borderWidth: 0.5, borderColor: colors.borderLight,
    padding: 16, ...shadows.card,
  },
  commMonthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  monthNavBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bg, borderWidth: 0.5, borderColor: colors.borderLight, alignItems: "center", justifyContent: "center" },
  commMonthText: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  commStatsRow: { flexDirection: "row", borderWidth: 0.5, borderColor: colors.borderLight, borderRadius: radius.lg, overflow: "hidden" },
  commStat: { flex: 1, paddingVertical: 12, alignItems: "center" },
  commStatNum: { fontSize: 15, fontWeight: "700", color: colors.textPrimary, marginBottom: 2 },
  commStatLabel: { fontSize: 11, color: colors.textDisabled },
  commStatusRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  commStatusChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#f0fdf4", borderWidth: 1, borderColor: "#bbf7d0", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  commStatusChipPending: { backgroundColor: "#fffbeb", borderColor: "#fde68a" },
  commStatusDot: { fontSize: 11, color: colors.primary },
  commStatusText: { fontSize: 12, color: "#166534", fontWeight: "600" },
  commProgressHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  commProgressLabel: { fontSize: 12, color: colors.textMuted },
  commProgressTrack: { height: 8, backgroundColor: colors.bg, borderRadius: 4, overflow: "hidden", borderWidth: 0.5, borderColor: colors.borderLight },
  commProgressFill: { height: "100%", borderRadius: 4 },
  commResult: { borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  commResultLabel: { fontSize: 13, fontWeight: "600", flex: 1 },
  commResultAmount: { fontSize: 18, fontWeight: "800" },

  bankSection: {
    marginHorizontal: 16, marginTop: 12, backgroundColor: colors.surface,
    borderRadius: radius.xl, borderWidth: 0.5, borderColor: colors.borderLight,
    padding: 16, ...shadows.card,
  },
  bankHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 14 },
  bankTitle: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  bankSubtitle: { fontSize: 11, color: colors.textDisabled, marginTop: 2 },
  editBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primaryBorder,
    borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5,
  },
  editBtnText: { fontSize: 12, color: colors.primaryDark, fontWeight: "600" },
  bankRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bankLabel: { fontSize: 13, color: colors.textMuted },
  bankValue: { fontSize: 13, color: colors.textPrimary, fontWeight: "600" },
  bankEmpty: { color: colors.textDisabled, fontWeight: "400" },
  inputLabel: { fontSize: 12, color: colors.textMuted, fontWeight: "600", marginBottom: 5 },
  bankInput: {
    borderWidth: 1, borderColor: colors.borderLight, borderRadius: radius.lg,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    color: colors.textPrimary, backgroundColor: colors.bg,
  },
  cancelBtn: {
    flex: 1, paddingVertical: 11, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderLight, alignItems: "center",
  },
  cancelBtnText: { fontSize: 14, color: colors.textSecondary, fontWeight: "600" },
  saveBtn: {
    flex: 2, paddingVertical: 11, borderRadius: radius.lg,
    backgroundColor: colors.primary, alignItems: "center",
  },
  saveBtnText: { fontSize: 14, color: "#fff", fontWeight: "700" },

  logoutButton: {
    marginHorizontal: 16, marginTop: 12, backgroundColor: colors.errorBg,
    borderWidth: 0.5, borderColor: "#fecaca", borderRadius: radius.xl,
    paddingVertical: 14, alignItems: "center", flexDirection: "row", justifyContent: "center",
  },
  logoutText: { color: colors.error, fontWeight: "700", fontSize: 15 },

});

const det = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "92%", overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderLight, gap: 12 },
  shopName: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  byUser: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderLight, alignItems: "center", justifyContent: "center" },
  galleryImg: { height: 240 },
  galleryMeta: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, alignItems: "center", gap: 6 },
  slotLabel: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
  dots: { flexDirection: "row", gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.borderLight },
  dotActive: { backgroundColor: colors.primary, width: 14 },
  body: { padding: 18 },
  resultBadge: { borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 6, alignSelf: "flex-start", marginBottom: 16 },
  resultBadgeText: { fontSize: 13, fontWeight: "700" },
  infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  infoIcon: { marginRight: 10 },
  infoLabel: { fontSize: 13, color: colors.textMuted, width: 70 },
  infoValue: { flex: 1, fontSize: 13, color: colors.textPrimary, fontWeight: "500" },
  noteBox: { marginTop: 16, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: colors.borderLight },
  noteLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "600", marginBottom: 6 },
  noteText: { fontSize: 13, color: colors.textPrimary, lineHeight: 20 },
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
  title: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  count: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderLight, alignItems: "center", justifyContent: "center" },
  card: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surface, borderRadius: radius.xl, padding: 12, marginBottom: 8, borderWidth: 0.5, borderColor: colors.borderLight, ...shadows.card },
  thumb: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.primaryLight },
  cardInfo: { flex: 1, minWidth: 0 },
  shopName: { fontSize: 13, fontWeight: "700", color: colors.textPrimary, marginBottom: 2 },
  cardDate: { fontSize: 11, color: colors.textDisabled },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  badgeText: { fontSize: 11, fontWeight: "600" },
});
