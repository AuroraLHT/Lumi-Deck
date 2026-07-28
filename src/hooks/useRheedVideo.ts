import { useEffect, useState } from "react";

import { RheedVideoClient } from "../generated/lumi";
import useTransportStore from "../clients/transport";

// Matches the encoder on the RHEED node (H.264 baseline). MSE needs the codec up
// front to create the source buffer before any fragment is appended.
const VIDEO_MIME = 'video/mp4; codecs="avc1.42E01E"';

// The node's startup fragments sit at the very beginning of the media timeline
// (t is about 0) while the live edge is wherever the encoder has reached since the
// process started -- hundreds of seconds on a server that has been up a while.
// Playback starts at 0, so without a seek the element plays the fraction of a
// second of startup video and then stalls forever on the gap, looking dead.
//
// So: whenever the playhead falls further than MAX_LAG behind the newest buffered
// media, jump it to TARGET_LAG behind the live edge. TARGET_LAG is a small cushion
// so playback has something buffered ahead of it instead of immediately starving.
const LIVE_EDGE_MAX_LAG_S = 2;
const LIVE_EDGE_TARGET_LAG_S = 0.3;

// How much already-played video to keep buffered, and how much slack to let
// build before spending a removal on it.
//
// The node pushes roughly 1.5 MB/s of fragments and MSE never evicts on its own,
// so without this the source buffer grows without bound -- hundreds of megabytes
// after a few minutes, which is felt as the whole tab getting slower. Relying on
// QuotaExceededError instead means waiting until the browser is already in
// trouble. This also disposes of the stale startup range near t=0 once playback
// has jumped to the live edge.
const BUFFER_BEHIND_S = 30;
const TRIM_SLACK_S = 15;

/**
 * Drives the RHEED `<video>` off the refactored backend's `rheed.video`
 * capability over the shared LumiTransport, replacing the old dedicated
 * `ws://host/RHEED/data/live` socket (that endpoint no longer exists -- the
 * bridge speaks one protocol on `/ws`).
 *
 * A MediaSource with a single source buffer is fed from a FIFO queue, appending
 * one fragment at a time because `appendBuffer` is asynchronous and rejects
 * while updating. `initial_fragments()` supplies the MSE init segment, then
 * `onFragment` supplies the live media fragments.
 *
 * Re-subscribes automatically when the transport reconnects, because a fresh
 * `LumiTransport` instance re-runs the effect.
 */
