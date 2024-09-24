import { useEffect, useState } from "react";
import RealTimeLineChart from "../../Plotting/RealTimeLineChart";
import { Serie } from "@nivo/line";
import useLog from "../../../hooks/useChamberLog";
import MediumContainer from "../../Plotting/MediumContainer";

const RealTimePressure = () => {
  const { logs, recentLog } = useLog();
  const [data, setData] = useState<Serie[]>([
    {
      id: "Vac Pres L/L",
      data: [{ x: new Date(), y: 0 }],
    },

    {
      id: "Vac Pres Main",
      data: [{ x: new Date(), y: 0 }],
    },
  ]);
  useEffect(() => {
    // console.log(logsRef.current);
    // console.log("update pressure");
    if (logs.length === 0) {
      return;
    }

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
    setData([
      {
        id: "Vac Pres L/L",
        data: ll_vac_pres,
      },

      {
        id: "Vac Pres Main",
        data: main_vac_pres,
      },
    ]);
  }, [logs, recentLog]);

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
      />
    </MediumContainer>
  );
};

export default RealTimePressure;
