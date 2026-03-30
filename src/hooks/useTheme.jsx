import { createContext, useContext, useMemo, useEffect } from 'react';
import { THEMES, getStyles } from '../styles/theme';

export const ThemeContext = createContext({
  theme: THEMES.light,
  S: getStyles(THEMES.light)
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ darkMode, children }) {
  const theme = darkMode ? THEMES.dark : THEMES.light;
  const S = useMemo(() => getStyles(theme), [darkMode]);

  // Update body class
  useEffect(() => {
    document.body.className = darkMode ? 'dark' : 'light';
  }, [darkMode]);

  const value = useMemo(() => ({ theme, S }), [theme, S]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
