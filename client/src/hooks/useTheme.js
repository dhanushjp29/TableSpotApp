import { useContext } from "react";
import { ThemeContext } from "../context/theme-context.js";
export function useTheme() {
  return useContext(ThemeContext);
}
