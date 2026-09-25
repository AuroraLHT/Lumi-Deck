# Roles on the heartbeat, predefined roles, and mask auto-alignment asks for its marker

Written 2026-09-24, from the backend side. Reply to the `UPDATE 2026-09-21` section of
`BACKEND-NOTES.md` (roles on the heartbeat -- done, section 0), plus new work that
follows on from the role note directly below.

**Now on `main`** -- Lumi-Lab PR #10 merged (`33051c9`), so the usual command is right
again:

```bash
npm run sync:client
```

**Contract hash `21112a7b98c5aa79` (the previous note) -> `3ac5669ddf974b76`.** Your
checked-in client is at `95159f6a` (`cc80568`), one step behind.

## 0. `roles` is on `FiducialState` now

Exactly as asked:

```ts
interface FiducialState {
  marker_ids?: string[];
  roles?: Record<string, string>;   // NEW: role -> marker_id, same as list_roles().roles
  ...
}
```

It is read straight from the store on every readout, so a `set_role` / `remove_role`
from any client shows up on the next 2s heartbeat whether or not the marker set moved.
Nothing is excluded from the heartbeat for it. The refetch-on-`marker_ids`-change
heuristic can go. `list_roles()` is still how you get `known` (section 1), which is fixed
per backend version and doesn't need mirroring -- fetch it once on connect.

## 1. `list_roles` now says which roles the system actually uses

```ts
interface RoleSpec { role: string; doc?: string; }
interface RoleMap {
  roles?: Record<string, string>;   // unchanged: role -> marker_id
  known?: RoleSpec[];               // NEW: the predefined roles, assigned or not
}
```

`known` is currently one entry:

```ts
{ role: "mask-center",
  doc: "The sample's centre. Mask-centre auto-alignment sweeps Mask1 and centres the slit on this marker." }
```

Free-form roles still work exactly as before (`set_role` accepts any name) -- `known`
is just the ones something in the backend reads. More will be added to the same list,
so read it rather than hardcoding `"mask-center"`.

**The ask:**
- **Offer `known` roles as choices** in the tag action, so the operator picks
  `mask-center` instead of typing it -- a typo there is a role nothing ever reads.
  Show `doc` as the hint. Keep a free-text "other" for custom roles.
- **Flag a known role that is unassigned, or assigned to a marker that no longer
  exists** (a `roles` value with no matching `marker_id` in `list_markers`). Both mean
  the automation that needs it can't run; see section 2 for what happens if it tries.

## 2. New driver op: `auto_align_center_mask` -- and the `fiducial_role` prompt

```ts
// experiment.driver -- MUTATE, operator only. Long-running: returns a TaskAck.
auto_align_center_mask(req: AutoAlignMaskCenter): Promise<TaskAck>

interface AutoAlignMaskCenter {        // every field optional, defaults shown
  half_window_mm?: number;   // 4.0   wide scan = center_mask_pos +- this
  step_mm?: number;          // 0.5   wide scan step
  max_passes?: number;       // 3     wide scan + finer re-scans of the slit
  points_per_pass?: number;  // 15
  tolerance_mm?: number;     // 0.02  stop once the centre moves less than this
  frames_per_point?: number; // 2
  min_contrast?: number;     // 5.0
  apply?: boolean;           // true  false = report only, keep center_mask_pos
  role_wait_timeout_s?: number; // 600  see below; 0 = fail at once
}
```

It scans Mask1, watches the marker tagged `mask-center` on the chamber camera, finds
the slit from the intensity-vs-position curve, refines it, sets `center_mask_pos`, and
parks the mask there. The result arrives as the `TaskEvent.task_result` on the driver's
`pending` update stream: `{ok: true, center, previous_center, converged, contrast,
baseline, polarity, passes: [...], samples: [{pass_index, position, reading}, ...]}`
(`MaskAlignResult` in `lumi.contracts.payloads.experiment`; it is not a named TS type,
because the op itself only returns the TaskAck). `samples` is a ready-made
intensity-vs-position plot, if you ever want one.

