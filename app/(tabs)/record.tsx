import { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, Modal, FlatList,
  ScrollView, Alert, ActivityIndicator, Image, StyleSheet,
  KeyboardAvoidingView, Platform, RefreshControl, Linking,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { api, getStoredUser } from "@/lib/api";
import { PROVINCES, BANGKOK_DISTRICTS, BANGKOK_PROVINCE } from "@/lib/thai-places";
import { getShopHistory, saveShopToHistory } from "@/lib/shop-history";
import { colors, radius } from "@/lib/theme";

const MIN_IMAGES = 6;

interface PickedImage {
  uri: string;
  name: string;
  type: string;
}

type TripType = "plan" | "off_plan" | "swap";
type CustomerType = "new" | "existing";
type VisitType = "tak" | "dem";
type ResultType = "buy" | "no_buy" | "not_found";

const IMAGE_SLOTS = [
  { key: "front1",  label: "หน้าร้าน 1" },
  { key: "front2",  label: "หน้าร้าน 2" },
  { key: "inside1", label: "ภายในร้าน 1" },
  { key: "inside2", label: "ภายในร้าน 2" },
  { key: "line",    label: "หน้าจอ Line" },
  { key: "xray",    label: "X-ray" },
] as const;

type SlotKey = typeof IMAGE_SLOTS[number]["key"];
type SlotImages = Record<SlotKey, PickedImage | null>;
const EMPTY_SLOTS: SlotImages = { front1: null, front2: null, inside1: null, inside2: null, line: null, xray: null };

export default function RecordScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [shopName, setShopName] = useState("ร้านทดสอบ BeautyUp");
  const [shopHistory, setShopHistory] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [province, setProvince] = useState("กรุงเทพมหานคร");
  const [district, setDistrict] = useState("ลาดพร้าว");
  const [showProvincePicker, setShowProvincePicker] = useState(false);
  const [showDistrictPicker, setShowDistrictPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [tripType, setTripType] = useState<TripType | null>("plan");
  const [customerType, setCustomerType] = useState<CustomerType | null>("new");
  const [visitType, setVisitType] = useState<VisitType | null>("tak");
  const [result, setResult] = useState<ResultType | null>("buy");
  const [details, setDetails] = useState("ทดสอบระบบ");
  const [slotImages, setSlotImages] = useState<SlotImages>({ ...EMPTY_SLOTS });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    getStoredUser().then((u) => { if (u) setUserId(u.id); });
    getShopHistory().then(setShopHistory);
    captureLocation();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([captureLocation(), getShopHistory().then(setShopHistory)]);
    setRefreshing(false);
  }, []);

  async function captureLocation() {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("ไม่ได้รับอนุญาต", "กรุณาเปิดสิทธิ์ Location เพื่อบันทึกพิกัด", [
          { text: "ไม่ใช่ตอนนี้", style: "cancel" },
          { text: "ไปที่ตั้งค่า", onPress: () => Linking.openSettings() },
        ]);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLatitude(loc.coords.latitude);
      setLongitude(loc.coords.longitude);
    } catch {
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถดึงพิกัดได้ กรุณาตรวจสอบ GPS");
    } finally {
      setLocationLoading(false);
    }
  }

  function parseAsset(uri: string): PickedImage {
    const rawName = uri.split("/").pop() || "image.jpg";
    const isPng = rawName.toLowerCase().endsWith(".png");
    return { uri, name: isPng ? rawName : rawName.replace(/\.[^.]+$/, "") + ".jpg", type: isPng ? "image/png" : "image/jpeg" };
  }

  function pickForSlot(slotKey: SlotKey) {
    Alert.alert("เพิ่มรูป", "เลือกวิธีเพิ่มรูป", [
      { text: "📷 ถ่ายรูป", onPress: () => openCameraForSlot(slotKey) },
      { text: "🖼 เลือกจาก Gallery", onPress: () => openGalleryForSlot(slotKey) },
      { text: "ยกเลิก", style: "cancel" },
    ]);
  }

  async function openCameraForSlot(slotKey: SlotKey) {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) { Alert.alert("ไม่ได้รับอนุญาต", "กรุณาเปิดสิทธิ์กล้องในการตั้งค่า"); return; }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8, allowsEditing: false });
    if (!res.canceled && res.assets[0]) {
      setSlotImages((prev) => ({ ...prev, [slotKey]: parseAsset(res.assets[0].uri) }));
    }
  }

  async function openGalleryForSlot(slotKey: SlotKey) {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], allowsMultipleSelection: false, quality: 0.8, allowsEditing: false,
    });
    if (!res.canceled && res.assets[0]) {
      setSlotImages((prev) => ({ ...prev, [slotKey]: parseAsset(res.assets[0].uri) }));
    }
  }

  const shopSuggestions = shopName.trim()
    ? shopHistory.filter((s) => s.toLowerCase().includes(shopName.toLowerCase()) && s !== shopName)
    : shopHistory.slice(0, 5);

  async function handleSubmit() {
    if (!shopName.trim()) { Alert.alert("แจ้งเตือน", "กรุณากรอกชื่อร้าน"); return; }
    if (!province) { Alert.alert("แจ้งเตือน", "กรุณาเลือกจังหวัด"); return; }
    if (province === BANGKOK_PROVINCE && !district) { Alert.alert("แจ้งเตือน", "กรุณาเลือกเขต (กรุงเทพฯ)"); return; }
    if (!tripType) { Alert.alert("แจ้งเตือน", "กรุณาเลือกทริป"); return; }
    if (!customerType) { Alert.alert("แจ้งเตือน", "กรุณาเลือกประเภทลูกค้า"); return; }
    if (!visitType) { Alert.alert("แจ้งเตือน", "กรุณาเลือกภารกิจ"); return; }
    if (!result) { Alert.alert("แจ้งเตือน", "กรุณาเลือกผลตอบรับ"); return; }
    const filledCount = IMAGE_SLOTS.filter((s) => slotImages[s.key] !== null).length;
    if (filledCount < MIN_IMAGES) {
      const missing = IMAGE_SLOTS.filter((s) => slotImages[s.key] === null).map((s) => s.label).join(", ");
      Alert.alert("แจ้งเตือน", `กรุณาแนบรูปให้ครบทุก slot\nยังขาด: ${missing}`);
      return;
    }
    if (!userId) { Alert.alert("ข้อผิดพลาด", "ไม่พบข้อมูลผู้ใช้ กรุณา login ใหม่"); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      IMAGE_SLOTS.forEach((slot) => {
        const img = slotImages[slot.key];
        if (img) fd.append("images", { uri: img.uri, name: `${slot.key}-${img.name}`, type: img.type } as unknown as Blob);
      });
      fd.append("shopName", shopName.trim());
      fd.append("province", province);
      fd.append("district", district);
      fd.append("latitude", String(latitude ?? 0));
      fd.append("longitude", String(longitude ?? 0));
      fd.append("tripType", tripType);
      fd.append("customerType", customerType);
      fd.append("visitType", visitType);
      fd.append("result", result);
      fd.append("details", details);
      await api.createVisit(fd);
      await saveShopToHistory(shopName.trim());
      setShopHistory(await getShopHistory());
      Alert.alert("บันทึกสำเร็จ", "ข้อมูลการเยี่ยมร้านบันทึกแล้ว");
      setShopName(""); setProvince(""); setDistrict("");
      setTripType(null); setCustomerType(null); setVisitType(null);
      setResult(null); setDetails(""); setSlotImages({ ...EMPTY_SLOTS });
      captureLocation();
    } catch (err: unknown) {
      Alert.alert("ผิดพลาด", err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const isBangkok = province === BANGKOK_PROVINCE;
  const filledCount = IMAGE_SLOTS.filter((s) => slotImages[s.key] !== null).length;
  const canSubmit = !!shopName.trim() && !!province && (!isBangkok || !!district) &&
    !!tripType && !!customerType && !!visitType && !!result && filledCount >= MIN_IMAGES && !loading;

  const filteredProvinces = PROVINCES.filter((p) => p.toLowerCase().includes(pickerSearch.toLowerCase()));
  const filteredDistricts = BANGKOK_DISTRICTS.filter((d) => d.toLowerCase().includes(pickerSearch.toLowerCase()));

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* GPS */}
        <View style={styles.section}>
          <View style={styles.gpsRow}>
            <View style={[styles.gpsDot, { backgroundColor: latitude ? colors.primary : colors.textDisabled }]} />
            <Text style={[styles.gpsText, !latitude && { color: colors.textDisabled }]}>
              {locationLoading ? "กำลังดึงพิกัด..." : latitude ? `${latitude.toFixed(6)}, ${longitude?.toFixed(6)}` : "ไม่พบพิกัด"}
            </Text>
            <TouchableOpacity onPress={captureLocation} disabled={locationLoading}>
              {locationLoading
                ? <ActivityIndicator size="small" color={colors.textMuted} />
                : <Text style={styles.gpsRefresh}>↻</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {/* Shop name */}
        <View style={styles.section}>
          <Text style={styles.label}>ชื่อร้าน <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            value={shopName}
            onChangeText={(t) => { setShopName(t); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="ระบุชื่อร้านค้า"
            placeholderTextColor={colors.textDisabled}
          />
          {showSuggestions && shopSuggestions.length > 0 && (
            <View style={styles.suggestionBox}>
              {shopSuggestions.map((s) => (
                <TouchableOpacity key={s} style={styles.suggestionItem} onPress={() => { setShopName(s); setShowSuggestions(false); }}>
                  <Ionicons name="time-outline" size={14} color={colors.textDisabled} style={{ marginRight: 6 }} />
                  <Text style={styles.suggestionText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Province */}
        <View style={styles.section}>
          <Text style={styles.label}>จังหวัด <Text style={styles.required}>*</Text></Text>
          <TouchableOpacity style={styles.pickerButton} onPress={() => { setPickerSearch(""); setShowProvincePicker(true); }}>
            <Text style={province ? styles.pickerText : styles.pickerPlaceholder}>{province || "เลือกจังหวัด"}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.textDisabled} />
          </TouchableOpacity>
        </View>

        {/* District (Bangkok only) */}
        {isBangkok && (
          <View style={styles.section}>
            <Text style={styles.label}>เขต (กรุงเทพฯ) <Text style={styles.required}>*</Text></Text>
            <TouchableOpacity style={styles.pickerButton} onPress={() => { setPickerSearch(""); setShowDistrictPicker(true); }}>
              <Text style={district ? styles.pickerText : styles.pickerPlaceholder}>{district || "เลือกเขต"}</Text>
              <Ionicons name="chevron-down" size={16} color={colors.textDisabled} />
            </TouchableOpacity>
          </View>
        )}

        {/* Trip type */}
        <View style={styles.section}>
          <Text style={styles.label}>ทริป <Text style={styles.required}>*</Text></Text>
          <View style={styles.pillRow}>
            {([
              { key: "plan",     label: "ตามแผน" },
              { key: "off_plan", label: "นอกแผน" },
              { key: "swap",     label: "สลับวัน" },
            ] as { key: TripType; label: string }[]).map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                style={[styles.pill, tripType === key && styles.pillActive]}
                onPress={() => setTripType(key)}
              >
                <Text style={[styles.pillText, tripType === key && styles.pillTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Customer type */}
        <View style={styles.section}>
          <Text style={styles.label}>ลูกค้า <Text style={styles.required}>*</Text></Text>
          <View style={styles.pillRow}>
            {([
              { key: "new",      label: "ลูกค้าใหม่" },
              { key: "existing", label: "ลูกค้าเก่า" },
            ] as { key: CustomerType; label: string }[]).map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                style={[styles.pill, customerType === key && styles.pillActive]}
                onPress={() => setCustomerType(key)}
              >
                <Text style={[styles.pillText, customerType === key && styles.pillTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Mission type */}
        <View style={styles.section}>
          <Text style={styles.label}>ภารกิจ <Text style={styles.required}>*</Text></Text>
          <View style={styles.pillRow}>
            {([
              { key: "tak", label: "ทัก" },
              { key: "dem", label: "เดม" },
            ] as { key: VisitType; label: string }[]).map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                style={[styles.pill, visitType === key && styles.pillActive]}
                onPress={() => setVisitType(key)}
              >
                <Text style={[styles.pillText, visitType === key && styles.pillTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Result */}
        <View style={styles.section}>
          <Text style={styles.label}>ผลตอบรับ <Text style={styles.required}>*</Text></Text>
          <View style={styles.pillRow}>
            {([
              { key: "buy",       label: "ซื้อ" },
              { key: "no_buy",    label: "ไม่ซื้อ" },
              { key: "not_found", label: "ไม่พบ" },
            ] as { key: ResultType; label: string }[]).map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                style={[styles.pill, result === key && styles.pillActive]}
                onPress={() => setResult(key)}
              >
                <Text style={[styles.pillText, result === key && styles.pillTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Summary */}
        <View style={styles.section}>
          <Text style={styles.label}>สรุปผล</Text>
          <TextInput
            style={[styles.input, { height: 88, paddingTop: 10 }]}
            value={details}
            onChangeText={setDetails}
            placeholder="บันทึกสรุปผลเพิ่มเติม..."
            placeholderTextColor={colors.textDisabled}
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* Images */}
        <View style={styles.section}>
          <View style={styles.imageLabelRow}>
            <Text style={styles.label}>รูปภาพ <Text style={styles.required}>*</Text></Text>
            <Text style={[styles.imageCount, filledCount < MIN_IMAGES && styles.imageCountWarn]}>
              {filledCount}/6 · ต้องการครบทุกรูป
            </Text>
          </View>
          <View style={styles.imageGrid}>
            {IMAGE_SLOTS.map((slot) => {
              const img = slotImages[slot.key];
              return img ? (
                <TouchableOpacity
                  key={slot.key}
                  style={styles.imageCell}
                  onPress={() => pickForSlot(slot.key)}
                  activeOpacity={0.85}
                >
                  <Image source={{ uri: img.uri }} style={styles.imageCellImg} />
                  <View style={styles.slotLabelFilled}>
                    <Text style={styles.slotLabelFilledText} numberOfLines={1}>{slot.label}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => setSlotImages((prev) => ({ ...prev, [slot.key]: null }))}
                  >
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  key={slot.key}
                  style={styles.addCell}
                  onPress={() => pickForSlot(slot.key)}
                >
                  <Ionicons name="camera-outline" size={22} color={colors.textDisabled} />
                  <Text style={styles.slotLabel}>{slot.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Submit */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitBtnText}>บันทึกการเยี่ยมร้าน</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <SearchPickerModal
        visible={showProvincePicker}
        title="เลือกจังหวัด"
        items={filteredProvinces}
        search={pickerSearch}
        onSearch={setPickerSearch}
        onSelect={(p) => { setProvince(p); setDistrict(""); setShowProvincePicker(false); }}
        onClose={() => setShowProvincePicker(false)}
      />
      <SearchPickerModal
        visible={showDistrictPicker}
        title="เลือกเขต (กรุงเทพฯ)"
        items={filteredDistricts}
        search={pickerSearch}
        onSearch={setPickerSearch}
        onSelect={(d) => { setDistrict(d); setShowDistrictPicker(false); }}
        onClose={() => setShowDistrictPicker(false)}
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
            <TextInput
              style={modal.searchInput}
              value={search}
              onChangeText={onSearch}
              placeholder="ค้นหา..."
              placeholderTextColor={colors.textDisabled}
              autoFocus
            />
          </View>
          <FlatList
            data={items}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity style={modal.item} onPress={() => onSelect(item)}>
                <Text style={modal.itemText}>{item}</Text>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={modal.separator} />}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  section: { paddingHorizontal: 16, marginTop: 16 },

  gpsRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.primaryLight, borderWidth: 1,
    borderColor: colors.primaryBorder, borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 10, gap: 8,
  },
  gpsDot: { width: 8, height: 8, borderRadius: 4 },
  gpsText: { flex: 1, fontSize: 11, color: colors.primaryText, fontVariant: ["tabular-nums"] },
  gpsRefresh: { fontSize: 18, color: colors.textMuted },

  label: { fontSize: 12, fontWeight: "600", color: colors.textSecondary, marginBottom: 6 },
  required: { color: colors.error },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    backgroundColor: colors.surface, color: colors.textPrimary,
  },

  suggestionBox: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.surface, marginTop: 2, overflow: "hidden",
  },
  suggestionItem: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  suggestionText: { fontSize: 14, color: colors.textSecondary },

  pickerButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 11, backgroundColor: colors.surface,
  },
  pickerText: { fontSize: 14, color: colors.textPrimary },
  pickerPlaceholder: { fontSize: 14, color: colors.textDisabled },

  pillRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  pill: {
    paddingHorizontal: 18, paddingVertical: 9, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.borderDashed, backgroundColor: colors.surface,
  },
  pillActive: { borderColor: colors.primaryDark, backgroundColor: colors.primaryLight },
  pillText: { fontSize: 14, color: colors.textMuted, fontWeight: "500" },
  pillTextActive: { color: colors.primaryDark, fontWeight: "700" },

  imageLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  imageCount: { fontSize: 11, color: colors.textMuted },
  imageCountWarn: { color: colors.error, fontWeight: "600" },

  imageGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  imageCell: {
    width: "48%", aspectRatio: 1.2,
    borderRadius: radius.md, overflow: "hidden", position: "relative",
  },
  imageCellImg: { width: "100%", height: "100%", resizeMode: "cover" },
  slotLabelFilled: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 8, paddingVertical: 4,
  },
  slotLabelFilledText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  removeBtn: {
    position: "absolute", top: 6, right: 6, width: 24, height: 24,
    borderRadius: 12, backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center", justifyContent: "center",
  },
  removeBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  addCell: {
    width: "48%", aspectRatio: 1.2,
    borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.borderDashed, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surface, gap: 4,
  },
  slotLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "600", textAlign: "center", paddingHorizontal: 4 },

  submitBtn: {
    backgroundColor: colors.primaryDark, borderRadius: radius.lg,
    paddingVertical: 15, alignItems: "center",
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "80%" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  title: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  searchWrap: {
    flexDirection: "row", alignItems: "center", margin: 12,
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.bg,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary },
  item: { paddingHorizontal: 20, paddingVertical: 14 },
  itemText: { fontSize: 15, color: colors.textPrimary },
  separator: { height: 1, backgroundColor: colors.borderLight },
});
