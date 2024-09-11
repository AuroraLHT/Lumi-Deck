import { useEffect, useState } from "react";
import RealTimeLineComponent from "./RealTimeLineChart";
import { Serie } from "@nivo/line";
import useLog from "../../hooks/useChamberLog";


const RealTImeTemperature = () => {
  const { logs, recentLog } = useLog();
  const [data, setData] = useState<Serie[]>([
    {
      id: "HT Temp set",
      data: [{ x: new Date(), y: 0 }],
    },

    {
      id: "HT Temp moni",
      data: [{ x: new Date(), y: 0 }],
    },
  ]);
  useEffect(() => {
    // console.log(logsRef.current);
    // console.log(logs);
    // console.log("update temperature");
    if (logs.length === 0) {
      return;
    }

    let HT_set = logs.map((log) => ({
      // x: new Date(log['Time']).getTime(),
      x: new Date(log["Time"]),
      y: (parseFloat(log["HT Temp set"])),
    }));

    let HT_moni = logs.map((log) => ({
      // x: new Date(log['Time']).getTime(),
      x: new Date(log["Time"]),
      y: parseFloat(log["HT Temp moni"]),
    }));

    setData([
      {
        id: "HT Temp set",
        data: HT_set,
      },

      {
        id: "HT Temp moni",
        data: HT_moni,
      },
    ]);
  }, [logs, recentLog]);

  return (
    <RealTimeLineComponent
      chartData={data}
      xaxisName="Time"
      yaxisName="Temperature (°C)"
      xaxisMin="auto"
      xaxisMax="auto"
      yaxisMin={1000}
      yaxisMax={0}
    />
  );
};

export default RealTImeTemperature;
