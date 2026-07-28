import { useEffect, useRef, useState } from "react";

import { ChamberCameraClient, ImageMeta } from "../generated/lumi";
import useTransportStore from "../clients/transport";

/**
 * Draws the chamber webcam onto a canvas from the `chamber.camera` capability
 * over the shared LumiTransport, replacing the old MJPEG route
 * `http://host/chamber/cam/live` (that endpoint no longer exists -- the bridge
 * speaks one protocol on `/ws`).
 *
 * The frames are not encoded images: the node ships the raw array as a NumPy
 * `.npy` buffer (uint8, HxWx3 or HxW), so there is nothing the browser can
 * decode natively and an <img> cannot be used. Each frame is unwrapped, widened
 * to RGBA and blitted with `putImageData`.
 *
 * At 640x480x3 and 25fps that is ~23 MB/s, so the subscription is deliberately
 * scoped to this hook rather than the provider: no Chamber Camera panel on
 * screen (or `enabled` false while paused) means the bridge is told to stop
 * sending, and the bytes stop. `stopStreaming` is never called -- the stream is
 * server-wide and shared with other viewers.
 */
export type CameraStreamState = "idle" | "connecting" | "live" | "error";

/** `.npy` header: magic(6) + version(2) + header length (u16 LE, u32 from v2). */
const npyDataOffset = (frame: Uint8Array): number => {
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  const major = frame[6];
  return major >= 2 ? 12 + view.getUint32(8, true) : 10 + view.getUint16(8, true);
};

/** Widens raw HxWx3 (or HxW greyscale) uint8 pixels to the RGBA canvas wants. */
const toRGBA = (pixels: Uint8Array, width: number, height: number, channels: number) => {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let src = 0, dst = 0; dst < rgba.length; src += channels, dst += 4) {
    rgba[dst] = pixels[src];
    rgba[dst + 1] = channels === 1 ? pixels[src] : pixels[src + 1];
    rgba[dst + 2] = channels === 1 ? pixels[src] : pixels[src + 2];
    rgba[dst + 3] = 255;
  }
  return rgba;
};

const useChamberCamera = (
  canvasRef: React.RefObject<HTMLCanvasElement>,
  enabled: boolean
) => {
  const transport = useTransportStore((s) => s.transport);
  const [state, setState] = useState<CameraStreamState>("idle");

  // Only ever the newest frame is worth drawing. Holding it here and painting on
  // an animation frame means a slow tab drops stale frames instead of queueing
  // an ever-growing backlog of 900 KB buffers.
  const pendingRef = useRef<{ meta: ImageMeta; payload: Uint8Array } | null>(null);

  useEffect(() => {
    if (!transport || !enabled) {
      setState("idle");
      return;
    }

    setState("connecting");
    let cancelled = false;
    let rafId = 0;
    const client = new ChamberCameraClient(transport);

    const draw = () => {
      rafId = 0;
      const frame = pendingRef.current;
      const canvas = canvasRef.current;
      if (cancelled || !frame || !canvas) return;
      pendingRef.current = null;

      const shape = frame.meta.shape;
      if (!shape || shape.length < 2) {
        setState("error");
        return;
      }
      const [height, width] = shape;
      const channels = shape.length > 2 ? shape[2] : 1;

      const pixels = frame.payload.subarray(npyDataOffset(frame.payload));
      if (pixels.length < width * height * channels) {
        setState("error");
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setState("error");
        return;
      }
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      ctx.putImageData(new ImageData(toRGBA(pixels, width, height, channels), width, height), 0, 0);
      setState("live");
    };

    const subscriptionKey = client.onFrame((meta, payload) => {
      if (cancelled) return;
      pendingRef.current = { meta, payload };
      if (!rafId) rafId = requestAnimationFrame(draw);
    });

    // The capability may already be running (another session, or the Controller
    // toggle); start is idempotent on the backend.
    client.startStreaming().catch((err) => {
      if (cancelled) return;
      console.error("ChamberCamera startStreaming failed:", err);
      setState("error");
    });

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      pendingRef.current = null;
      // Tells the bridge to stop routing frames here -- this is what actually
      // stops the ~23 MB/s, since the server-wide stream keeps running.
      client.unsubscribe(subscriptionKey);
    };
  }, [transport, enabled, canvasRef]);

  return { state };
};

export default useChamberCamera;
