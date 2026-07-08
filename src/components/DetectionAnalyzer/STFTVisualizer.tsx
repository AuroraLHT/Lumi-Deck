// import { useEffect, useState } from "react";
import { Serie } from "@nivo/line";
import useLiveAnalysisStore from "../../stores/liveAnalysis";
import useSTFTCache from "../../hooks/useSTFTCache";
import LineChart from "../Plotting/LineChart";
import SmallContainer from "../Plotting/SmallContainer";

import PlottingToolbar from "../Plotting/ToolBar";
import STFTToolBarMenu, { RangeValue } from "./STFTToolBarMenu";
import { useState } from "react";

// import { v4 as uuidv4 } from "uuid";

const STFTVisualizer = () => {
  // console.log("Rendering STFTVisualizer", new Date().toISOString(), uuidv4());
  const { cache } = useSTFTCache();
  const focusedDetectionID = useLiveAnalysisStore((s) => s.focusedDetectionID);

  const [rangeMin, setRangeMin] = useState<RangeValue>("auto");
  const [rangeMax, setRangeMax] = useState<RangeValue>("auto");
  const [frequencyMin, setFrequencyMin] = useState<RangeValue>("auto");
  const [frequencyMax, setFrequencyMax] = useState<RangeValue>("auto");
  const [isVisible, setIsVisible] = useState(false);

  let data: Serie[] = [
    {
      id: "",
      data: [{ x: 1, y: 1 }],
    },
  ];
  if (
    Object.keys(cache).length === 0 ||
    !focusedDetectionID ||
    !(focusedDetectionID in cache)
  ) {
    // No action needed
  } else {
    const cacheFocused = cache[focusedDetectionID];
    if (cacheFocused.length > 0) {
      const numTimesteps = Math.min(cacheFocused.length, 1); // Limit to last 10 timesteps
      const series: Serie[] = [];

      for (let i = 1; i <= numTimesteps; i++) {
        const index = cacheFocused.length - i;
        const stft = cacheFocused[index].content;

        series.push({
          // id: `T-${i}`,
          id: "STFT",
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

  const settingsMenu = (
    <STFTToolBarMenu
      RangeMin={rangeMin}
      onRangeMinChange={setRangeMin}
      RangeMax={rangeMax}
      onRangeMaxChange={setRangeMax}
      FrequencyMin={frequencyMin}
      onFrequencyMinChange={setFrequencyMin}
      FrequencyMax={frequencyMax}
      onFrequencyMaxChange={setFrequencyMax}
    />
  );
  return (
    <SmallContainer>
      <PlottingToolbar
        isMinimized={!isVisible}
        onMinimize={() => {
          setIsVisible(!isVisible);
        }}
        settingsMenu={settingsMenu}
      />
      {isVisible && (
        <LineChart
          chartData={data}
          xaxisName="Frequency (Hz)"
          yaxisName="Magnitude"
          xaxisMin={0}
          xaxisMax={1}
          yaxisMin="auto"
          yaxisMax="auto"
        />
      )}
    </SmallContainer>
  );
};

export default STFTVisualizer;
