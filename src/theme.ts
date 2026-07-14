import { extendTheme, ThemeConfig, StyleFunctionProps } from "@chakra-ui/react";
import { mode } from "@chakra-ui/theme-tools";

/**
 * Visual language: a scientific instrument console.
 *
 * Dark by default, because this runs on a lab display next to a chamber and a
 * bright UI at 2am is hostile. Panels are quiet, low-chroma surfaces so that the
 * only saturated colour on screen is *data* -- traces, detections, alarms. The
 * accent is a cyan drawn from the RHEED phosphor screen itself.
 *
 * Colours are exposed as semantic tokens rather than raw values, so components
 * never hard-code a hex and light/dark stay in step automatically.
 */

const config: ThemeConfig = {
  initialColorMode: "dark",
  useSystemColorMode: false,
};

const colors = {
  // Neutral ramp, blue-shifted so it reads as "instrument" rather than "grey".
  ink: {
    50: "#f6f8fa",
    100: "#eaeef2",
    200: "#d4dbe3",
    300: "#aeb9c7",
    400: "#7f8da0",
    500: "#5c6b7f",
    600: "#425061",
    700: "#2a3441",
    750: "#222b36",
    800: "#1a222c",
    850: "#151c24",
    900: "#10161d",
    950: "#0b1015",
  },
  // Primary accent: RHEED phosphor cyan.
  brand: {
    50: "#e0fbff",
    100: "#b8f3fd",
    200: "#8aeaf9",
    300: "#57ddf2",
    400: "#2ccde6",
    500: "#12b3ce",
    600: "#0f9bb4",
    700: "#0a8da5",
    800: "#0d6a7c",
    900: "#0d4d5a",
  },
  // Status colours for node indicators and alarms.
  signal: {
    ok: "#2ecc9b",
    warn: "#f2b53c",
    error: "#f2604c",
    idle: "#7f8da0",
  },
};

const semanticTokens = {
  colors: {
    "app.bg": { _light: "ink.100", _dark: "ink.950" },

    // Panels
    "panel.bg": { _light: "white", _dark: "ink.850" },
    "panel.bgElevated": { _light: "white", _dark: "ink.800" },
    "panel.header": { _light: "ink.50", _dark: "ink.800" },
    "panel.border": { _light: "ink.200", _dark: "ink.700" },
    "panel.borderActive": { _light: "brand.400", _dark: "brand.500" },

    // Text
    "text.primary": { _light: "ink.900", _dark: "ink.100" },
    "text.secondary": { _light: "ink.500", _dark: "ink.400" },
    "text.muted": { _light: "ink.400", _dark: "ink.500" },

    // Accent
    "accent.solid": { _light: "brand.600", _dark: "brand.400" },
    "accent.subtle": { _light: "brand.50", _dark: "brand.900" },

    // Status
    "status.ok": "signal.ok",
    "status.warn": "signal.warn",
    "status.error": "signal.error",
    "status.idle": "signal.idle",

    // Plot surfaces. The charts previously hard-coded a white background, which
    // glares in dark mode.
    "plot.bg": { _light: "white", _dark: "ink.900" },
    "plot.grid": { _light: "ink.200", _dark: "ink.700" },
    "plot.axis": { _light: "ink.500", _dark: "ink.400" },
  },
};

const fonts = {
  heading:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  body: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, Menlo, monospace",
};

const styles = {
  global: (props: StyleFunctionProps) => ({
    "html, body, #root": {
      height: "100%",
    },
    body: {
      bg: "app.bg",
      color: "text.primary",
      // Instrument readouts only line up column-wise with tabular figures.
      fontVariantNumeric: "tabular-nums",
    },
    "::selection": {
      bg: mode("brand.200", "brand.700")(props),
    },

    // Scrollbars, so panel overflow doesn't punch a bright hole in dark mode.
    "::-webkit-scrollbar": { width: "10px", height: "10px" },
    "::-webkit-scrollbar-track": { bg: "transparent" },
    "::-webkit-scrollbar-thumb": {
      bg: mode("ink.200", "ink.700")(props),
      borderRadius: "999px",
      border: "2px solid transparent",
      backgroundClip: "content-box",
    },
    "::-webkit-scrollbar-thumb:hover": {
      bg: mode("ink.300", "ink.600")(props),
      backgroundClip: "content-box",
    },

    // --- react-grid-layout chrome, themed to match the panels ---------------

    // The drop target shown while dragging.
    ".react-grid-item.react-grid-placeholder": {
      background: mode("#57ddf2", "#12b3ce")(props) + " !important",
      opacity: "0.18 !important",
      borderRadius: "12px",
    },
    // The library ships a grey triangle background-image as the resize handle.
    // Replace it with a corner grip drawn in CSS so it follows the colour mode.
    ".react-resizable-handle": {
      backgroundImage: "none !important",
      padding: 0,
    },
    ".react-resizable-handle::after": {
      content: '""',
      position: "absolute",
      right: "5px",
      bottom: "5px",
      width: "8px",
      height: "8px",
      borderRight: "2px solid",
      borderBottom: "2px solid",
      borderColor: mode("#aeb9c7", "#425061")(props),
      borderBottomRightRadius: "3px",
      transition: "border-color 0.15s ease",
    },
    ".react-grid-item:hover .react-resizable-handle::after": {
      borderColor: mode("#12b3ce", "#2ccde6")(props),
    },
    // Lift the panel above its neighbours while it is being moved.
    ".react-grid-item.react-draggable-dragging": {
      transition: "none !important",
      zIndex: 10,
    },
    ".react-grid-item.resizing": {
      zIndex: 10,
    },
  }),
};

const components = {
  Button: {
    baseStyle: { fontWeight: "600", borderRadius: "lg" },
    variants: {
      panelGhost: (props: StyleFunctionProps) => ({
        bg: "transparent",
        color: mode("ink.500", "ink.400")(props),
        _hover: {
          bg: mode("ink.100", "ink.700")(props),
          color: mode("ink.900", "ink.100")(props),
        },
      }),
    },
  },
  Input: {
    defaultProps: { focusBorderColor: "brand.400" },
  },
  Select: {
    defaultProps: { focusBorderColor: "brand.400" },
  },
  Tooltip: {
    baseStyle: {
      borderRadius: "md",
      fontSize: "xs",
      px: 2,
      py: 1,
    },
  },
};

const theme = extendTheme({
  config,
  colors,
  semanticTokens,
  fonts,
  styles,
  components,
});

export default theme;
