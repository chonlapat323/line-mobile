import { useState } from "react";
import {
  View, Text, Image, Modal, ScrollView,
  TouchableOpacity, useWindowDimensions, StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  images: string[];
  labels?: string[];
  initialIndex?: number;
  onClose: () => void;
}

export function ImageViewer({ images, labels = [], initialIndex = 0, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const [idx, setIdx] = useState(initialIndex);

  if (!images.length) return null;

  return (
    <Modal visible animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={st.overlay}>
        {/* Header */}
        <View style={st.header}>
          <Text style={st.labelText} numberOfLines={1}>
            {labels[idx] ?? `รูป ${idx + 1}`}
            {"  "}
            <Text style={st.countText}>{idx + 1} / {images.length}</Text>
          </Text>
          <TouchableOpacity onPress={onClose} style={st.closeBtn}>
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Zoomable image — key=idx resets zoom on each navigation */}
        <ScrollView
          key={idx}
          style={{ flex: 1 }}
          contentContainerStyle={st.imgContainer}
          maximumZoomScale={4}
          minimumZoomScale={1}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          centerContent
        >
          <Image
            source={{ uri: images[idx] }}
            style={{ width, height: height * 0.82 }}
            resizeMode="contain"
          />
        </ScrollView>

        {/* Prev / dots / next */}
        {images.length > 1 && (
          <View style={st.nav}>
            <TouchableOpacity
              onPress={() => setIdx((p) => Math.max(0, p - 1))}
              disabled={idx === 0}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons
                name="chevron-back-circle"
                size={42}
                color={idx === 0 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.85)"}
              />
            </TouchableOpacity>

            <View style={st.dots}>
              {images.map((_, i) => (
                <TouchableOpacity key={i} onPress={() => setIdx(i)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                  <View style={[st.dot, i === idx && st.dotActive]} />
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={() => setIdx((p) => Math.min(images.length - 1, p + 1))}
              disabled={idx === images.length - 1}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons
                name="chevron-forward-circle"
                size={42}
                color={idx === images.length - 1 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.85)"}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#000" },
  header: {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
    paddingTop: 52, paddingHorizontal: 18,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  labelText: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "600", flex: 1 },
  countText: { color: "rgba(255,255,255,0.45)", fontWeight: "400" },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center", marginLeft: 10,
  },
  imgContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  nav: {
    position: "absolute", bottom: 44, left: 0, right: 0,
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingHorizontal: 16,
  },
  dots: { flexDirection: "row", gap: 6, alignItems: "center" },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.35)" },
  dotActive: { width: 16, backgroundColor: "#fff" },
});
