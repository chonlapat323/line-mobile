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
