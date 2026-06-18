# BeautyUp LINE Mobile — Design Specification

> ไฟล์นี้เป็น design spec สำหรับ Claude Code ใช้ implement UI ของแอป BeautyUp LINE (React Native / Expo Router)
> ทุก StyleSheet ที่ให้ไว้สามารถ copy ไปใช้ได้เลย

---

## 1. Design Tokens

### Colors
```ts
export const colors = {
  // Primary — Green (Brand)
  primary:       '#22c55e',   // Green 500 — buttons, active tabs
  primaryDark:   '#16a34a',   // Green 600 — submit buttons, hover states
  primaryLight:  '#f0fdf4',   // Green 50  — backgrounds, selected pills
  primaryBorder: '#bbf7d0',   // Green 200 — borders on light green bg
  primaryText:   '#15803d',   // Green 700 — text on light green bg

  // LINE Brand
  lineGreen:     '#06c755',

  // Neutral
  bg:            '#f8fafc',   // Page background
  surface:       '#ffffff',   // Cards, inputs
  surfaceMuted:  '#f9fafb',   // Input background (unfocused)
  border:        '#e5e7eb',   // Default border
  borderLight:   '#f3f4f6',   // Dividers
  borderDashed:  '#d1d5db',   // Dashed borders (image picker)

  // Text
  textPrimary:   '#111827',   // Main text
  textSecondary: '#374151',   // Labels, secondary text
  textMuted:     '#6b7280',   // Hints, placeholders
  textDisabled:  '#9ca3af',   // Disabled / empty states

  // Status
  error:         '#dc2626',   // Error text
  errorBg:       '#fee2e2',   // Error badge bg
  errorLight:    '#fef2f2',   // Error surface
  successBg:     '#dcfce7',   // Success badge bg
  infoBg:        '#dbeafe',   // Info badge (ลูกค้าใหม่)
  infoText:      '#1d4ed8',
  warningBg:     '#fef9c3',
  warningText:   '#854d0e',
};
```

### Typography
```ts
export const typography = {
  // Font sizes
  xs:   11,
  sm:   12,
  base: 13,
  md:   14,
  lg:   15,
  xl:   16,
  '2xl': 18,
  '3xl': 20,
  '4xl': 22,
  '5xl': 24,

  // Font weights
  regular:   '400',
  medium:    '500',
  semibold:  '600',
  bold:      '700',
  extrabold: '800',
};
```

### Spacing
```ts
export const spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 32,
};
```

### Border Radius
```ts
export const radius = {
  sm:   8,
  md:   10,
  lg:   12,
  xl:   14,
  '2xl': 16,
  '3xl': 20,
  full: 999,
};
```

### Shadows
```ts
export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  modal: {
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
};
```

---

## 2. Shared Components

### TabBar Layout (`_layout.tsx`)
```ts
screenOptions={{
  tabBarActiveTintColor: colors.primary,         // '#22c55e'
  tabBarInactiveTintColor: colors.textDisabled,  // '#9ca3af'
  tabBarStyle: {
    borderTopColor: colors.borderLight,
    borderTopWidth: 1,
    paddingBottom: 8,
    paddingTop: 4,
    height: 58,
  },
  headerStyle: {
    backgroundColor: colors.surface,
  },
  headerTitleStyle: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 17,
  },
  headerShadowVisible: false,
  headerStatusBarHeight: undefined,
}}
```

### Common Input Style
```ts
input: {
  borderWidth: 1.5,
  borderColor: colors.border,          // '#e5e7eb'
  borderRadius: radius.md,             // 10
  paddingHorizontal: 12,
  paddingVertical: 10,
  fontSize: typography.md,             // 14
  backgroundColor: colors.surface,    // '#fff'
  color: colors.textPrimary,           // '#111827'
},
// focused state (use onFocus/onBlur state)
inputFocused: {
  borderColor: colors.primary,         // '#22c55e'
  backgroundColor: colors.surface,
},
```

### Primary Button
```ts
button: {
  backgroundColor: colors.primaryDark,  // '#16a34a'
  borderRadius: radius.lg,              // 12
  paddingVertical: 14,
  alignItems: 'center',
},
buttonText: {
  color: '#fff',
  fontWeight: '700',
  fontSize: typography.lg,              // 15
},
buttonDisabled: {
  opacity: 0.45,
},
```

