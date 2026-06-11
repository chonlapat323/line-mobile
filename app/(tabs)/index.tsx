import { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, Pressable, StyleSheet, ScrollView,
  Image, Alert, ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { api, getStoredUser } from "@/lib/api";

export default function SendScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [title, setTitle] = useState("สินค้าทดสอบ");
  const [price, setPrice] = useState("350");
  const [note, setNote] = useState("test");
  const [image, setImage] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getStoredUser().then((u) => { if (u) setUserId(u.id); });
  }, []);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const rawName = asset.uri.split("/").pop() || "image.jpg";
      const isPng = rawName.toLowerCase().endsWith(".png");
      // แปลง HEIC และรูปแบบอื่นๆ เป็น JPEG, คงไว้แค่ PNG
      const name = isPng ? rawName : rawName.replace(/\.[^.]+$/, "") + ".jpg";
      const type = isPng ? "image/png" : "image/jpeg";
      setImage({ uri: asset.uri, name, type });
    }
  }

  async function handleSend() {
    console.log('[SEND] image:', image?.uri, 'title:', title, 'userId:', userId);
    if (!image || !title || !userId) {
      Alert.alert("แจ้งเตือน", `กรุณากรอกข้อมูลให้ครบ\nimage=${!!image} title=${!!title} userId=${!!userId}`);
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("image", { uri: image.uri, name: image.name, type: image.type } as unknown as Blob);
      fd.append("title", title);
      fd.append("price", price);
      fd.append("note", note);
      fd.append("targetUserIds", JSON.stringify([userId]));
      await api.sendMessage(fd);
      Alert.alert("สำเร็จ", "ส่งรูปเข้า LINE Group แล้ว");
      setImage(null); setTitle(""); setPrice(""); setNote("");
    } catch (err: unknown) {
      console.error('[SEND] catch error:', err);
      Alert.alert("ผิดพลาด", err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
        {image ? (
          <Image source={{ uri: image.uri }} style={styles.imagePreview} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imagePlaceholderIcon}>📷</Text>
            <Text style={styles.imagePlaceholderText}>แตะเพื่อเลือกรูป</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.form}>
        <Text style={styles.label}>ชื่อสินค้า *</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="ระบุชื่อสินค้า" />

        <Text style={styles.label}>ราคา</Text>
        <TextInput style={styles.input} value={price} onChangeText={setPrice} placeholder="เช่น 350 บาท" keyboardType="numeric" />

        <Text style={styles.label}>หมายเหตุ</Text>
        <TextInput style={[styles.input, { height: 72 }]} value={note} onChangeText={setNote} placeholder="รายละเอียดเพิ่มเติม" multiline />

        <TouchableOpacity style={[styles.sendButton, loading && styles.sendButtonDisabled]}
          onPress={handleSend} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendButtonText}>ส่งเข้า LINE Group ของฉัน</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  imagePicker: { margin: 16, borderRadius: 12, overflow: "hidden", backgroundColor: "#e5e7eb", height: 200 },
  imagePreview: { width: "100%", height: "100%", resizeMode: "cover" },
  imagePlaceholder: { flex: 1, justifyContent: "center", alignItems: "center" },
  imagePlaceholderIcon: { fontSize: 40, marginBottom: 8 },
  imagePlaceholderText: { color: "#9ca3af", fontSize: 14 },
  form: { paddingHorizontal: 16 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: "#fff", color: "#111827" },
  sendButton: { backgroundColor: "#22c55e", borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 20 },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