**The part that needs UI:** if no marker is tagged `mask-center` (or it points at a
deleted marker), the task does not fail. It opens a pending confirmation and waits:

```ts
state.pending_confirmation = {
  id: "...", kind: "fiducial_role",
  message: "no fiducial marker is tagged 'mask-center' -- tag the marker on the sample's centre with that role; mask auto-alignment continues once it is set",
  requested_at: ...
}
```

- It **resolves itself**: as soon as `chamber.fiducial.set_role({role: "mask-center",
  marker_id})` lands (from anywhere), the confirmation clears and the scan starts.
  There is nothing to "confirm" after tagging.
- `confirm({confirmation_id})` on it **cancels** the alignment (task_result
  `{ok: false, error: "...cancelled..."}`), so a "Cancel" button maps to `confirm`,
  not a "Done" button.
- After `role_wait_timeout_s` (default 600s) it gives up the same way and clears the
  confirmation itself.

Lumi-Deck doesn't have an experiment-driver panel yet, so no opinion on where this
lives. The minimum useful version: when the driver's `pending_confirmation.kind ===
"fiducial_role"`, show the message next to the camera with a shortcut into the marker
tagging from section 1, plus a Cancel. A "Align mask" button that calls the op and
shows `task_result.center` would be the natural next step, but that can wait for the
driver panel.

---

# Fiducial markers can now be named by role — needs a UI to tag one

Written 2026-09-21, from the backend side. Not a reply to anything in
`BACKEND-NOTES.md`; new work, not a bug fix.

**Not yet on `main`.** This is on the `fiducial-markers` branch of `Lumi-Lab`, which
also carries the marker CRUD/stats capability your `feat/fiducial-markers-ui` branch
is already building the overlay for. Grab the branch's contract rather than main's
until it merges:

```bash
git -C ../Lumi-Lab show fiducial-markers:web/src/generated/lumi.ts > src/generated/lumi.ts
```

**Contract hash `a57b9852c04edaac` (current `main`) -> `21112a7b98c5aa79`.** (Your
checked-in client is currently at `58f95c5a92b54f58`, further back still — you'll pick
up whatever else landed on `main` since your branch forked, too.)

## What is new: `chamber.fiducial` gets three more ops

```ts
interface RoleAssignment { role: string; marker_id: string; }
interface RoleQuery { role: string; }
interface RoleMap { roles?: Record<string, string>; }

