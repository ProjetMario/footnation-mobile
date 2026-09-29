import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  darkColors,
  lightColors,
  parseThemePreference,
  resolveThemeMode,
  themeStorageKey,
  type ThemeColors,
  type ThemeMode,
  type ThemePreference,
} from "./palette";
type ThemeContextValue = {
  colors: ThemeColors;
  mode: ThemeMode;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};
const ThemeContext = createContext<ThemeContextValue>({
  colors: lightColors,
  mode: "light",
  preference: "system",
  setPreference: () => {},
});
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [preference, updatePreference] = useState<ThemePreference>("system");
  const edited = useRef(false);
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(themeStorageKey)
      .then((saved) => {
        if (active && !edited.current)
          updatePreference(parseThemePreference(saved));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const setPreference = useCallback((next: ThemePreference) => {
    const valid = parseThemePreference(next);
    edited.current = true;
    updatePreference(valid);
    // Serial writes preserve the most recent choice even after rapid toggles.
    writes.current = writes.current
      .catch(() => {})
      .then(() => AsyncStorage.setItem(themeStorageKey, valid))
      .catch(() => {});
  }, []);
  const mode = resolveThemeMode(preference, system);
  const value = useMemo(
    () => ({
      colors: mode === "dark" ? darkColors : lightColors,
      mode,
      preference,
      setPreference,
    }),
    [mode, preference, setPreference],
  );
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
export function useTheme() {
  return useContext(ThemeContext);
}
export function useThemedStyles<T>(factory: (colors: ThemeColors) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [colors, factory]);
}

/** Restricts a palette override to one subtree; appearance preferences stay shared. */
export function ThemePaletteProvider({
  colors,
  children,
}: {
  colors: ThemeColors;
  children: React.ReactNode;
}) {
  const parent = useTheme();
  const value = useMemo(() => ({ ...parent, colors }), [parent, colors]);
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
