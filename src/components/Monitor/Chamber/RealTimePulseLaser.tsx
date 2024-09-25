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
      id: "Laser moni",
      data: [{ x: new Date(), y: 0 }],
    },

    {
      id: "Laser set",
      data: [{ x: new Date(), y: 0 }],
    },

    {
      id: "LaserPuls",
      data: [{ x: new Date(), y: 0 }],
    },

    {
      id: "LaserHz",
      data: [{ x: new Date(), y: 0 }],
    },
  ];
  const { logs } = useLog();
  //   console.log(logs, logs[0]);
  //   console.log("logs", logs.length);
  if (logs.length > 0) {
    let serie_data: Serie[] = [];

    serie_data.push({
      id: "Laser moni",
      data: logs.map((log) => ({
        // x: new Date(log['Time']).getTime(),
        x: new Date(log["Time"]),
        y: parseFloat(log["Laser moni"]),
      })),
    });

    serie_data.push({
      id: "Laser set",
      data: logs.map((log) => ({
        // x: new Date(log['Time']).getTime(),
        x: new Date(log["Time"]),
        y: parseFloat(log["Laser set"]),
      })),
    });

    serie_data.push({
      id: "Laser pulse",
      data: logs.map((log) => ({
        // x: new Date(log['Time']).getTime(),
        x: new Date(log["Time"]),
        y: parseFloat(log["LaserPuls"]),
      })),
    });

    serie_data.push({
      id: "Laser Hz",
      data: logs.map((log) => ({
        // x: new Date(log['Time']).getTime(),
        x: new Date(log["Time"]),
        y: parseFloat(log["LaserHz"]),
      })),
    });

    data = serie_data;
  }

  return (
    <MediumContainer>
      <RealTimeLineChart
        chartData={data}
        xaxisName="Time"
        yaxisName="Pulse (count)"
        xaxisMin="auto"
        xaxisMax="auto"
        yaxisMin={0}
        yaxisMax="auto"
      />
    </MediumContainer>
  );
};

export default RealTimeTemperature;
