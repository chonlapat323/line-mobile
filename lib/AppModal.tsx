import { View, Text, Modal, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "./theme";

// ─── AppAlert ────────────────────────────────────────────────────────────────

export interface AlertButton {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
}

interface AppAlertProps {
  visible: boolean;
  type?: "error" | "confirm" | "success" | "info";
  title: string;
  message?: string;
  buttons: AlertButton[];
}

const ICONS: Record<string, { name: React.ComponentProps<typeof Ionicons>["name"]; bg: string }> = {
  error:   { name: "close-circle",         bg: "#ef4444" },
  confirm: { name: "help-circle",          bg: "#f59e0b" },
  success: { name: "checkmark-circle",     bg: "#22c55e" },
  info:    { name: "information-circle",   bg: colors.primary },
};

export function AppAlert({ visible, type = "info", title, message, buttons }: AppAlertProps) {
  const icon = ICONS[type];
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={al.overlay}>
        <View style={al.card}>
          <View style={[al.iconWrap, { backgroundColor: icon.bg }]}>
            <Ionicons name={icon.name} size={32} color="#fff" />
          </View>
          <Text style={al.title}>{title}</Text>
          {!!message && <Text style={al.message}>{message}</Text>}
          <View style={[al.btnRow, buttons.length === 1 && { justifyContent: "center" }]}>
            {buttons.map((btn, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  al.btn,
                  buttons.length > 1 && { flex: 1 },
                  btn.style === "destructive" ? al.btnDestructive
                    : btn.style === "cancel" ? al.btnCancel
                    : al.btnPrimary,
                ]}
                onPress={btn.onPress}
                activeOpacity={0.8}
              >
                <Text style={[
                  al.btnText,
                  btn.style === "cancel" && al.btnTextCancel,
                ]}>
                  {btn.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const al = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center", justifyContent: "center", padding: 32,
  },
  card: {
    backgroundColor: "#fff", borderRadius: 20, padding: 28,
    alignItems: "center", width: "100%", maxWidth: 320,
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  title: {
    fontSize: 18, fontWeight: "800", color: "#111827",
    marginBottom: 6, textAlign: "center", letterSpacing: -0.3,
  },
  message: {
    fontSize: 13, color: "#6b7280", textAlign: "center",
    marginBottom: 24, lineHeight: 20,
  },
  btnRow: { flexDirection: "row", gap: 10, width: "100%", marginTop: 8 },
  btn: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center" },
  btnPrimary:     { backgroundColor: colors.primary },
  btnDestructive: { backgroundColor: "#ef4444" },
  btnCancel:      { backgroundColor: "#f3f4f6" },
  btnText:        { fontWeight: "700", fontSize: 14, color: "#fff" },
  btnTextCancel:  { color: "#374151" },
});

// ─── ImagePickerSheet ────────────────────────────────────────────────────────

interface ImagePickerSheetProps {
  visible: boolean;
  title: string;
  onCamera: () => void;
  onGallery: () => void;
  onClose: () => void;
}

export function ImagePickerSheet({ visible, title, onCamera, onGallery, onClose }: ImagePickerSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={ps.overlay} activeOpacity={1} onPress={onClose}>
        <View style={ps.sheet}>
          <View style={ps.handle} />
          <Text style={ps.title}>{title}</Text>
          <TouchableOpacity style={ps.option} onPress={onCamera} activeOpacity={0.7}>
            <View style={ps.optionIcon}>
              <Ionicons name="camera-outline" size={22} color={colors.primary} />
            </View>
            <Text style={ps.optionText}>ถ่ายรูป</Text>
            <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
          </TouchableOpacity>
          <TouchableOpacity style={ps.option} onPress={onGallery} activeOpacity={0.7}>
            <View style={ps.optionIcon}>
              <Ionicons name="images-outline" size={22} color={colors.primary} />
            </View>
            <Text style={ps.optionText}>เลือกจาก Gallery</Text>
            <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
          </TouchableOpacity>
          <TouchableOpacity style={ps.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={ps.cancelText}>ยกเลิก</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const ps = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingBottom: 36, paddingHorizontal: 20,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: "#e5e7eb",
    alignSelf: "center", marginBottom: 16,
  },
  title: {
    fontSize: 15, fontWeight: "700", color: "#111827",
    marginBottom: 12, textAlign: "center",
  },
  option: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 14, borderTopWidth: 1, borderTopColor: "#f3f4f6",
  },
  optionIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "#f0fdf4", alignItems: "center", justifyContent: "center",
  },
  optionText: { flex: 1, fontSize: 15, fontWeight: "600", color: "#111827" },
  cancelBtn: {
    marginTop: 8, paddingVertical: 14, alignItems: "center",
    borderRadius: 12, backgroundColor: "#f3f4f6",
  },
  cancelText: { fontSize: 15, fontWeight: "700", color: "#374151" },
});
