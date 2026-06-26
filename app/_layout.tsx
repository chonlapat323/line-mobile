import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { getStoredUser } from "@/lib/api";
import { colors } from "@/lib/theme";

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

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function init() {
      try {
        const user = await getStoredUser();
        if (!user) {
          router.replace("/login");
        }
      } catch {
        router.replace("/login");
      } finally {
        setReady(true);
      }
    }
    init();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {!ready && <AppLoadingScreen />}
      <Stack screenOptions={{ headerShown: false }} style={!ready ? { opacity: 0 } : undefined}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}

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
  logoText: { fontSize: 34, fontWeight: "900", color: "#fff" },
  appName: { fontSize: 24, fontWeight: "900", color: colors.textPrimary, letterSpacing: -0.5 },
  appSub: { fontSize: 13, color: colors.textDisabled, fontWeight: "500" },
  dotsRow: { flexDirection: "row", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
});
