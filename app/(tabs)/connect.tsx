import { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Clipboard, Linking,
} from "react-native";
import { api, getStoredUser } from "@/lib/api";

export default function ConnectScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [lineBotId, setLineBotId] = useState<string | null>(null);

  useEffect(() => {
    getStoredUser().then((u) => { if (u) setUserId(u.id); });
    api.getSettings().then((s: { lineBotId: string | null }) => {
      if (s.lineBotId) setLineBotId(s.lineBotId);
    }).catch(console.error);
  }, []);

  async function generateCode() {
    if (!userId) return;
    setLoading(true);
    setCode(null);
    try {
      const data = await api.getVerificationCode(userId);
      setCode(data);
    } catch {
      Alert.alert("ผิดพลาด", "ไม่สามารถสร้างรหัสได้");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 24 }}>
      <Text style={styles.title}>เชื่อมต่อ LINE Group</Text>
      <Text style={styles.desc}>
        1. กด "สร้างรหัส" ด้านล่าง{"\n"}
        2. เปิดกลุ่ม LINE ที่มี Bot อยู่{"\n"}
        3. พิมพ์รหัสในกลุ่ม LINE
      </Text>

      {lineBotId && (
        <TouchableOpacity
          style={styles.addBotButton}
          onPress={() => Linking.openURL(`https://line.me/R/ti/p/${lineBotId}`)}
        >
          <Text style={styles.addBotText}>➕ เพิ่ม Bot เป็นเพื่อนใน LINE</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={generateCode}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>สร้างรหัสยืนยัน</Text>
        }
      </TouchableOpacity>

      {code && (
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>รหัสยืนยัน</Text>
          <TouchableOpacity onPress={() => { Clipboard.setString(code.code); Alert.alert("คัดลอกแล้ว", `รหัส ${code.code}`); }}>
            <Text style={styles.code}>{code.code}</Text>
          </TouchableOpacity>
          <Text style={styles.codeExpiry}>
            หมดอายุ {new Date(code.expiresAt).toLocaleTimeString("th-TH")}
          </Text>
          <TouchableOpacity
            style={styles.copyButton}
            onPress={() => {
              Clipboard.setString(code.code);
              Alert.alert("คัดลอกแล้ว", `รหัส ${code.code} ถูกคัดลอกแล้ว`);
            }}
          >
            <Text style={styles.copyButtonText}>📋 คัดลอกรหัส</Text>
          </TouchableOpacity>
          <Text style={styles.codeHint}>พิมพ์หรือวางรหัสนี้ในกลุ่ม LINE</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  title: { fontSize: 20, fontWeight: "700", color: "#1f2937", marginBottom: 12 },
  desc: { fontSize: 14, color: "#6b7280", lineHeight: 24, marginBottom: 24 },
  addBotButton: { backgroundColor: "#06c755", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 12 },
  addBotText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  button: { backgroundColor: "#22c55e", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  codeBox: { marginTop: 24, backgroundColor: "#f0fdf4", borderWidth: 1, borderColor: "#bbf7d0", borderRadius: 16, padding: 28, alignItems: "center" },
  codeLabel: { fontSize: 12, color: "#6b7280", marginBottom: 8 },
  code: { fontSize: 40, fontWeight: "800", color: "#16a34a", letterSpacing: 8, marginBottom: 10 },
  codeExpiry: { fontSize: 12, color: "#9ca3af", marginBottom: 8 },
  copyButton: { backgroundColor: "#22c55e", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 24, marginTop: 12, marginBottom: 8 },
  copyButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  codeHint: { fontSize: 13, color: "#4b5563", textAlign: "center", lineHeight: 20 },
});
