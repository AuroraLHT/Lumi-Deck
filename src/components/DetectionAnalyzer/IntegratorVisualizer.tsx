// import { useEffect, useState } from "react";
import RealTimeLineChart from "../Plotting/RealTimeLineChart";
import { Serie } from "@nivo/line";
import useLiveAnalysisStore from "../../stores/liveAnalysis";
import useIntegrationCache from "../../hooks/useIntegrationCache";
// import useLiveAnalysisClient from "../../clients/liveAnalysis/analyzer";
import SmallContainer from "../Plotting/SmallContainer";
// import { v4 as uuidv4 } from "uuid";

const IntegratorVisualizer = () => {
  // console.log( "Rendering IntegratorVisualizer",
  //   new Date().toISOString(),
  //   uuidv4()
  // );
  // const { cache } = useIntegrationCache();
  const focusedDetectionID = useLiveAnalysisStore((s) => s.focusedDetectionID);

  let data: Serie[] = [
    {
      id: "",
      data: [{ x: new Date(), y: 0 }],
    },
  ];
  const { cache: cacheIntegrator } = useIntegrationCache();

  // const cacheIntegrator = state.cacheIntegrator;

  if (!cacheIntegrator || Object.keys(cacheIntegrator).length === 0) {
    // No action needed
  } else {
    if (
      focusedDetectionID &&
      focusedDetectionID in cacheIntegrator
    ) {
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

  return (
    <SmallContainer>
      <RealTimeLineChart
        chartData={data}
        xaxisName="Time"
        yaxisName="Intensity"
        xaxisMin="auto"
        xaxisMax="auto"
        yaxisMin={0}
        yaxisMax="auto"
      />
    </SmallContainer>
  );
};

export default IntegratorVisualizer;
