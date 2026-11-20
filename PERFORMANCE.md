# Dashboard performance

How the dashboard was made smooth (2026-11-17), what caused the jank, and
the rules that keep it smooth. Read this before adding a panel that reads a
live stream.

## Where the time goes

The backend is not the bottleneck. Measured on the dev stack with every panel
open, the socket carries about 1.5 MB/s, almost all of it RHEED video, and the
message handlers in `LumiTransport` take about 5 ms per second.

The cost is **React rendering after each message**. A zustand `set()` inside a
stream handler re-renders every subscribed component in a microtask right
after the handler. Profilers attribute that time to `WebSocket.onmessage`, but
it is render cost, not decoding.

The feeds that trigger renders:

| Feed | Rate | What it drives |
|---|---|---|
| `chamber.pld` `state` | 2 Hz, ~7.4 KB | PLD Chamber, PLD Chamber Controls, Monitor charts |
| `detection.overlay` | ~3.7 Hz | RHEED overlay, classification chart |
| `system.registry` heartbeat | ~0.8 Hz | Server Nodes, every node store |
| `rheed.video` / `chamber.camera` | 21-27 Hz | Canvases only, drawn outside React |

## Symptoms and causes

### 1. Stutter every 0.5-2 s while streaming (fixed in 4112eea)

Before: 4-6 fps, main thread 90-97% busy, a ~400 ms task every 0.5 s.

- Each `chamber.pld` push is fresh JSON. The store swapped in the whole new
  object, so every component reading any part of it re-rendered, including
  sections whose values had not moved.
- Every push repeats the newest ten activity entries. The store rebuilt the
  activity array each time, so the ~200-row Activity list re-rendered with
  nothing new.
- The PLD Chamber panel re-rendered its 200 Recent events on every push, and
  each event mounted its own Chakra `Popover`, which is expensive to create.
- The Monitor charts also subscribed to the `chamber.log` feed, which they do
  not plot under the pld driver.

After: 56 fps, 3-7% busy.

### 2. A long-open tab gets slower and slower (fixed in 4993d5c)

A tab open for a while dropped to 16 fps, with ~118 ms of rendering per
`chamber.pld` push. A reload made it look fast again, which hid the problem.

- `stores/chamberPldSeries.ts` keeps up to 3600 rows (30 min at 2 Hz). On
  every push each Monitor chart mapped **all** rows into new `{x: Date, y}`
  points (6 series on Pressure alone), then threw most away to show its
  10-minute window. The cost grew with uptime until the store was full.
- The PLD Chamber panel still rendered all ~100 fields across its 14 sections
  on every push (27 ms per push in dev).

After, with a full 30 min of history: 57 fps idle, 6 ms per push for the
PLD Chamber panel.

### 3. Scrolling

Scrolling ran at ~22 fps with long tasks of up to 142 ms. Most of those long
tasks were the render costs in 1 and 2, landing mid-scroll. With both fixed,
the page's JavaScript costs the same while scrolling as while idle.

What remains is drawing, not code: ~31 fps while scrolling, 57 fps idle. The
Chrome on the office workstation has no hardware acceleration (WebGL is
unavailable), so it rasterises the whole 2264x1155 page in software while the
RHEED video repaints at 27 Hz. Check `chrome://gpu` ("Compositing" and
"Rasterization" should say "Hardware accelerated"). A production build is also
faster than these dev-server numbers.

The chamber camera adds no measurable cost: the numbers above were taken with
it streaming.

## The fixes, and the rules they imply

1. **Keep unchanged state the same object.**
   `setChamber` merges with `replaceEqualDeep` from `@tanstack/react-query`
   (`stores/chamberPld.ts`). A slice that did not change keeps its identity, so
   `s.chamber?.valves` only fires when the valves change. Apply this to any
   store fed by a stream of full snapshots.

2. **Do not write a store when nothing changed.**
   `mergeActivity` returns the old state when every pushed entry matches the
   one already held. A new array, even with equal contents, re-renders every
   list that shows it.

3. **Select the narrowest slice.**
   Use `useChamberPldStore((s) => s.chamber?.heater)`, not
   `useChamberPldStore((s) => s.chamber)` followed by `.heater` in the body. A
   component that only needs to know "do we have state yet" selects
   `s.chamber != null`. A value only needed while a dialog is open selects
   `pending ? s.chamber : null`.