set_role(req: RoleAssignment): Promise<Ack>     // MUTATE — operator only
remove_role(req: RoleQuery): Promise<Ack>       // MUTATE — operator only
list_roles(): Promise<RoleMap>                  // READ — viewer ok
```

A role is a free-form name (`"sample_holder"`, `"mask_alignment_target"`, whatever the
operator wants to call it) pinned to one `marker_id`. `set_role` replaces whatever that
role previously pointed at; it does not require the marker to already exist, and
removing or redrawing the marker does not clear the role — it just ends up pointing at
nothing until someone re-points it or removes it. Persisted alongside the markers
themselves (`cfg/chamber_fiducials.json`), so it survives a node restart same as they do.

**The point:** the automated mask-finding step being built next needs to say "watch
*the* sample-holder marker" without a hardcoded marker_id, and needs a way for an
operator to say *which* marker that is, once, from the UI, rather than editing a
config file. That's this.

## The ask: let the operator tag a marker with a role

Somewhere in the marker list/editor — a "tag" action per marker (assign it a role
name, existing or new) is probably the natural fit, plus a way to see and clear
existing role -> marker assignments (`list_roles`). No opinion from this side on the
exact UI; a simple text input for the role name is enough to start, a role picker
(sample_holder / mask_alignment_target / ... presets) can come later once there is
more than one real consumer of them.

One thing worth surfacing to the operator: if a role points at a marker_id that no
longer exists (removed or never drawn), `list_roles` still returns it — the UI should
probably flag that rather than silently drop it, since it usually means "someone
needs to re-tag this."

---

# Storage: `n_frames` deleted, the recorder's counters locked, §4 is fixed

Written 2026-08-02, from the backend side. Reply to the `UPDATE 2026-08-02` section
of `BACKEND-NOTES.md`.

**Contract hash `5a6b14ce52d03047` -> `f61dd3b29d4ff31b`.**

## 1. Take the new contract

```bash
npm run sync:client   # git -C ../Lumi-Lab show main:web/src/generated/lumi.ts
```

The whole diff is two hunks: the hash banner, and `- n_frames?: number | null;` from
`StorageReadout`. Nothing else moved. As you predicted, every node has to be redeployed
together — the monitor flags a mismatched `contract_hash` on join.

## 2. §7 — `n_frames` is gone

Removed from `StorageReadout` and regenerated; `schemas/contract.json` and the Python
clients went with it. You were right that it was worse than no field: nothing ever
assigned it, so it was a permanent `null` every client had to write code for.

Your reasoning for *not* reviving it is now recorded in the payload where the field used
to be, so the next person to reach for a counter finds the argument before they add one:
capability state rides the 2s heartbeat, `on_heartbeat` emits `state_changed` on any
diff, and a value that ticks every 2s turns the registry into a 0.5 Hz event pump. When
the counter does get built it should ride `getState()`, exactly as you proposed.

## 3. §8 — fixed, and it was losing data on the live sim

`Recorder` now takes a reentrant `_lock_write` across each save's whole
allocate → resize → write → bump-size sequence, not just the index. All four steps were
unguarded read-modify-writes, so locking only the counter would have left the
`attrs['size'] += 1` and the check-then-resize races open.

It costs essentially nothing. h5py routes every API call through its own global lock
(`h5py._objects.phil`), so those eight workers were already serialised inside HDF5 — the
pool's real job is keeping the asyncio loop off blocking file IO, and that is unchanged.

**Your report is not theoretical.** A 6s recording on the sim, written by the *unfixed*
node, came back with 26 non-empty rows in `log` and `attrs['size'] == 23`. Three
increments lost in six seconds.

Two things beyond the report:

- **The integration path allocated per-box indices one at a time** while
  `_save_integrations_buffered_data` writes one contiguous slice
  `[bbox_idx_start[0] : bbox_idx_end[-1]+1]`. Another thread allocating mid-run made that
  slice span rows belonging to both calls. Indices are now taken as a block.
- `Recorder.save_integrations` (the non-buffered one, currently unreachable — the server
  submits the buffered variant) reserved **one** bbox index and then wrote
  `len(integrations)` rows starting at it, so consecutive calls overlapped regardless of
  threading. Fixed the same way.

There is now a `frames_written` / `logs_written` / `detections_written` /
`integrations_written` set of side-effect-free properties, per your note that
`next_frame_idx` mutates. Use those for the counter when you build it. The
`next_*_idx` properties carry a comment saying so.

Regression tests: `tests/storage/test_recorder_concurrency.py`, T0, no broker. Verified
they actually bite — reverted to the pre-fix code and 4 of the 7 fail, including both
end-to-end ones.

## 4. §4 — retest, it is already fixed

You are not blocked. Measured against the running sim just now, driving
`storage.storage` directly over AMQP:

```
start_recording(save_frame, save_ai, save_log, save_integration)   # detection is down
  -> ok=False in 6ms
     "cannot record: detection not available on the bus"

start_recording(save_frame, save_log, save_integration)            # rheed + chamber up
  -> ok=True in 111ms, is_storing=True, file written, stop_recording clean
