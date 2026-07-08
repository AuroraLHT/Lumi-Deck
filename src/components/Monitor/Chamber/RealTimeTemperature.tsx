// import { useEffect, useState } from "react";
import RealTimeLineChart from "../../Plotting/RealTimeLineChart";
import { Serie } from "@nivo/line";
import useLog from "../../../hooks/useChamberLog";
// import useChamberLogStore from "../../../clients/chamberLog";
import MediumContainer from "../../Plotting/MediumContainer";
import PlottingToolbar from "../../Plotting/ToolBar";
import RTVToolBarMenu, { RangeValue } from "../../Plotting/RTVToolBarMenu";
import { useState } from "react";

const RealTimeTemperature = () => {
  const [rangeMin, setRangeMin] = useState<RangeValue>("auto");
  const [rangeMax, setRangeMax] = useState<RangeValue>("auto");
  const [windowSize, setWindowSize] = useState(10*60*1000);
  const [isVisible, setIsVisible] = useState(true);

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
          yaxisName="Temperature (°C)"
          xaxisMin="auto"
          xaxisMax="auto"
          yaxisMin={0}
          yaxisMax={1000}
          windowSize={windowSize}
        />
      )}
    </MediumContainer>
  );
};

export default RealTimeTemperature;
