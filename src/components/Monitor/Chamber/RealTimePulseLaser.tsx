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
 * Under the pld driver, the state only carries pulses fired so far in the
 * current/last train and the train's missed-shot count -- not the requested
 * pulse count ("Laser set") or rate ("LaserHz"), so those two series are
 * dropped rather than left plotting nothing. REA is adding rate_hz and the
 * requested pulse count to the stream; both return once that lands.
 *
 * Falls back to the CSV log under --use-legacy-mi-mode, where chamber.pld
 * carries no state at all.
 */
const RealTimePulseLaser = () => {
  const [rangeMin, setRangeMin] = useState<RangeValue>(0);
  const [rangeMax, setRangeMax] = useState<RangeValue>("auto");
  const [windowSize, setWindowSize] = useState(10 * 60 * 1000);

  const driver = useChamberPldNodeStore((s) => s.state.driver);
  const pldRows = useChamberPldSeriesStore((s) => s.rows);
  const { logs } = useLog();

  let data: Serie[] = [
    { id: "Laser moni", data: [{ x: new Date(), y: 0 }] },
    { id: "Laser set", data: [{ x: new Date(), y: 0 }] },
    { id: "LaserPuls", data: [{ x: new Date(), y: 0 }] },
    { id: "LaserHz", data: [{ x: new Date(), y: 0 }] },
  ];

  if (driver === "pld") {
    if (pldRows.length > 0) {
      data = [
        {
          id: "Laser moni (pulses fired)",
          data: pldRows.map((row) => ({ x: new Date(row.time * 1000), y: row.laser_pulses_fired })),
        },
        {
          id: "Missed shots",
          data: pldRows.map((row) => ({ x: new Date(row.time * 1000), y: row.laser_missed_shots })),
        },
      ] as Serie[];
    }
  } else if (logs.length > 0) {
    data = [
      {
        id: "Laser moni",
        data: logs.map((log) => ({ x: new Date(log["Time"]), y: parseFloat(log["Laser moni"]) })),
      },
      {
        id: "Laser set",
        data: logs.map((log) => ({ x: new Date(log["Time"]), y: parseFloat(log["Laser set"]) })),
      },
      {
        id: "Laser pulse",
        data: logs.map((log) => ({ x: new Date(log["Time"]), y: parseFloat(log["LaserPuls"]) })),
      },
      {
        id: "Laser Hz",
        data: logs.map((log) => ({ x: new Date(log["Time"]), y: parseFloat(log["LaserHz"]) })),
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
      <PlottingToolbar title="Pulse Laser" settingsMenu={settingsMenu} />
      {driver === "pld" && <PldStreamBanner />}
      <RealTimeLineChart
        chartData={data}
        xaxisName="Time"
        yaxisName="Pulse (count)"
        xaxisMin="auto"
        xaxisMax="auto"
        yaxisMin={rangeMin}
        yaxisMax={rangeMax}
        windowSize={windowSize}
      />
    </MediumContainer>
  );
};

export default RealTimePulseLaser;
