import { useEffect, useMemo, useState } from "react";
import { Center, Text, VStack } from "@chakra-ui/react";
import { Serie } from "@nivo/line";

import useAppStore from "../../stores/app";
import useTransportStore from "../../clients/transport";
import useFiducialUIStore from "../../stores/fiducialUI";
import useFiducialStatsStore from "../../stores/fiducialStats";
import useFiducialNodeStore from "../../stores/nodes/fiducial";
import { ChamberFiducialClient } from "../../generated/lumi";
import SmallContainer from "../Plotting/SmallContainer";
import PlottingToolbar from "../Plotting/ToolBar";
import RealTimeLineChart from "../Plotting/RealTimeLineChart";
import RTVToolBarMenu, { RangeValue } from "../Plotting/RTVToolBarMenu";

/** The worker keeps ~5000 samples; at ~25fps that is a little over three minutes. */
const DEFAULT_WINDOW_MS = 60_000;

/**
 * A single marker's intensity trace, live.
 *
 * This is the calibration view the fiducial feature exists for: watching
 * `mean` dip as the mask edge crosses a marker locates the mask, so the chart
 * favours the recent, moving picture (`RealTimeLineChart`) over a static plot
 * of `marker_history()`. That call is still made, but only once per marker
 * selection -- to backfill the chart with whatever the node already retained,
 * so switching markers does not start from an empty chart while the live
 * `chamber.fiducial` stream (owned by `useFiducialStats`, mounted once in
 * `LumiTransportProvider`) catches back up.
 *
 * The marker being charted is not local state: it is set by clicking a marker
 * on the Chamber Camera panel's overlay (`stores/fiducialUI.ts`), since the two
 * are separate dashboard panels with no parent between them.
 */
const FiducialTraceMain = () => {
  const host = useAppStore((s) => s.selectedHost);
  const transport = useTransportStore((s) => s.transport);
  const selectedMarkerId = useFiducialUIStore((s) => s.selectedMarkerId);
  const fiducialAvailable = useFiducialNodeStore((s) => s.state.is_available);

  const cache = useFiducialStatsStore((s) =>
    selectedMarkerId ? s.cache[selectedMarkerId] : undefined
  );

  const [windowSize, setWindowSize] = useState(DEFAULT_WINDOW_MS);
  const [rangeMin, setRangeMin] = useState<RangeValue>("auto");
  const [rangeMax, setRangeMax] = useState<RangeValue>("auto");
  const [historyError, setHistoryError] = useState<string | null>(null);

  // One-shot backfill per marker selection -- not a subscription, so it is not
  // in `useFiducialStats`. `cache === undefined` (not "empty") is the guard: an
  // empty array is a marker the live stream has already reported zero-pixel
  // stats for, which is a real answer, not a reason to refetch.
  useEffect(() => {
    if (!transport || !selectedMarkerId || cache !== undefined) return;
    let cancelled = false;
    setHistoryError(null);

    new ChamberFiducialClient(transport)
      .marker_history({ marker_id: selectedMarkerId })
      .then((history) => {
        if (cancelled) return;
        const samples = history.samples ?? [];
        if (samples.length === 0) return;
        useFiducialStatsStore.getState().appendSamples(
          samples.map((point) => ({
            time: point.time,
            uuid: point.uuid,
            time_stamp: point.time_stamp,
            frame_idx: point.frame_idx,
            stats: { [selectedMarkerId]: point.stats },
          }))
        );
      })
      .catch((err) => {
        if (!cancelled) {
          setHistoryError(err instanceof Error ? err.message : String(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [transport, selectedMarkerId, cache]);

  const data: Serie[] = useMemo(() => {
    if (!cache || cache.length === 0) return [];
    return [
      {
        id: "Mean",
        data: cache
          .filter((e) => e.stats.mean != null)
          .map((e) => ({ x: e.x, y: e.stats.mean as number })),
      },
      {
        id: "Min",
        data: cache
          .filter((e) => e.stats.min != null)
          .map((e) => ({ x: e.x, y: e.stats.min as number })),
      },
      {
        id: "Max",
        data: cache
          .filter((e) => e.stats.max != null)
          .map((e) => ({ x: e.x, y: e.stats.max as number })),
      },
    ];
  }, [cache]);

  if (!host) {
    return (
      <Center h="100%" minH="180px">
        <Text fontSize="sm" color="text.muted">
          Select a server to view fiducial marker traces.
        </Text>
      </Center>
    );
  }

  if (!fiducialAvailable) {
    return (
      <Center h="100%" minH="180px">
        <Text fontSize="sm" color="text.muted">
          Chamber node is not reporting fiducial markers.
        </Text>
      </Center>
    );
  }

  if (!selectedMarkerId) {
    return (
      <Center h="100%" minH="180px">
        <VStack spacing={1}>
          <Text fontSize="sm" color="text.secondary">
            No marker selected.
          </Text>
          <Text fontSize="xs" color="text.muted">
            Click a marker on the Chamber Camera panel to chart its intensity.
          </Text>
        </VStack>
      </Center>
    );
  }

  const settingsMenu = (
    <RTVToolBarMenu
      WindowSize={windowSize}
      onWindowSizeChange={setWindowSize}
      RangeMin={rangeMin}
      onRangeMinChange={setRangeMin}
      RangeMax={rangeMax}
      onRangeMaxChange={setRangeMax}
    />
  );

  return (
    <VStack align="stretch" spacing={2} h="100%">
      <SmallContainer>
        <PlottingToolbar title={`Marker "${selectedMarkerId}"`} settingsMenu={settingsMenu} />
        {data.length === 0 ? (
          <Center flex="1">
            <Text fontSize="xs" color="text.muted">
              {historyError
                ? `Could not load history: ${historyError}`
                : "Waiting for frames…"}
            </Text>
          </Center>
        ) : (
          <RealTimeLineChart
            chartData={data}
            xaxisName="Time"
            yaxisName="Luminance"
            xaxisMin="auto"
            xaxisMax="auto"
            yaxisMin={rangeMin}
            yaxisMax={rangeMax}
            windowSize={windowSize}
          />
        )}
      </SmallContainer>
    </VStack>
  );
};

export default FiducialTraceMain;
