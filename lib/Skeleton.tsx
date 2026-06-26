import { useEffect, useRef } from "react";
import { Animated, StyleProp, ViewStyle } from "react-native";

interface SkeletonBoxProps {
  width?: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export function SkeletonBox({ width = "100%", height, borderRadius = 8, style }: SkeletonBoxProps) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.75, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: "#e5e7eb", opacity }, style]}
    />
  );
}
