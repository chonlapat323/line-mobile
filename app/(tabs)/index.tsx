import { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Image, Alert, ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { api } from "@/lib/api";

interface User { id: string; fullName: string; email: string; }

export default function SendScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [image, setImage] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.getUsers().then(setUsers).catch(console.error); }, []);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const name = asset.uri.split("/").pop() || "image.jpg";
      const type = name.endsWith(".png") ? "image/png" : "image/jpeg";
      setImage({ uri: asset.uri, name, type });
    }
  }

  function toggleUser(id: string) {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function handleSend() {
    if (!image || !title || selectedIds.length === 0) {
      Alert.alert("แจ้งเตือน", "กรุณากรอกข้อมูลและเลือก User ให้ครบ");
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("image", { uri: image.uri, name: image.name, type: image.type } as unknown as Blob);
      fd.append("title", title);
      fd.append("price", price);
      fd.append("note", note);
      fd.append("targetUserIds", JSON.stringify(selectedIds));
      await api.sendMessage(fd);
      Alert.alert("สำเร็จ", "ส่งรูปเข้า LINE Group แล้ว");
      setImage(null); setTitle(""); setPrice(""); setNote(""); setSelectedIds([]);
    } catch (err: unknown) {
      Alert.alert("ผิดพลาด", err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
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

        <Text style={styles.label}>เลือก User</Text>
        <View style={styles.userList}>
          {users.map((u) => {
            const selected = selectedIds.includes(u.id);
            return (
              <TouchableOpacity key={u.id} style={[styles.userItem, selected && styles.userItemSelected]}
                onPress={() => toggleUser(u.id)}>
                <Text style={[styles.userName, selected && styles.userNameSelected]}>{u.fullName}</Text>
                <Text style={styles.userEmail}>{u.email}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={[styles.sendButton, loading && styles.sendButtonDisabled]}
          onPress={handleSend} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendButtonText}>ส่งเข้า LINE Group</Text>}
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
  userList: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, overflow: "hidden", backgroundColor: "#fff" },
  userItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  userItemSelected: { backgroundColor: "#f0fdf4" },
  userName: { fontSize: 14, color: "#374151", fontWeight: "500" },
  userNameSelected: { color: "#16a34a" },
  userEmail: { fontSize: 12, color: "#9ca3af" },
  sendButton: { backgroundColor: "#22c55e", borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 20 },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
