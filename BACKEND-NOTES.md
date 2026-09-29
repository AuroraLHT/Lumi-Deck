# Backend issues found during the frontend `/ws` migration

**Date:** 2026-07-28
**Frontend branch:** `feat/auth-modular-dashboard`
**Backend probed:** `Autonomous-Servers/.claude/worktrees/refactor-contract-nodes`, running via
`scripts/start_simulation.sh` on `localhost:8000`
**Contract hash:** `33d6c4f476c4dda8` (matches `src/generated/lumi.ts`)

The frontend has been migrated off the removed legacy endpoints onto the single
`WS /ws` bridge. Every media panel now talks to a generated capability client.
While verifying each one against the running simulation, five things turned up
that are **backend-side** — the frontend code for them is written, typechecks and
builds, but cannot produce data until these are resolved.

Nodes up during these runs: `chamber`, `rheed`, `storage`, `system` — all
`status: up`, `contract_matches: true`.

---

# UPDATE 2026-07-30 — MJPEG verified end to end, §0 fixed

**Contract `5a6b14ce52d03047`. Nothing outstanding on the chamber camera.**

`chamber.camera:frame` is confirmed working against the running stack, and
`rheed.video:fragment` (§0) is alive again. Measured over 10s with `start`
called and one subscriber:

```
frames          204 in 9.9s   ->  20.6 fps
throughput      1.08 MB/s     (was 23.0 MB/s as NPY -- 21x)
frame size      51.4 KB       (q80, as predicted)
integrity       204/204 complete JFIF (ff d8 … ff d9), 0 malformed
decode          640x480 RGB, matches meta width/height
meta            time, uuid, time_stamp, frame_idx, width, height, quality, channels
```

Every field of `JpegMeta` arrives as specified, and a captured frame decodes to
a real 640x480 RGB image. The frontend hook is unchanged by this contract bump --
the only delta was `n_dropped` on `CameraState`, no client API change.

**Steady state is clean.** Over 30s of continuous streaming, `n_encoded` rose
+62 per 3s bucket while delivery was 62 per 3s and `n_dropped` stayed frozen at
957. Encode rate equals delivery rate with zero drops; the 957 accumulated
earlier, while nothing was draining the queue. That is the pipeline behaving
exactly as designed.

## `n_dropped` was the right thing to expose

Thanks for adding it. It is now the signal worth trusting, and it settles the
question raised in `FRONTEND-NOTES.md` §4.

`n_encoded` alone cannot distinguish a healthy feed from a dead one:
`JpegEncoder._put` (`jpeg_stream.py:150-166`) increments it *after* evicting the
oldest frame to make room, so an undrained queue counts up at full rate. Measured
directly with no consumer attached: 61 encoded against 57 dropped. It proves the
encoder thread is alive and nothing more.

`n_dropped` holding steady while `n_encoded` climbs is the thing that actually
means "frames are reaching a subscriber", and it is what made this verification
conclusive rather than circumstantial. If a liveness chip gets built on the
frontend, that is the pair it should watch.

## One thing to be aware of, not a bug

The stream is gated on `start` (`server.py:_ctl_start` sets `_streaming`), so a
subscriber that never calls it sees silence with no error -- which is what my
earlier survey was measuring and misreporting. `useChamberCamera` calls
`startStreaming()`, so the browser is fine. Worth knowing when reading a probe
that only subscribes.

Note also that `_stream_task` is created once at serve time
(`server.py:158-161`) and `_ctl_start` only flips the flag -- it does not check
whether the task is still alive. If that task ever dies, `start`/`stop` cannot
bring it back and the capability keeps reporting `is_streaming: true`; only a
process restart recovers. The `await self.exchange.publish(...)` at the end of
`_stream_loop` is the one statement in that loop not wrapped in a try/except, and
`asyncio.create_task` there has no done-callback, so such a death would be
entirely silent. Not something I can show happening now that everything works --
flagging it only because it matches the shape of §0 and would be cheap to
harden.

Still open elsewhere: §1/§2 (STFT register, transposed width/height) were not
re-verified -- no bbox is registered, so the integrator stream has nothing to
emit. `detection.*` streams were likewise not retested.

---

# UPDATE 2026-07-31 — the box registry is now mirrored live in the UI

The frontend now shows every box registered on `rheed.integrator`, whoever
registered it, and follows changes made by other clients. **No backend change was
needed for this** -- it is built entirely on what the contract already provides.
Recording how, because it is a pattern worth reusing, and then two things that
would make it better.

## How it works, so it does not get broken by accident

`IntegratorReadout.registered_bboxes` is part of the capability's state; capability
state rides the node's 2s heartbeat; and `NodeRegistry.on_heartbeat` emits
`state_changed` whenever a heartbeat's capabilities blob differs from the previous
one (`registry.py:77`). A register or remove by *anyone* makes that true, so the
id list is already being pushed to every subscriber of `system.registry`. The
frontend just watches it and calls `bboxes()` for coordinates when the id set
moves.

Measured against the live backend: another client's `register` is visible in
**~850ms**, and on a fresh page load the list is populated in **130ms** (from the
`list_nodes()` seed, which carries the same state). Three `bboxes()` calls over a
19s session -- one per actual change, none on idle heartbeats.

The load-bearing part is that `registered_bboxes` stays in the readout rather than
moving somewhere the heartbeat does not reach. If it ever does, the UI silently
stops following other clients -- it will not error, it will just go stale.

## 5. Registered boxes do not survive a node restart

`Integrator.bboxes` is a plain dict built in `__init__` (`rheed/integrator.py:43`),
so every box and its integration cache is lost when the RHEED node restarts. The
frontend can now recover boxes across a *browser* reload, which is most of what
the user hits day to day, but it cannot recover them across a node restart --
there is nothing left to read.

This is worth considering because the boxes are hand-placed against a specific
diffraction pattern: re-drawing them is not just a click, it is re-deciding where
the streak was. Persisting `{bbox_id: bbox}` on register/remove and reloading it
on start would make a node restart invisible to an operator mid-growth. The
integration *cache* does not need persisting -- only the regions.

## 6. `integrator.remove` can orphan an STFT registration

