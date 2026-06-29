import { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, Modal, FlatList,
  ScrollView, Alert, ActivityIndicator, Image, StyleSheet,
  KeyboardAvoidingView, Platform, RefreshControl, Linking, Keyboard,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { api, getStoredUser } from "@/lib/api";
import { PROVINCES, BANGKOK_DISTRICTS, BANGKOK_PROVINCE } from "@/lib/thai-places";
import { getShopHistory, saveShopToHistory } from "@/lib/shop-history";
import { colors, radius, shadows } from "@/lib/theme";

const MIN_IMAGES = 1;

interface PickedImage { uri: string; name: string; type: string; }

type TripType = "plan" | "off_plan";
type CustomerType = "new" | "existing";
type VisitType = "tak" | "dem" | "tel";
type ResultType = "buy" | "no_buy" | "not_found";

const IMAGE_SLOTS = [
  { key: "front1",  label: "หน้าร้าน 1" },
  { key: "front2",  label: "หน้าร้าน 2" },
  { key: "inside1", label: "ภายในร้าน 1" },
  { key: "inside2", label: "ภายในร้าน 2" },
  { key: "line",    label: "หน้าจอ LINE" },
  { key: "xray",    label: "X-ray" },
] as const;

type SlotKey = typeof IMAGE_SLOTS[number]["key"];
type SlotImages = Record<SlotKey, PickedImage | null>;
const EMPTY_SLOTS: SlotImages = { front1: null, front2: null, inside1: null, inside2: null, line: null, xray: null };

const RESULT_OPTIONS: { key: ResultType; emoji: string; label: string }[] = [
  { key: "buy",       emoji: "🛍️", label: "ซื้อ" },
  { key: "no_buy",    emoji: "🙅", label: "ไม่ซื้อ" },
  { key: "not_found", emoji: "🔍", label: "ไม่พบ" },
];

export default function RecordScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [shopName, setShopName] = useState("");
  const [shopHistory, setShopHistory] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [showProvincePicker, setShowProvincePicker] = useState(false);
  const [showDistrictPicker, setShowDistrictPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [tripType, setTripType] = useState<TripType | null>(null);
  const [customerType, setCustomerType] = useState<CustomerType | null>(null);
  const [visitType, setVisitType] = useState<VisitType | null>(null);
  const [result, setResult] = useState<ResultType | null>(null);
  const [details, setDetails] = useState("");
  const [orderAmount, setOrderAmount] = useState("");
  const [slotImages, setSlotImages] = useState<SlotImages>({ ...EMPTY_SLOTS });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [slipImage, setSlipImage] = useState<PickedImage | null>(null);
  const [slipVerifying, setSlipVerifying] = useState(false);
  const [slipStatus, setSlipStatus] = useState<string | null>(null);
  const [slipUrl, setSlipUrl] = useState<string | null>(null);
  const [transRef, setTransRef] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [savedShop, setSavedShop] = useState("");

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

  async function parseAsset(uri: string): Promise<PickedImage> {
    const converted = await ImageManipulator.manipulateAsync(
      uri, [], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    const name = (converted.uri.split("/").pop() || "image").replace(/\.[^.]+$/, "") + ".jpg";
    return { uri: converted.uri, name, type: "image/jpeg" };
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
      const img = await parseAsset(res.assets[0].uri);
      setSlotImages((prev) => ({ ...prev, [slotKey]: img }));
    }
  }

  async function openGalleryForSlot(slotKey: SlotKey) {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], allowsMultipleSelection: false, quality: 0.8, allowsEditing: false,
    });
    if (!res.canceled && res.assets[0]) {
      const img = await parseAsset(res.assets[0].uri);
      setSlotImages((prev) => ({ ...prev, [slotKey]: img }));
    }
  }

  function pickSlip() {
    Alert.alert("แนบสลิป", "เลือกวิธีแนบสลิป", [
      { text: "📷 ถ่ายรูป", onPress: openCameraForSlip },
      { text: "🖼 เลือกจาก Gallery", onPress: openGalleryForSlip },
      { text: "ยกเลิก", style: "cancel" },
    ]);
  }

  async function openCameraForSlip() {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) { Alert.alert("ไม่ได้รับอนุญาต", "กรุณาเปิดสิทธิ์กล้องในการตั้งค่า"); return; }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8, allowsEditing: false });
    if (!res.canceled && res.assets[0]) processSlip(res.assets[0].uri);
  }

  async function openGalleryForSlip() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], allowsMultipleSelection: false, quality: 0.8, allowsEditing: false,
    });
    if (!res.canceled && res.assets[0]) processSlip(res.assets[0].uri);
  }

  async function processSlip(uri: string) {
    const img = await parseAsset(uri);
    setSlipImage(img);
    setSlipStatus(null); setSlipUrl(null); setTransRef(null); setOrderAmount("");
  }

  async function verifySlipImage() {
    if (!slipImage) return;
    setSlipVerifying(true);
    setSlipStatus(null); setSlipUrl(null); setTransRef(null); setOrderAmount("");
    try {
      const fd = new FormData();
      fd.append("slip", { uri: slipImage.uri, name: slipImage.name, type: slipImage.type } as unknown as Blob);
      const res = await api.verifySlip(fd);
      setSlipUrl(res.slipUrl ?? null);
      setTransRef(res.transRef ?? null);
      if (res.success) { setSlipStatus("verified"); setOrderAmount(String(res.amount ?? "")); }
      else setSlipStatus("pending_approval");
    } catch { setSlipStatus("pending_approval"); }
    finally { setSlipVerifying(false); }
  }

  async function handleSubmit() {
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
      fd.append("tripType", tripType!);
      fd.append("customerType", customerType!);
      fd.append("visitType", visitType!);
      fd.append("result", result!);
      fd.append("details", details);
      if (orderAmount.trim()) fd.append("orderAmount", orderAmount.trim());
      if (slipUrl) fd.append("slipUrl", slipUrl);
      if (slipStatus) fd.append("slipStatus", slipStatus);
      if (transRef) fd.append("transRef", transRef);
      await api.createVisit(fd);
      await saveShopToHistory(shopName.trim());
      setShopHistory(await getShopHistory());
      Keyboard.dismiss();
      setSavedShop(shopName.trim());
      setShowSuccess(true);
      setShopName(""); setProvince(""); setDistrict("");
      setTripType(null); setCustomerType(null); setVisitType(null);
      setResult(null); setDetails(""); setOrderAmount("");
      setSlotImages({ ...EMPTY_SLOTS });
      setSlipImage(null); setSlipVerifying(false); setSlipStatus(null); setSlipUrl(null); setTransRef(null);
      captureLocation();
    } catch (err: unknown) {
      Alert.alert("ผิดพลาด", err instanceof Error ? err.message : String(err));
    } finally { setLoading(false); }
  }

  const shopSuggestions = shopName.trim()
    ? shopHistory.filter((s) => s.toLowerCase().includes(shopName.toLowerCase()) && s !== shopName)
    : shopHistory.slice(0, 5);

  const isBangkok = province === BANGKOK_PROVINCE;
  const filledCount = IMAGE_SLOTS.filter((s) => slotImages[s.key] !== null).length;
  const slipReady = result !== "buy" || (!!slipImage && !slipVerifying && !!slipStatus && !!orderAmount.trim());

  // Step progress: green when section is complete
  const step1Done = !!shopName.trim() && !!province && !!tripType && !!customerType && !!visitType;
  const step2Done = !!result && slipReady;
  const step3Done = filledCount >= MIN_IMAGES;
  const step4Done = step1Done && step2Done && step3Done;
  const stepsDone = [step1Done, step2Done, step3Done, step4Done];
  const currentStep = !step1Done ? 1 : !step2Done ? 2 : !step3Done ? 3 : 4;

  const canSubmit = step1Done && step2Done && step3Done;

  const filteredProvinces = PROVINCES.filter((p) => p.toLowerCase().includes(pickerSearch.toLowerCase()));
  const filteredDistricts = BANGKOK_DISTRICTS.filter((d) => d.toLowerCase().includes(pickerSearch.toLowerCase()));

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ flex: 1 }}>
        {/* ── Progress Steps (fixed at top) ── */}
        <View style={st.stepsWrap}>
          <View style={st.stepsRow}>
            {["ข้อมูล", "ผลลัพธ์", "รูปภาพ", "ส่ง"].map((label, i) => {
              const num = i + 1;
              const done = stepsDone[i];
              const isCurrent = !done && num === currentStep;
              return [
                <View key={`s${num}`} style={st.stepCol}>
                  <View style={[st.stepCircle, done ? st.stepCircleFilled : isCurrent ? st.stepCircleCurrent : st.stepCircleGrey]}>
                    {done
                      ? <Ionicons name="checkmark" size={12} color="#fff" />
                      : <Text style={[st.stepNum, isCurrent ? st.stepNumCurrent : st.stepNumGrey]}>{num}</Text>
                    }
                  </View>
                  <Text style={[st.stepLabel, done ? st.stepLabelFilled : isCurrent ? st.stepLabelCurrent : st.stepLabelGrey]}>{label}</Text>
                </View>,
                i < 3 && (
                  <View key={`l${num}`} style={[st.stepLine, done ? st.stepLineFilled : st.stepLineGrey]} />
                ),
              ];
            })}
          </View>
        </View>

        <ScrollView
          style={st.container}
          contentContainerStyle={{ paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
        {/* ── GPS Banner ── */}
        <View style={st.gpsBanner}>
          <View style={st.gpsIconCircle}>
            <Ionicons name="location" size={16} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.gpsLabel}>GPS พิกัด</Text>
            <Text style={st.gpsCoords}>
              {locationLoading ? "กำลังดึงพิกัด..." : latitude ? `${latitude.toFixed(6)}, ${longitude?.toFixed(6)}` : "ไม่พบพิกัด"}
            </Text>
          </View>
          <TouchableOpacity style={st.gpsRefreshBtn} onPress={captureLocation} disabled={locationLoading}>
            {locationLoading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="refresh" size={14} color="#fff" />}
          </TouchableOpacity>
        </View>

        {/* ── Card 1: ข้อมูลร้าน ── */}
        <View style={st.cardWrap}>
          <View style={st.card}>
            <View style={st.cardHeader}>
              <View style={[st.cardIconBox, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="home-outline" size={16} color={colors.primaryDark} />
              </View>
              <Text style={st.cardTitle}>ข้อมูลร้าน</Text>
            </View>
            <View style={st.cardBody}>
              <Text style={st.fieldLabel}>ชื่อร้าน <Text style={st.req}>*</Text></Text>
              <View style={[st.inputRow, st.inputFocused]}>
                <Ionicons name="search" size={15} color={colors.primary} style={{ marginRight: 8 }} />
                <TextInput
                  style={st.inputText}
                  value={shopName}
                  onChangeText={(t) => { setShopName(t); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder="ระบุชื่อร้านค้า"
                  placeholderTextColor={colors.textDisabled}
                />
              </View>
              {showSuggestions && shopSuggestions.length > 0 && (
                <View style={st.suggestionBox}>
                  {shopSuggestions.map((s) => (
                    <TouchableOpacity key={s} style={st.suggestionRow} onPress={() => { setShopName(s); setShowSuggestions(false); }}>
                      <Ionicons name="time-outline" size={14} color={colors.textDisabled} style={{ marginRight: 6 }} />
                      <Text style={st.suggestionText}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {/* Province + District: 2-column */}
              <View style={st.twoCol}>
                <View style={{ flex: 1 }}>
                  <Text style={[st.fieldLabel, { marginTop: 12 }]}>จังหวัด <Text style={st.req}>*</Text></Text>
                  <TouchableOpacity style={st.pickerBtn} onPress={() => { setPickerSearch(""); setShowProvincePicker(true); }}>
                    <Text style={province ? st.pickerText : st.pickerPlaceholder} numberOfLines={1}>{province || "เลือกจังหวัด"}</Text>
                    <Ionicons name="chevron-down" size={12} color={colors.textDisabled} />
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[st.fieldLabel, { marginTop: 12 }]}>เขต{isBangkok && <Text style={st.req}> *</Text>}</Text>
                  <TouchableOpacity
                    style={[st.pickerBtn, !isBangkok && { opacity: 0.4 }]}
                    onPress={() => { if (!isBangkok) return; setPickerSearch(""); setShowDistrictPicker(true); }}
                    disabled={!isBangkok}
                  >
                    <Text style={district && isBangkok ? st.pickerText : st.pickerPlaceholder} numberOfLines={1}>
                      {isBangkok ? (district || "เลือกเขต") : "—"}
                    </Text>
                    {isBangkok && <Ionicons name="chevron-down" size={12} color={colors.textDisabled} />}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ── Card 2: ประเภทการเยี่ยม ── */}
        <View style={[st.cardWrap, { marginTop: 10 }]}>
          <View style={st.card}>
            <View style={st.cardHeader}>
              <View style={[st.cardIconBox, { backgroundColor: "#eff6ff" }]}>
                <Ionicons name="time-outline" size={16} color="#3b82f6" />
              </View>
              <Text style={st.cardTitle}>ประเภทการเยี่ยม</Text>
            </View>
            <View style={st.cardBody}>
              {/* ทริป */}
              <View style={st.toggleRow}>
                <Text style={st.toggleLabel}>ทริป</Text>
                <View style={st.toggleGroup}>
                  {([ { key: "plan", label: "ตามแผน" }, { key: "off_plan", label: "นอกแผน" } ] as { key: TripType; label: string }[]).map(({ key, label }) => (
                    <TouchableOpacity key={key} style={[st.toggle, tripType === key && st.toggleOn]} onPress={() => setTripType(key)}>
                      <Text style={[st.toggleText, tripType === key && st.toggleTextOn]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              {/* ลูกค้า */}
              <View style={[st.toggleRow, { marginTop: 14 }]}>
                <Text style={st.toggleLabel}>ลูกค้า</Text>
                <View style={st.toggleGroup}>
                  {([ { key: "new", label: "ลูกค้าใหม่" }, { key: "existing", label: "ลูกค้าเก่า" } ] as { key: CustomerType; label: string }[]).map(({ key, label }) => (
                    <TouchableOpacity key={key} style={[st.toggle, customerType === key && st.toggleOn]} onPress={() => setCustomerType(key)}>
                      <Text style={[st.toggleText, customerType === key && st.toggleTextOn]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              {/* ภารกิจ */}
              <View style={[st.toggleRow, { marginTop: 14 }]}>
                <Text style={st.toggleLabel}>ภารกิจ</Text>
                <View style={st.toggleGroup}>
                  {([ { key: "tak", label: "ทัก" }, { key: "dem", label: "เดม" }, { key: "tel", label: "โทร" } ] as { key: VisitType; label: string }[]).map(({ key, label }) => (
                    <TouchableOpacity key={key} style={[st.toggle, visitType === key && st.toggleOn]} onPress={() => setVisitType(key)}>
                      <Text style={[st.toggleText, visitType === key && st.toggleTextOn]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ── Card 3: ผลตอบรับ + Slip ── */}
        <View style={[st.cardWrap, { marginTop: 10 }]}>
          <View style={st.card}>
            <View style={st.cardHeader}>
              <View style={[st.cardIconBox, { backgroundColor: "#fefce8" }]}>
                <Ionicons name="pulse-outline" size={16} color="#ca8a04" />
              </View>
              <Text style={st.cardTitle}>ผลตอบรับ</Text>
            </View>
            <View style={st.cardBody}>
              {/* 3-column emoji result cards */}
              <View style={st.resultGrid}>
                {RESULT_OPTIONS.map(({ key, emoji, label }) => (
                  <TouchableOpacity
                    key={key}
                    style={[st.resultCard, result === key && st.resultCardActive]}
                    onPress={() => {
                      setResult(key);
                      if (key !== "buy") {
                        setOrderAmount(""); setSlipImage(null);
                        setSlipVerifying(false); setSlipStatus(null);
                        setSlipUrl(null); setTransRef(null);
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={st.resultEmoji}>{emoji}</Text>
                    <Text style={[st.resultLabel, result === key && st.resultLabelActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Slip section — inside ผลตอบรับ card when ซื้อ */}
              {result === "buy" && (
                <View style={{ marginTop: 14 }}>
                  <Text style={st.fieldLabel}>สลิปการชำระเงิน <Text style={st.req}>*</Text></Text>
                  <TouchableOpacity onPress={pickSlip} style={st.slipBox} activeOpacity={0.8} disabled={slipVerifying}>
                    {slipImage ? (
                      <Image source={{ uri: slipImage.uri }} style={st.slipPreview} resizeMode="contain" />
                    ) : (
                      <View style={st.slipPlaceholder}>
                        <View style={st.slipIconWrap}>
                          <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} />
                        </View>
                        <Text style={st.slipUploadText}>อัปโหลดสลิป</Text>
                        <Text style={st.slipUploadSub}>ถ่ายรูปหรือเลือกจาก Gallery</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  {slipImage && !slipStatus && !slipVerifying && (
                    <TouchableOpacity onPress={verifySlipImage} style={st.verifyBtn}>
                      <Ionicons name="scan-outline" size={16} color="#fff" />
                      <Text style={st.verifyBtnText}>ตรวจสอบสลิป</Text>
                    </TouchableOpacity>
                  )}
                  {slipVerifying && (
                    <View style={st.statusRow}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={st.statusText}>กำลังตรวจสอบ QR บนสลิป...</Text>
                    </View>
                  )}
                  {!slipVerifying && slipStatus === "verified" && (
                    <View style={[st.statusRow, st.statusVerified]}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.primaryDark} />
                      <Text style={[st.statusText, { color: colors.primaryDark }]}>ยืนยัน QR สำเร็จ</Text>
                    </View>
                  )}
                  {!slipVerifying && slipStatus === "pending_approval" && (
                    <View style={[st.statusRow, st.statusPending]}>
                      <Ionicons name="time-outline" size={16} color="#d97706" />
                      <Text style={[st.statusText, { color: "#d97706" }]}>ไม่พบ QR — รอ Admin ยืนยัน</Text>
                    </View>
                  )}
                  <View style={{ marginTop: 10 }}>
                    <Text style={st.fieldLabel}>ยอดสั่งซื้อ (บาท) <Text style={st.req}>*</Text></Text>
                    <View style={[st.inputRow, slipStatus === "verified" && { backgroundColor: "#f9fafb" }]}>
                      <Text style={st.bahtSign}>฿</Text>
                      <TextInput
                        style={st.inputText}
                        value={orderAmount}
                        onChangeText={slipStatus === "verified" ? undefined : setOrderAmount}
                        editable={slipStatus !== "verified"}
                        placeholder="ระบุยอดสั่งซื้อ"
                        placeholderTextColor={colors.textDisabled}
                        keyboardType="numeric"
                      />
                    </View>
                    {slipStatus === "verified" && <Text style={st.lockedNote}>ยอดเงินอ้างอิงจาก QR สลิป</Text>}
                    {slipStatus === "pending_approval" && <Text style={st.lockedNote}>กรอกจำนวนเงินตามข้อมูลในสลิป</Text>}
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ── Card 4: สรุปผล ── */}
        <View style={[st.cardWrap, { marginTop: 10 }]}>
          <View style={st.card}>
            <View style={st.cardHeader}>
              <View style={[st.cardIconBox, { backgroundColor: "#f5f3ff" }]}>
                <Ionicons name="pencil-outline" size={16} color="#8b5cf6" />
              </View>
              <Text style={st.cardTitle}>สรุปผล</Text>
            </View>
            <View style={st.cardBody}>
              <TextInput
                style={st.textarea}
                value={details}
                onChangeText={setDetails}
                placeholder="บันทึกสรุปผลเพิ่มเติม..."
                placeholderTextColor={colors.textDisabled}
                multiline
                textAlignVertical="top"
              />
            </View>
          </View>
        </View>

        {/* ── Card 5: รูปภาพ (3-column grid) ── */}
        <View style={[st.cardWrap, { marginTop: 10 }]}>
          <View style={st.card}>
            <View style={st.cardHeader}>
              <View style={[st.cardIconBox, { backgroundColor: "#fff7ed" }]}>
                <Ionicons name="image-outline" size={16} color="#ea580c" />
              </View>
              <Text style={st.cardTitle}>รูปภาพ <Text style={st.req}>*</Text></Text>
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <View style={[st.imgCountBadge, filledCount > 0 ? st.imgCountOk : st.imgCountWarn]}>
                  <Text style={[st.imgCountText, filledCount > 0 ? st.imgCountTextOk : st.imgCountTextWarn]}>
                    {filledCount} / 6
                  </Text>
                </View>
              </View>
            </View>
            <View style={[st.cardBody, { paddingTop: 14 }]}>
              <View style={st.imgGrid}>
                {IMAGE_SLOTS.map((slot) => {
                  const img = slotImages[slot.key];
                  return img ? (
                    <TouchableOpacity key={slot.key} style={st.imgCellFilled} onPress={() => pickForSlot(slot.key)} activeOpacity={0.85}>
                      <Image source={{ uri: img.uri }} style={st.imgCellImage} />
                      <View style={st.imgCellOverlay}>
                        <Text style={st.imgCellOverlayText} numberOfLines={1}>{slot.label}</Text>
                      </View>
                      <View style={st.imgCheckBadge}>
                        <Ionicons name="checkmark" size={8} color="#fff" />
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity key={slot.key} style={st.imgCellEmpty} onPress={() => pickForSlot(slot.key)} activeOpacity={0.7}>
                      <View style={st.imgCellContent}>
                        <Ionicons name="camera-outline" size={18} color={colors.textDisabled} />
                        <Text style={st.imgSlotLabel} numberOfLines={2}>{slot.label}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={st.imgNote}>กดที่ช่องเพื่อเพิ่มรูป</Text>
            </View>
          </View>
        </View>

        {/* ── Submit button ── */}
        <View style={st.submitWrap}>
          <TouchableOpacity
            style={[st.submitBtn, !canSubmit && st.submitBtnOff]}
            onPress={handleSubmit}
            disabled={!canSubmit || loading}
            activeOpacity={0.88}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send-outline" size={18} color="#fff" />
                <Text style={st.submitText}>บันทึกการเยี่ยมร้าน</Text>
              </>
            )}
          </TouchableOpacity>
          {!canSubmit && <Text style={st.submitHint}>กรอกข้อมูลให้ครบเพื่อส่ง</Text>}
        </View>

        </ScrollView>
      </View>

      <Modal visible={showSuccess} transparent animationType="fade" onRequestClose={() => setShowSuccess(false)}>
        <View style={st.successOverlay}>
          <View style={st.successCard}>
            <View style={st.successCircle}>
              <Ionicons name="checkmark" size={40} color="#fff" />
            </View>
            <Text style={st.successTitle}>บันทึกสำเร็จ!</Text>
            {!!savedShop && <Text style={st.successShop}>{savedShop}</Text>}
            <Text style={st.successSub}>ข้อมูลการเยี่ยมร้านถูกบันทึกแล้ว</Text>
            <TouchableOpacity style={st.successBtn} onPress={() => setShowSuccess(false)} activeOpacity={0.8}>
              <Text style={st.successBtnText}>ปิด</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
            <TextInput style={modal.searchInput} value={search} onChangeText={onSearch}
              placeholder="ค้นหา..." placeholderTextColor={colors.textDisabled} autoFocus />
          </View>
          <FlatList
            data={items} keyExtractor={(item) => item}
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

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  // GPS Banner
  gpsBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#16a34a", paddingHorizontal: 16, paddingVertical: 12,
  },
  gpsIconCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  gpsLabel: {
    fontSize: 10, color: "rgba(255,255,255,0.65)", fontWeight: "600",
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  gpsCoords: { fontSize: 12, color: "#fff", fontWeight: "700", marginTop: 1 },
  gpsRefreshBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },

  // Progress Steps
  stepsWrap: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  stepsRow: { flexDirection: "row", alignItems: "center" },
  stepCol: { flex: 1, alignItems: "center", gap: 4 },
  stepCircle: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  stepCircleFilled: { backgroundColor: colors.primary },
  stepCircleGrey: { backgroundColor: colors.borderLight },
  stepNum: { fontSize: 11, fontWeight: "800" },
  stepNumFilled: { color: "#fff" },
  stepNumGrey: { color: colors.textDisabled },
  stepLabel: { fontSize: 9, fontWeight: "700", textAlign: "center" },
  stepLabelFilled: { color: colors.primaryDark },
  stepLabelGrey: { color: colors.textDisabled },
  stepLine: { flex: 1, height: 2, borderRadius: 2, marginBottom: 14 },
  stepLineFilled: { backgroundColor: colors.primary },
  stepLineGrey: { backgroundColor: colors.borderLight },
  stepCircleCurrent: { backgroundColor: "#fff", borderWidth: 2, borderColor: colors.primary },
  stepNumCurrent: { color: colors.primary },
  stepLabelCurrent: { color: colors.primary },

  // Cards
  cardWrap: { paddingHorizontal: 14, marginTop: 12 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius["3xl"],
    borderWidth: 1, borderColor: colors.borderLight,
    overflow: "hidden",
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  cardIconBox: { width: 30, height: 30, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 13, fontWeight: "800", color: colors.textPrimary },
  cardBody: { paddingHorizontal: 16, paddingVertical: 14 },

  // Fields
  fieldLabel: {
    fontSize: 10, fontWeight: "700", color: colors.textDisabled,
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 7,
  },
  req: { color: colors.error },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.surface,
  },
  inputFocused: { borderColor: colors.primary },
  inputText: { flex: 1, fontSize: 14, fontWeight: "500", color: colors.textPrimary },
  bahtSign: { fontSize: 15, fontWeight: "800", color: colors.textMuted, marginRight: 6 },

  suggestionBox: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, backgroundColor: colors.surface,
    marginTop: 2, overflow: "hidden",
  },
  suggestionRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  suggestionText: { fontSize: 14, color: colors.textSecondary },

  twoCol: { flexDirection: "row", gap: 10 },
  pickerBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.surface,
  },
  pickerText: { fontSize: 13, fontWeight: "600", color: colors.textPrimary, flex: 1 },
  pickerPlaceholder: { fontSize: 13, color: colors.textDisabled, flex: 1 },

  // Toggle pills
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  toggleLabel: { fontSize: 12, fontWeight: "700", color: colors.textSecondary },
  toggleGroup: { flexDirection: "row", gap: 6 },
  toggle: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bg,
  },
  toggleOn: { backgroundColor: colors.primary, borderColor: "transparent" },
  toggleText: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
  toggleTextOn: { color: "#fff" },

  // Result emoji cards
  resultGrid: { flexDirection: "row", gap: 8 },
  resultCard: {
    flex: 1, alignItems: "center", paddingVertical: 12, paddingHorizontal: 8,
    borderRadius: radius.md, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface,
  },
  resultCardActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  resultEmoji: { fontSize: 18, marginBottom: 4 },
  resultLabel: { fontSize: 12, fontWeight: "800", color: colors.textMuted },
  resultLabelActive: { color: colors.primaryDark },

  // Slip
  slipBox: {
    borderWidth: 2, borderColor: colors.primaryBorder, borderStyle: "dashed",
    borderRadius: radius.lg, backgroundColor: colors.primaryLight,
    minHeight: 100, overflow: "hidden",
  },
  slipPreview: { width: "100%", height: 180 },
  slipPlaceholder: { alignItems: "center", justifyContent: "center", gap: 6, padding: 20 },
  slipIconWrap: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.surface, alignItems: "center", justifyContent: "center",
    ...shadows.card,
  },
  slipUploadText: { fontSize: 13, fontWeight: "700", color: colors.primaryDark },
  slipUploadSub: { fontSize: 11, color: colors.textMuted },
  verifyBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    marginTop: 8, paddingVertical: 11, backgroundColor: colors.primaryDark, borderRadius: radius.md,
  },
  verifyBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  statusRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md,
  },
  statusVerified: { backgroundColor: colors.primaryLight },
  statusPending: { backgroundColor: "#fffbeb" },
  statusText: { fontSize: 13, color: colors.textMuted, fontWeight: "500" },
  lockedNote: { fontSize: 11, color: colors.textDisabled, marginTop: 4 },

  // Textarea
  textarea: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    padding: 12, minHeight: 78, fontSize: 14, fontWeight: "500",
    color: colors.textSecondary, backgroundColor: colors.bg,
  },

  // Image grid (3-column square)
  imgGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  imgCellFilled: {
    width: "31.5%", aspectRatio: 1,
    borderRadius: radius.md, overflow: "hidden",
    position: "relative",
    borderWidth: 2, borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  imgCellImage: { width: "100%", height: "100%" },
  imgCellOverlay: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.45)", paddingHorizontal: 6, paddingVertical: 3,
  },
  imgCellOverlayText: { color: "#fff", fontSize: 9, fontWeight: "600" },
  imgCheckBadge: {
    position: "absolute", top: 4, right: 4,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  imgCellEmpty: {
    width: "31.5%", aspectRatio: 1,
    borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.borderDashed, borderStyle: "dashed",
    backgroundColor: colors.bg,
    overflow: "hidden",
  },
  imgCellContent: {
    flex: 1, alignItems: "center", justifyContent: "center", gap: 4,
  },
  imgSlotLabel: { fontSize: 9, fontWeight: "700", color: colors.textDisabled, textAlign: "center", paddingHorizontal: 4, marginTop: 2 },
  imgCountBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full },
  imgCountOk: { backgroundColor: colors.successBg, borderWidth: 1, borderColor: colors.primaryBorder },
  imgCountWarn: { backgroundColor: colors.errorBg, borderWidth: 1, borderColor: "#fecaca" },
  imgCountText: { fontSize: 10, fontWeight: "800" },
  imgCountTextOk: { color: colors.primaryDark },
  imgCountTextWarn: { color: colors.error },
  imgNote: { marginTop: 10, fontSize: 10, color: colors.textDisabled, textAlign: "center", fontWeight: "500" },

  // Submit
  submitWrap: { paddingHorizontal: 14, marginTop: 14, marginBottom: 6 },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: colors.primary, borderRadius: radius["3xl"], paddingVertical: 16,
  },
  submitBtnOff: { opacity: 0.4 },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 15, letterSpacing: -0.2 },
  submitHint: { textAlign: "center", marginTop: 8, fontSize: 11, color: colors.textDisabled, fontWeight: "500" },

  // Success modal
  successOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center", justifyContent: "center", padding: 32,
  },
  successCard: {
    backgroundColor: "#fff", borderRadius: 24, padding: 32,
    alignItems: "center", width: "100%", maxWidth: 320,
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
  },
  successCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center", marginBottom: 20,
  },
  successTitle: {
    fontSize: 22, fontWeight: "800", color: colors.textPrimary,
    marginBottom: 6, letterSpacing: -0.5,
  },
  successShop: {
    fontSize: 15, fontWeight: "700", color: colors.primary,
    marginBottom: 6, textAlign: "center",
  },
  successSub: {
    fontSize: 13, color: colors.textMuted, marginBottom: 24, textAlign: "center",
  },
  successBtn: {
    backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 40,
  },
  successBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
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
    flexDirection: "row", alignItems: "center",
    margin: 12, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary },
  item: { paddingHorizontal: 20, paddingVertical: 14 },
  itemText: { fontSize: 15, color: colors.textPrimary },
  separator: { height: 1, backgroundColor: colors.borderLight },
});