### Card
```ts
card: {
  backgroundColor: colors.surface,     // '#fff'
  borderRadius: radius.xl,             // 14
  padding: 12,
  borderWidth: 0.5,
  borderColor: colors.borderLight,     // '#f3f4f6'
  ...shadows.card,
},
```

### Pill / Toggle Button
```ts
pill: {
  paddingHorizontal: 18,
  paddingVertical: 9,
  borderRadius: radius.full,           // 999
  borderWidth: 1.5,
  borderColor: colors.borderDashed,    // '#d1d5db'
  backgroundColor: colors.surface,
},
pillActive: {
  borderColor: colors.primaryDark,     // '#16a34a'
  backgroundColor: colors.primaryLight,// '#f0fdf4'
},
pillText: {
  fontSize: typography.md,             // 14
  color: colors.textMuted,             // '#6b7280'
  fontWeight: '500',
},
pillTextActive: {
  color: colors.primaryDark,           // '#16a34a'
  fontWeight: '700',
},
```

### Status Badge
```ts
badge: {
  paddingHorizontal: 10,
  paddingVertical: 4,
  borderRadius: radius.full,
},
badgeSuccess: { backgroundColor: colors.successBg },     // '#dcfce7'
badgeSuccessText: { color: colors.primaryDark, fontWeight: '600', fontSize: 11 },
badgeFail: { backgroundColor: colors.errorBg },          // '#fee2e2'
badgeFailText: { color: colors.error, fontWeight: '600', fontSize: 11 },
badgeNew: { backgroundColor: colors.infoBg },            // '#dbeafe'
badgeNewText: { color: colors.infoText, fontWeight: '600', fontSize: 11 },
```

### Image Grid Cell
```ts
const CELL_SIZE = 80;  // ปรับเป็น 80 จาก 100/110 เดิมให้พอดีจอ

imageGrid: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 8,
},
imageCell: {
  width: CELL_SIZE,
  height: CELL_SIZE,
  borderRadius: radius.md,    // 10
  overflow: 'hidden',
  position: 'relative',
},
imageCellImg: {
  width: '100%',
  height: '100%',
  resizeMode: 'cover',
},
removeBtn: {
  position: 'absolute',
  top: 4, right: 4,
  width: 22, height: 22,
  borderRadius: 11,
  backgroundColor: 'rgba(0,0,0,0.55)',
  alignItems: 'center',
  justifyContent: 'center',
},
removeBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
addCell: {
  width: CELL_SIZE,
  height: CELL_SIZE,
  borderRadius: radius.md,
  borderWidth: 1.5,
  borderColor: colors.borderDashed,  // '#d1d5db'
  borderStyle: 'dashed',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: colors.surface,
  gap: 2,
},
addIcon: { fontSize: 22, color: colors.textDisabled },
addText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
```

---

## 3. Screen Specs

### 3.1 Login (`app/login.tsx`)

**Layout:** Full screen, center-aligned, light green gradient background

**Key changes from current:**
- เพิ่ม logo block (ตัว "B" หรือ icon ใน square rounded)
- ปรับ subtitle เป็น "ระบบบันทึกการเยี่ยมร้านค้า" (ชัดเจนกว่า)
- Input มี label แยกด้านบน (ไม่ใช่ placeholder-only)
- Card มี shadow นิดหน่อย

```tsx
// container
container: {
  flex: 1,
  backgroundColor: '#f0fdf4',  // light green bg
  justifyContent: 'center',
  alignItems: 'center',
  padding: 24,
}

// logo
logoWrap: {
  width: 64, height: 64,
  borderRadius: 20,
  backgroundColor: colors.primary,  // '#22c55e'
  justifyContent: 'center',
  alignItems: 'center',
  marginBottom: 16,
}
logoText: { color: '#fff', fontSize: 26, fontWeight: '700' }

// app name
appName: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 }
appSub: { fontSize: 13, color: colors.textDisabled, marginBottom: 28 }

// card
card: {
  width: '100%',
  backgroundColor: colors.surface,
  borderRadius: 20,
  padding: 24,
  borderWidth: 0.5,
  borderColor: colors.border,
  shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, elevation: 4,
}

// label above input
fieldLabel: {
  fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 5,
}

// input — same as common input, marginBottom: 14
// button — same as primary button, marginTop: 16
```

