import { createContext, useContext } from 'react';
import { THEMES, getStyles } from '../styles/theme';

export const ThemeContext = createContext({ theme: THEMES.light, S: getStyles(THEMES.light) });

export function useTheme() {
  return useContext(ThemeContext);
}
