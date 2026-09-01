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
