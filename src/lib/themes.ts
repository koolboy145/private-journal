export type ColorTheme = 'default' | 'tron' | 'nature' | 'playful';
export type ThemeName = `${ColorTheme}-light` | `${ColorTheme}-dark`;

export interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  sidebarBackground: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
  sidebarRing: string;
}

// Convert hex to HSL
function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// Theme color palettes (light mode)
const lightThemes: Record<ColorTheme, ThemeColors> = {
  default: {
    background: '220 20% 97%',
    foreground: '220 15% 15%',
    card: '0 0% 100%',
    cardForeground: '220 15% 15%',
    popover: '0 0% 100%',
    popoverForeground: '220 15% 15%',
    primary: '220 70% 50%',
    primaryForeground: '0 0% 100%',
    secondary: '220 15% 92%',
    secondaryForeground: '220 15% 15%',
    muted: '220 15% 95%',
    mutedForeground: '220 10% 45%',
    accent: '38 92% 60%',
    accentForeground: '0 0% 100%',
    destructive: '0 70% 50%',
    destructiveForeground: '0 0% 100%',
    border: '220 15% 88%',
    input: '220 15% 88%',
    ring: '220 70% 50%',
    sidebarBackground: '220 20% 97%',
    sidebarForeground: '220 15% 15%',
    sidebarPrimary: '220 70% 50%',
    sidebarPrimaryForeground: '0 0% 100%',
    sidebarAccent: '220 15% 92%',
    sidebarAccentForeground: '220 15% 15%',
    sidebarBorder: '220 15% 88%',
    sidebarRing: '220 70% 50%',
  },
  tron: {
    // Pure White #FFFFFF, Carbon Black #141414, Crimson Red #DC143C
    background: hexToHsl('#FFFFFF'), // Pure White
    foreground: hexToHsl('#141414'), // Carbon Black
    card: hexToHsl('#FFFFFF'),
    cardForeground: hexToHsl('#141414'), // Carbon Black
    popover: hexToHsl('#FFFFFF'),
    popoverForeground: hexToHsl('#141414'), // Carbon Black
    primary: hexToHsl('#DC143C'), // Crimson Red
    primaryForeground: hexToHsl('#FFFFFF'),
    secondary: hexToHsl('#F5F5F5'),
    secondaryForeground: hexToHsl('#141414'), // Carbon Black
    muted: hexToHsl('#F5F5F5'),
    mutedForeground: hexToHsl('#141414'), // Carbon Black
    accent: hexToHsl('#DC143C'), // Crimson Red
    accentForeground: hexToHsl('#FFFFFF'),
    destructive: hexToHsl('#DC143C'),
    destructiveForeground: hexToHsl('#FFFFFF'),
    border: hexToHsl('#141414'), // Carbon Black
    input: hexToHsl('#F5F5F5'),
    ring: hexToHsl('#DC143C'),
    sidebarBackground: hexToHsl('#FFFFFF'),
    sidebarForeground: hexToHsl('#141414'), // Carbon Black
    sidebarPrimary: hexToHsl('#DC143C'), // Crimson Red
    sidebarPrimaryForeground: hexToHsl('#FFFFFF'),
    sidebarAccent: hexToHsl('#F5F5F5'),
    sidebarAccentForeground: hexToHsl('#141414'), // Carbon Black
    sidebarBorder: hexToHsl('#141414'), // Carbon Black
    sidebarRing: hexToHsl('#DC143C'),
  },
  nature: {
    // Charcoal #36454F, Sage Green #87AE73, Cream #FFFDD0
    background: hexToHsl('#FFFDD0'), // Cream
    foreground: hexToHsl('#36454F'), // Charcoal
    card: hexToHsl('#FFFFFF'),
    cardForeground: hexToHsl('#36454F'),
    popover: hexToHsl('#FFFFFF'),
    popoverForeground: hexToHsl('#36454F'),
    primary: hexToHsl('#87AE73'), // Sage Green
    primaryForeground: hexToHsl('#FFFFFF'),
    secondary: hexToHsl('#F5F5DC'),
    secondaryForeground: hexToHsl('#36454F'),
    muted: hexToHsl('#F5F5DC'),
    mutedForeground: hexToHsl('#555555'),
    accent: hexToHsl('#87AE73'),
    accentForeground: hexToHsl('#FFFFFF'),
    destructive: hexToHsl('#B22222'),
    destructiveForeground: hexToHsl('#FFFFFF'),
    border: hexToHsl('#87AE73'),
    input: hexToHsl('#E8E8D0'),
    ring: hexToHsl('#87AE73'),
    sidebarBackground: hexToHsl('#FFFDD0'),
    sidebarForeground: hexToHsl('#36454F'),
    sidebarPrimary: hexToHsl('#87AE73'),
    sidebarPrimaryForeground: hexToHsl('#FFFFFF'),
    sidebarAccent: hexToHsl('#F5F5DC'),
    sidebarAccentForeground: hexToHsl('#36454F'),
    sidebarBorder: hexToHsl('#87AE73'),
    sidebarRing: hexToHsl('#87AE73'),
  },
  playful: {
    // Coral #FF7F50, Mustard Yellow #FFDB58, Aqua Blue #00FFFF
    background: hexToHsl('#FFFFFF'),
    foreground: hexToHsl('#2C2C2C'),
    card: hexToHsl('#FFFFFF'),
    cardForeground: hexToHsl('#2C2C2C'),
    popover: hexToHsl('#FFFFFF'),
    popoverForeground: hexToHsl('#2C2C2C'),
    primary: hexToHsl('#FF7F50'), // Coral
    primaryForeground: hexToHsl('#FFFFFF'),
    secondary: hexToHsl('#FFF9E6'),
    secondaryForeground: hexToHsl('#2C2C2C'),
    muted: hexToHsl('#FFF9E6'),
    mutedForeground: hexToHsl('#666666'),
    accent: hexToHsl('#FFDB58'), // Mustard Yellow
    accentForeground: hexToHsl('#2C2C2C'),
    destructive: hexToHsl('#FF4444'),
    destructiveForeground: hexToHsl('#FFFFFF'),
    border: hexToHsl('#FFDB58'),
    input: hexToHsl('#FFF9E6'),
    ring: hexToHsl('#FF7F50'),
    sidebarBackground: hexToHsl('#FFFFFF'),
    sidebarForeground: hexToHsl('#2C2C2C'),
    sidebarPrimary: hexToHsl('#FF7F50'),
    sidebarPrimaryForeground: hexToHsl('#FFFFFF'),
    sidebarAccent: hexToHsl('#FFDB58'),
    sidebarAccentForeground: hexToHsl('#2C2C2C'),
    sidebarBorder: hexToHsl('#FFDB58'),
    sidebarRing: hexToHsl('#FF7F50'),
  },
};