`IntegratorHandler.remove` calls `integrator.remove_bbox(id)` and nothing else,
while `STFTHandler.remove` deliberately leaves the integration alone. So removing
a box from the integrator while an STFT is running on it leaves
`calculator.registered_integrations` holding an id the integrator no longer has:
`stft.registered_bboxes` reports a box that `integrator.bboxes()` cannot describe.

The frontend joins on the integrator's ids, so such a box simply stops being
listed -- it does not crash, and no coordinates are invented for it. But the node
is then computing (or failing to compute) an STFT over a series nobody is
producing. Dropping the STFT registration inside `integrator.remove` would close
it.

---

# UPDATE 2026-08-02 — storage state is now mirrored across clients; one ghost field to delete

**Contract `5a6b14ce52d03047`.** One request (§7) and one report (§8).

The Storage panel used to be blind to everyone else: it read
`storage.storage.state` once on mount and then flipped a local boolean on its own
click. Two browsers open, one starts a recording, the other showed a red "record"
button indefinitely.

**No backend change was needed for that** — the data was already on the wire.
`heartbeat.py:70-83` calls `refresh_state()` on every capability and dumps the
full state blob into the 2s heartbeat, and `registry.py:77-78` diffs that blob and
emits `state_changed`. The frontend was already subscribed via
`system.registry:registry_event`; it just never projected the `storage` node.
It does now, so `is_storing`, `project_name`, `path` and `deps_available` drive the
panel for every connected client. Recording start/stop is decided against node
state rather than a local flag, so one operator's session is correctly stopped
rather than double-started by another.

Two things came out of doing that.

## 7. `n_frames` is a ghost field — please delete it

`StorageReadout.n_frames` (`src/lumi/contracts/payloads/storage.py:39`) is declared
as `int | None = None` and **nothing ever assigns it**. `StorageHandler.readout()`
(`src/lumi/storage/handlers.py:127-133`) constructs the readout with four fields
and omits it, so every heartbeat and every `getState()` reports `null`. §4 below
already captured this on the wire without anyone noticing:

```json
{"is_storing": false, "project_name": null, "path": null,
 "deps_available": {...}, "n_frames": null}
```

A published contract that advertises a number nobody provides is worse than no
field at all: every client has to write code for a value that is always absent.

**Request:** remove the one line from `StorageReadout` and regenerate. We
considered wiring it to the recorder's frame count instead and decided against
reviving a placeholder — see "the counter we are *not* adding yet" below.

Safe on our side: nothing in the frontend reads it. A grep across `src/` returns
only the generated declaration in `src/generated/lumi.ts`.

Three consequences, none of them obvious from the size of the diff:

1. **The contract hash moves.** `_capability_json` includes
   `"state": _schema(cap.state)` (`src/lumi/contracts/registry.py:66`), so the
   state schema feeds `canonical_json()` → `contract_hash()` (`registry.py:105`).
   Deleting one field changes `5a6b14ce52d03047` to something new.
2. **Every node has to be redeployed together.** `registry.py:60` sets
   `contract_matches = hb.contract_hash == self.own_hash`, so any node still on the
   old contract will be flagged mismatched and log a warning each time it joins.
3. **CI fails without regeneration.** `uv run lumi-codegen --check` is a drift gate.
   Please run `uv run lumi-codegen` and commit `web/src/generated/lumi.ts`,
   `src/lumi/generated/clients/`, and `schemas/contract.json` in the same change.

We will copy the regenerated `lumi.ts` across once it lands — we will not hand-edit
ours ahead of you, since it would then disagree with the `contract_hash` recorded
in its own header.

## 8. Report: the recorder's index counters race (pre-existing, not from this work)

Found while checking whether `n_frames` *could* be wired. Reporting rather than
requesting, since it is yours to weigh — but it is frame loss, not just a bad
counter.

`RecorderServer.save_frame` (`src/lumi/storage/record.py:791`) submits into a
`ThreadPoolExecutor` sized by `max_workers = 8` (`cfg/settings.toml:384`), so
`Recorder.save_frame` runs on **eight threads concurrently**. Each takes its index
from `next_frame_idx` (`record.py:452-455`):

```python
@property
def next_frame_idx(self):
    idx = self._idx_frame      # LOAD_ATTR
    self._idx_frame += 1       # BINARY_OP + STORE_ATTR  -- no lock, not atomic
    return idx
```

The GIL can switch between those bytecodes, so two threads can be handed the same
`idx`. `ds_frame[_idx] = frame` at `record.py:510` then silently overwrites a frame
that was already written, and `_idx_frame` ends up below the true count.

The same shape applies to `next_log_idx`, `next_detection_idx`,
`next_integration_idx` and `next_integration_bbox_idx` (`record.py:445-473`), and
to the `ds_*.attrs['size'] += 1` increments beside them. A `threading.Lock` around
the five properties would close it.

Two notes for whoever picks this up:

- **`next_frame_idx` is a property with a side effect.** Anything that reads it to
  *display* a count consumes an index and desynchronises the write sequence. A
  future counter must read `_idx_frame` directly, or get a new side-effect-free
  `frames_written` property — the current name gives no hint that touching it
  mutates.
- **The throttle is correct and worth preserving.** `record.py:501-503` returns
  before incrementing when the speed limiter rejects a frame, so `_idx_frame`
  counts frames *written*, not frames *received*. That is the right semantic for a
  progress display.

## The counter we are *not* adding yet, and why

Recording this so it does not get rediscovered from scratch, and so §7 does not
read as "the frontend did not want the number".

We do want a progress counter eventually. What we do not want is it living on
presence-carried state. `registry.py:77` emits `state_changed` whenever the
capability blob differs from the previous heartbeat, and every current storage
field is stable for the duration of a recording — so events fire on real
transitions only, which is exactly what makes the cross-client sync above cheap. A
value that ticks every 2s turns the registry into a 0.5 Hz event pump, waking every
connected client for the length of a growth.

When we build it, the shape we would propose is a `VOLATILE_FIELDS` ClassVar on
`ServerStateBase` (`src/lumi/contracts/payloads/common.py:44`) that
`heartbeat.py:81` passes to `model_dump(exclude=...)`. The value then rides the
`getState()` control call (`base/mq/server.py:464`, which already calls
`refresh_state()` first), and the Storage panel polls it only while `is_storing` is
true and the panel is open. Presence keeps announcing transitions; progress gets
pulled by whoever is actually looking.

