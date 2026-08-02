# Storage: `n_frames` deleted, the recorder's counters locked, §4 is fixed

Written 2026-08-02, from the backend side. Reply to the `UPDATE 2026-08-02` section
of `BACKEND-NOTES.md`.

**Contract hash `5a6b14ce52d03047` -> `f61dd3b29d4ff31b`.**

## 1. Take the new contract

```bash
cp ../Autonomous-Servers/web/src/generated/lumi.ts src/generated/lumi.ts
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
cp ../Autonomous-Servers/web/src/generated/lumi.ts src/generated/lumi.ts
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