const useRheedVideo = (videoRef: React.RefObject<HTMLVideoElement>) => {
  const transport = useTransportStore((s) => s.transport);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!transport || !video) {
      setIsReady(false);
      return;
    }

    let cancelled = false;
    const client = new RheedVideoClient(transport);
    let subscriptionKey: string | null = null;

    // Per-run state. These were refs shared across effect runs, which let a
    // reconnect's teardown and the next run's setup interleave on the same
    // objects -- a stale `updateend` could then append into the new run's buffer.
    let sourceBuffer: SourceBuffer | null = null;
    let queue: BufferSource[] = [];

    const mediaSource = new MediaSource();
    const objectUrl = URL.createObjectURL(mediaSource);
    video.src = objectUrl;

    /**
     * True only while this run's source buffer is still attached and idle.
     * `readyState` is the part that matters on teardown: revoking the object URL
     * closes the MediaSource and detaches its buffers, and appending to a
     * detached buffer throws `InvalidStateError` ("removed from the parent media
     * source") on every queued fragment.
     */
    const canAppend = () =>
      !cancelled &&
      sourceBuffer !== null &&
      !sourceBuffer.updating &&
      mediaSource.readyState === "open";

    // Keep up with the live edge. Called after each append settles.
    const followLiveEdge = () => {
      if (!sourceBuffer || sourceBuffer.buffered.length === 0) return;
      const liveEdge = sourceBuffer.buffered.end(sourceBuffer.buffered.length - 1);
      if (liveEdge - video.currentTime > LIVE_EDGE_MAX_LAG_S) {
        video.currentTime = Math.max(0, liveEdge - LIVE_EDGE_TARGET_LAG_S);
      }
    };

    // Drain one fragment from the queue whenever the source buffer is idle.
    // Called after every enqueue and on each `updateend`.
    const pump = () => {
      if (!canAppend() || queue.length === 0) return;
      const sb = sourceBuffer!;
      const next = queue.shift()!;
      try {
        sb.appendBuffer(next);
      } catch (err) {
        if (err instanceof DOMException && err.name === "QuotaExceededError") {
          // Buffer is full: evict everything already played back, then retry the
          // fragment we just pulled on the next updateend.
          if (sb.buffered.length > 0) {
            const start = sb.buffered.start(0);
            const end = video.currentTime;
            if (end > start) sb.remove(start, end);
          }
          queue.unshift(next);
        } else {
          console.error("RheedVideo appendBuffer error:", err);
        }
      }
    };

    /**
     * Drop played-back media. Returns true if a removal was started, in which
     * case the caller must not append until the next `updateend` -- a source
     * buffer can only run one operation at a time.
     */
    const trimBuffer = (): boolean => {
      if (!canAppend() || sourceBuffer!.buffered.length === 0) return false;
      const sb = sourceBuffer!;
      const start = sb.buffered.start(0);
      const keepFrom = video.currentTime - BUFFER_BEHIND_S;
      // The slack keeps this from firing on every single updateend.
      if (keepFrom - start < TRIM_SLACK_S) return false;
      try {
        sb.remove(start, keepFrom);
        return true;
      } catch (err) {
        console.error("RheedVideo buffer trim failed:", err);
        return false;
      }
    };

    const onUpdateEnd = () => {
      followLiveEdge();
      if (trimBuffer()) return; // resume appending once the removal settles
      pump();
    };

    const onSourceBufferError = (event: Event) =>
      console.error("RheedVideo source buffer error:", event);

    const onSourceOpen = async () => {
      if (cancelled) return;
      try {
        sourceBuffer = mediaSource.addSourceBuffer(VIDEO_MIME);
      } catch (err) {
        console.error("RheedVideo could not create source buffer:", err);
        return;
      }
      sourceBuffer.addEventListener("updateend", onUpdateEnd);
      sourceBuffer.addEventListener("error", onSourceBufferError);

      try {
        // The MSE init segment must be appended before any media fragment. The
        // body is the concatenation of the startup fragments; `sizes` says where
        // to cut, but appending the whole blob at once is an equivalent, simpler
        // init segment.
        const initial = await client.initial_fragments();
        if (cancelled) return;
        if (initial.payload.length > 0) {
          queue.push(initial.payload);
        }
      } catch (err) {
        if (!cancelled) console.error("RheedVideo initial_fragments failed:", err);
      }

      // Live media fragments. Subscribe before start so we do not miss the first
      // fragments the node emits.
      subscriptionKey = client.onFragment((_meta, payload) => {
        if (cancelled) return;
        queue.push(payload);
        pump();
      });

      // The capability's stream may already be running (another session, or the
      // Controller toggle); start is idempotent on the backend. Never stop on
      // unmount -- the stream is server-wide and shared with other viewers.
      client.startStreaming().catch((err) => {
        if (!cancelled) console.error("RheedVideo startStreaming failed:", err);
      });

      if (!cancelled) setIsReady(true);
      pump();
    };

    mediaSource.addEventListener("sourceopen", onSourceOpen);

    return () => {
      cancelled = true;
      setIsReady(false);
      if (subscriptionKey) client.unsubscribe(subscriptionKey);
      queue = [];
      if (sourceBuffer) {
        // Detach before the MediaSource closes, so no queued `updateend` can
        // fire pump() against a buffer that is about to be orphaned.
        sourceBuffer.removeEventListener("updateend", onUpdateEnd);
        sourceBuffer.removeEventListener("error", onSourceBufferError);
        sourceBuffer = null;
      }
      mediaSource.removeEventListener("sourceopen", onSourceOpen);
      URL.revokeObjectURL(objectUrl);
      if (video.src === objectUrl) video.removeAttribute("src");
    };
  }, [transport, videoRef]);

  return { isReady };
};

export default useRheedVideo;
