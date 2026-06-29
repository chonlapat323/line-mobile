import { useState, useRef, useCallback } from "react";
import {
  View, Text, Image, Modal, FlatList, ScrollView,
  TouchableOpacity, useWindowDimensions, StyleSheet, ViewToken,
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
  const listRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setIdx(viewableItems[0].index);
    }
  }, []);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 });

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
          <TouchableOpacity onPress={onClose} style={st.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Swipeable list — FlatList handles horizontal swipe between images */}
        <FlatList
          ref={listRef}
          data={images}
          keyExtractor={(_, i) => String(i)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig.current}
          style={{ flex: 1 }}
          renderItem={({ item }) => (
            // ScrollView inside each page for pinch-to-zoom (works best on iOS)
            <ScrollView
              style={{ width }}
              contentContainerStyle={{ height: height * 0.88, alignItems: "center", justifyContent: "center" }}
              maximumZoomScale={4}
              minimumZoomScale={1}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              centerContent
            >
              <Image
                source={{ uri: item }}
                style={{ width, height: height * 0.82 }}
                resizeMode="contain"
              />
            </ScrollView>
          )}
        />

        {/* Dot indicators */}
        {images.length > 1 && (
          <View style={st.dots}>
            {images.map((_, i) => (
              <View key={i} style={[st.dot, i === idx && st.dotActive]} />
            ))}
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
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  labelText: { color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: "600", flex: 1 },
  countText: { color: "rgba(255,255,255,0.5)", fontWeight: "400" },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center", marginLeft: 10,
  },
  dots: {
    position: "absolute", bottom: 36, left: 0, right: 0,
    flexDirection: "row", justifyContent: "center", gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.35)" },
  dotActive: { width: 16, backgroundColor: "#fff" },
});