```

Both halves of §4 are gone. The structured `ok:false` you asked for is there, in **6ms**
rather than a 10s stall. And `deps_available` now reads
`{'rheed': True, 'chamber': True, 'detection': False}` — correct, since detection is not
running without `--with-detection`.

The all-false reading you saw was the `list_nodes()` bug from your original §5 report:
codegen drops the request argument for `Empty`-request ops, the extra argument raised a
`TypeError`, and the surrounding `except` swallowed it, so every dependency looked
permanently down. That fix landed in "Fix the five issues reported in the frontend's
BACKEND-NOTES"; the 2026-08-02 re-test appears to have run against a backend from before
it. Worth re-running your cross-client storage verification — the data path is working.

## 5. One trap, since I fell into it

`stop_recording` takes **no argument**. Same codegen rule as `list_nodes`: ops whose
request type is `Empty` generate a zero-argument method. Passing `Empty()` gets you
`TypeError: stop_recording() takes 1 positional argument but 2 were given`, and if you
hit it after a successful `start_recording` the node is left recording.

## 6. Not addressed here

`§0b` (serial per-connection dispatch) and `§5`/`§6` from the 2026-07-31 update
(bbox persistence across a node restart, `integrator.remove` orphaning an STFT
registration) are untouched. Still open, still agreed.

---

# Chamber camera is now MJPEG

Written 2026-07-30, from the backend side. Reply to `BACKEND-NOTES.md`.

The `chamber.camera` **stream** now carries JPEG instead of raw NumPy arrays.
`23.0 MB/s -> 1.3 MB/s` per subscriber, measured against the sim camera at
640x480x3 / 25fps (~17x). The per-frame cost on your side should mostly vanish
too: `createImageBitmap` decodes off the main thread, so there is no `.npy`
header to parse, no RGBA widening, and no 1.2 MB allocation per frame.

Nothing else changed. `rheed.camera` still streams raw arrays (the integrator and
the detection model need real pixels), and `rheed.video` is still H.264.

---

## 1. Take the new contract

```bash
npm run sync:client   # git -C ../Lumi-Lab show main:web/src/generated/lumi.ts
```

**Contract hash `33d6c4f476c4dda8` -> `5a6b14ce52d03047`.** The backend rejects a
mismatched hash, so this has to land together with the backend deploy. The whole
diff is five hunks:

- the hash banner
- `+ n_encoded?` and `+ n_dropped?` on `CameraReadout` (see §4)
- `+ interface JpegMeta`
- the `ChamberCameraClient` docstring
- `ChamberCameraClient.onFrame` handler type: `ImageMeta` -> `JpegMeta`

`onFrame`'s shape is unchanged — still `(meta, payload: Uint8Array) => void`,
still the same subscribe/unsubscribe keys. Only the meta type moved.

```ts
export interface JpegMeta {
  time: number;
  uuid: string;
  time_stamp: string;
  frame_idx?: number | null;
  width: number;
  height: number;
  quality?: number | null;
  channels?: number;   // 1 for greyscale sources, 3 for colour
}
```

`shape` and `dtype` are gone — the body is no longer an array, so there is
nothing for them to describe. Use `width`/`height`, which are the encoded
dimensions and always match the payload.

## 2. Rewrite the draw path in `useChamberCamera.ts`

The payload is a complete JFIF buffer (`ff d8 ... ff d9`). Everything from
`npyDataOffset` down to `putImageData` goes away:

```ts
const bitmap = await createImageBitmap(
  new Blob([payload], { type: "image/jpeg" })
);
if (canvas.width !== bitmap.width) canvas.width = bitmap.width;
if (canvas.height !== bitmap.height) canvas.height = bitmap.height;
canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
bitmap.close();   // it holds decoded pixels; without this you leak per frame
```

Two things to keep from the current version. Keep the `pendingRef` newest-frame-wins
buffer — `createImageBitmap` is async, so without it a slow tab still queues
decodes faster than it drains them. And keep the subscribe/unsubscribe scoping to
panel visibility; 1.3 MB/s is much better than 23, but it is not free.

You could also drop the canvas entirely and assign an object URL to an `<img>`.
Canvas is the better fit if you plan to overlay anything (bboxes, a timestamp);
otherwise `<img>` is less code.

## 3. Two bugs in the current `useChamberCamera.ts`

Both are pre-existing, and both are in code the rewrite deletes anyway — flagging
them so the behaviour you have been seeing makes sense.

- **Line 121 calls `toRGBA(...)`, which is not defined anywhere in the repo.**
  `writeRGBA` (line 44) is defined, unused, and has a different signature —
  a half-finished optimization. This throws `ReferenceError` on the first frame,
  so if the panel has been blank rather than merely slow, that is why.
- **`setState("live")` fires on every draw** — a React state update 25x/s that
  re-renders the panel subtree when nothing has changed. Latch it:
  `if (state !== "live") setState("live")`.

## 4. Liveness — CORRECTED, the earlier advice here was wrong

**An earlier version of this section told you to use "n_encoded advancing" as the
panel's liveness signal. That does not work, and you were right to call it out.**

`JpegEncoder._put` evicts the oldest frame to make room, then increments. So with
nothing draining at all, `n_encoded` still climbs at full frame rate. Confirmed
both ways:

```
no consumer, 100 puts, queue depth 4  ->  n_encoded=100  n_dropped=96
live node, before start_streaming     ->  n_encoded=1792  is_streaming=false
```

1792 frames "encoded" with literally nothing subscribed. It proves the encoder
thread is alive and nothing more.

`n_dropped` is now on the wire too (`CameraState.n_dropped`), as you suggested.
Read the two together:

| n_encoded | n_dropped | is_streaming | meaning |
|---|---|---|---|
| rising | rising | `false` | idle — nobody subscribed. **Normal.** |
| rising | flat | `true` | healthy, consumer keeping up |
| rising | rising | `true` | frames produced but not drained — server-side fault |
| flat | flat | either | encoder thread is dead |

But for the panel's status chip, **don't poll server state at all** — use
"time since the last `onFrame` callback". No server counter can tell you whether
the *browser* is receiving; only the browser knows that. The server counters are
for diagnosing which side broke once you already know something is wrong.

## 5. What did not change

`chamber.camera.image()` is **still lossless NPY**, and deliberately so — that is
the call for when the pixels matter (a saved still, a measurement). Your existing
`.npy` parsing is still correct there; only the live stream is lossy. If you want
a "save this frame" button, call `image()` rather than grabbing the canvas.

Encoder settings (quality 80, queue depth 4) are in `cfg/settings.toml` under
`[pascal.jpeg_encoder]` — backend-side, no redeploy of the frontend needed to
change them.

---

## 6. Verified live, 2026-07-30 15:19

Measured on the restarted sim, through `/ws` — the same path your `onFrame` uses:

```
stream frames received over /ws : 60
codec / framing                 : [u32 len][header json][jpeg bytes]
meta                            : 640x480 ch=3 quality=80
magic / terminator              : ffd8ff .. ffd9   (valid JFIF)
rate                            : 20.8 fps -> 1.10 MB/s
all 60 decode via imdecode      : yes
```

Neither of the two `_stream_loop` failure paths you identified
(`server.py:313` handler, `server.py:325` encode) logged anything — the pascal
console is clean. The loop is publishing and the bridge is forwarding.

**One thing that will look like a bug and is not.** Over 60 delivered frames only
6 were distinct images. That is the *simulator*, not the pipeline: `[pascal.simcam]`
oscillates brightness by amplitude 5 counts at 0.1 Hz, so the fastest slew is
`5 * 2π * 0.1 = 3.14 counts/s`, or 0.126 counts/frame at 25fps — about **8 frames
per 1-count step**, and the frames in between are byte-identical after `astype(uint8)`.
Reading raw arrays straight off the camera queue before any encoding gives 60
distinct uuids but only 12 distinct pixel arrays, with run lengths
`[2,10,9,7,6,6,3,2,5,3,2,5]` — matching the predicted 8.0. Real hardware has sensor
noise and every frame will differ. If you want the sim to look alive, raise
`base_oscillation_amplitude` in `cfg/settings.toml`.

Also: the camera grabs at ~21fps rather than the configured 25 (its own grab loop,
predating this change). Encoder output and delivered rate match each other, so
nothing is being lost in the JPEG path.

## Also outstanding

The websocket bridge leak from `BACKEND-NOTES.md` is fixed backend-side, but two
notes for you:

- **The bridge tolerated duplicate subscribes badly.** Subscribing to the same
  target twice on one socket orphaned the first consumer, which then streamed
  into a dead socket forever. That is fixed, but each duplicate subscribe is
  still a redundant broker queue — worth checking whether StrictMode double-mount
  or the reconnect path is issuing them.
- The running API has to be restarted for any of this to take effect.
