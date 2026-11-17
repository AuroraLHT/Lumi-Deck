import { useState } from "react";
import RealTimeLineChart from "../../Plotting/RealTimeLineChart";
import { Serie } from "@nivo/line";
import useLog from "../../../hooks/useChamberLog";
import useChamberPldNodeStore from "../../../stores/nodes/chamberPld";
import useChamberPldSeriesStore from "../../../stores/chamberPldSeries";
import MediumContainer from "../../Plotting/MediumContainer";
import PlottingToolbar from "../../Plotting/ToolBar";
import RTVToolBarMenu, { RangeValue } from "../../Plotting/RTVToolBarMenu";
import PldStreamBanner from "./PldStreamBanner";

/**
 * Under the pld driver, plots the chamber.pld state stream's typed fields
 * instead of the parsed log. The setpoint series is left as a gap (not the
 * stale setpoint it was last given) whenever the PID is off: a manual-current
 * run's "setpoint" is not a live target.
 *
 * Under --use-legacy-mi-mode, chamber.pld carries no state at all, so this
 * falls back to the CSV log exactly as before.
 */
const RealTimeTemperature = () => {
  const [rangeMin, setRangeMin] = useState<RangeValue>(0);
  const [rangeMax, setRangeMax] = useState<RangeValue>(1000);
  const [windowSize, setWindowSize] = useState(10 * 60 * 1000);

  const driver = useChamberPldNodeStore((s) => s.state.driver);
  const pldRows = useChamberPldSeriesStore((s) => s.rows);
  const { logs } = useLog(driver !== "pld");

  let data: Serie[] = [
    { id: "HT Temp set", data: [{ x: new Date(), y: 0 }] },
    { id: "HT Temp moni", data: [{ x: new Date(), y: 0 }] },
  ];

  if (driver === "pld") {
    if (pldRows.length > 0) {
      data = [
        {
          id: "HT Temp set",
          data: pldRows.map((row) => ({ x: new Date(row.time * 1000), y: row.heater_temperature_setpoint })),
        },
        {
          id: "HT Temp moni",
          data: pldRows.map((row) => ({ x: new Date(row.time * 1000), y: row.heater_temperature })),
        },
      ] as Serie[];
    }
  } else if (logs.length > 0) {
    const HT_set = logs.map((log) => ({
      x: new Date(log["Time"]),
      y: parseFloat(log["HT Temp set"]),
    }));

    const HT_moni = logs.map((log) => ({
      x: new Date(log["Time"]),
      y: parseFloat(log["HT Temp moni"]),
    }));

    data = [
      { id: "HT Temp set", data: HT_set },
      { id: "HT Temp moni", data: HT_moni },
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
      <PlottingToolbar title="Temperature" settingsMenu={settingsMenu} />
      {driver === "pld" && <PldStreamBanner />}
      <RealTimeLineChart
        chartData={data}
        xaxisName="Time"
        yaxisName="Temperature (°C)"
        xaxisMin="auto"
        xaxisMax="auto"
        yaxisMin={rangeMin}
        yaxisMax={rangeMax}
        windowSize={windowSize}
      />
    </MediumContainer>
  );
};

export default RealTimeTemperature;
