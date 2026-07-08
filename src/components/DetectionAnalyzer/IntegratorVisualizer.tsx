import RealTimeLineChart from "../Plotting/RealTimeLineChart";
import { Serie } from "@nivo/line";
import useLiveAnalysisStore from "../../stores/liveAnalysis";
import useIntegrationCache from "../../hooks/useIntegrationCache";
import SmallContainer from "../Plotting/SmallContainer";
import PlottingToolbar from "../Plotting/ToolBar";
import { useState } from "react";
import RTVToolBarMenu from "../Plotting/RTVToolBarMenu";
import { RangeValue } from "../Plotting/RTVToolBarMenu";

const IntegratorVisualizer = () => {
  const focusedDetectionID = useLiveAnalysisStore((s) => s.focusedDetectionID);

  const [windowSize, setWindowSize] = useState(10000);
  const [rangeMin, setRangeMin] = useState<RangeValue>("auto");
  const [rangeMax, setRangeMax] = useState<RangeValue>("auto");
  const [isVisible, setIsVisible] = useState(true);

  let data: Serie[] = [
    {
      id: "",
      data: [{ x: new Date(), y: 0 }],
    },
  ];
  const { cache: cacheIntegrator } = useIntegrationCache();

  if (!cacheIntegrator || Object.keys(cacheIntegrator).length === 0) {
    // No action needed
  } else {
    if (focusedDetectionID && focusedDetectionID in cacheIntegrator) {
      // console.log("Focused detection in cache");
      let cacheFocused = cacheIntegrator[focusedDetectionID];
      // console.log("cacheIntegrator Focused", cacheFocused.length);

      let liveIntegration = cacheFocused.map((item) => ({
        x: new Date(item.header.time_stamp),
        y: item.content.mean,
      }));

      data = [
        {
          id: `Oscillation`,
          data: liveIntegration,
        },
      ];
      // console.log(data);
    }
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
    <SmallContainer>
      <PlottingToolbar isMinimized={!isVisible} onMinimize={() => {setIsVisible(!isVisible)}} settingsMenu={settingsMenu} />
      {isVisible && (
        <RealTimeLineChart
          chartData={data}
          xaxisName="Time"
          yaxisName="Intensity"
          xaxisMin="auto"
          xaxisMax="auto"
          yaxisMin={rangeMin}
        yaxisMax={rangeMax}
          windowSize={windowSize}
        />
      )}
    </SmallContainer>
  );
};

export default IntegratorVisualizer;
