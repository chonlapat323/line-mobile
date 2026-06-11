import { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator,
} from "react-native";
import { api } from "@/lib/api";

interface User { id: string; fullName: string; email: string; }

export default function ConnectScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState<User | null>(null);
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.getUsers().then(setUsers).catch(console.error); }, []);

  async function generateCode() {
    if (!selected) return;
    setLoading(true);
    try {
      const data = await api.getVerificationCode(selected.id);
      setCode(data);
    } catch {
      Alert.alert("ผิดพลาด", "ไม่สามารถสร้างรหัสได้");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.desc}>สร้างรหัสยืนยัน แล้วพิมพ์ในกลุ่ม LINE ที่มี Bot อยู่</Text>

      <Text style={styles.sectionTitle}>เลือก User</Text>
      <View style={styles.userList}>
        {users.map((u) => (
          <TouchableOpacity key={u.id}
            style={[styles.userItem, selected?.id === u.id && styles.userItemSelected]}
            onPress={() => { setSelected(u); setCode(null); }}>
            <Text style={[styles.userName, selected?.id === u.id && styles.userNameSelected]}>{u.fullName}</Text>
            <Text style={styles.userEmail}>{u.email}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.button, (!selected || loading) && styles.buttonDisabled]}
        onPress={generateCode} disabled={!selected || loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>สร้างรหัสยืนยัน</Text>}
      </TouchableOpacity>

      {code && (
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>รหัสยืนยัน</Text>
          <Text style={styles.code}>{code.code}</Text>
          <Text style={styles.codeExpiry}>หมดอายุ {new Date(code.expiresAt).toLocaleTimeString("th-TH")}</Text>
          <Text style={styles.codeHint}>พิมพ์รหัสนี้ในกลุ่ม LINE ที่ต้องการเชื่อมต่อ</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  desc: { fontSize: 13, color: "#6b7280", marginBottom: 20, lineHeight: 20 },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 8 },
  userList: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, overflow: "hidden", backgroundColor: "#fff", marginBottom: 16 },
  userItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  userItemSelected: { backgroundColor: "#f0fdf4" },
  userName: { fontSize: 14, color: "#374151", fontWeight: "500" },
  userNameSelected: { color: "#16a34a", fontWeight: "700" },
  userEmail: { fontSize: 12, color: "#9ca3af" },
  button: { backgroundColor: "#22c55e", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  codeBox: { marginTop: 20, backgroundColor: "#f0fdf4", borderWidth: 1, borderColor: "#bbf7d0", borderRadius: 16, padding: 24, alignItems: "center" },
  codeLabel: { fontSize: 12, color: "#6b7280", marginBottom: 6 },
  code: { fontSize: 36, fontWeight: "800", color: "#16a34a", letterSpacing: 6, marginBottom: 8 },
  codeExpiry: { fontSize: 12, color: "#9ca3af", marginBottom: 8 },
  codeHint: { fontSize: 13, color: "#4b5563", textAlign: "center" },
});
