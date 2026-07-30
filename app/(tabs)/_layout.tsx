import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, Text, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/lib/theme";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textDisabled,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600", marginTop: -2 },
        tabBarIconStyle: { marginBottom: -2 },
        tabBarStyle: {
          borderTopColor: colors.borderLight,
          borderTopWidth: 1,
          paddingBottom: insets.bottom || 6,
          paddingTop: 6,
          height: 62 + (insets.bottom || 0),
        },
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: {
          color: colors.textPrimary,
          fontWeight: "700",
          fontSize: 17,
        },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="record"
        options={{
          tabBarLabel: "บันทึก",
          headerTitle: () => (
            <View style={{ gap: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.textPrimary }}>
                ระบบบันทึกการออกทริป
              </Text>
              <Text style={{ fontSize: 13, color: colors.textDisabled }}>
                กรอกข้อมูลให้ครบก่อนส่ง
              </Text>
            </View>
          ),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="clipboard-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "ประวัติบันทึก",
          tabBarLabel: "ประวัติ",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="slip"
        options={{
          title: "ส่งสลิป",
          tabBarLabel: "ส่งสลิป",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="slip-history"
        options={{
          title: "ประวัติสลิป",
          tabBarLabel: "ประวัติสลิป",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="connect"
        options={{
          title: "เชื่อมต่อ LINE",
          href: null,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
              <Ionicons name="chevron-back" size={24} color={colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
