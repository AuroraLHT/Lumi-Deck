import { useMemo } from "react";

import { IntegrationTrace, StepInfo } from "../../generated/lumi";
import RecordingTimeChart from "./RecordingTimeChart";

/**
 * Each integration box's mean intensity over a recording -- the RHEED
 * oscillations, one line per box, coloured as the box is on the frame above.
 */
const IntegrationChart = ({
  traces,
  ...rest
}: {
  traces: IntegrationTrace[];
  t0: number;
  cursor: number | null;
  deposition: StepInfo | null;
  onSeek: (time: number) => void;
}) => {
  const lines = useMemo(
    () =>
      traces.map((trace) => ({
        id: `Box ${trace.bbox_id}`,
        time: trace.time ?? [],
        values: trace.mean ?? [],
      })),
    [traces]
  );
  return <RecordingTimeChart lines={lines} yLegend="Mean intensity" what="boxes" {...rest} />;
};

export default IntegrationChart;
