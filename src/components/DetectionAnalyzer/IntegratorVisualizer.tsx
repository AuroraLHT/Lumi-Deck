import RealTimeLineChart from "../Plotting/RealTimeLineChart";
import { Serie } from "@nivo/line";
import useLiveAnalysisStore from "../../stores/liveAnalysis";
import useIntegrationCache from "../../hooks/useIntegrationCache";
import SmallContainer from "../Plotting/SmallContainer";
import PlottingToolbar from "../Plotting/ToolBar";
import { useState } from "react";
import ToolBarMenu from "../Plotting/ToolBarMenu";
import { RangeValue } from "../Plotting/ToolBarMenu";

const IntegratorVisualizer = () => {
  const focusedDetectionID = useLiveAnalysisStore((s) => s.focusedDetectionID);

  const [windowSize, setWindowSize] = useState(10000);
  const [rangeMin, setRangeMin] = useState<RangeValue>("auto");
  const [rangeMax, setRangeMax] = useState<RangeValue>("auto");

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
    <ToolBarMenu
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
      <PlottingToolbar onMinimize={() => {}} settingsMenu={settingsMenu} />
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
    </SmallContainer>
  );
};

export default IntegratorVisualizer;
