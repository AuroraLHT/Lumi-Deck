// import { useEffect, useState } from "react";
import RealTimeLineChart from "../Plotting/RealTimeLineChart";
// import { Serie } from "@nivo/line";
import useDetectionCache from "../../hooks/useDetectionCache";
// import useLiveAnalysisClient from "../../clients/liveAnalysis/analyzer";
import MediumContainer from "../Plotting/MediumContainer";
import PlottingToolbar from "../Plotting/ToolBar";
import RTVToolBarMenu, {RangeValue} from "../Plotting/RTVToolBarMenu";
import { useState } from "react";

// import { DetectionBase } from "../../entities/detector";
// import {v4 as uuidv4} from 'uuid';

const RealTimeClassification = () => {
  const [rangeMin, setRangeMin] = useState<RangeValue>("auto");
  const [rangeMax, setRangeMax] = useState<RangeValue>("auto");
  const [windowSize, setWindowSize] = useState(20000);
  const [isVisible, setIsVisible] = useState(true);

  // console.log("RealTimeClassification re-rendered", new Date().toISOString(), uuidv4());
  let data = ([
      {
        id: "Polycrystalline",
        data: [{ x: new Date(), y: 0 }],
      },
      
      {
        id: "Transmission",
        data: [{ x: new Date(), y: 0 }],
      },
      
      {
        id: "Epitaxial",
        data: [{ x: new Date(), y: 0 }],
      },
    ])
  const { cache } = useDetectionCache();
  // console.log("cache", cache[0].classification);

  if (cache.length > 0) {
    // console.log("cacheDetection", cache.length);
    let prob_transmission = cache.map((item) => ({
      x: new Date(item.header.time_stamp),
      y: parseFloat(item.classification["Transmission"]),
    }));
  
    let prob_polycrystalline = cache.map((item) => ({
      x: new Date(item.header.time_stamp),
      y: parseFloat(item.classification["Polycrystalline"]),
    }));
  
    let prob_epitaxial = cache.map((item) => ({
      x: new Date(item.header.time_stamp),
      y: parseFloat(item.classification["Epitaxial"]),
    }));
  
    data = ([
      {
        id: "Polycrystalline",
        data: prob_polycrystalline,
      },
  
      {
        id: "Epitaxial",
        data: prob_epitaxial,
      },
  
      {
        id: "Transmission",
        data: prob_transmission,
      },
    ]);  
  }

  const settingsMenu = (
    <RTVToolBarMenu
      RangeMin={rangeMin}
      onRangeMinChange={setRangeMin}
      RangeMax={rangeMax}
      onRangeMaxChange={setRangeMax}
      WindowSize={windowSize}
      onWindowSizeChange={setWindowSize}
    />
  );

  return (
    <MediumContainer>
      <PlottingToolbar isMinimized={!isVisible} onMinimize={() => {setIsVisible(!isVisible)}} settingsMenu={settingsMenu} />
      {isVisible && (
        <RealTimeLineChart
          chartData={data}
          xaxisName="Time"
          yaxisName="Probability"
          xaxisMin="auto"
          xaxisMax="auto"
        yaxisMin={0}
        yaxisMax={1}
          windowSize={windowSize}
        />
      )}
    </MediumContainer>
  );
};

export default RealTimeClassification;