**§8 is a prerequisite** — a count derived from `_idx_frame` is wrong until the
increments are locked.

## Still blocked on §4

The cross-client storage work above is **unverified against a real recording**.
Under `scripts/start_simulation.sh`, `storage.storage.start_recording` still times
out and `deps_available` still reports `chamber`, `rheed` and `detection` all
false while `chamber` and `rheed` are up and streaming on the same bus (§4). The
panel's state mirroring is correct by construction and builds clean, but it cannot
be exercised end to end until a recording can actually start.

---

## 0. `rheed.video` publishes no fragments despite `is_streaming: true` — video feed is dead

**This is the most user-visible one: the RHEED video panel shows nothing.**

The capability reports itself healthy and `start` succeeds, but the `fragment`
stream never emits:

```
rheed.video.state  -> {"is_running":true,"is_streaming":true,"error":null,
                       "n_fragments":null,"fragment_duration":0.0166666...}
rheed.video.start  -> {"ok":true}
subscribe rheed.video:fragment  -> 0 messages in 20s
```

`initial_fragments` works correctly — 4 fragments, 324,874 bytes, payload starts
with a valid `moov` box — so the MSE init segment is fine. It is only the live
fragment stream that is silent. At `fragment_duration` 0.0167s (60 fps) there
should have been hundreds of fragments in that window.

**This is not a subscribe-side problem.** On one socket, subscribing to three
streams together and starting all three:

| stream | messages in 20s |
|---|---|
| `rheed.video:fragment` | **0** |
| `rheed.camera:frame` | 210 |
| `chamber.camera:frame` | 168 |

Same connection, same framing, same `control: true` start verb — the two camera
capabilities deliver, the video capability does not. So the bridge, the
subscription routing and the client are all working; the video node is not
publishing onto its stream.

**Frontend impact:** `useRheedVideo` appends the init segment and then waits
forever for media fragments, so the `<video>` stays blank. No frontend change
will help until fragments flow.

**Recovery observed:** a full server restart fixed it. `start` does not, because
it is idempotent against the `is_streaming` flag — it returned `{"ok": true}` and
did nothing while the pipeline was dead.

### Likely mechanism (`lumi/base/camera/video_stream.py`)

`VideoCompressor` is a `threading.Thread` whose `run()` has no exception handling:

```python
def run(self):
    for content in self.yield_video():
        self.fragments.put(content)
```

and `yield_video()` deliberately re-raises on any encode/mux failure
(`logging.error(...); raise e`, ~lines 191 and 221). A raise propagates out of
`run()`, **the thread exits**, and the process carries on. Nothing sets
`is_streaming = False`; nothing populates `error`. `is_streaming` is a flag
written by start/stop, not derived from producer liveness — so the capability
advertises `is_streaming: true, error: null` over a dead thread.

This explains the observed signature exactly, including why `initial_fragments`
kept working: it reads `self.startup_fragments`, a plain **list** filled during
the first few keyframes, whereas live fragments come from `self.fragments`, a
`Queue` only the running thread feeds. The list survives the thread's death.

There is precedent for this in-tree. From the `_to_8bit` docstring in
`lumi/rheed/hardware.py`:

> …handed uint16 straight to putText, which raises `(-215:Assertion failed)
> img.depth() == CV_8U`, **killing the compressor thread. That is why the video
> capability served zero fragments on the simulated camera.**

Same failure mode, already hit once. `_to_8bit` fixed that one trigger; it did not
make the thread survivable, so any other encoder hiccup reproduces it.

### A second, latent fragility

`self.fragments = queue.Queue(maxsize=fragment_queue_size)` (default 10) and
`run()` uses a plain blocking `put()`. If the drain ever stalls, the producer
parks in `put()` forever with the same healthy-looking state.

Probably *not* what happened here: a blocked `put()` self-heals as soon as a
consumer drains one item, so fragments would have resumed within a second of a
browser subscribing. Zero fragments across 20s with no recovery fits a dead
thread, not a blocked one. Worth fixing regardless.

### Triage next time — before restarting

A restart destroys the evidence, so the above is a strong inference, not proof.

1. `py-spy dump --pid <rheed node pid>` — compressor thread **absent** means it
   died; **parked in `Queue.put`** means the queue filled. This one command
   distinguishes the two.
2. Node stderr/log around the stop — an unhandled thread exception prints a
   traceback, preceded by the `logging.error` from the mux/encode handler.

### Suggested hardening, roughly in value order

- Wrap `run()`'s loop so a raise sets `error` and flips `is_streaming = False`
  instead of vanishing. A capability that reports itself degraded is something the
  UI can surface; a silent one is not.
- Derive `is_streaming` in `readout()` from `thread.is_alive()` plus a
  last-published timestamp rather than the flag. Note `n_fragments` is declared in
  the state payload but comes back `null` — it is never populated, so there is no
  health signal today; populating it would provide one for free.
- Make `put()` non-blocking with a drop-oldest policy. For live video, dropping a
  stale fragment is correct; blocking the encoder never is.
- Have `start` check the thread is alive and restart it if not, instead of
  short-circuiting on the flag — otherwise a process restart stays the only
  recovery path.

---

## 0b. The bridge serves a connection's requests serially — one dead node stalls everything

**Added 2026-07-28, after the video-publishing fix landed.** This one is
architectural and outlived the fragment bug.

A request to a capability whose node is absent occupies the connection for its
full server-side timeout (~10s), and every request queued behind it on that same
socket fails. Measured on two fresh sockets:

| socket | request | result |
|---|---|---|
| A | `rheed.video.initial_fragments` alone | **ok, 67 ms**, 514 KB |
| B | same request, issued right after `detection.detection.state` + `detection.overlay.start` | **never answered in 15s** — `detection.detection.state` errored at 10,008 ms and the video request died behind it |

