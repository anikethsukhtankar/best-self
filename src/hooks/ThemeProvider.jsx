import { useMemo, useEffect } from 'react';
import { THEMES, getStyles } from '../styles/theme';
import { ThemeContext } from './useTheme';

export function ThemeProvider({ darkMode, children }) {
  const theme = darkMode ? THEMES.dark : THEMES.light;
  const S = useMemo(() => getStyles(theme), [theme]);

  useEffect(() => {
    document.body.className = darkMode ? 'dark' : 'light';
  }, [darkMode]);

  const value = useMemo(() => ({ theme, S }), [theme, S]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
