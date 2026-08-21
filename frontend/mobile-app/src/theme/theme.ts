// Mirrors the admin console's design tokens (AdminConsole/Code/src/index.css @theme block):
// brand = indigo/violet, paired with a teal accent; dark navy "ink" neutrals; canvas background.
export const colors = {
  primary: '#4F46E5', // brand-600
  primaryDark: '#4338CA', // brand-700 (outline-button text, hover states)
  primaryLight: '#6366F1', // brand-500
  primarySoft: '#EEF2FF', // brand-50
  primaryRing: '#A5B4FC', // brand-300 (outline-button border)

  teal: '#0D9488', // teal-600
  tealLight: '#14B8A6', // teal-500

  action: '#4F46E5', // primary CTA fill (brand-600, same family as primary)
  actionDark: '#4338CA', // brand-700
  actionLight: '#6366F1', // brand-500

  bg: '#F5F6FB', // canvas
  surface: '#FFFFFF',
  surfaceSoft: '#EEF2FF', // brand-50
  surfaceMuted: '#F1F5F9', // slate-100
  border: '#E4E6F3', // ink-900 @ ~6-8%, flattened

  ink: '#0B1120', // ink-950
  inkSoft: '#4B5170', // ink-700, flattened
  inkFaint: '#8A8FB0', // ink-700 @ lower opacity, flattened
  onPrimary: '#FFFFFF',

  success: '#059669', // emerald-600
  successSoft: '#ECFDF5', // emerald-50
  warn: '#F59E0B', // amber-500
  warnSoft: '#FFFBEB', // amber-50
  danger: '#F43F5E', // rose-500
  dangerSoft: '#FFF1F2', // rose-50
  info: '#0EA5E9', // sky-500
  infoSoft: '#F0F9FF', // sky-50

  slotAvailable: '#FFFFFF',
  slotBooked: '#CBD1E6',
  slotSelected: '#4F46E5',
  slotUnavailable: '#EEF0F8',

  navy: '#0B1120', // ink-950, used for the dark chrome (sidebar-equivalent tab bar)
  navySoft: '#12162B', // ink-900
};

export const gradients = {
  // PageHeader.tsx: from-brand-600 via-brand-600 to-teal-600 (diagonal)
  primary: [colors.primary, colors.primary, colors.teal] as const,
  hero: [colors.primary, colors.primary, colors.teal] as const,
  // Button.tsx primary variant: from-brand-500 to-brand-600 (vertical)
  action: [colors.primaryLight, colors.primary] as const,
  // Sidebar.tsx logo badge / brand mark: from-brand-400 to-teal-400
  brandBadge: ['#818CF8', '#2DD4BF'] as const,
  // Sidebar.tsx aside background: from-ink-950 via-ink-900 to a deep violet-navy
  navy: [colors.navy, colors.navySoft, '#161233'] as const,
};

export const gradientLocations = {
  primary: [0, 0.55, 1] as const,
  hero: [0, 0.55, 1] as const,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 36,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
};

export const typography = {
  display: { fontSize: 26, fontWeight: '800' as const, color: colors.ink },
  h1: { fontSize: 22, fontWeight: '800' as const, color: colors.ink },
  h2: { fontSize: 18, fontWeight: '700' as const, color: colors.ink },
  h3: { fontSize: 15, fontWeight: '700' as const, color: colors.ink },
  body: { fontSize: 14, fontWeight: '400' as const, color: colors.ink },
  bodySoft: { fontSize: 14, fontWeight: '400' as const, color: colors.inkSoft },
  caption: { fontSize: 12, fontWeight: '500' as const, color: colors.inkFaint },
  label: { fontSize: 12, fontWeight: '700' as const, color: colors.inkSoft },
  button: { fontSize: 15, fontWeight: '700' as const, color: colors.onPrimary },
};

export const shadow = {
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  raised: {
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 8,
  },
};