// Dark mode variants
const darkThemes: Record<ColorTheme, ThemeColors> = {
  default: {
    background: '220 30% 8%',
    foreground: '220 15% 92%',
    card: '220 25% 12%',
    cardForeground: '220 15% 92%',
    popover: '220 25% 12%',
    popoverForeground: '220 15% 92%',
    primary: '220 70% 55%',
    primaryForeground: '0 0% 100%',
    secondary: '220 20% 16%',
    secondaryForeground: '220 15% 92%',
    muted: '220 20% 16%',
    mutedForeground: '220 10% 60%',
    accent: '38 92% 65%',
    accentForeground: '220 30% 8%',
    destructive: '0 70% 55%',
    destructiveForeground: '0 0% 100%',
    border: '220 20% 20%',
    input: '220 20% 20%',
    ring: '220 70% 55%',
    sidebarBackground: '220 30% 8%',
    sidebarForeground: '220 15% 92%',
    sidebarPrimary: '220 70% 55%',
    sidebarPrimaryForeground: '0 0% 100%',
    sidebarAccent: '220 20% 16%',
    sidebarAccentForeground: '220 15% 92%',
    sidebarBorder: '220 20% 20%',
    sidebarRing: '220 70% 55%',
  },
  tron: {
    // Dark mode for Tron - same as light mode
    background: hexToHsl('#000000'),
    foreground: hexToHsl('#FFFFFF'), // White
    card: hexToHsl('#0A0A0A'),
    cardForeground: hexToHsl('#FFFFFF'), // White
    popover: hexToHsl('#0A0A0A'),
    popoverForeground: hexToHsl('#FFFFFF'), // White
    primary: hexToHsl('#FF1744'), // Brighter crimson
    primaryForeground: hexToHsl('#FFFFFF'),
    secondary: hexToHsl('#1A1A1A'),
    secondaryForeground: hexToHsl('#DC143C'), // Crimson Neon as secondary color
    muted: hexToHsl('#1A1A1A'),
    mutedForeground: hexToHsl('#FFFFFF'), // White
    accent: hexToHsl('#FFFFFF'), // White
    accentForeground: hexToHsl('#000000'),
    destructive: hexToHsl('#FF1744'),
    destructiveForeground: hexToHsl('#FFFFFF'),
    border: hexToHsl('#FFFFFF'), // White
    input: hexToHsl('#1A1A1A'),
    ring: hexToHsl('#FF1744'),
    sidebarBackground: hexToHsl('#000000'),
    sidebarForeground: hexToHsl('#FFFFFF'), // White
    sidebarPrimary: hexToHsl('#FF1744'),
    sidebarPrimaryForeground: hexToHsl('#FFFFFF'),
    sidebarAccent: hexToHsl('#1A1A1A'),
    sidebarAccentForeground: hexToHsl('#DC143C'), // Crimson Neon as secondary color
    sidebarBorder: hexToHsl('#FFFFFF'), // White
    sidebarRing: hexToHsl('#FF1744'),
  },
  nature: {
    // Dark mode for Nature - darker, earthy tones
    background: hexToHsl('#1A1F1C'),
    foreground: hexToHsl('#E8F5E9'),
    card: hexToHsl('#2A352D'),
    cardForeground: hexToHsl('#E8F5E9'),
    popover: hexToHsl('#2A352D'),
    popoverForeground: hexToHsl('#E8F5E9'),
    primary: hexToHsl('#87AE73'),
    primaryForeground: hexToHsl('#FFFFFF'),
    secondary: hexToHsl('#36454F'),
    secondaryForeground: hexToHsl('#E8F5E9'),
    muted: hexToHsl('#36454F'),
    mutedForeground: hexToHsl('#A5C9A8'),
    accent: hexToHsl('#87AE73'),
    accentForeground: hexToHsl('#FFFFFF'),
    destructive: hexToHsl('#D32F2F'),
    destructiveForeground: hexToHsl('#FFFFFF'),
    border: hexToHsl('#87AE73'),
    input: hexToHsl('#36454F'),
    ring: hexToHsl('#87AE73'),
    sidebarBackground: hexToHsl('#1A1F1C'),
    sidebarForeground: hexToHsl('#E8F5E9'),
    sidebarPrimary: hexToHsl('#87AE73'),
    sidebarPrimaryForeground: hexToHsl('#FFFFFF'),
    sidebarAccent: hexToHsl('#36454F'),
    sidebarAccentForeground: hexToHsl('#E8F5E9'),
    sidebarBorder: hexToHsl('#87AE73'),
    sidebarRing: hexToHsl('#87AE73'),
  },
  playful: {
    // Dark mode for Playful - darker background with vibrant accents
    background: hexToHsl('#1A1A1A'),
    foreground: hexToHsl('#FFFFFF'),
    card: hexToHsl('#2A2A2A'),
    cardForeground: hexToHsl('#FFFFFF'),
    popover: hexToHsl('#2A2A2A'),
    popoverForeground: hexToHsl('#FFFFFF'),
    primary: hexToHsl('#FF7F50'),
    primaryForeground: hexToHsl('#FFFFFF'),
    secondary: hexToHsl('#3A3A3A'),
    secondaryForeground: hexToHsl('#FFFFFF'),
    muted: hexToHsl('#3A3A3A'),
    mutedForeground: hexToHsl('#CCCCCC'),
    accent: hexToHsl('#FFDB58'),
    accentForeground: hexToHsl('#1A1A1A'),
    destructive: hexToHsl('#FF5555'),
    destructiveForeground: hexToHsl('#FFFFFF'),
    border: hexToHsl('#FFDB58'),
    input: hexToHsl('#3A3A3A'),
    ring: hexToHsl('#FF7F50'),
    sidebarBackground: hexToHsl('#1A1A1A'),
    sidebarForeground: hexToHsl('#FFFFFF'),
    sidebarPrimary: hexToHsl('#FF7F50'),
    sidebarPrimaryForeground: hexToHsl('#FFFFFF'),
    sidebarAccent: hexToHsl('#FFDB58'),
    sidebarAccentForeground: hexToHsl('#1A1A1A'),
    sidebarBorder: hexToHsl('#FFDB58'),
    sidebarRing: hexToHsl('#FF7F50'),
  },
};

