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
  const focusedDetection = useLiveAnalysisStore((s) => s.focusedDetection);

  let data: Serie[] = [
    {
      id: "Box -",
      data: [{ x: new Date(), y: 0 }],
    },
  ];
  const { cache: cacheIntegrator } = useIntegrationCache();

  // const cacheIntegrator = state.cacheIntegrator;

  if (!cacheIntegrator || Object.keys(cacheIntegrator).length === 0) {
    // No action needed
  } else {
    if (
      focusedDetection &&
      focusedDetection.id &&
      focusedDetection.id in cacheIntegrator
    ) {
      // console.log("Focused detection in cache");
      let cacheFocused = cacheIntegrator[focusedDetection.id];
      // console.log("cacheIntegrator Focused", cacheFocused.length);

      let liveIntegration = cacheFocused.map((item) => ({
        x: new Date(item.header.time_stamp),
        y: item.content.mean,
      }));

      data = [
        {
          id: `${focusedDetection.name}`,
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
