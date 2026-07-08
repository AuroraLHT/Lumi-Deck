// import { useEffect, useState } from "react";
import RealTimeLineChart from "../../Plotting/RealTimeLineChart";
import { Serie } from "@nivo/line";
import useLog from "../../../hooks/useChamberLog";
// import useChamberLogStore from "../../../clients/chamberLog";
import MediumContainer from "../../Plotting/MediumContainer";
// import { v4 as uuidv4 } from "uuid";
import PlottingToolbar from "../../Plotting/ToolBar";
import RTVToolBarMenu, {RangeValue} from "../../Plotting/RTVToolBarMenu";
import { useState } from "react";

const RealTimePressure = () => {
  // console.log("RealTimePressure Re-render", new Date().toISOString(), uuidv4());

  // const { logs, recentLog } = useLog();
  const [rangeMin, setRangeMin] = useState<RangeValue>("auto");
  const [rangeMax, setRangeMax] = useState<RangeValue>("auto");
  const [windowSize, setWindowSize] = useState(60*1000);
  const [isVisible, setIsVisible] = useState(true);

  let data: Serie[] = [
    // {
    //   id: "TG L/L",
    //   data: [{ x: new Date(), y: 0 }],
    // },

    {
      id: "TG Main",
      data: [{ x: new Date(), y: 0 }],
    },

    {
      id: "CDG Main",
      data: [{ x: new Date(), y: 0 }],
    },

    {
      id: "CDG High Main",
      data: [{ x: new Date(), y: 0 }],
    },

    // {
    //   id: "CDG L/L",
    //   data: [{ x: new Date(), y: 0 }],
    // },
    
    
  ];
  const { logs } = useLog();
  // console.log("logs", logs.length);
  if (logs.length > 0) {
    // let ll_vac_pres = logs.map((log) => ({
    //   // x: new Date(log['Time']).getTime(),
    //   x: new Date(log["Time"]),
    //   y: parseFloat(log["Vac Pres L/L"]) === 0 ? 10 : Math.log10(parseFloat(log["Vac Pres L/L"])),
    // }));

    let main_vac_pres = logs.map((log) => ({
      // x: new Date(log['Time']).getTime(),
      x: new Date(log["Time"]),
      y:
        parseFloat(log["Vac Pres Main"]) === 0
          ? 10
          : Math.log10(parseFloat(log["Vac Pres Main"])),
    }));

    let main_cdg_pres = logs.map((log) => ({
      // x: new Date(log['Time']).getTime(),
      x: new Date(log["Time"]),
      y:
        parseFloat(log["Prc Pres Main"]) === 0
          ? 10
          : Math.log10(parseFloat(log["Prc Pres Main"])),
    }));

    let main_high_cdg_pres = logs.map((log) => ({
      // x: new Date(log['Time']).getTime(),
      x: new Date(log["Time"]),
      y:
        parseFloat(log["Prc Pres Main2"]) === 0
          ? 10
          : Math.log10(parseFloat(log["Prc Pres Main2"])),
    }));

    // let ll_cdg_pres = logs.map((log) => ({
    //   // x: new Date(log['Time']).getTime(),
    //   x: new Date(log["Time"]),
    //   y:
    //     parseFloat(log["Prc Pres L/L"]) === 0
    //       ? 10
    //       : Math.log10(parseFloat(log["Prc Pres L/L"])),
    // }));


    // console.log(ll_vac_pres);
    data = [
      {
        id: "TG Main",
        data: main_vac_pres,
      },

      {
        id: "CDG Main",
        data: main_cdg_pres,
      },
      
      {
        id: "CDG High Main",
        data: main_high_cdg_pres,
      },

      // {
      //   id: "TG L/L",
      //   data: ll_vac_pres,
      // },

      // {
      //   id: "CDG L/L",
      //   data: ll_cdg_pres,
      // },
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
          yaxisName="log₁₀ Pressure (Torr)"
          xaxisMin="auto"
          xaxisMax="auto"
          yaxisMin={-11}
          yaxisMax={3}
          windowSize={windowSize}
        />
      )}
    </MediumContainer>
  );
};

export default RealTimePressure;
