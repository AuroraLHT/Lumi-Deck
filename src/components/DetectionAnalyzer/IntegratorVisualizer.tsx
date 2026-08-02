import RealTimeLineChart from "../Plotting/RealTimeLineChart";
import { Serie } from "@nivo/line";
import useLiveAnalysisStore from "../../stores/liveAnalysis";
import useIntegrationCache from "../../hooks/useIntegrationCache";
import SmallContainer from "../Plotting/SmallContainer";
import PlottingToolbar from "../Plotting/ToolBar";
import { useMemo, useState } from "react";
import RTVToolBarMenu from "../Plotting/RTVToolBarMenu";
import { RangeValue } from "../Plotting/RTVToolBarMenu";

const IntegratorVisualizer = () => {
  const focusedDetectionID = useLiveAnalysisStore((s) => s.focusedDetectionID);

  const [windowSize, setWindowSize] = useState(10000);
  const [rangeMin, setRangeMin] = useState<RangeValue>("auto");
  const [rangeMax, setRangeMax] = useState<RangeValue>("auto");

  const { cache: cacheIntegrator } = useIntegrationCache();

  // Memoized on the focused series: this runs over the whole cache (up to
  // maxCacheSize entries), so re-running it for unrelated re-renders -- a
  // toolbar toggle, a parent update -- is what makes the panel feel sluggish.
  // `item.x` is parsed once at ingest; see stores/integrator.ts.
  const data: Serie[] = useMemo(() => {
    const cacheFocused =
      focusedDetectionID != null ? cacheIntegrator?.[focusedDetectionID] : undefined;

    if (!cacheFocused || cacheFocused.length === 0) {
      return [{ id: "", data: [{ x: new Date(), y: 0 }] }];
    }

    return [
      {
        id: "Oscillation",
        data: cacheFocused.map((item) => ({ x: item.x, y: item.content.mean })),
      },
    ];
  }, [cacheIntegrator, focusedDetectionID]);

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
      <PlottingToolbar title="Oscillation" settingsMenu={settingsMenu} />
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
