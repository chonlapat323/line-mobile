import { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Image, Alert, ActivityIndicator, FlatList,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { api, getStoredUser } from "@/lib/api";

const MAX_IMAGES = 6;

interface PickedImage {
  uri: string;
  name: string;
  type: string;
}

export default function SendScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [images, setImages] = useState<PickedImage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getStoredUser().then((u) => { if (u) setUserId(u.id); });
  }, []);

  function parseAsset(uri: string): PickedImage {
    const rawName = uri.split("/").pop() || "image.jpg";
    const isPng = rawName.toLowerCase().endsWith(".png");
    const name = isPng ? rawName : rawName.replace(/\.[^.]+$/, "") + ".jpg";
    const type = isPng ? "image/png" : "image/jpeg";
    return { uri, name, type };
  }

  async function openGallery() {
    const remaining = MAX_IMAGES - images.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets.length > 0) {
      const picked = result.assets.map((a) => parseAsset(a.uri));
      setImages((prev) => [...prev, ...picked].slice(0, MAX_IMAGES));
    }
  }

  async function openCamera() {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) {
      Alert.alert("ไม่ได้รับอนุญาต", "กรุณาเปิดสิทธิ์กล้องในการตั้งค่าของเครื่อง");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setImages((prev) => [...prev, parseAsset(result.assets[0].uri)].slice(0, MAX_IMAGES));
    }
  }

  function pickImages() {
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      Alert.alert("ครบแล้ว", `เลือกได้สูงสุด ${MAX_IMAGES} รูป`);
      return;
    }
    Alert.alert("เพิ่มรูป", "เลือกวิธีเพิ่มรูป", [
      { text: "📷 ถ่ายรูป", onPress: openCamera },
      { text: "🖼 เลือกจาก Gallery", onPress: openGallery },
      { text: "ยกเลิก", style: "cancel" },
    ]);
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSend() {
    if (images.length === 0 || !title || !userId) {
      Alert.alert("แจ้งเตือน", "กรุณาเลือกรูปและระบุชื่อสินค้า");
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      images.forEach((img) => {
        fd.append("images", { uri: img.uri, name: img.name, type: img.type } as unknown as Blob);
      });
      fd.append("title", title);
      fd.append("price", price);
      fd.append("note", note);
      fd.append("targetUserIds", JSON.stringify([userId]));
      await api.sendMessage(fd);
      Alert.alert("สำเร็จ", `ส่ง ${images.length} รูปเข้า LINE Group แล้ว`);
      setImages([]);
      setTitle("");
      setPrice("");
      setNote("");
    } catch (err: unknown) {
      Alert.alert("ผิดพลาด", err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 48 }}>
      {/* Image picker area */}
      <View style={styles.pickerSection}>
        <View style={styles.imageGrid}>
          {images.map((img, index) => (
            <View key={index} style={styles.imageCell}>
              <Image source={{ uri: img.uri }} style={styles.imageCellImg} />
              <TouchableOpacity style={styles.removeBtn} onPress={() => removeImage(index)}>
                <Text style={styles.removeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}

          {images.length < MAX_IMAGES && (
            <TouchableOpacity style={styles.addCell} onPress={pickImages}>
              <Text style={styles.addIcon}>＋</Text>
              <Text style={styles.addText}>
                {images.length === 0 ? "เลือกรูป" : "เพิ่มรูป"}
              </Text>
              <Text style={styles.addCount}>{images.length}/{MAX_IMAGES}</Text>
            </TouchableOpacity>
          )}
        </View>

        {images.length > 0 && (
          <TouchableOpacity style={styles.clearAll} onPress={() => setImages([])}>
            <Text style={styles.clearAllText}>ล้างทั้งหมด</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Form */}
      <View style={styles.form}>
        <Text style={styles.label}>ชื่อสินค้า *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="ระบุชื่อสินค้า"
          placeholderTextColor="#9ca3af"
        />

        <Text style={styles.label}>ราคา</Text>
        <TextInput
          style={styles.input}
          value={price}
          onChangeText={setPrice}
          placeholder="เช่น 350"
          keyboardType="numeric"
          placeholderTextColor="#9ca3af"
        />

        <Text style={styles.label}>หมายเหตุ</Text>
        <TextInput
          style={[styles.input, { height: 80 }]}
          value={note}
          onChangeText={setNote}
          placeholder="รายละเอียดเพิ่มเติม"
          multiline
          placeholderTextColor="#9ca3af"
        />

        <TouchableOpacity
          style={[styles.sendButton, (loading || images.length === 0) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={loading || images.length === 0}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>
              {images.length > 0
                ? `ส่ง ${images.length} รูป เข้า LINE Group`
                : "กรุณาเลือกรูปก่อน"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const CELL_SIZE = 110;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  pickerSection: { padding: 16 },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  imageCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  imageCellImg: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtnText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  addCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#d1d5db",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    gap: 2,
  },
  addIcon: { fontSize: 24, color: "#9ca3af" },
  addText: { fontSize: 12, color: "#6b7280", fontWeight: "600" },
  addCount: { fontSize: 11, color: "#d1d5db" },
  clearAll: { marginTop: 10, alignSelf: "flex-end" },
  clearAllText: { fontSize: 12, color: "#ef4444" },
  form: { paddingHorizontal: 16 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: "#fff",
    color: "#111827",
  },
  sendButton: {
    backgroundColor: "#16a34a",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 20,
  },
  sendButtonDisabled: { opacity: 0.45 },
  sendButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
