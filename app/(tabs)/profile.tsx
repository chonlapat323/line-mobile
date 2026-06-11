import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { clearToken, getStoredUser } from "@/lib/api";

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<{ fullName: string; email: string; role: string } | null>(null);

  useEffect(() => { getStoredUser().then(setUser); }, []);

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

  if (!user) return null;

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{user.fullName.charAt(0).toUpperCase()}</Text>
      </View>
      <Text style={styles.name}>{user.fullName}</Text>
      <Text style={styles.email}>{user.email}</Text>
      <View style={styles.roleBadge}>
        <Text style={styles.roleText}>{user.role}</Text>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>ออกจากระบบ</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb", alignItems: "center", paddingTop: 60 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#22c55e", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  avatarText: { color: "#fff", fontSize: 32, fontWeight: "700" },
  name: { fontSize: 20, fontWeight: "700", color: "#1f2937", marginBottom: 4 },
  email: { fontSize: 14, color: "#6b7280", marginBottom: 12 },
  roleBadge: { backgroundColor: "#dcfce7", paddingHorizontal: 16, paddingVertical: 5, borderRadius: 20, marginBottom: 40 },
  roleText: { color: "#16a34a", fontWeight: "600", fontSize: 13 },
  logoutButton: { backgroundColor: "#fee2e2", paddingHorizontal: 32, paddingVertical: 13, borderRadius: 12 },
  logoutText: { color: "#dc2626", fontWeight: "700", fontSize: 15 },
});
