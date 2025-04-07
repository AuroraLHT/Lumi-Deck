// import { useEffect, useState } from "react";
import RealTimeLineChart from "../../Plotting/RealTimeLineChart";
import { Serie } from "@nivo/line";
import useLog from "../../../hooks/useChamberLog";
// import useChamberLogStore from "../../../clients/chamberLog";
import MediumContainer from "../../Plotting/MediumContainer";
import { v4 as uuidv4 } from "uuid";

const RealTimePressure = () => {
  // console.log("RealTimePressure Re-render", new Date().toISOString(), uuidv4());

  // const { logs, recentLog } = useLog();
  let data: Serie[] = [
    {
      id: "Vac Pres L/L",
      data: [{ x: new Date(), y: 0 }],
    },

    {
      id: "Vac Pres Main",
      data: [{ x: new Date(), y: 0 }],
    },
  ];
  const { logs } = useLog();
  // console.log("logs", logs.length);
  if (logs.length > 0) {
    let ll_vac_pres = logs.map((log) => ({
      // x: new Date(log['Time']).getTime(),
      x: new Date(log["Time"]),
      y: Math.log10(parseFloat(log["Vac Pres L/L"])),
    }));

    let main_vac_pres = logs.map((log) => ({
      // x: new Date(log['Time']).getTime(),
      x: new Date(log["Time"]),
      y:
        parseFloat(log["Vac Pres Main"]) === 0
          ? 10
          : Math.log10(parseFloat(log["Vac Pres Main"])),
    }));
    // console.log(ll_vac_pres);
    data = [
      {
        id: "Vac Pres L/L",
        data: ll_vac_pres,
      },

      {
        id: "Vac Pres Main",
        data: main_vac_pres,
      },
    ];
  }

  return (
    <MediumContainer>
      <RealTimeLineChart
        chartData={data}
        xaxisName="Time"
        yaxisName="log₁₀ Pressure (Torr)"
        xaxisMin="auto"
        xaxisMax="auto"
        yaxisMin={-11}
        yaxisMax={3}
        windowSize={10*60*1000}
      />
    </MediumContainer>
  );
};

export default RealTimePressure;
