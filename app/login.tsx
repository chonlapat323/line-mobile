import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { api, saveToken } from "@/lib/api";
import { colors, radius, shadows } from "@/lib/theme";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);

  async function handleLogin() {
    if (!email || !password) return;
    setLoading(true);
    try {
      const data = await api.login(email, password);
      await saveToken(data.token, data.user);
      router.replace("/(tabs)/record");
    } catch (err: unknown) {
      Alert.alert("เข้าสู่ระบบไม่สำเร็จ", err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoWrap}>
          <Text style={styles.logoText}>B</Text>
        </View>
        <Text style={styles.appName}>BeautyUp Sales</Text>
        <Text style={styles.appSub}>ระบบบันทึกการเยี่ยมร้านค้า</Text>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>อีเมล</Text>
          <TextInput
            style={[styles.input, emailFocused && styles.inputFocused]}
            value={email}
            onChangeText={setEmail}
            placeholder="กรอกอีเมล"
            placeholderTextColor={colors.textDisabled}
            keyboardType="email-address"
            autoCapitalize="none"
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
          />

          <Text style={styles.fieldLabel}>รหัสผ่าน</Text>
          <TextInput
            style={[styles.input, passFocused && styles.inputFocused, { marginBottom: 0 }]}
            value={password}
            onChangeText={setPassword}
            placeholder="กรอกรหัสผ่าน"
            placeholderTextColor={colors.textDisabled}
            secureTextEntry
            onFocus={() => setPassFocused(true)}
            onBlur={() => setPassFocused(false)}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>
              {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primaryLight,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    paddingTop: 60,
    paddingBottom: 48,
  },
  logoWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  logoText: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
  },
  appName: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  appSub: {
    fontSize: 13,
    color: colors.textDisabled,
    marginBottom: 28,
  },
  card: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radius["3xl"],
    padding: 24,
    borderWidth: 0.5,
    borderColor: colors.border,
    ...shadows.card,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: "#f9fafb",
    marginBottom: 16,
  },
  inputFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  button: {
    backgroundColor: colors.primaryDark,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});
