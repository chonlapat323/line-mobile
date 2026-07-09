import { useState, useCallback } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "@/lib/api";
import { colors, radius, shadows } from "@/lib/theme";

export function OutstandingDebtCard() {
  const [debt, setDebt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      api.getMyOutstandingDebt()
        .then((res) => setDebt(res?.outstandingDebt ?? 0))
        .catch(() => setDebt(null))
        .finally(() => setLoading(false));
    }, [])
  );

  if (loading) {
    return (
      <View style={[styles.card, styles.cardLoading]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (debt === null) return null;

  const hasDebt = debt > 0;

  return (
    <View style={[styles.card, hasDebt ? styles.cardDebt : styles.cardClear]}>
      <View style={[styles.iconWrap, hasDebt ? styles.iconDebt : styles.iconClear]}>
        <Ionicons
          name={hasDebt ? "alert-circle-outline" : "checkmark-circle-outline"}
          size={22}
          color={hasDebt ? "#d97706" : colors.primaryDark}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, hasDebt ? styles.labelDebt : styles.labelClear]}>ยอดค้าง</Text>
        <Text style={[styles.amount, hasDebt ? styles.amountDebt : styles.amountClear]}>
          {hasDebt
            ? `฿${debt.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`
            : "ไม่มียอดค้าง"}
        </Text>
      </View>
      {hasDebt && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>ค้างอยู่</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    ...shadows.card,
  },
  cardLoading: {
    backgroundColor: colors.surface,
    borderColor: colors.borderLight,
    justifyContent: "center",
    height: 60,
  },
  cardDebt: {
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
  },
  cardClear: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryBorder,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  iconDebt: { backgroundColor: "#fef3c7" },
  iconClear: { backgroundColor: "#dcfce7" },
  label: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 2,
  },
  labelDebt: { color: "#92400e" },
  labelClear: { color: colors.primaryDark },
  amount: {
    fontSize: 18,
    fontWeight: "800",
  },
  amountDebt: { color: "#d97706" },
  amountClear: { color: colors.primary },
  badge: {
    backgroundColor: "#fde68a",
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#92400e",
  },
});
