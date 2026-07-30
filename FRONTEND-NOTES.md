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

**Contract hash `33d6c4f476c4dda8` -> `ce6fc72764fb3b9f`.** The backend rejects a
mismatched hash, so this has to land together with the backend deploy. The whole
diff is five hunks:

- the hash banner
- `+ n_encoded?: number | null` on `CameraReadout` (see §4)
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

## 4. Optional: a real liveness signal

`CameraState.n_encoded` counts frames the encoder has published. It is the same
idea as `VideoState.n_fragments`: `is_streaming` is a server-owned *transport*
flag and stays `true` over a producer thread that died, so a count that stops
advancing is the only way to tell a live feed from a dead one. If you poll state
for the panel's status chip, prefer "n_encoded advancing" over `is_streaming`.

## 5. What did not change

`chamber.camera.image()` is **still lossless NPY**, and deliberately so — that is
the call for when the pixels matter (a saved still, a measurement). Your existing
`.npy` parsing is still correct there; only the live stream is lossy. If you want
a "save this frame" button, call `image()` rather than grabbing the canvas.

Encoder settings (quality 80, queue depth 4) are in `cfg/settings.toml` under
`[pascal.jpeg_encoder]` — backend-side, no redeploy of the frontend needed to
change them.

---

## Also outstanding

The websocket bridge leak from `BACKEND-NOTES.md` is fixed backend-side, but two
notes for you:

- **The bridge tolerated duplicate subscribes badly.** Subscribing to the same
  target twice on one socket orphaned the first consumer, which then streamed
  into a dead socket forever. That is fixed, but each duplicate subscribe is
  still a redundant broker queue — worth checking whether StrictMode double-mount
  or the reconnect path is issuing them.
- The running API has to be restarted for any of this to take effect.
