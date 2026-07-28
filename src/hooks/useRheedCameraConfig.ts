import { useCallback, useEffect, useState } from "react";

import { RheedCameraClient } from "../generated/lumi";
import useTransportStore from "../clients/transport";
import { CameraConfigForm } from "../components/VideoPlayer/CameraConfigModal";

/**
 * Reads and writes the RHEED camera's settings through the `rheed.camera`
 * capability over the shared LumiTransport, replacing the request/response
 * commands that used to ride the removed `ws://host/RHEED/data/live` socket.
 *
 * Unlike the streaming migrations this is a plain RPC pair, so there is no
 * subscription to own -- the modal fetches on open and writes on submit.
 */
const DEFAULT_CONFIG: CameraConfigForm = { exposure_time: 0, gain: 0 };

const useRheedCameraConfig = (isOpen: boolean) => {
  const transport = useTransportStore((s) => s.transport);
  const [cameraConfig, setCameraConfig] = useState<CameraConfigForm>(DEFAULT_CONFIG);

  useEffect(() => {
    if (!transport || !isOpen) return;
    let cancelled = false;

    new RheedCameraClient(transport)
      .get_camera_config()
      .then((config) => {
        if (cancelled) return;
        setCameraConfig({
          exposure_time: config.exposure_time ?? 0,
          gain: config.gain ?? 0,
        });
      })
      .catch((err) => console.error("RheedCamera get_camera_config failed:", err));

    return () => {
      cancelled = true;
    };
  }, [transport, isOpen]);

  const updateCameraConfig = useCallback(
    (form: CameraConfigForm) => {
      if (!transport) return;
      // The form inputs yield strings; the capability's contract is typed, so
      // coerce rather than let the bridge reject the frame.
      const config = {
        exposure_time: Number(form.exposure_time),
        gain: Number(form.gain),
      };
      new RheedCameraClient(transport)
        .update_camera_config(config)
        .then(() => setCameraConfig(config))
        .catch((err) => console.error("RheedCamera update_camera_config failed:", err));
    },
    [transport]
  );

  return { cameraConfig, updateCameraConfig };
};

export default useRheedCameraConfig;