---

### 3.2 Record (`app/(tabs)/record.tsx`)

**Header:** เพิ่ม subtitle "กรอกข้อมูลให้ครบก่อนส่ง"

```ts
// Header subtitle — ใส่ใน options ของ Tabs.Screen
headerTitle: () => (
  <View>
    <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textPrimary }}>บันทึกการเยี่ยมร้าน</Text>
    <Text style={{ fontSize: 12, color: colors.textDisabled }}>กรอกข้อมูลให้ครบก่อนส่ง</Text>
  </View>
)
```

**GPS Bar:**
```ts
gpsRow: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: colors.primaryLight,  // '#f0fdf4'
  borderWidth: 1,
  borderColor: colors.primaryBorder,     // '#bbf7d0'
  borderRadius: radius.md,              // 10
  paddingHorizontal: 12,
  paddingVertical: 10,
  gap: 8,
},
gpsDot: {
  width: 8, height: 8, borderRadius: 4,
  backgroundColor: colors.primary,      // animated pulse ถ้าต้องการ
},
gpsText: { flex: 1, fontSize: 11, color: colors.primaryText, fontFamily: 'monospace' },
gpsRefreshBtn: { fontSize: 18, color: colors.textMuted },  // ↻
```

**Section wrapper:**
```ts
section: { paddingHorizontal: 16, marginTop: 16 },
label: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
```

**Image count warning:**
```ts
imageCountWarn: {
  fontSize: 11, color: colors.error, fontWeight: '600',
}
// แสดงเมื่อ images.length < MIN_IMAGES
// ข้อความ: `${images.length}/${MAX_IMAGES} · ต้องการอย่างน้อย ${MIN_IMAGES} รูป`
```

**Submit button** — ใช้ Primary Button ด้านบน แต่:
```ts
// เมื่อ canSubmit = true → backgroundColor: colors.primaryDark
// เมื่อ canSubmit = false → opacity: 0.45
// ข้อความ: "บันทึกการเยี่ยมร้าน"
```

**Province/District Picker Modal:**
```ts
// Modal overlay
overlay: {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.45)',
  justifyContent: 'flex-end',
},
sheet: {
  backgroundColor: colors.surface,
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  maxHeight: '80%',
},
sheetHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: 20,
  paddingVertical: 16,
  borderBottomWidth: 1,
  borderBottomColor: colors.borderLight,
},
sheetTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
searchWrap: {
  flexDirection: 'row',
  alignItems: 'center',
  margin: 12,
  paddingHorizontal: 12,
  paddingVertical: 8,
  backgroundColor: colors.bg,
  borderRadius: radius.md,
  borderWidth: 1,
  borderColor: colors.border,
},
listItem: { paddingHorizontal: 20, paddingVertical: 14 },
listItemText: { fontSize: 15, color: colors.textPrimary },
separator: { height: 1, backgroundColor: colors.borderLight },
```

---

### 3.3 History (`app/(tabs)/history.tsx`)

**Header:** เพิ่ม badge count ทางขวา

**Card redesign:**
```ts
histCard: {
  backgroundColor: colors.surface,
  borderRadius: 14,
  padding: 12,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 11,
  marginBottom: 10,
  borderWidth: 0.5,
  borderColor: colors.borderLight,
  ...shadows.card,
},
histImg: {
  width: 56,
  height: 56,
  borderRadius: 10,
  backgroundColor: colors.primaryLight,
  resizeMode: 'cover',
},
histInfo: { flex: 1, minWidth: 0 },
histShop: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
histVisitType: { fontSize: 11, color: colors.textMuted, marginBottom: 2 },
histDate: { fontSize: 11, color: colors.textDisabled },
```

