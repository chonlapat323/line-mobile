import { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Clipboard, Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api, getStoredUser } from "@/lib/api";
import { colors, radius } from "@/lib/theme";
import { AppAlert, AlertButton } from "@/lib/AppModal";
import { SkeletonBox } from "@/lib/Skeleton";

const STEPS = [
  { num: "1", text: 'กด "เพิ่ม Bot" แล้วเพิ่ม Bot เป็นเพื่อนใน LINE ก่อน' },
  { num: "2", text: 'กด "สร้างรหัส" เพื่อรับรหัสยืนยัน' },
  { num: "3", text: "เปิดกลุ่ม LINE แล้วพิมพ์หรือวางรหัสในกลุ่ม" },
];

export default function ConnectScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [lineBotId, setLineBotId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [appAlert, setAppAlert] = useState<{ visible: boolean; type: "error" | "success" | "info"; title: string; message: string; buttons: AlertButton[] }>({ visible: false, type: "info", title: "", message: "", buttons: [] });

  function showAlert(type: "error" | "success" | "info", title: string, message = "") {
    setAppAlert({ visible: true, type, title, message, buttons: [{ text: "ตกลง", onPress: () => setAppAlert((p) => ({ ...p, visible: false })) }] });
  }

  useEffect(() => {
    Promise.all([
      getStoredUser().then((u) => { if (u) setUserId(u.id); }),
      api.getSettings().then((s: { lineBotId: string | null }) => {
        if (s.lineBotId) setLineBotId(s.lineBotId);
      }).catch(console.error),
    ]).finally(() => setInitializing(false));
  }, []);

  async function generateCode() {
    if (!userId) return;
    setLoading(true);
    setCode(null);
    try {
      const data = await api.getVerificationCode(userId);
      setCode(data);
    } catch {
      showAlert("error", "ผิดพลาด", "ไม่สามารถสร้างรหัสได้");
    } finally {
      setLoading(false);
    }
  }

  function copyCode() {
    if (!code) return;
    Clipboard.setString(code.code);
    showAlert("success", "คัดลอกแล้ว", `รหัส ${code.code} ถูกคัดลอกแล้ว`);
  }

  if (initializing) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
        <View style={[styles.stepsCard, { gap: 14 }]}>
          <SkeletonBox height={16} width="55%" />
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <SkeletonBox width={26} height={26} borderRadius={13} />
              <SkeletonBox height={13} style={{ flex: 1 }} />
            </View>
          ))}
        </View>
        <SkeletonBox height={48} borderRadius={12} style={{ marginBottom: 10 }} />
        <SkeletonBox height={48} borderRadius={12} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
      {/* Steps */}
      <View style={styles.stepsCard}>
        <Text style={styles.stepsTitle}>วิธีเชื่อมต่อ LINE Group</Text>
        {STEPS.map((s) => (
          <View key={s.num} style={styles.stepRow}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>{s.num}</Text>
            </View>
            <Text style={styles.stepText}>{s.text}</Text>
          </View>
        ))}
      </View>

      {/* Add Bot button */}
      {lineBotId && (
        <TouchableOpacity
          style={styles.addBotButton}
          onPress={() => Linking.openURL(`https://line.me/R/ti/p/${lineBotId}`)}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle-outline" size={18} color="#fff" />
          <Text style={styles.addBotText}>เพิ่ม Bot เป็นเพื่อนใน LINE</Text>
        </TouchableOpacity>
      )}

      {/* Generate code button */}
      <TouchableOpacity
        style={[styles.genButton, loading && styles.genButtonDisabled]}
        onPress={generateCode}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : (
            <View style={styles.genButtonInner}>
              <Ionicons name="key-outline" size={18} color="#fff" />
              <Text style={styles.genButtonText}>สร้างรหัสยืนยัน</Text>
            </View>
          )}
      </TouchableOpacity>

      {/* Code display */}
      {code && (
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>รหัสยืนยัน</Text>
          <Text style={styles.codeText} adjustsFontSizeToFit numberOfLines={1} minimumFontScale={0.5}>
            {code.code}
          </Text>
          <Text style={styles.codeExpiry}>
            หมดอายุ {new Date(code.expiresAt).toLocaleTimeString("th-TH")}
          </Text>
          <TouchableOpacity style={styles.copyButton} onPress={copyCode} activeOpacity={0.85}>
            <Ionicons name="copy-outline" size={15} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.copyButtonText}>คัดลอกรหัส</Text>
          </TouchableOpacity>
          <Text style={styles.codeHint}>พิมพ์หรือวางรหัสนี้ในกลุ่ม LINE</Text>
        </View>
      )}
      <AppAlert {...appAlert} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  stepsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 18,
    borderWidth: 0.5,
    borderColor: colors.borderLight,
    marginBottom: 16,
  },
  stepsTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 14,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    borderWidth: 1.5,
    borderColor: colors.primaryBorder,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  stepNumText: { fontSize: 12, fontWeight: "700", color: colors.primaryDark },
  stepText: { fontSize: 13, color: colors.textSecondary, lineHeight: 20, flex: 1 },

  addBotButton: {
    backgroundColor: colors.lineGreen,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 10,
  },
  addBotText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  genButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: "center",
  },
  genButtonDisabled: { opacity: 0.5 },
  genButtonInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  genButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  codeBox: {
    marginTop: 20,
    backgroundColor: colors.primaryLight,
    borderWidth: 1.5,
    borderColor: colors.primaryBorder,
    borderRadius: radius["2xl"],
    padding: 24,
    alignItems: "center",
    gap: 6,
  },
  codeLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  codeText: {
    fontSize: 42,
    fontWeight: "800",
    color: colors.primaryDark,
    letterSpacing: 5,
    marginBottom: 2,
    width: "100%",
    textAlign: "center",
  },
  codeExpiry: { fontSize: 11, color: colors.textDisabled },
  copyButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginTop: 10,
    marginBottom: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  copyButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  codeHint: { fontSize: 12, color: "#4b5563", textAlign: "center", lineHeight: 18 },
});
