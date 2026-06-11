import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { api, saveToken } from "@/lib/api";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@beautyup.com");
  const [password, setPassword] = useState("admin1234");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) return;
    setLoading(true);
    try {
      const data = await api.login(email, password);
      await saveToken(data.token, data.user);
      router.replace("/(tabs)");
    } catch (err: unknown) {
      Alert.alert("เข้าสู่ระบบไม่สำเร็จ", err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>BeautyUp LINE</Text>
        <Text style={styles.subtitle}>ระบบส่งรูปเข้า LINE Group</Text>

        <TextInput style={styles.input} placeholder="อีเมล" value={email}
          onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <TextInput style={styles.input} placeholder="รหัสผ่าน" value={password}
          onChangeText={setPassword} secureTextEntry />

        <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb", justifyContent: "center", alignItems: "center" },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 32, width: "85%", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  title: { fontSize: 24, fontWeight: "bold", textAlign: "center", color: "#1f2937", marginBottom: 4 },
  subtitle: { fontSize: 13, color: "#9ca3af", textAlign: "center", marginBottom: 24 },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, marginBottom: 12, color: "#111827" },
  button: { backgroundColor: "#22c55e", borderRadius: 10, paddingVertical: 13, alignItems: "center", marginTop: 4 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
