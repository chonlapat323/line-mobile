import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, Text } from "react-native";
import { colors } from "@/lib/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textDisabled,
        tabBarStyle: {
          borderTopColor: colors.borderLight,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 4,
          height: 58,
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
                บันทึกการเยี่ยมร้าน
              </Text>
              <Text style={{ fontSize: 11, color: colors.textDisabled }}>
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
          title: "ประวัติการเยี่ยม",
          tabBarLabel: "ประวัติ",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="connect"
        options={{
          title: "เชื่อมต่อ LINE",
          tabBarLabel: "เชื่อม LINE",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="link-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "โปรไฟล์",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