Since the browser multiplexes every capability over one `/ws` connection, a
single missing node makes *unrelated, healthy* capabilities look broken. In this
case the absent `detection` node (issue #3) caused the RHEED video panel to come
up empty with `initial_fragments timed out after 10000ms` — a failure with no
visible connection to detection at all. That is an expensive symptom to chase.

**Worked around on the frontend** by gating detection calls on the registry
reporting a detection node up. That is a patch on one instance, not the class of
problem: any node dying at runtime reintroduces it, and the browser cannot know
in advance which capability will be slow.

Two things would fix it properly, and they are independent:

- **Dispatch requests concurrently per connection** rather than awaiting each in
  turn. Correlation ids are already in the frame header, so responses can return
  out of order — the client (`LumiTransport.rpc`) already matches on
  `correlation_id` and does not care about ordering.
- **Fail fast when no node is registered for a target.** The registry already
  knows whether a `detection` node exists; returning an immediate
  `NodeUnavailable` error beats a 10s wait for a node that was never there. This
  alone removes most of the pain even if dispatch stays serial.

---

## 1. `rheed.stft.register` raises AttributeError — blocks all STFT

Registering a box with the STFT capability fails immediately:

```
[AttributeError] 'STFTCalculator' object has no attribute 'register_bbox'
```

`rheed.stft.cache` then fails as a consequence:

```
[KeyError] 'bbox 1 has no STFT cache'
```

The capability reports itself healthy — `is_running: true, is_streaming: true,
registered_bboxes: []` — so nothing surfaces until a register is attempted.

**Reproduce** (over `/ws`, frame = `[u32 header_len][header json][payload]`):

```
-> {"target":"rheed.stft","op":"register","kind":"request","correlation_id":"c0"}
   payload: {"bbox_id":1,"bbox":{"x":100,"y":100,"width":80,"height":60}}
<- kind=error  AttributeError  'STFTCalculator' object has no attribute 'register_bbox'
```

The equivalent `rheed.integrator.register` with the same body returns `{"ok":true}`,
so this looks like `STFTCalculator` simply not implementing the register/remove
half of the contract that `RheedStftClient` exposes.

**Frontend impact:** the STFT spectrum panel stays empty. `useAnalysisStreams` is
subscribed to `rheed.stft:stft` and `useAnalyzerControl` calls `register`/`remove`
exactly as the integrator does; it should start working with no frontend change.

---

## 2. `IntegrationResult.width` and `.height` are transposed

The integrator applies the registered box correctly — the reported centers prove
it — but the `width`/`height` fields in the result come back swapped.

Registered `{"x":100,"y":50,"width":200,"height":40}` (bbox_id 7), received:

```json
{"width": 40, "height": 200, "center_x": 200, "center_y": 70}
```

| field | expected | got | |
|---|---|---|---|
| `center_x` = x + width/2 | 200 | 200 | OK |
| `center_y` = y + height/2 | 70 | 70 | OK |
| `width` | 200 | 40 | swapped |
| `height` | 40 | 200 | swapped |

The centers are computed from the correct extents, so only the two reported
fields are wrong. Looks like a NumPy `.shape` being unpacked as `(width, height)`
where the slice is `img[y:y+height, x:x+width]` and therefore `(rows, cols)` =
`(height, width)`.

**Frontend impact:** none today — the Oscillation chart plots `mean`. Flagging it
because anything that later sizes a box from an integration result will be wrong,
and because it is cheap to fix now.

---

## 3. No `detection` node runs under `start_simulation.sh`

`system.registry.list_nodes` returns only `chamber`, `rheed`, `storage`, `system`.
Anything addressed to `detection.*` therefore times out:

```
[Timeout] detection.detection.state did not answer
```

**Frontend impact:** the RHEED video's bounding-box overlay and the Chamber
Monitor's classification chart stay empty, and the box-selection workflow in the
Detection Analyzer has nothing to select. These are wired to
`DetectionOverlayClient.onOverlay()` and `DetectionDetectionClient.getState()`
(for the crop window) but could not be verified end to end here.

If the detection node is expected to be part of the simulation, it is not being
spawned. If it is deliberately excluded, it would help for the simulation script
to say so — from the frontend the symptom is indistinguishable from a crashed node.

---

## 4. `storage.start_recording` times out; `deps_available` all false

```
-> storage.storage.start_recording
   {"project_name":"...","save_frame":true,"save_ai":true,"save_log":true,"save_integration":true}
<- [Timeout] storage.storage.start_recording did not answer
```

`storage.storage.state` before, during and after is unchanged:

```json
{"is_running": true, "is_streaming": false, "error": null, "is_storing": false,
 "project_name": null, "path": null,
 "deps_available": {"chamber": false, "rheed": false, "detection": false},
 "n_frames": null}
```

`deps_available` reports all three sources unavailable even though `chamber` and
`rheed` are both `up` and actively streaming on the same bus — so the dependency
check looks like it is not seeing them, rather than the sources genuinely being
absent.

Worth noting the call **hangs** rather than returning `{"ok": false, "message":
"..."}`. `stop_recording` does the graceful thing in the same situation:

```json
{"ok": false, "message": "not recording", "project_name": null, "path": null}
```

A timeout costs the UI a 10s stall before it can report anything; a structured
`ok: false` would surface the real reason immediately.

---

## Notes that may be useful on the backend side

These are observations from the wire, not requests:

- **Chamber camera frames are raw `.npy` buffers** — uint8 `(480, 640, 3)`, ~900 KB
  per frame at 25 fps ≈ 23 MB/s per subscriber. The browser cannot decode this
  natively, so the frontend unwraps the `.npy` header and blits to a canvas. It
  works, but if a JPEG/WebP-encoded variant of `chamber.camera` is ever on the
  table, it would cut bandwidth by ~20x and remove a per-frame RGB→RGBA pass in JS.
- **`time_stamp` format is `"YYYY-MM-DD HH:mm:ss.ffffff"`** (space separator).
  `new Date()` on that string is not spec'd — V8 accepts it, other engines return
  `Invalid Date`. The frontend normalises to ISO on the way in. ISO-8601 with `T`
  at the source would be one less place to get this wrong.
- **`chamber.log` `LogEntry.time` is `0` and `time_stamp` is `""`** on every entry;
  the real timestamp is in `values["Time"]`. The frontend uses `values["Time"]`.
- **`chamber.log.log()` returns a single row**, not a backfill, so charts start
  empty and fill at ~1 Hz. Not a bug, just noting it in case a history window was
  intended.
- **`frame_dims` lives on the rheed node's `camera` capability**, not `video`. That
  is the only place the frontend can learn the sensor geometry the detection boxes
  are expressed in.
- `system.registry` has no `nodes` op (it is `list_nodes`) — worth knowing that the
  error `KeyError "registry has no op 'nodes'"` is a client mistake, not a fault.

---

## How these were reproduced

Raw `ws` client against `ws://localhost:8000/ws`, framing per `src/generated/lumi.ts`:

```
[u32 big-endian header_len][header JSON][payload bytes]

request:   {"target": "...", "op": "...", "kind": "request", "correlation_id": "c0"}  + JSON payload
control:   {"target": "...", "op": "start|stop|state", "kind": "request",
            "correlation_id": "c0", "control": true}          (no payload)
subscribe: {"kind": "subscribe", "target": "...", "stream": "..."}
```

Auth was disabled for these runs (the simulation returns an anonymous admin), so
no `?token=` was needed.

Any test boxes registered while probing were removed afterwards —
`rheed.integrator.bboxes` returns `{}`.

---

# UPDATE 2026-08-25 — backend repo renamed to `Lumi-Lab`, refactor merged to `main`

**Nothing to resync.** Contract hash is still `7e7d5e6d72531bde`, identical to what
`src/generated/lumi.ts` already has. No client regeneration, no API change.

**But one path in this repo is now broken.** See "Action required" below.

## What changed on the backend

The contract-nodes refactor is finished and merged. It no longer lives on a branch
in a worktree — it *is* `main` now.

| | before | after |
|---|---|---|
| GitHub repo | `AuroraLHT/Autonomous-Servers` | `AuroraLHT/Lumi-Lab` |
| local dir | `../Autonomous-Servers` | `../Lumi-Lab` |
| refactor branch | `worktree-refactor-contract-nodes` in `.claude/worktrees/refactor-contract-nodes` | merged to `main`, worktree removed |
| pre-refactor code | `main` | tag `v1.0.0` |

The old GitHub URL still redirects, so clones and remotes keep working. The old
*local* directory name does not — it is gone.

## Action required: `package.json` → `sync:client`

The script points at a path that no longer exists, for two separate reasons — the
worktree was removed, and the directory was renamed:

```
    "sync:client": "cp ../Autonomous-Servers/.claude/worktrees/refactor-contract-nodes/web/src/generated/lumi.ts src/generated/lumi.ts"
```

It should now be:

```
    "sync:client": "cp ../Lumi-Lab/web/src/generated/lumi.ts src/generated/lumi.ts"
```

The generated client is at `web/src/generated/lumi.ts` on `main` — same file, same
contents, just reachable from the repo root instead of from inside a worktree.

## Other stale references to fix while you are in there

None of these break a build, they are just wrong now:

- `README.md:5` — link `[`Autonomous-Servers`](../Autonomous-Servers)` → `../Lumi-Lab`
- `README.md:16` — comment `# in Autonomous-Servers`
- `FRONTEND-NOTES.md:11` and `:124` — the `cp ../Autonomous-Servers/web/src/generated/lumi.ts` lines
- `BACKEND-NOTES.md:5` — the "Backend probed" header at the top of this file still
  names the worktree path it was written against. Leaving it as a historical record
  is fine; just do not copy the path out of it.

---

# UPDATE 2026-09-21 — fiducial roles have a UI; one request to put them on the heartbeat

Reply to "Fiducial markers can now be named by role" in `FRONTEND-NOTES.md`.
**Contract taken: `21112a7b98c5aa79`**, from `fiducial-markers` rather than `main`, as
that note instructs. `package.json`'s `sync:client` still points at `main` on purpose —
running it right now would *downgrade* the checked-in client. Once the branch merges it
becomes the correct command again and this note is the reminder to re-run it.

## What shipped (branch `feat/fiducial-markers-ui`)

An operator can tag a marker from the Chamber Camera toolbar: the tag icon opens a role
menu listing every `role -> marker_id`, with a name field (existing names offered back as
completions) and a marker picker that follows whichever marker is selected in the
toolbar. Assigning an existing name re-points it — the button says "Re-assign" so nobody
is surprised by that. Any roles pinned to a marker also ride along on the marker's tag
in the toolbar, since "sample_holder" is what an operator recognises a week later and
"marker-34" is not.

Dangling roles are flagged, as you suggested: the frontend is the only side that knows
which ids currently exist, so a role whose marker is not in `marker_ids` is drawn in the
warning colour with a "re-assign or clear" line rather than dropped. The picker only
offers existing markers, so the UI cannot create a dangling role — only outliving a
marker can.

Verified against `start_simulation.sh --with-auth`: assign, re-point, tag display,
dangling flag after removing the tagged marker, and clear, each confirmed in
`cfg/chamber_fiducials.json`.

## The one thing worth changing: roles do not ride the heartbeat

`marker_ids` is on `FiducialState`, so a marker another client draws or removes shows up
within 2s for free. Roles have no equivalent — nothing on the wire says a role moved, and
`list_roles()` is the only way to find out. The frontend currently refetches on connect
and whenever `marker_ids` changes, on the grounds that re-tagging usually happens around
drawing. It is a guess, and it is wrong whenever someone re-points a role without
touching the marker set: a second operator's console keeps showing the old assignment
until its marker list moves or the page reconnects.

**Ask: add `roles?: Record<string, string>` to `FiducialState`.** It is the same shape and
the same argument as `marker_ids` — a handful of short strings that change roughly never,
so it costs nothing per heartbeat and does not turn the registry into an event pump the
way a per-frame counter would (§2 of the 2026-08-02 note). With it the frontend drops the
refetch heuristic entirely and mirrors roles exactly the way it mirrors marker ids.

Not blocking: the UI works as-is, and for a single operator at one console the difference
is invisible.

---

# UPDATE 2026-09-24 — roles on the heartbeat: consumed; predefined roles have a picker

Replying to the 2026-09-24 FRONTEND-NOTES entry and closing the ask in the
2026-09-21 update above. Client synced from Lumi-Lab `main` (contract
`3ac5669ddf974b76`); `npm run sync:client` is back to pointing at the right place.

- **`FiducialState.roles` is consumed.** The frontend now takes assignments off
  the heartbeat and no longer refetches `list_roles()` when the marker set
  moves. Verified with two browsers: a role set in one showed in the other
  after ~0.5 s, and a clear after ~2 s, with no marker change. Before, it
  stayed stale for 6 s or more.
- **`list_roles()` is still called once per connection**, only for `known`,
  which isn't on the heartbeat. That's fine as long as `known` only changes
  when the backend is redeployed; if it ever changes at runtime, put it on the
  heartbeat too.
- **`RoleMap.known` has a UI.** The role menu offers the predefined roles as a
  pick list with `doc` as the hint, with free text under "Other...". A known
  role that is unassigned or points at a removed marker is flagged in the menu
  and on the toolbar's tag button.
- **Not built yet:** §2 of the note (`auto_align_center_mask` and the
  `fiducial_role` pending confirmation). That waits for a driver panel.

---

# UPDATE 2026-09-24 — experiment driver panel: three small asks for mask centering, and one wire quirk

Lumi-Deck now has an **Experiment Driver** panel. It shows the driver state, answers
every pending-confirmation kind (`fiducial_role`, `mask_center_check`,
`mask_center_alignment`, `rheed_gain`, `pixel_check`, `laser_power`), runs
`auto_align_center_mask` and plots its `samples`, and has start buttons for the four
`begin_*` checks. Verified live on the sim: a report-only align converged at 97.207 mm
against `center_mask_pos` 100.0; the `fiducial_role` prompt appeared 0.26 s after the
start, "Cancel alignment" (`confirm`) ended the task with the cancelled error, and
tagging from the prompt let the task continue on its own.

Three asks, all around `center_mask_pos`. Each one is small and none blocks what has
shipped.

## 1. Let the operator choose where the auto-align scan is centred

`auto_align_center_mask` always scans `center_mask_pos ± half_window_mm`. When the
current calibration is well off (a new mask, a remount), the slit can fall outside the
window, and the only way to recover is to widen the window, which makes the scan slower.

**Ask:** an optional field on `AutoAlignMaskCenter`:

```python
center_mm: float | None = None   # scan centre; None = center_mask_pos, as now
```

`start = (req.center_mm if req.center_mm is not None else previous) - half_window_mm`.
`previous_center` in the result should stay the calibration it replaces, not the scan
centre. The panel will show this as an optional "Scan around" field, placeholder = the
current calibration.

## 2. Put `center_mask_pos` on `ExperimentState`

```python
center_mask_pos: float | None = None
```

Then the panel can show the calibration, show the scan range before Start
("95.0 – 105.0 mm"), and prefill #1, with no extra call. It changes rarely, so it
costs nothing on the heartbeat.

## 3. A direct way to set it: `set_center_mask_pos`

Today `center_mask_pos` can only change through auto-align with `apply=true`,
`confirm_center_mask` (needs `begin_align_center_mask` first, which zeroes the RHEED gun
X and moves the mask), or `confirm_mask_center(aligned=false, ...)` (retracts and moves
the mask). So a report-only result (`apply=false`) cannot be applied afterwards without
moving hardware just to store a number.

**Ask:** a MUTATE op that only sets the value:

```python
async def set_center_mask_pos(self, req: MoveTo) -> Ack:   # or a new CenterMaskPos {position}
    self.manager.pld_config.center_mask_pos = req.position
    return Ack()
```

Journal it like the other steps, since it changes the calibration. The panel will put
an "Apply 97.219 mm" button on every report-only result.

**Related question:** as far as I can see, `center_mask_pos` is held in memory only.
`pld_config` comes from `settings.experiment.pld_config` at startup, and I found no
write-back. If so, a calibration set by any of these paths is lost when the node
restarts. Intended? If not, #3 is the natural place to persist it.

## Wire quirk worth knowing: `TaskEvent` pushes carry every field

`_push(**fields)` builds `TaskEvent(**fields)`, and it is published with a plain
`model_dump_json()`. So a push that only means "the task finished"
(`current_task=None, task_result=...`) also carries `pending_confirmation: null`,
which looks the same as "the gate was cleared". The frontend now treats each event as a
nudge: it keeps `task_result` and re-reads `getState()` for the gate and task. Other
clients (the MCP server, notebooks) may not. Either
`model_dump_json(exclude_unset=True)` on this channel or a doc line on `TaskEvent`
would make it unambiguous.

**Follow-up, same day — all of the above is consumed** (contract `d886275865bf2ea5`, from
Lumi-Lab's `driver-center-mask-ux` working tree; not on `main` yet). The panel now has a
"Scan around" field (`center_mm`; blank = calibration) and a line showing the calibration and
the exact scan range, taken from `center_mask_pos` on the heartbeat. A report-only result
gets an "Apply <center> mm" button (`set_center_mask_pos`). Events are applied as snapshots,
and results are attributed through `finished_task`; the `getState()` after every event is gone.
The generated `MaskAlignResult` types replace the frontend's hand copy. Verified live:
scan 95–99 mm around 97 converged at 97.214; Apply moved the calibration from 100.0 to
97.214 without moving the mask; an auto-applied run showed "the current calibration" and
no button. The sim's calibration was put back to 100.0 afterwards (now saved in growth.db).

---

# UPDATE 2026-09-26 — growth history has a page; two things to fix on the backend side

(Both fixed in `615d637` -- see the 2026-09-27 update below.)

Consumed Lumi-Lab `85eea96` (branch `growth-history-read`, contract `4c4ce3bd6ca25bbb`,
**not on `main` yet**, so taken from the branch rather than via `npm run sync:client`; re-run
the sync after the merge, which should show no diff).

## What shipped (branch `feat/history-page`)

A `/history` route beside the dashboard (shared shell, one transport). Sample list on the
left (`list_samples`, filtered by substrate / state / search, grouped under
`list_substrates` names); per sample, four tabs:

- **Overview** -- `get_sample` layers, each joined to its `perform_deposition` step's params
  (temperature, pressure, rate, target), plus `list_measurements`; `sample.notes` shown as a
  warning (e.g. the aborted deposition).
- **Process** -- `sample_history(sample_id, order="asc")`, split into working sessions at
  gaps over an hour, each step expandable to its params / result.
- **RHEED** -- the recordings named by each `start_storage` step's `result.storage_name`;
  `recording_info` -> frame scrubber over `recording_frame_jpeg` with the integration boxes
  drawn on it, and `recording_integration` as the oscillation curves (click to seek).
- **Chamber log** -- `log_window(since, until)` over one session (±2 min), six small
  multiples from `DEFAULT_LOG_COLUMNS`, depositions marked.

Verified live against the seeded simulator.

## 1. Codegen bug: `list[float | str | None]` loses its parentheses in TypeScript

```ts
columns?: Record<string, number | string | null[]>;   // generated, LogSeries + RecordingLog
columns?: Record<string, (number | string | null)[]>; // what the wire carries
```

As generated, `columns["Mask1"]` types as a scalar-or-array-of-null. The frontend restates
the type locally for now (`ChamberLogHistory.tsx`). The TS emitter should parenthesise a union
before appending `[]`. Any other `list[A | B]` field is affected the same way.

## 2. `log_window` interleaves overlapping log files

For a window crossing two seeded files that overlap in time --

```
chamber_log_20260924_110046.csv   15:00:46Z – 16:26:18Z
chamber_log_20260924_122033.csv   16:20:33Z – 17:11:42Z
```

-- the six overlapping minutes come back merged by time, alternating row by row between the
two sessions (MFC1 12.2 / 0.0, Mask1 95 / 0 ...). Charted, that is a solid block. Two
separate questions:

- **The seeder**: one session's cool-down tail runs past the next session's start. PASCAL
  writes one file at a time, so real logs should not overlap; the seed probably should not
  either.
- **`log_window`**: if overlaps can happen on a real instrument (clock change, a file
  copied in), merging silently hides it. Preferring the later file for the overlap, or
  saying so in the reply (e.g. an `overlap: true` / per-row file index), would let a UI flag it.
  The frontend cannot tell today: rows carry no file.

## Not an ask, just noting

The sample -> recording link is implicit: it relies on `start_storage` putting
`storage_name` in `result`. Fine for now; if `record` rows ever carry `sample_id`,
`list_records(sample_id=...)` would be the sturdier path.

---

# UPDATE 2026-09-27 — measurements: view and entry form built, checked live

Consumed `measurement-data` @ `84d903c` (contract `72ecc45c4bf41d2d`, stacked on
`growth-history-read`; neither on `main` yet -- client taken from the branch). Checked
against a restarted sim stack on that commit, through the bridge, from the browser.

## Also consumed from `615d637`

- `LogSeries.columns` is `(number | string | null)[]` now; the frontend's local restatement is
  gone. Thanks.
- `files` / `file_index` / `overlap`: on an overlap the Chamber log tab warns and plots one file
  (default: the one with most rows in the window, pickable).

## What shipped

A **Measurements** tab (Overview keeps the layer stack only):

- one card per measurement: kind, value, source, detail, `conditions`; each series from
  `get_measurement` charted (y columns grouped by unit, one chart per unit;
  `meta.log_scale` honoured); files listed with role / size / type; `image/*` inline,
  everything else a download under `file_name`;
- **Add measurement** (operator/admin): kind (free text, known kinds suggested), optional
  value, key/value details, source; curves parsed in the browser from delimited text
  (header row `name (unit)`, x first, any number of y; bad rows are an error, not skipped),
  original kept as `raw` by default; a drop zone with a role per file. Saving is
  `add_measurement`, then one `attach_measurement_file` per file. If an upload fails, the
  form stays open and **Retry** sends only the failed files to the same measurement,
  never a second copy;
- per card: **Attach files**, and **Remove** for a file or the measurement
  (`retire_*`), each with an Undo toast;
- files over 15 MiB and curves over 200k values are refused in the form before anything is sent.

## Your checklist

- **(a) curves render from `get_measurement`** -- yes: `2theta-omega` (log),
  `rocking curve`, `line profile`, `R(T)` on STO-LSMO-01-p0.
- **(b) the PNG shows inline via `measurement_file`** -- yes, `s18_topo_5um.png` at 256x256.
- **(c) upload round-trip** -- yes. Measurement 36 (`claude_live_check`), with a parsed curve,
  the original CSV and a 300 kB random `.bin`. The reply's sha256 equals the browser's own
  SHA-256 of the bytes it sent. The form checks this on every upload and flags a mismatch;
  it is skipped where WebCrypto is unavailable (plain http off localhost). Downloading the
  `.bin` back gave identical bytes. A seeded `.raw` downloads with its stored sha256.
  Measurement 36 was retired afterwards; its two files are still `active` rows under a
  retired measurement.
- **(d) over 15 MiB is refused cleanly** -- yes at 15.5 MiB: `[ValueError] the file is
  16252928 bytes; the limit is 15728640 (experiment.measurement_file_max_bytes)`, in 254 ms.
  **But not at 17 MiB** -- see 1.

## 1. An upload over 16 MiB hangs the caller instead of failing

A 17 MiB `attach_measurement_file` frame never reaches the handler; nothing is in
api.log or experiment.log. The bridge drops the websocket (close **1006**, no close frame --
seen from a raw `WebSocket`, not the generated client). Then:

- the generated `LumiTransport` does not reject pending RPCs when its socket closes, so
  the call waits out the full timeout (10 s by default; 30 s in my test) and reports
  "timed out", not "too large";
- in the app, the transport store sees the close and reconnects, and every stream
  re-subscribes, for one oversized request.

The form never sends past 15 MiB, so the UI cannot hit this. Other clients (notebooks, a
future uploader) can. Asks, in order of value:
(i) reject every pending RPC with a clear error on `ws.onclose` in the generated transport;
(ii) have the bridge answer an oversized frame with an error reply (or close 1009 with a
reason) rather than dropping the socket.

## 2. Per-call timeout for uploads

`LumiTransport`'s timeout is per transport (constructor, 10 s), and uploads share the app's
one transport. 15 MiB on localhost took well under a second, but over a slow link it may not.
An optional per-call timeout on `callWithPayload` (and so on the generated upload ops) would
let the upload path wait longer without slowing every other call's failure.

## Generated types

No problems this time. `MeasurementSeries`, `SeriesAxis`, `MeasurementFileInfo`,
`AttachMeasurementFile` and the `Response<MeasurementFileInfo>` download all typed cleanly.
One nit: `media_type` is required on `MeasurementFileInfo` but optional on the request.
That's correct, just worth a doc line that the server always fills it.

## A frontend fix you may see elsewhere

nivo's log scale with `min/max: "auto"` draws **upside down** (the XRD Bragg peak rendered
as a dip; the pressure chart from the 09-26 note was inverted too). Both charts now use
explicit decade bounds and ticks. Mentioned only in case a screenshot from before this
reached anyone.

**Follow-up, same night — the upload asks are done (`db17c68`) and verified.** Client re-synced
(contract hash unchanged, `72ecc45c`). Uploads now pass `{ timeoutMs }` scaled to size (10 s +
2 s per MB). After the api-node restart, through the bridge from the browser:

| size | answer | time | same socket after |
|---|---|---|---|
| 15.5 MiB | `[ValueError]` from the experiment node, names the limit | 845 ms | works |
| 17 MiB | `[PayloadTooLarge]`, names op, size, limit | 312 ms | works |
| 40 MiB | `[PayloadTooLarge]` | 493 ms | works |
| 70 MiB | `bridge websocket closed (code 1009: ...)`, pending call rejected at once | 911 ms | closed, as expected |

One small gap left: a call made **after** the socket closed still waits its whole timeout
(30 s in the test). `WebSocket.send` on a closed socket is a silent no-op, so `rpc()` queues a
reply that cannot come. Checking `ws.readyState !== WebSocket.OPEN` in `rpc()` and rejecting
straight away would close it. It is not reachable from the app, whose transport store swaps in
a fresh transport on close.

**Closed too (`7f5639a`):** re-synced. A call on a closed socket now fails in 0 ms with
`experiment.driver.state: bridge websocket is not open (readyState 3)`, checked in the browser.

---

# UPDATE 2026-09-28 — RHEED simulation has a page and an overlay

Consumed `rheed-sim` @ `caffbbc` (contract `fc175a0ccd44bdf7`, PR #14, not on `main` yet --
client taken from the branch). Checked live against the sim stack running that commit, with
the simulation node up (gemmi 0.7.5), through the bridge, from the browser.

## What shipped (branch `feat/rheed-sim`)

- A **Simulation** page (`/simulation`): pick a structure (built in, then saved), the surface
  (hkl), the beam azimuth [uvw] (low-index in-plane directions offered; one off the plane is
  caught before it is sent), off-axis turn, termination, reconstructions (presets or a
  2x2 matrix, with strength), beam energy / incidence / divergence, morphology, and the
  rendering. `simulate_rheed_jpeg` renders the pattern; its spot list is drawn over it as
  rings by kind (rod, fractional, streak_max, bulk), with labels, a hover tooltip, the
  shadow edge, specular and direct beam, and a spot table. "Geometry used" shows the mesh,
  wavelength, k and the lab screen the node used. Every request uses the lab camera's screen
  (`screen: null`).
- **Add from CIF** (operator/admin) -> `save_structure`; **Delete** a saved one ->
  `delete_structure`. The node's parse error is shown as it comes.
- **Simulated spots on the live RHEED camera**: a toggle on the video panel (and on the page)
  draws the page's scene from `rheed_spots`. If the camera's `frame_dims` differ from the
  simulated screen, it says so rather than draw it stretched.
- **History -> RHEED**: the recording line shows `rheed_energy_kev`, marked "(assumed)" when
  `rheed_energy_recorded` is false. The same spot overlay can be drawn on a recorded frame,
  at that recording's energy.
- **Storage panel**: an optional "RHEED beam energy (keV)" for `start_recording` (empty = null
  = lab default).

The scene is kept in the browser (localStorage), shared by the page and both overlays.

## Checked

- SrTiO3(001) along [100] and [110], with and without 2x1 + 1x2 domains: rods, streak maxima
  and fractional rods land on the rendered streaks. Along [110] at 3 deg the half-order rods
  report none, which is right, since their Laue circle falls off the screen.
- YSZ(111) with islands 0.5: 16 bulk spots; the energy at 15 keV moves them as expected.
- `simulate_rheed_jpeg` takes 180-460 ms here and `rheed_spots` under 100 ms, so the default
  10 s call timeout is plenty.

## 1. A termination by composition can be ambiguous

YSZ (111) reports `terminations: ["O0.963", "O0.963", "Zr0.85Y0.15"]`. Naming the second O
plane by its composition gets the first. The frontend sends the **index**, so it is fine.
But a notebook user reading the docstring ("or that plane's composition") could be caught
out. Worth either a doc line, or refusing a composition that matches more than one plane.

## 2. The simulated camera does not look like the lab screen

`rheed --src simcam` frames (and recordings made from them) are not the geometry
`[simulation.rheed.screen]` describes. On the lab screen the specular spot sits below the
shadow edge with `flip_y`, and in the simcam frames it does not. So on the sim stack the
overlay never lines up. That is expected, but it means the overlay can only be judged on
real frames. If you ever want the sim stack to exercise it, one option is a simcam source
that renders from `lumi.rheedsim` with the lab screen.

## Not an ask

The UI never overrides `screen`. When the geometry fit from `docs/TODO.md` lands, the fitted
`ScreenSpec` would slot in there, and a "fit to this frame" action could live next to the
recorded-frame overlay.

**Follow-up 2026-09-29 — both answered, and the overlay lines up.** Checked against the
change that is now `1c29e27` on `rheed-sim`; the contract is still `fc175a0c`. On the sim
stack with `--substrate sto`, then `--substrate ysz`, the live-camera overlay from `rheed_spots`
with the requests you gave lands on the frames:
- **SrTiO3:** shadow edge on the shadow, 0 0 on the specular, 0 ±1 on the first-order spots.
- **YSZ:** 0 0 and ±1 0 on their streaks.

The page now has one-click **Lab frames** presets with exactly those scenes, and its default
incidence is 1.89°. Terminations were already sent by index.

**Follow-up 2026-09-29 — beam shift consumed (`d342e20`, contract `5edbcfae`).** The Beam
section has "Beam shift y/z (mm)" inputs, default 0, ±500 mm, with ±20 mm sliders in 0.1 mm
steps. All overlays draw from the result's pixel positions, so the shift was picked up with no
overlay change, and nothing reads `meta.screen.origin_*`. Checked on the restarted sim stack
(SrTiO3 lab frame): y +2 mm moves the pattern 20 px left and z +1 mm moves it 10 px down
(origin 374.6, 129.7 → 354.6, 139.7). The divergence help now says it blurs, not streaks.
A shifted scene no longer counts as a Lab frame; picking the preset resets the shift to 0.