**History item data (ปรับ API/interface เพิ่มฟิลด์):**
```ts
// แนะนำเพิ่มฟิลด์ใน Log interface:
interface Log {
  id: string;
  imageUrl: string;
  shopName: string;       // เพิ่ม
  province: string;       // เพิ่ม
  customerType: 'new' | 'existing';  // เพิ่ม
  visitType?: string;     // เพิ่ม
  status: 'success' | 'fail';
  createdAt: string;
}

// Badge logic:
// customerType === 'new' → badge สีฟ้า "ใหม่"
// status === 'success' → badge สีเขียว "สำเร็จ"
// status === 'fail' → badge สีแดง "ล้มเหลว"
```

**Empty State:**
```tsx
<View style={{ alignItems: 'center', paddingTop: 80, gap: 12 }}>
  <Text style={{ fontSize: 40 }}>📋</Text>
  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textSecondary }}>ยังไม่มีประวัติการเยี่ยม</Text>
  <Text style={{ fontSize: 13, color: colors.textDisabled }}>เริ่มบันทึกการเยี่ยมร้านค้าได้เลย</Text>
</View>
```

---

### 3.4 Connect LINE (`app/(tabs)/connect.tsx`)

**Step indicator:**
```tsx
// แทนที่ Text instructions ด้วย Step component
<View style={styles.stepRow}>
  <View style={styles.stepNum}>
    <Text style={styles.stepNumText}>1</Text>
  </View>
  <Text style={styles.stepText}>กด "เพิ่ม Bot" แล้วเพิ่ม Bot เป็นเพื่อนใน LINE ก่อน</Text>
</View>

stepRow: {
  flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14,
},
stepNum: {
  width: 26, height: 26, borderRadius: 13,
  backgroundColor: colors.primaryLight,
  borderWidth: 1.5, borderColor: colors.primaryBorder,
  justifyContent: 'center', alignItems: 'center',
  flexShrink: 0, marginTop: 1,
},
stepNumText: { fontSize: 12, fontWeight: '700', color: colors.primaryDark },
stepText: { fontSize: 13, color: colors.textSecondary, lineHeight: 20, flex: 1 },
```

**Add Bot button (LINE green):**
```ts
addBotButton: {
  backgroundColor: colors.lineGreen,  // '#06c755'
  borderRadius: radius.lg,
  paddingVertical: 14,
  alignItems: 'center',
  flexDirection: 'row',
  justifyContent: 'center',
  gap: 6,
  marginBottom: 10,
},
```

**Code box:**
```ts
codeBox: {
  marginTop: 20,
  backgroundColor: colors.primaryLight,  // '#f0fdf4'
  borderWidth: 1.5,
  borderColor: colors.primaryBorder,     // '#bbf7d0'
  borderRadius: 16,
  padding: 24,
  alignItems: 'center',
  gap: 6,
},
codeLabel: { fontSize: 12, color: colors.textMuted },
codeText: {
  fontSize: 40,
  fontWeight: '800',
  color: colors.primaryDark,           // '#16a34a'
  letterSpacing: 10,
},
codeExpiry: { fontSize: 11, color: colors.textDisabled },
copyButton: {
  backgroundColor: colors.primary,
  borderRadius: radius.md,
  paddingVertical: 9,
  paddingHorizontal: 24,
  marginTop: 6,
},
copyButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
codeHint: { fontSize: 12, color: '#4b5563', textAlign: 'center', lineHeight: 18 },
```

---

### 3.5 Profile (`app/(tabs)/profile.tsx`)

**Header section:**
```ts
profHeader: {
  backgroundColor: colors.surface,
  paddingTop: 32,
  paddingBottom: 24,
  paddingHorizontal: 16,
  alignItems: 'center',
  gap: 8,
  borderBottomWidth: 0.5,
  borderBottomColor: colors.borderLight,
},
avatar: {
  width: 72, height: 72, borderRadius: 36,
  backgroundColor: colors.primary,
  justifyContent: 'center', alignItems: 'center',
  marginBottom: 4,
},
avatarText: { color: '#fff', fontSize: 28, fontWeight: '700' },
userName: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
userEmail: { fontSize: 13, color: colors.textDisabled },
roleBadge: {
  backgroundColor: colors.successBg,
  paddingHorizontal: 14, paddingVertical: 4,
  borderRadius: radius.full,
},
roleText: { color: colors.primaryDark, fontWeight: '600', fontSize: 12 },
```

