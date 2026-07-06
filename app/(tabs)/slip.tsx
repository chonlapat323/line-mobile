import { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Image, StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { colors, radius, shadows } from "@/lib/theme";

interface PickedImage { uri: string; name: string; type: string; }

type SlipStatus = "verified" | "pending_approval" | null;

export default function SlipScreen() {
  const [slipImage, setSlipImage] = useState<PickedImage | null>(null);
  const [slipUrl, setSlipUrl] = useState<string | null>(null);
  const [slipStatus, setSlipStatus] = useState<SlipStatus>(null);
  const [transRef, setTransRef] = useState("");
  const [verifying, setVerifying] = useState(false);

  const [shopName, setShopName] = useState("");
  const [amount, setAmount] = useState("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);

  async function parseAsset(uri: string): Promise<PickedImage> {
    const compressed = await ImageManipulator.manipulateAsync(uri, [], {
      compress: 0.7, format: ImageManipulator.SaveFormat.JPEG,
    });
    const name = `slip-${Date.now()}.jpg`;
    return { uri: compressed.uri, name, type: "image/jpeg" };
  }

  async function verifySlip(picked: PickedImage) {
    setVerifying(true);
    setSlipStatus(null);
    setTransRef("");
    setAmount("");
    setSlipUrl(null);
    try {
      const fd = new FormData();
      fd.append("slip", { uri: picked.uri, name: picked.name, type: picked.type } as unknown as Blob);
      const res = await api.post("/visits/verify-slip", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSlipUrl(res.data.slipUrl ?? null);
      setTransRef(res.data.transRef ?? "");
      if (res.data.success && res.data.amount) {
        setSlipStatus("verified");
        setAmount(String(res.data.amount));
      } else {
        setSlipStatus("pending_approval");
      }
    } catch {
      setSlipStatus("pending_approval");
    } finally {
      setVerifying(false);
    }
  }

  async function pickSlip() {
    Alert.alert("แนบสลิป", "", [
      {
        text: "ถ่ายรูป", onPress: async () => {
          const r = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 });
          if (!r.canceled && r.assets[0]) {
            const picked = await parseAsset(r.assets[0].uri);
            setSlipImage(picked);
            setSlipStatus(null); setSlipUrl(null); setTransRef(""); setAmount("");
          }
        },
      },
      {
        text: "เลือกจาก Gallery", onPress: async () => {
          const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 });
          if (!r.canceled && r.assets[0]) {
            const picked = await parseAsset(r.assets[0].uri);
            setSlipImage(picked);
            setSlipStatus(null); setSlipUrl(null); setTransRef(""); setAmount("");
          }
        },
      },
      { text: "ยกเลิก", style: "cancel" },
    ]);
  }

  function resetForm() {
    setSlipImage(null);
    setSlipUrl(null);
    setSlipStatus(null);
    setTransRef("");
    setAmount("");
    setShopName("");
    setDetails("");
  }

  async function handleSubmit() {
    if (!slipUrl || !shopName.trim() || !amount.trim()) return;
    setLoading(true);
    try {
      await api.post("/slips", {
        shopName: shopName.trim(),
        amount: amount.trim(),
        details: details.trim(),
        slipUrl,
        slipStatus,
        transRef,
      });
      resetForm();
      Alert.alert(
        "สำเร็จ",
        slipStatus === "verified"
          ? "ส่งสลิปแล้ว และแจ้งกลุ่ม LINE เรียบร้อย"
          : "ส่งสลิปแล้ว รอ Admin ยืนยันยอดเงิน",
      );
    } catch {
      Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถส่งสลิปได้ กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = !!slipUrl && !verifying && !!shopName.trim() && !!amount.trim() && !loading;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={st.screen} contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">

        {/* ── Card 1: สลิป ── */}
        <View style={st.card}>
          <View style={st.cardHeader}>
            <View style={[st.cardIconBox, { backgroundColor: "#f0fdf4" }]}>
              <Ionicons name="receipt-outline" size={16} color={colors.primary} />
            </View>
            <Text style={st.cardTitle}>สลิปการชำระเงิน <Text style={st.req}>*</Text></Text>
          </View>
          <View style={st.cardBody}>
            <TouchableOpacity onPress={pickSlip} style={st.slipBox} activeOpacity={0.8} disabled={verifying}>
              {slipImage ? (
                <Image source={{ uri: slipImage.uri }} style={st.slipPreview} resizeMode="contain" />
              ) : (
                <View style={st.slipPlaceholder}>
                  <View style={st.slipIconWrap}>
                    <Ionicons name="cloud-upload-outline" size={22} color={colors.primary} />
                  </View>
                  <Text style={st.slipUploadText}>อัปโหลดสลิป</Text>
                  <Text style={st.slipUploadSub}>ถ่ายรูปหรือเลือกจาก Gallery</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* ปุ่มตรวจสอบ — แสดงเมื่อเลือกรูปแล้วแต่ยังไม่ verify */}
            {slipImage && !slipStatus && !verifying && (
              <TouchableOpacity onPress={() => verifySlip(slipImage)} style={st.verifyBtn}>
                <Ionicons name="scan-outline" size={16} color="#fff" />
                <Text style={st.verifyBtnText}>ตรวจสอบสลิป</Text>
              </TouchableOpacity>
            )}

            {/* Verify status */}
            {verifying && (
              <View style={st.statusRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={st.statusText}>กำลังตรวจสอบ QR บนสลิป...</Text>
              </View>
            )}
            {!verifying && slipStatus === "verified" && (
              <View style={[st.statusRow, st.statusVerified]}>
                <Ionicons name="checkmark-circle" size={16} color={colors.primaryDark} />
                <Text style={[st.statusText, { color: colors.primaryDark }]}>ยืนยัน QR สำเร็จ</Text>
              </View>
            )}
            {!verifying && slipStatus === "pending_approval" && (
              <View style={[st.statusRow, st.statusPending]}>
                <Ionicons name="time-outline" size={16} color="#d97706" />
                <Text style={[st.statusText, { color: "#d97706" }]}>ไม่พบ QR — กรอกยอดด้วยตนเอง รอ Admin ยืนยัน</Text>
              </View>
            )}

            {slipImage && (
              <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 6, gap: 12 }}>
                {slipStatus && (
                  <TouchableOpacity onPress={() => { setSlipStatus(null); verifySlip(slipImage); }} style={st.changeBtn}>
                    <Ionicons name="scan-outline" size={13} color={colors.textMuted} />
                    <Text style={st.changeBtnText}>ตรวจสอบใหม่</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={pickSlip} style={st.changeBtn}>
                  <Ionicons name="refresh-outline" size={13} color={colors.textMuted} />
                  <Text style={st.changeBtnText}>เปลี่ยนรูปสลิป</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* ── Card 2: ข้อมูลการชำระ ── */}
        <View style={[st.card, { marginTop: 10 }]}>
          <View style={st.cardHeader}>
            <View style={[st.cardIconBox, { backgroundColor: "#fef9ee" }]}>
              <Ionicons name="storefront-outline" size={16} color="#d97706" />
            </View>
            <Text style={st.cardTitle}>ข้อมูลการชำระ</Text>
          </View>
          <View style={st.cardBody}>
            <View style={st.fieldGroup}>
              <Text style={st.fieldLabel}>ชื่อร้าน <Text style={st.req}>*</Text></Text>
              <TextInput
                style={st.input}
                value={shopName}
                onChangeText={setShopName}
                placeholder="ระบุชื่อร้าน"
                placeholderTextColor={colors.textDisabled}
              />
            </View>

            <View style={st.fieldGroup}>
              <Text style={st.fieldLabel}>
                ยอดเงิน (บาท) <Text style={st.req}>*</Text>
                {slipStatus === "verified" && (
                  <Text style={{ fontSize: 11, color: colors.primaryDark, fontWeight: "400" }}> (จาก QR)</Text>
                )}
              </Text>
              <View style={st.inputRow}>
                <Text style={st.bahtSign}>฿</Text>
                <TextInput
                  style={st.inputText}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="ระบุยอดเงิน"
                  placeholderTextColor={colors.textDisabled}
                  keyboardType="numeric"
                  editable={slipStatus !== "verified"}
                />
                {slipStatus === "verified" && (
                  <Ionicons name="lock-closed-outline" size={14} color={colors.textDisabled} style={{ marginRight: 10 }} />
                )}
              </View>
              {slipStatus === "pending_approval" && (
                <Text style={st.fieldNote}>กรอกยอดตามในสลิป Admin จะยืนยันก่อนส่ง LINE</Text>
              )}
            </View>

            <View style={st.fieldGroup}>
              <Text style={st.fieldLabel}>รายละเอียด <Text style={{ color: colors.textDisabled, fontWeight: "400" }}>(ถ้ามี)</Text></Text>
              <TextInput
                style={[st.input, st.textarea]}
                value={details}
                onChangeText={setDetails}
                placeholder="หมายเหตุเพิ่มเติม..."
                placeholderTextColor={colors.textDisabled}
                multiline
                textAlignVertical="top"
              />
            </View>
          </View>
        </View>

        {/* ── Submit ── */}
        <View style={st.submitWrap}>
          <TouchableOpacity
            style={[st.submitBtn, !canSubmit && st.submitBtnOff]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.88}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send-outline" size={18} color="#fff" />
                <Text style={st.submitText}>ส่งสลิป</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 12, paddingBottom: 40 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  cardIconBox: {
    width: 28, height: 28, borderRadius: radius.sm,
    alignItems: "center", justifyContent: "center",
  },
  cardTitle: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  cardBody: { padding: 14 },

  req: { color: colors.error },

  slipBox: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    borderStyle: "dashed", overflow: "hidden", minHeight: 160,
    backgroundColor: colors.bgAlt,
  },
  slipPreview: { width: "100%", height: 220 },
  slipPlaceholder: { alignItems: "center", justifyContent: "center", gap: 6, padding: 24 },
  slipIconWrap: {
    width: 44, height: 44, borderRadius: radius.full,
    backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center",
  },
  slipUploadText: { fontSize: 14, fontWeight: "700", color: colors.primaryDark },
  slipUploadSub: { fontSize: 12, color: colors.textMuted },

  statusRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md,
  },
  statusVerified: { backgroundColor: colors.primaryLight },
  statusPending: { backgroundColor: "#fffbeb" },
  statusText: { fontSize: 12, color: colors.textMuted, fontWeight: "500", flex: 1 },

  verifyBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    marginTop: 10, paddingVertical: 11, backgroundColor: colors.primaryDark, borderRadius: radius.md,
  },
  verifyBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  changeBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
  },
  changeBtnText: { fontSize: 12, color: colors.textMuted },

  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: 6 },
  fieldNote: { fontSize: 11, color: "#d97706", marginTop: 4 },

  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, fontWeight: "500", color: colors.textSecondary,
    backgroundColor: colors.bg,
  },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.bg,
  },
  bahtSign: { paddingLeft: 12, fontSize: 15, color: colors.textMuted, fontWeight: "600" },
  inputText: { flex: 1, paddingHorizontal: 8, paddingVertical: 10, fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  textarea: { minHeight: 80, paddingTop: 10 },

  submitWrap: { marginTop: 16 },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: colors.primary, borderRadius: radius.lg,
    paddingVertical: 15, ...shadows.button,
  },
  submitBtnOff: { backgroundColor: colors.textDisabled },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
