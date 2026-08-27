import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Animated, Modal, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAuthStore } from "@/lib/useAuthStore";
import { api } from "@/lib/api";
import { colors, radius } from "@/lib/theme";

function AppLoadingScreen() {
  const scale = new Animated.Value(0.85);
  const opacity = new Animated.Value(0);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
      Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={st.screen}>
      <Animated.View style={[st.logoWrap, { transform: [{ scale }], opacity }]}>
        <View style={st.logo}>
          <Text style={st.logoText}>B</Text>
        </View>
        <Text style={st.appName}>BeautyUp</Text>
        <Text style={st.appSub}>Sales Management</Text>
      </Animated.View>
      <View style={st.dotsRow}>
        {[0, 1, 2].map((i) => (
          <PulsingDot key={i} delay={i * 160} />
        ))}
      </View>
    </View>
  );
}

function PulsingDot({ delay }: { delay: number }) {
  const opacity = new Animated.Value(0.25);

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.25, duration: 400, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return <Animated.View style={[st.dot, { opacity }]} />;
}

function ForceChangePasswordModal({ visible }: { visible: boolean }) {
  const updateUser = useAuthStore((s) => s.updateUser);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleChange() {
    if (newPw.length < 6) { setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"); return; }
    if (newPw !== confirmPw) { setError("รหัสผ่านไม่ตรงกัน"); return; }
    setSaving(true);
    setError("");
    try {
      await api.forceChangePassword(newPw);
      updateUser({ mustChangePassword: false });
      setNewPw(""); setConfirmPw("");
    } catch (err: any) {
      setError(err?.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally { setSaving(false); }
  }

  return (
    <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={() => {}}>
      <KeyboardAvoidingView style={fp.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={fp.card}>
          <View style={fp.lockCircle}>
            <Text style={fp.lockIcon}>🔒</Text>
          </View>
          <Text style={fp.title}>ตั้งรหัสผ่านใหม่</Text>
          <Text style={fp.subtitle}>กรุณาตั้งรหัสผ่านก่อนเริ่มใช้งาน</Text>
          <Text style={fp.note}>รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร</Text>

          <View style={{ width: "100%", gap: 12, marginTop: 8 }}>
            <TextInput
              style={fp.input}
              placeholder="รหัสผ่านใหม่"
              placeholderTextColor="#9ca3af"
              secureTextEntry
              value={newPw}
              onChangeText={(t) => { setNewPw(t); setError(""); }}
            />
            <TextInput
              style={fp.input}
              placeholder="ยืนยันรหัสผ่าน"
              placeholderTextColor="#9ca3af"
              secureTextEntry
              value={confirmPw}
              onChangeText={(t) => { setConfirmPw(t); setError(""); }}
            />
          </View>

          {!!error && <Text style={fp.error}>{error}</Text>}

          <TouchableOpacity style={[fp.btn, saving && { opacity: 0.6 }]} onPress={handleChange} disabled={saving}>
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={fp.btnText}>ยืนยัน</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const mustChangePassword = useAuthStore((s) => s.user?.mustChangePassword ?? false);
  const _hasHydrated = useAuthStore((s) => (s as any)._hasHydrated);

  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      setReady(true);
    });
    if (useAuthStore.persist.hasHydrated()) {
      setReady(true);
    } else {
      // fallback: iOS บางกรณี onFinishHydration ไม่ถูก fire
      const t = setTimeout(() => setReady(true), 3000);
      return () => { unsub(); clearTimeout(t); };
    }
    return unsub;
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) router.replace("/login");
  }, [ready, isAuthenticated]);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {!ready && <AppLoadingScreen />}
      <View style={!ready ? { opacity: 0, flex: 1 } : { flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack>
      </View>
      <ForceChangePasswordModal visible={isAuthenticated && mustChangePassword} />
    </SafeAreaProvider>
  );
}

const fp = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", padding: 24 },
  card: { backgroundColor: "#fff", borderRadius: radius["2xl"], padding: 28, width: "100%", alignItems: "center", gap: 8, elevation: 6, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } },
  lockCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  lockIcon: { fontSize: 34 },
  title: { fontSize: 22, fontWeight: "800", color: colors.textPrimary },
  subtitle: { fontSize: 16, color: colors.textSecondary, textAlign: "center" },
  note: { fontSize: 14, color: colors.textDisabled, marginBottom: 4 },
  input: { width: "100%", borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18, color: colors.textPrimary, backgroundColor: "#f9fafb" },
  error: { color: "#dc2626", fontSize: 14, textAlign: "center", marginTop: 4 },
  btn: { backgroundColor: colors.primaryDark, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center", width: "100%", marginTop: 8 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 18 },
});

const st = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
    gap: 48,
  },
  logoWrap: { alignItems: "center", gap: 12 },
  logo: {
    width: 76, height: 76, borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
    shadowColor: colors.primary,
    shadowOpacity: 0.4, shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  logoText: { fontSize: 37, fontWeight: "900", color: "#fff" },
  appName: { fontSize: 27, fontWeight: "900", color: colors.textPrimary, letterSpacing: -0.5 },
  appSub: { fontSize: 18, color: colors.textDisabled, fontWeight: "500" },
  dotsRow: { flexDirection: "row", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
});