**Stats row (เพิ่มใหม่):**
```ts
statsRow: {
  flexDirection: 'row',
  margin: 14,
  gap: 10,
},
statCard: {
  flex: 1,
  backgroundColor: colors.surface,
  borderWidth: 0.5,
  borderColor: colors.borderLight,
  borderRadius: 12,
  padding: 12,
  alignItems: 'center',
},
statNum: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
statLabel: { fontSize: 11, color: colors.textDisabled },
```

**Info section:**
```ts
infoSection: {
  marginHorizontal: 16,
  backgroundColor: colors.surface,
  borderRadius: 14,
  borderWidth: 0.5,
  borderColor: colors.borderLight,
  overflow: 'hidden',
  marginBottom: 12,
},
infoRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: 14,
  paddingVertical: 13,
  borderBottomWidth: 0.5,
  borderBottomColor: colors.bg,
},
infoRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
infoIcon: {
  width: 32, height: 32, borderRadius: 8,
  justifyContent: 'center', alignItems: 'center',
},
infoLabel: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
infoValue: { fontSize: 13, color: colors.textDisabled },
```

**Logout button:**
```ts
logoutButton: {
  marginHorizontal: 16,
  backgroundColor: colors.errorBg,   // '#fee2e2'
  borderWidth: 0.5,
  borderColor: '#fecaca',
  borderRadius: 14,
  paddingVertical: 14,
  alignItems: 'center',
},
logoutText: { color: colors.error, fontWeight: '700', fontSize: 15 },
```

---

## 4. Refactor Checklist

ทำตามลำดับนี้เพื่อ implement design ใหม่:

1. **สร้างไฟล์ `lib/theme.ts`** — export `colors`, `typography`, `spacing`, `radius`, `shadows` จาก Section 1
2. **สร้างไฟล์ `components/ui.tsx`** — export shared components: `PrimaryButton`, `FormInput`, `FormLabel`, `PillButton`, `StatusBadge`, `SectionCard`
3. **แก้ `app/login.tsx`** — ตาม Section 3.1
4. **แก้ `app/(tabs)/record.tsx`** — ตาม Section 3.2
5. **แก้ `app/(tabs)/history.tsx`** — ตาม Section 3.3 (ปรับ interface ถ้า backend รองรับ)
6. **แก้ `app/(tabs)/connect.tsx`** — ตาม Section 3.4
7. **แก้ `app/(tabs)/profile.tsx`** — ตาม Section 3.5 (เพิ่ม stats row)
8. **แก้ `app/(tabs)/_layout.tsx`** — ตาม tabBarStyle ใน Section 3.2 header

---

## 5. File Structure แนะนำ

```
mobile/
├── lib/
│   ├── theme.ts          ← Design tokens (สร้างใหม่)
│   ├── api.ts
│   ├── shop-history.ts
│   └── thai-places.ts
├── components/
│   └── ui.tsx            ← Shared UI components (สร้างใหม่)
├── app/
│   ├── login.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── record.tsx
│   │   ├── history.tsx
│   │   ├── connect.tsx
│   │   └── profile.tsx
│   └── ...
└── DESIGN.md             ← ไฟล์นี้
```

---

## 6. Quick Reference — Colors

| ใช้กับอะไร | Token | Hex |
|---|---|---|
| Primary button bg | `colors.primaryDark` | `#16a34a` |
| Active tab / icon | `colors.primary` | `#22c55e` |
| Light green bg | `colors.primaryLight` | `#f0fdf4` |
| Page background | `colors.bg` | `#f8fafc` |
| Card / input bg | `colors.surface` | `#ffffff` |
| Input border | `colors.border` | `#e5e7eb` |
| Main text | `colors.textPrimary` | `#111827` |
| Label text | `colors.textSecondary` | `#374151` |
| Muted text | `colors.textMuted` | `#6b7280` |
| Placeholder | `colors.textDisabled` | `#9ca3af` |
| Error | `colors.error` | `#dc2626` |
| LINE button | `colors.lineGreen` | `#06c755` |
