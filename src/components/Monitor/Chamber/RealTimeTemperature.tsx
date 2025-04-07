// import { useEffect, useState } from "react";
import RealTimeLineChart from "../../Plotting/RealTimeLineChart";
import { Serie } from "@nivo/line";
import useLog from "../../../hooks/useChamberLog";
// import useChamberLogStore from "../../../clients/chamberLog";
import MediumContainer from "../../Plotting/MediumContainer";
// import { v4 as uuidv4 } from "uuid";

const RealTimeTemperature = () => {
  // console.log(
  //   "RealTimeTemperature Re-render",
  //   new Date().toISOString(),
  //   uuidv4()
  // );

  // const { logs, recentLog } = useLog();
  let data: Serie[] = [
    {
      id: "HT Temp set",
      data: [{ x: new Date(), y: 0 }],
    },

    {
      id: "HT Temp moni",
      data: [{ x: new Date(), y: 0 }],
    },
  ];
  const { logs } = useLog();
  // console.log("logs", logs.length);
  if (logs.length > 0) {
    let HT_set = logs.map((log) => ({
      // x: new Date(log['Time']).getTime(),
      x: new Date(log["Time"]),
      y: parseFloat(log["HT Temp set"]),
    }));

    let HT_moni = logs.map((log) => ({
      // x: new Date(log['Time']).getTime(),
      x: new Date(log["Time"]),
      y: parseFloat(log["HT Temp moni"]),
    }));

    data = [
      {
        id: "HT Temp set",
        data: HT_set,
      },

      {
        id: "HT Temp moni",
        data: HT_moni,
      },
    ];
  }

  return (
    <MediumContainer>
      <RealTimeLineChart
        chartData={data}
        xaxisName="Time"
        yaxisName="Temperature (°C)"
        xaxisMin="auto"
        xaxisMax="auto"
        yaxisMin={0}
        yaxisMax={1000}
        windowSize={10*60*1000}
      />
    </MediumContainer>
  );
};

export default RealTimeTemperature;