export function parseThemeName(themeName: ThemeName): { colorTheme: ColorTheme; isDark: boolean } {
  const parts = themeName.split('-');
  const colorTheme = parts[0] as ColorTheme;
  const isDark = parts[1] === 'dark';
  return { colorTheme, isDark };
}

export function applyTheme(themeName: ThemeName) {
  const { colorTheme, isDark } = parseThemeName(themeName);
  const theme = isDark ? darkThemes[colorTheme] : lightThemes[colorTheme];
  const root = document.documentElement;

  // Apply dark/light class
  document.documentElement.classList.remove('light', 'dark');
  document.documentElement.classList.add(isDark ? 'dark' : 'light');

  root.style.setProperty('--background', theme.background);
  root.style.setProperty('--foreground', theme.foreground);
  root.style.setProperty('--card', theme.card);
  root.style.setProperty('--card-foreground', theme.cardForeground);
  root.style.setProperty('--popover', theme.popover);
  root.style.setProperty('--popover-foreground', theme.popoverForeground);
  root.style.setProperty('--primary', theme.primary);
  root.style.setProperty('--primary-foreground', theme.primaryForeground);
  root.style.setProperty('--secondary', theme.secondary);
  root.style.setProperty('--secondary-foreground', theme.secondaryForeground);
  root.style.setProperty('--muted', theme.muted);
  root.style.setProperty('--muted-foreground', theme.mutedForeground);
  root.style.setProperty('--accent', theme.accent);
  root.style.setProperty('--accent-foreground', theme.accentForeground);
  root.style.setProperty('--destructive', theme.destructive);
  root.style.setProperty('--destructive-foreground', theme.destructiveForeground);
  root.style.setProperty('--border', theme.border);
  root.style.setProperty('--input', theme.input);
  root.style.setProperty('--ring', theme.ring);
  root.style.setProperty('--sidebar-background', theme.sidebarBackground);
  root.style.setProperty('--sidebar-foreground', theme.sidebarForeground);
  root.style.setProperty('--sidebar-primary', theme.sidebarPrimary);
  root.style.setProperty('--sidebar-primary-foreground', theme.sidebarPrimaryForeground);
  root.style.setProperty('--sidebar-accent', theme.sidebarAccent);
  root.style.setProperty('--sidebar-accent-foreground', theme.sidebarAccentForeground);
  root.style.setProperty('--sidebar-border', theme.sidebarBorder);
  root.style.setProperty('--sidebar-ring', theme.sidebarRing);
}

export function getThemeName(): ThemeName {
  const saved = localStorage.getItem('theme_name');
  if (saved && /^(default|tron|nature|playful)-(light|dark)$/.test(saved)) {
    return saved as ThemeName;
  }
  // Default to dark mode
  return 'default-dark';
}

export function setThemeName(themeName: ThemeName) {
  localStorage.setItem('theme_name', themeName);
}

export function getColorThemeOptions(): Array<{ value: ThemeName; label: string }> {
  const colors: ColorTheme[] = ['default', 'tron', 'nature', 'playful'];
  const options: Array<{ value: ThemeName; label: string }> = [];
  
  colors.forEach(color => {
    options.push({ value: `${color}-dark` as ThemeName, label: `${color.charAt(0).toUpperCase() + color.slice(1)} (Dark)` });
    options.push({ value: `${color}-light` as ThemeName, label: `${color.charAt(0).toUpperCase() + color.slice(1)} (Light)` });
  });
  
  return options;
}

