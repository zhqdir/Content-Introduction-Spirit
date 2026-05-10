export const Colors = {
  light: {
    // 柔和卡片风格 - AI 助手主题
    textPrimary: "#2D3436",
    textSecondary: "#636E72",
    textMuted: "#B2BEC3",
    primary: "#6C63FF", // 薰衣草紫 - 品牌主色
    accent: "#FF6584", // 珊瑚粉 - 辅助色
    success: "#00B894",
    error: "#FF6B6B",
    warning: "#FDCB6E",
    backgroundRoot: "#F0F0F3", // 暖灰白背景
    backgroundDefault: "#F0F0F3", // 卡片背景
    backgroundTertiary: "#E8E8EB", // 凹陷面背景
    buttonPrimaryText: "#FFFFFF",
    tabIconSelected: "#6C63FF",
    border: "#E8E8EB",
    borderLight: "#FFFFFF",
    // 新拟态专用色
    shadowDark: "#D1D9E6",
    shadowLight: "#FFFFFF",
  },
  dark: {
    // 暗色模式（保持柔和风格）
    textPrimary: "#FAFAF9",
    textSecondary: "#A8A29E",
    textMuted: "#6F767E",
    primary: "#8B7FFF", // 薰衣草紫亮色
    accent: "#FF8BA7",
    success: "#00D9A5",
    error: "#FF8A8A",
    warning: "#FFE082",
    backgroundRoot: "#1A1A2E",
    backgroundDefault: "#25253A",
    backgroundTertiary: "#1E1E32",
    buttonPrimaryText: "#1A1A2E",
    tabIconSelected: "#8B7FFF",
    border: "#3A3A52",
    borderLight: "#2A2A42",
    shadowDark: "#0A0A1E",
    shadowLight: "#3A3A52",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  "6xl": 64,
};

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 28,
  "4xl": 32,
  full: 9999,
};

export const Typography = {
  display: {
    fontSize: 112,
    lineHeight: 112,
    fontWeight: "200" as const,
    letterSpacing: -4,
  },
  displayLarge: {
    fontSize: 112,
    lineHeight: 112,
    fontWeight: "200" as const,
    letterSpacing: -2,
  },
  displayMedium: {
    fontSize: 48,
    lineHeight: 56,
    fontWeight: "200" as const,
  },
  h1: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "800" as const, // 页面大标题
  },
  h3: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "300" as const,
  },
  h4: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600" as const,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700" as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
  bodyMedium: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500" as const,
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400" as const,
  },
  smallMedium: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500" as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400" as const,
  },
  captionMedium: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500" as const,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500" as const,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
  },
  labelSmall: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500" as const,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
  },
  labelTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700" as const,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
  },
  link: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
  stat: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "300" as const,
  },
  tiny: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "400" as const,
  },
  navLabel: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "600" as const,
  },
  // 柔和卡片风格专用
  pageTitle: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "800" as const,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700" as const,
  },
  cardTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700" as const,
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400" as const,
  },
  bigData: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "800" as const,
  },
  smallData: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700" as const,
  },
  tagText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600" as const,
  },
};

export type Theme = typeof Colors.light;
