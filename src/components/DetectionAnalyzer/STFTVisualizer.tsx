// import { useEffect, useState } from "react";
import { Serie } from "@nivo/line";
import useLiveAnalysisStore from "../../stores/liveAnalysis";
import useSTFTCache from "../../hooks/useSTFTCache";
import LineChart from "../Plotting/LineChart";
import SmallContainer from "../Plotting/SmallContainer";
// import { v4 as uuidv4 } from "uuid";

const STFTVisualizer = () => {
  // console.log("Rendering STFTVisualizer", new Date().toISOString(), uuidv4());
  const { cache } = useSTFTCache();
  const focusedDetection = useLiveAnalysisStore((s) => s.focusedDetection);

  let data: Serie[] = [
    {
      id: "T -",
      data: [{ x: 1, y: 1 }],
    },
  ];
  if (
    Object.keys(cache).length === 0 ||
    !focusedDetection ||
    !focusedDetection.id ||
    !(focusedDetection.id in cache)
  ) {
    // No action needed
  } else {
    const cacheFocused = cache[focusedDetection.id];
    if (cacheFocused.length > 0) {
      const numTimesteps = Math.min(cacheFocused.length, 1); // Limit to last 10 timesteps
      const series: Serie[] = [];

      for (let i = 1; i <= numTimesteps; i++) {
        const index = cacheFocused.length - i;
        const stft = cacheFocused[index].content;

        series.push({
          id: `T-${i}`,
          data: stft.fft_freq.map((freq, idx) => ({
            x: freq,
            y: stft.fft_mag[idx],
          })),
          showLegend: i === 1 || i === numTimesteps,
        });
      }

      data = series.reverse();
    }
  }

  return (
    <SmallContainer>
      <LineChart
        chartData={data}
        xaxisName="Frequency (Hz)"
        yaxisName="Magnitude"
        xaxisMin={0}
        xaxisMax={1}
        yaxisMin="auto"
        yaxisMax="auto"
      />
    </SmallContainer>
  );
};

export default STFTVisualizer;