4. **Split a big panel into memoized pieces fed by slices.**
   Each PLD Chamber section is a `memo` component taking only its slice
   (`<HeaterSection heater={chamber.heater} limits={chamber.limits} />`).
   Together with rule 1, a push re-renders only the sections whose readings
   moved. The same goes for controls: the pressure readouts (`GaugePair`)
   select their own fields so a gauge tick does not re-render the valve grid.

5. **Long lists are memoized and read the store themselves.**
   `ActivityList`, `ActivityRow` and `RecentEvents` are `memo` and subscribe
   to their own data, so the parent re-rendering does not re-render them.

6. **Mount expensive widgets lazily.**
   `TruncatedText` renders plain text until it is clicked, and only then mounts
   its `Popover`. Do not mount a popover, tooltip or menu per row of a long list.

7. **Chart only what is visible.**
   `windowRows()` in `stores/chamberPldSeries.ts` cuts the rows to the chart's
   window *before* mapping them to points, and thins them to ~400 points on
   fixed time buckets (so the kept points do not shift between pushes). A
   chart is a few hundred pixels wide. Memoize the result on
   `[rows, windowSize]`. `RealTimeLineChart` is `memo` and memoizes its own
   windowing.

8. **Do not subscribe to a feed you do not draw.**
   `useLog(enabled)` returns a stable empty result when disabled; the Monitor
   charts pass `driver !== "pld"`.

9. **Draw video outside React.**
   `useChamberCamera` and the RHEED player decode with `createImageBitmap`
   and draw on a canvas from `requestAnimationFrame`, latching their status so
   a frame does not dispatch React state. Keep it that way.

## How to measure

Always measure on a tab that has been open a while, or fill the series store
first. A fresh reload hides history-dependent costs (see 2).

All of these run in the page console on the dev server (`localhost:5173`).

**Frame rate and long tasks for 10 s** (add the two `scrollTop` lines to
measure scrolling):

```js
const res = { f: [], lt: [] };
const po = new PerformanceObserver((l) => l.getEntries().forEach((e) => res.lt.push(e.duration)));
po.observe({ type: "longtask" });
let last = performance.now(); const t0 = last;
await new Promise((done) => { const step = (t) => { res.f.push(t - last); last = t;
  // document.scrollingElement.scrollTop += 15;  // scroll test
  t - t0 < 10000 ? requestAnimationFrame(step) : done(); }; requestAnimationFrame(step); });
po.disconnect();
const f = res.f.slice(1);
({ fps: Math.round(f.length / (f.reduce((a, b) => a + b, 0) / 1000)),
   over50: f.filter((x) => x > 50).length, longTaskMs: Math.round(res.lt.reduce((a, b) => a + b, 0)) });
```

**Render cost per feed:** wrap `LumiTransport.prototype.onMessage` (import
`/src/generated/lumi.ts` with the same `?t=` query the page loaded, found via
`performance.getEntriesByType("resource")`). Time from the call to two nested
`queueMicrotask`s after it, keyed by `target:stream` from the frame header.
That includes the React render the message triggers.

**Render cost per panel:** temporarily wrap `{definition.render()}` in
`DashboardGrid.tsx` with `<Profiler id={definition.title} onRender={...}>`
and accumulate `actualDuration` per id on `window`. Remove it afterwards.

**Full chart history:** import `/src/stores/chamberPldSeries.ts` the same way
and `setState({ rows })` with 3600 synthetic rows 0.5 s apart.

Reference numbers (dev server, office workstation, all panels open, camera on,
3600 rows):

| | Idle | Scrolling |
|---|---|---|
| Frame rate | 57 fps | 31 fps |
| Frames over 50 ms in 10 s | 2 | 39 |
| Long tasks in 10 s | 0.3 s | 0.7 s |

Per-panel render cost per 10 s: Chamber Monitor ~1 s (its charts redraw on
real data, about 8 times a second), Server Nodes ~0.25 s (registry
heartbeats), PLD Chamber ~0.14 s, Experiment Driver ~0.08 s. A panel that
shows up far above these after a change is the regression.

## Not done yet

- Server Nodes re-renders on every registry heartbeat (~15 ms each in dev).
  Not a stutter source today; split its rows per node if it grows.
- The classification chart redraws on every detection (~3.7 Hz). It is live
  data over a 20 s window, so it was left alone.
