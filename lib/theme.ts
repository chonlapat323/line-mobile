// ─── Font Size Scale ──────────────────────────────────────────────────────────
// แก้ที่นี่ที่เดียว → import { fontSize } from "@/lib/theme"
//
// ┌─────────────┬──────┬─────────────────────────────────┐
// │ Token       │  px  │ ใช้กับ                          │
// ├─────────────┼──────┼─────────────────────────────────┤
// │ caption     │  14  │ timestamp, metadata, badge       │
// │ label       │  15  │ tab label, form label            │
// │ body        │  16  │ เนื้อหาทั่วไป                   │
// │ bodyLg      │  18  │ body เน้น, input text            │
// │ subheading  │  20  │ หัวข้อรอง, card label            │
// │ heading     │  23  │ หัวข้อ card, section             │
// │ title       │  26  │ ชื่อ section ใหญ่                │
// │ pageTitle   │  30  │ ชื่อหน้า                        │
// │ display     │  38  │ stat number ใหญ่                 │
// └─────────────┴──────┴─────────────────────────────────┘
export const fontSize = {
  caption:    14,
  label:      15,
  body:       16,
  bodyLg:     18,
  subheading: 20,
  heading:    23,
  title:      26,
  pageTitle:  30,
  display:    38,
} as const;

export const colors = {
  primary:       '#22c55e',
  primaryDark:   '#16a34a',
  primaryLight:  '#f0fdf4',
  primaryBorder: '#bbf7d0',
  primaryText:   '#15803d',
  lineGreen:     '#06c755',

  bg:            '#f8fafc',
  surface:       '#ffffff',
  border:        '#e5e7eb',
  borderLight:   '#f3f4f6',
  borderDashed:  '#d1d5db',

  textPrimary:   '#111827',
  textSecondary: '#374151',
  textMuted:     '#6b7280',
  textDisabled:  '#9ca3af',

  error:         '#dc2626',
  errorBg:       '#fee2e2',
  successBg:     '#dcfce7',
  infoBg:        '#dbeafe',
  infoText:      '#1d4ed8',
};

export const radius = {
  sm:   8,
  md:   10,
  lg:   12,
  xl:   14,
  '2xl': 16,
  '3xl': 20,
  full: 999,
};

export const shadows = {
  card: {
    shadowColor: '#000' as const,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  modal: {
    shadowColor: '#000' as const,
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
};
