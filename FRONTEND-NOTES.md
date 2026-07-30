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
