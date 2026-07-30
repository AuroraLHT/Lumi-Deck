import { useEffect, useRef, useState } from "react";

import { ChamberCameraClient } from "../generated/lumi";
import useTransportStore from "../clients/transport";

/**
 * Draws the chamber webcam onto a canvas from the `chamber.camera` capability
 * over the shared LumiTransport, replacing the old MJPEG route
 * `http://host/chamber/cam/live` (that endpoint no longer exists -- the bridge
 * speaks one protocol on `/ws`).
 *
 * The stream carries complete JFIF buffers, so decoding is handed to
 * `createImageBitmap`, which runs off the main thread; `drawImage` then uploads
 * the result as a texture. This replaced a raw `.npy` stream that had to be
 * unwrapped, widened to RGBA and blitted with `putImageData` -- 23 MB/s and
 * ~55 ms per second of main-thread pixel work, most of it large-object garbage
 * that only a full mark-compact could reclaim. That is what used to make every
 * other panel stutter while the camera was on. See FRONTEND-NOTES.md.
 *
 * Still ~1.3 MB/s, so the subscription stays scoped to this hook rather than the
 * provider: no Chamber Camera panel on screen (or `enabled` false while paused)
 * means the bridge is told to stop sending. `stopStreaming` is never called --
 * the stream is server-wide and shared with other viewers.
 *
 * `chamber.camera.image()` is unaffected and still returns lossless `.npy`; use
 * it, not the canvas, if a frame ever needs to be saved or measured.
 */
export type CameraStreamState = "idle" | "connecting" | "live" | "error";

const useChamberCamera = (
  canvasRef: React.RefObject<HTMLCanvasElement>,
  enabled: boolean
) => {
  const transport = useTransportStore((s) => s.transport);
  const [state, setState] = useState<CameraStreamState>("idle");

  // Only ever the newest frame is worth decoding. Holding it here and draining on
  // an animation frame means a slow tab drops stale frames instead of queueing
  // decodes faster than it can finish them -- `createImageBitmap` is async, so
  // without this the backlog is unbounded.
  const pendingRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    if (!transport || !enabled) {
      setState("idle");
      return;
    }

    setState("connecting");
    let cancelled = false;
    let rafId = 0;
    let decoding = false;
    let ctx: CanvasRenderingContext2D | null = null;
    const client = new ChamberCameraClient(transport);

    // `setState` on every frame is 25 React dispatches a second that re-render
    // the panel to paint the same badge. Latch it and only report transitions.
    let reported: CameraStreamState = "connecting";
    const report = (next: CameraStreamState) => {
      if (cancelled || next === reported) return;
      reported = next;
      setState(next);
    };

    const drawBitmap = (bitmap: ImageBitmap) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (!ctx || ctx.canvas !== canvas) {
        // JPEG has no alpha, and an opaque canvas lets the compositor skip
        // per-pixel blending. This has to be the first getContext call on the
        // element -- later ones ignore the attributes and return the existing
        // context.
        ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) {
          report("error");
          return;
        }
      }
      // The decoded bitmap is the authority on size, not the meta: they agree,
      // but this cannot drift out of sync with the payload.
      if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
      }
      ctx.drawImage(bitmap, 0, 0);
      report("live");
    };

    const drain = async () => {
      const payload = pendingRef.current;
      if (cancelled || !payload) return;
      pendingRef.current = null;
      decoding = true;

      let bitmap: ImageBitmap;
      try {
        bitmap = await createImageBitmap(
          new Blob([payload], { type: "image/jpeg" })
        );
      } catch (err) {
        decoding = false;
        if (!cancelled) {
          console.error("ChamberCamera frame decode failed:", err);
          report("error");
        }
        return;
      }

      try {
        if (!cancelled) drawBitmap(bitmap);
      } finally {
        // Holds decoded pixels off-heap; without this every frame leaks.
        bitmap.close();
        decoding = false;
      }

      // A newer frame landed while we were decoding.
      if (pendingRef.current) schedule();
    };

    // Driven by rAF so a backgrounded tab stops decoding entirely (rAF does not
    // fire when hidden) rather than burning CPU on frames nobody can see.
    const schedule = () => {
      if (cancelled || rafId || decoding) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        void drain();
      });
    };

    const subscriptionKey = client.onFrame((_meta, payload) => {
      if (cancelled) return;
      pendingRef.current = payload;
      schedule();
    });

    // The capability may already be running (another session, or the Controller
    // toggle); start is idempotent on the backend.
    client.startStreaming().catch((err) => {
      if (cancelled) return;
      console.error("ChamberCamera startStreaming failed:", err);
      report("error");
    });

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      pendingRef.current = null;
      // Tells the bridge to stop routing frames here -- this is what actually
      // stops the bytes, since the server-wide stream keeps running.
      client.unsubscribe(subscriptionKey);
    };
  }, [transport, enabled, canvasRef]);

  return { state };
};

export default useChamberCamera;
