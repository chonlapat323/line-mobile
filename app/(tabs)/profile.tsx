import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { clearToken, getStoredUser, api } from "@/lib/api";
import { colors, radius, shadows } from "@/lib/theme";

interface UserInfo {
  fullName: string;
  email: string;
  role: string;
}

interface Stats {
  total: number;
  newCustomers: number;
  successRate: number;
}

const INFO_ROWS: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  key: keyof UserInfo;
  iconBg: string;
  iconColor: string;
}[] = [
  { icon: "person-outline",    label: "ชื่อ",     key: "fullName", iconBg: colors.primaryLight, iconColor: colors.primaryDark },
  { icon: "mail-outline",      label: "อีเมล",    key: "email",    iconBg: "#eff6ff",            iconColor: "#3b82f6" },
  { icon: "briefcase-outline", label: "ตำแหน่ง", key: "role",     iconBg: "#fefce8",            iconColor: "#ca8a04" },
];

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [stats, setStats] = useState<Stats>({ total: 0, newCustomers: 0, successRate: 0 });

  useEffect(() => {
    getStoredUser().then(setUser);
    api.getHistory().then((logs: { status: string; customerType?: string }[]) => {
      const total = logs.length;
      const success = logs.filter((l) => l.status === "success").length;
      const newC = logs.filter((l) => l.customerType === "new").length;
      setStats({
        total,
        newCustomers: newC,
        successRate: total > 0 ? Math.round((success / total) * 100) : 0,
      });
    }).catch(() => {});
  }, []);

  async function handleLogout() {
    Alert.alert("ออกจากระบบ", "ต้องการออกจากระบบใช่ไหม?", [
      { text: "ยกเลิก", style: "cancel" },
      {
        text: "ออกจากระบบ",
        style: "destructive",
        onPress: async () => {
          await clearToken();
          router.replace("/login");
        },
      },
    ]);
  }

  const { fontScale } = useWindowDimensions();
  const fs = (base: number) => base / fontScale;

  if (!user) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 48 }}>
      {/* Avatar header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.fullName.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={[styles.userName, { fontSize: fs(18) }]}>{user.fullName}</Text>
        <Text style={[styles.userEmail, { fontSize: fs(13) }]}>{user.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>
            {user.role === "admin" ? "แอดมิน" : "เซล"}
          </Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { fontSize: fs(22) }]}>{stats.total}</Text>
          <Text style={[styles.statLabel, { fontSize: fs(11) }]}>เยี่ยมร้าน</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { fontSize: fs(22) }]}>{stats.newCustomers}</Text>
          <Text style={[styles.statLabel, { fontSize: fs(11) }]}>ลูกค้าใหม่</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { fontSize: fs(22) }]}>{stats.successRate}%</Text>
          <Text style={[styles.statLabel, { fontSize: fs(11) }]}>สำเร็จ</Text>
        </View>
      </View>

      {/* Info section */}
      <View style={styles.infoSection}>
        {INFO_ROWS.map((row, i) => (
          <View
            key={row.key}
            style={[styles.infoRow, i === INFO_ROWS.length - 1 && { borderBottomWidth: 0 }]}
          >
            <View style={styles.infoRowLeft}>
              <View style={[styles.infoIcon, { backgroundColor: row.iconBg }]}>
                <Ionicons name={row.icon} size={16} color={row.iconColor} />
              </View>
              <Text style={styles.infoLabel}>{row.label}</Text>
            </View>
            <Text style={styles.infoValue} numberOfLines={1}>
              {row.key === "role"
                ? user.role === "admin" ? "แอดมิน" : "เซล"
                : user[row.key]}
            </Text>
          </View>
        ))}
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.85}>
        <Ionicons name="log-out-outline" size={18} color={colors.error} style={{ marginRight: 8 }} />
        <Text style={styles.logoutText}>ออกจากระบบ</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: {
    backgroundColor: colors.surface,
    paddingTop: 36,
    paddingBottom: 24,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.borderLight,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.primary,
    justifyContent: "center", alignItems: "center",
    marginBottom: 6,
  },
  avatarText: { color: "#fff", fontSize: 28, fontWeight: "700" },
  userName: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  userEmail: { fontSize: 13, color: colors.textDisabled },
  roleBadge: {
    backgroundColor: colors.successBg,
    paddingHorizontal: 14, paddingVertical: 4,
    borderRadius: radius.full, marginTop: 2,
  },
  roleText: { color: colors.primaryDark, fontWeight: "600", fontSize: 12 },

  statsRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 14,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.borderLight,
    borderRadius: radius.lg,
    padding: 12,
    alignItems: "center",
    ...shadows.card,
  },
  statNum: { fontSize: 22, fontWeight: "700", color: colors.textPrimary, marginBottom: 2 },
  statLabel: { fontSize: 11, color: colors.textDisabled },

  infoSection: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    borderColor: colors.borderLight,
    overflow: "hidden",
    ...shadows.card,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.bg,
  },
  infoRowLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoIcon: {
    width: 32, height: 32,
    borderRadius: radius.sm,
    justifyContent: "center", alignItems: "center",
  },
  infoLabel: { fontSize: 14, color: colors.textSecondary, fontWeight: "500" },
  infoValue: { fontSize: 13, color: colors.textDisabled, maxWidth: 160 },

  logoutButton: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: colors.errorBg,
    borderWidth: 0.5,
    borderColor: "#fecaca",
    borderRadius: radius.xl,
    paddingVertical: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  logoutText: { color: colors.error, fontWeight: "700", fontSize: 15 },
});
