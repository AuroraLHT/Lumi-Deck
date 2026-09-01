# Lumi-Deck

Operator console for the autonomous PLD / RHEED system. React + TypeScript + Vite,
Chakra UI for components, Zustand for state, talking to the FastAPI backend in
[`Lumi-Lab`](../Lumi-Lab).

```bash
npm install
npm run dev         # http://localhost:5173
npm run build       # typecheck + production bundle
npm run sync:client # re-copy src/generated/lumi.ts from Lumi-Lab's main
```

You need the backend running, and an account on it:

```bash
# in Lumi-Lab
python -m lumi.api.manage create-user <you> --role admin
scripts/start_simulation.sh          # simulated stack, no hardware
scripts/start_server_host.sh         # or the real one, on the server machine
```

Pick that server's address on the login screen. The backend must list this app's
origin in `api.allow_origins`, or the browser will block every request.

`src/generated/lumi.ts` is generated from the backend's contract and carries a
`contract_hash`. It must match the backend's — the nodes reject a mismatched hash on
join — so a contract change means redeploying both halves together.

---

## Architecture

### Authentication

The API requires a token on every request. `stores/auth.ts` holds the session and
persists it to `localStorage`, so a reload does not sign you out.

Only one of the transports this app uses can send an `Authorization` header, so
the token is delivered two different ways:

| Transport | How the token travels | Where |
|---|---|---|
| REST | `Authorization: Bearer …` | `clients/http.ts` |
| SSE (`EventSource`) | `?token=…` | `hooks/useSSE.ts` |
| WebSocket | `?token=…` | `components/MainWebSockets.tsx` |
| MJPEG (`<img src>`) | `?token=…` | `components/ChamberCamera/` |

`withAuthToken()` in `stores/auth.ts` is the single place that appends the query
parameter. A 401 from any REST call clears the session (response interceptor in
`clients/http.ts`), which bounces the user back to `/login` via
`components/Auth/ProtectedRoute.tsx`.

### The dashboard

There is no fixed layout. Panels are placed, moved, resized, collapsed, maximised
and removed by the user, on a `react-grid-layout` grid.

**To add a new panel type, add one entry to `components/Dashboard/panelRegistry.tsx`.**
The grid, the "add panel" menu and the saved-layout sanitiser all read from that
registry; nothing else needs to change.

`DashboardGrid.tsx` deliberately drives the plain `GridLayout` and picks the
breakpoint itself, rather than using `ResponsiveGridLayout`. In react-grid-layout
2.2.x the responsive wrapper keeps its own breakpoint in state, ignores the
`breakpoint` prop, and was observed to switch to the new column count while still
rendering the *previous* breakpoint's coordinates — which on a phone rendered
12-column desktop geometry inside 4 columns and overflowed the page.

Layouts are stored per breakpoint (`lg` / `md` / `sm` / `xs`), and only the
breakpoint you are actually looking at is ever written, so rearranging panels on a
laptop cannot corrupt your phone layout.

### Settings

Per-user settings (dashboard layout, colour mode) live **on the backend**, under
`GET/PUT /users/me/settings`, so they follow you between machines and browsers.

`hooks/useSettingsSync.ts` hydrates the stores on login and writes changes back
debounced (~900 ms — dragging a panel emits a layout change per frame). The
backend treats the payload as opaque JSON; the schema is defined here, in
`clients/settings.ts`, so adding a setting needs no backend change.

The selected **host** is the one exception: it lives in `localStorage`
(`stores/app.ts`), because you have to choose a server before you can log in to it.

### Theming

`theme.ts` defines semantic tokens (`panel.bg`, `text.primary`, `plot.grid`, …).
Components should use those rather than raw colours, so light and dark stay in
step. Dark is the default — this runs on a lab display next to a chamber.

Nivo renders to a canvas and cannot read Chakra tokens, so it has a mirrored
palette in `components/Plotting/nivoTheme.ts`. Keep the two in step.

---

## Gotchas

- **`vite.config.ts` defines `process.env`.** `react-draggable` (pulled in by
  `react-grid-layout`) reads `process.env.DRAGGABLE_DEBUG` on every drag start.
  Without the shim, `process is not defined` throws inside `onMouseDown` and panels
  silently refuse to drag. Vite only replaces `process.env.NODE_ENV` on its own.
- **`StrictMode` is off** (`main.tsx`). It double-invokes effects, which opens and
  immediately tears down every WebSocket and MJPEG stream on mount.
