// import { useEffect, useState } from "react";
import RealTimeLineChart from "../Plotting/RealTimeLineChart";
// import { Serie } from "@nivo/line";
import useDetectionCache from "../../hooks/useDetectionCache";
// import useLiveAnalysisClient from "../../clients/liveAnalysis/analyzer";
import MediumContainer from "../Plotting/MediumContainer";
// import { DetectionBase } from "../../entities/detector";
// import {v4 as uuidv4} from 'uuid';

const RealTimeClassification = () => {
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

  return (
    <MediumContainer>
      <RealTimeLineChart
        chartData={data}
        xaxisName="Time"
        yaxisName="Probability"
        xaxisMin="auto"
        xaxisMax="auto"
        yaxisMin={0}
        yaxisMax={1}
        windowSize={20000}
      />
    </MediumContainer>
  );
};

export default RealTimeClassification;
