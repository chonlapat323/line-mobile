import { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, Switch,
  ScrollView, ActivityIndicator, Image, StyleSheet, Alert, KeyboardAvoidingView, Platform,
  Modal, FlatList,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { PROVINCES, BANGKOK_DISTRICTS, BANGKOK_PROVINCE, PROVINCE_AMPHOES } from "@/lib/thai-places";
import { colors, radius, shadows } from "@/lib/theme";

interface PickedImage { uri: string; name: string; type: string; }

type SlipStatus = "verified" | "pending_approval" | null;

export default function SlipScreen() {
  const [slipImage, setSlipImage] = useState<PickedImage | null>(null);
  const [slipOriginalUri, setSlipOriginalUri] = useState<string | null>(null);
  const [slipUrl, setSlipUrl] = useState<string | null>(null);
  const [slipStatus, setSlipStatus] = useState<SlipStatus>(null);
  const [transRef, setTransRef] = useState("");
  const [verifying, setVerifying] = useState(false);

  const [shopName, setShopName] = useState("");
  const [amount, setAmount] = useState("");
  const [details, setDetails] = useState("");
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [showProvincePicker, setShowProvincePicker] = useState(false);
  const [showDistrictPicker, setShowDistrictPicker] = useState(false);
  const [showAmphoePicker, setShowAmphoePicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [isProxy, setIsProxy] = useState(false);
  const [loading, setLoading] = useState(false);

  async function parseAsset(uri: string): Promise<PickedImage> {
    const compressed = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1920 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );
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
      const verifyUri = slipOriginalUri ?? picked.uri;
      fd.append("slip", { uri: verifyUri, name: picked.name, type: picked.type } as unknown as Blob);
      const res = await api.verifySlip(fd);
      setSlipUrl(res.slipUrl ?? null);
      setTransRef(res.transRef ?? "");
      if (res.success && res.amount) {
        setSlipStatus("verified");
        setAmount(String(res.amount));
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
          const r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"] as any, quality: 1 });
          if (!r.canceled && r.assets[0]) {
            const originalUri = r.assets[0].uri;
            const picked = await parseAsset(originalUri);
            setSlipOriginalUri(originalUri);
            setSlipImage(picked);
            setSlipStatus(null); setSlipUrl(null); setTransRef(""); setAmount("");
          }
        },
      },
      {
        text: "เลือกจาก Gallery", onPress: async () => {
          const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"] as any, quality: 1 });
          if (!r.canceled && r.assets[0]) {
            const originalUri = r.assets[0].uri;
            const picked = await parseAsset(originalUri);
            setSlipOriginalUri(originalUri);
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
    setSlipOriginalUri(null);
    setSlipUrl(null);
    setSlipStatus(null);
    setTransRef("");
    setAmount("");
    setShopName("");
    setDetails("");
    setProvince("");
    setDistrict("");
    setIsProxy(false);
  }

  async function handleSubmit() {
    if (!slipUrl || !shopName.trim() || !amount.trim()) return;
    setLoading(true);
    try {
      await api.submitSlip({
        shopName: shopName.trim(),
        amount: amount.trim(),
        details: details.trim(),
        slipUrl,
        slipStatus,
        transRef,
        province: province.trim(),
        district: district.trim(),
        isProxy,
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

  const isBangkok = province === BANGKOK_PROVINCE;
  const filteredProvinces = PROVINCES.filter((p) => p.toLowerCase().includes(pickerSearch.toLowerCase()));
  const filteredDistricts = BANGKOK_DISTRICTS.filter((d) => d.toLowerCase().includes(pickerSearch.toLowerCase()));
  const filteredAmphoes = (PROVINCE_AMPHOES[province] ?? []).filter((a) => a.toLowerCase().includes(pickerSearch.toLowerCase()));

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

            <View style={st.fieldRow}>
              <View style={[st.fieldGroup, { flex: 1 }]}>
                <Text style={st.fieldLabel}>จังหวัด</Text>
                <TouchableOpacity style={st.pickerBtn} onPress={() => { setPickerSearch(""); setShowProvincePicker(true); }}>
                  <Text style={province ? st.pickerText : st.pickerPlaceholder} numberOfLines={1}>{province || "เลือกจังหวัด"}</Text>
                  <Ionicons name="chevron-down" size={12} color={colors.textDisabled} />
                </TouchableOpacity>
              </View>
              <View style={[st.fieldGroup, { flex: 1 }]}>
                <Text style={st.fieldLabel}>{isBangkok ? "เขต" : "อำเภอ"}</Text>
                <TouchableOpacity
                  style={[st.pickerBtn, !province && { opacity: 0.4 }]}
                  onPress={() => {
                    if (!province) return;
                    setPickerSearch("");
                    isBangkok ? setShowDistrictPicker(true) : setShowAmphoePicker(true);
                  }}
                  disabled={!province}
                >
                  <Text style={district ? st.pickerText : st.pickerPlaceholder} numberOfLines={1}>
                    {district || (isBangkok ? "เลือกเขต" : "เลือกอำเภอ")}
                  </Text>
                  <Ionicons name="chevron-down" size={12} color={colors.textDisabled} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={st.fieldGroup}>
              <Text style={st.fieldLabel}>
                ยอดเงิน (บาท) <Text style={st.req}>*</Text>
                {slipStatus === "verified" && (
                  <Text style={{ fontSize: 16, color: colors.primaryDark, fontWeight: "400" }}> (จาก QR)</Text>
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
            <View style={st.switchRow}>
              <View style={st.switchLabel}>
                <Text style={st.fieldLabel}>เก็บแทน</Text>
                <Text style={st.switchSub}>เก็บเงินแทนเซล์คนอื่น</Text>
              </View>
              <Switch
                value={isProxy}
                onValueChange={setIsProxy}
                trackColor={{ false: colors.borderLight, true: colors.primaryLight }}
                thumbColor={isProxy ? colors.primary : colors.textDisabled}
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

      <SearchPickerModal
        visible={showProvincePicker} title="เลือกจังหวัด" items={filteredProvinces}
        search={pickerSearch} onSearch={setPickerSearch}
        onSelect={(p) => { setProvince(p); setDistrict(""); setShowProvincePicker(false); }}
        onClose={() => setShowProvincePicker(false)}
      />
      <SearchPickerModal
        visible={showDistrictPicker} title="เลือกเขต (กรุงเทพฯ)" items={filteredDistricts}
        search={pickerSearch} onSearch={setPickerSearch}
        onSelect={(d) => { setDistrict(d); setShowDistrictPicker(false); }}
        onClose={() => setShowDistrictPicker(false)}
      />
      <SearchPickerModal
        visible={showAmphoePicker} title="เลือกอำเภอ" items={filteredAmphoes}
        search={pickerSearch} onSearch={setPickerSearch}
        onSelect={(a) => { setDistrict(a); setShowAmphoePicker(false); }}
        onClose={() => setShowAmphoePicker(false)}
      />
    </KeyboardAvoidingView>
  );
}

function SearchPickerModal({ visible, title, items, search, onSearch, onSelect, onClose }: {
  visible: boolean; title: string; items: string[];
  search: string; onSearch: (s: string) => void;
  onSelect: (item: string) => void; onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={modal.overlay}>
          <View style={modal.sheet}>
            <View style={modal.header}>
              <Text style={modal.title}>{title}</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={modal.searchWrap}>
              <Ionicons name="search" size={16} color={colors.textDisabled} style={{ marginRight: 8 }} />
              <TextInput style={modal.searchInput} value={search} onChangeText={onSearch}
                placeholder="ค้นหา..." placeholderTextColor={colors.textDisabled} />
            </View>
            <FlatList
              data={items} keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity style={modal.item} onPress={() => onSelect(item)}>
                  <Text style={modal.itemText}>{item}</Text>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={modal.separator} />}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
  cardTitle: { fontSize: 19, fontWeight: "700", color: colors.textPrimary },
  cardBody: { padding: 14 },

  req: { color: colors.error },

  slipBox: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    borderStyle: "dashed", overflow: "hidden", minHeight: 160,
    backgroundColor: colors.bg,
  },
  slipPreview: { width: "100%", height: 220 },
  slipPlaceholder: { alignItems: "center", justifyContent: "center", gap: 6, padding: 24 },
  slipIconWrap: {
    width: 44, height: 44, borderRadius: radius.full,
    backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center",
  },
  slipUploadText: { fontSize: 19, fontWeight: "700", color: colors.primaryDark },
  slipUploadSub: { fontSize: 17, color: colors.textMuted },

  statusRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md,
  },
  statusVerified: { backgroundColor: colors.primaryLight },
  statusPending: { backgroundColor: "#fffbeb" },
  statusText: { fontSize: 17, color: colors.textMuted, fontWeight: "500", flex: 1 },

  verifyBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    marginTop: 10, paddingVertical: 11, backgroundColor: colors.primaryDark, borderRadius: radius.md,
  },
  verifyBtnText: { color: "#fff", fontWeight: "700", fontSize: 19 },

  changeBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
  },
  changeBtnText: { fontSize: 17, color: colors.textMuted },

  fieldGroup: { marginBottom: 14 },
  fieldRow: { flexDirection: "row", gap: 10 },
  switchRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 6, marginBottom: 4,
  },
  switchLabel: { gap: 2 },
  switchSub: { fontSize: 15, color: colors.textDisabled },
  fieldLabel: { fontSize: 18, fontWeight: "600", color: colors.textSecondary, marginBottom: 6 },
  fieldNote: { fontSize: 16, color: "#d97706", marginTop: 4 },

  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 19, fontWeight: "500", color: colors.textSecondary,
    backgroundColor: colors.bg,
  },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.bg,
  },
  bahtSign: { paddingLeft: 12, fontSize: 20, color: colors.textMuted, fontWeight: "600" },
  inputText: { flex: 1, paddingHorizontal: 8, paddingVertical: 10, fontSize: 20, fontWeight: "600", color: colors.textPrimary },
  textarea: { minHeight: 80, paddingTop: 10 },

  pickerBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.bg,
  },
  pickerText: { fontSize: 19, fontWeight: "500", color: colors.textSecondary, flex: 1 },
  pickerPlaceholder: { fontSize: 19, color: colors.textDisabled, flex: 1 },

  submitWrap: { marginTop: 16 },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: colors.primary, borderRadius: radius.lg,
    paddingVertical: 15, ...shadows.card,
  },
  submitBtnOff: { backgroundColor: colors.textDisabled },
  submitText: { color: "#fff", fontSize: 21, fontWeight: "700" },
});

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "80%" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  title: { fontSize: 21, fontWeight: "700", color: colors.textPrimary },
  searchWrap: {
    flexDirection: "row", alignItems: "center",
    margin: 12, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 19, color: colors.textPrimary },
  item: { paddingHorizontal: 20, paddingVertical: 14 },
  itemText: { fontSize: 20, color: colors.textPrimary },
  separator: { height: 1, backgroundColor: colors.borderLight },
});
