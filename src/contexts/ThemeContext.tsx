import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { applyTheme, getThemeName, setThemeName, parseThemeName, type ThemeName } from '../lib/themes';

interface ThemeContextType {
  themeName: ThemeName;
  setThemeName: (themeName: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [themeName, setThemeNameState] = useState<ThemeName>(() => {
    return getThemeName();
  });

  // Initialize theme from localStorage on mount
  useEffect(() => {
    const savedThemeName = getThemeName();
    setThemeNameState(savedThemeName);
    applyTheme(savedThemeName);
  }, []);

  // Apply theme changes
  useEffect(() => {
    applyTheme(themeName);
    setThemeName(themeName);
  }, [themeName]);

  const handleSetThemeName = (newThemeName: ThemeName) => {
    setThemeNameState(newThemeName);
    setThemeName(newThemeName);
    applyTheme(newThemeName);
  };

  return (
    <ThemeContext.Provider value={{ themeName, setThemeName: handleSetThemeName }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
