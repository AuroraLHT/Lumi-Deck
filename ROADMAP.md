# Roadmap / deferred work

Things intentionally left for a later, dedicated pass. None of these block day-to-day
work or the public release.

## Chakra UI v2 → v3 migration

**Not a drop-in replacement.** v3 is a ground-up rewrite (new styling engine, Ark UI
state machines). There is a snippet CLI (`npx @chakra-ui/cli snippet add`) but **no
codemod** for the breaking changes. Reference:
<https://chakra-ui.com/blog/chakra-v2-vs-v3-a-detailed-comparison>

We are deliberately on v2 (`@chakra-ui/react` `^2.x`). v2 is in maintenance mode, so
this is worth doing eventually — as its own project, not an incidental bump.

Main exposure in this codebase:

| Area | v2 (in use) | v3 |
|---|---|---|
| Provider | `<ChakraProvider theme={theme}>` + `<ColorModeScript>` (`main.tsx`) | `createSystem(...)` + new `Provider` |
| Theme | `extendTheme({...})`, component style overrides — `theme.ts` (~230 lines) | `defineConfig` with `theme.tokens` / `semanticTokens` / recipes — full rewrite |
| `@chakra-ui/theme-tools` `mode()` | used in `theme.ts` | package removed; color mode via `next-themes` |
| Forms | `FormControl` / `FormLabel` / `FormErrorMessage` / `FormHelperText` — ~108 usages | `Field.Root` / `Field.Label` / `Field.ErrorText` / `Field.HelperText` |
| `Tooltip` | ~45 usages | new Tooltip snippet (portal + positioner) |
| `Select` | ~22 usages | `Select.Root` + collection, or `NativeSelect` |
| `useToast` | ~10 usages | `createToaster()` + `<Toaster />` + `toaster.create(...)` |
| `Modal` / `Menu` / `Checkbox` / `Switch` / `Slider` / `Popover` | ~35 usages | all namespaced (`.Root` / `.Item` / …) |
| Style props | `spacing=`, `isInvalid`, `isLoading`, `isDisabled`, `isOpen` (everywhere) | `gap=`, `invalid`, `loading`, `disabled`, `open` |
| `@chakra-ui/icons` | imported | package dropped → `react-icons` (already a dependency) |

Rough estimate: multi-day, ~38 files, real regression risk in the custom instrument
theme. Do it on a branch with the app running side by side.

## Wire `npm run lint` into CI

`.github/workflows/ci.yml` runs `npm run build` (which typechecks via `tsc -b`) but
not `npm run lint` — the tree has ~28 pre-existing eslint errors
(`@typescript-eslint/no-explicit-any`, empty-interface, a few `react-hooks/exhaustive-deps`
warnings). Clear those, then add a `- run: npm run lint` step to the workflow.

## Loose ends

- **README `Lumi-Lab` link** is "TBD" — fill in the GitHub URL once that repo is
  public.
- **`npm run sync:client`** assumes a sibling `../Lumi-Lab` checkout. Fine for local
  dev; revisit if contributors need another way to regenerate `src/generated/lumi.ts`.
