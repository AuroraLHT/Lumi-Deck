import { useMemo, useState } from "react";
import RealTimeLineChart from "../../Plotting/RealTimeLineChart";
import { Serie } from "@nivo/line";
import useLog from "../../../hooks/useChamberLog";
import useChamberPldNodeStore from "../../../stores/nodes/chamberPld";
import useChamberPldSeriesStore, { PldSeriesRow, windowRows } from "../../../stores/chamberPldSeries";
import MediumContainer from "../../Plotting/MediumContainer";
import PlottingToolbar from "../../Plotting/ToolBar";
import RTVToolBarMenu, { RangeValue } from "../../Plotting/RTVToolBarMenu";
import PldStreamBanner from "./PldStreamBanner";

/** log10, preserving a null gap instead of raising on it or on a non-positive reading. */
const logTorr = (v: number | null): number | null => (v == null || v <= 0 ? null : Math.log10(v));

const pldSeries = (rows: PldSeriesRow[], field: keyof PldSeriesRow) =>
  rows.map((row) => ({ x: new Date(row.time * 1000), y: logTorr(row[field] as number | null) }));

/**
 * Under the pld driver, plots every pressure gauge the state stream carries,
 * not just the three the old log columns happened to cover. log10 throughout,
 * same as before: the ion gauges alone span 1e-7 Torr to atmospheric.
 *
 * "Back Pres Main" (tcg[0], TCG1) is REA's best reading for DP1's foreline,
 * but unconfirmed above its 1.00E-04 floor -- labelled as such rather than
 * presented as authoritative.
 */
const RealTimePressure = () => {
  const [rangeMin, setRangeMin] = useState<RangeValue>(-11);
  const [rangeMax, setRangeMax] = useState<RangeValue>(3);
  const [windowSize, setWindowSize] = useState(10 * 60 * 1000);

  const driver = useChamberPldNodeStore((s) => s.state.driver);
  const allRows = useChamberPldSeriesStore((s) => s.rows);
  const pldRows = useMemo(() => windowRows(allRows, windowSize), [allRows, windowSize]);
  const { logs } = useLog(driver !== "pld");

  let data: Serie[] = [
    { id: "TG Main", data: [{ x: new Date(), y: 0 }] },
    { id: "CDG Main", data: [{ x: new Date(), y: 0 }] },
    { id: "CDG High Main", data: [{ x: new Date(), y: 0 }] },
  ];

  if (driver === "pld") {
    if (pldRows.length > 0) {
      data = [
        { id: "IG1 (main)", data: pldSeries(pldRows, "pressures_ig1") },
        { id: "CDG10", data: pldSeries(pldRows, "pressures_cdg10") },
        { id: "CDG11", data: pldSeries(pldRows, "pressures_cdg11") },
        { id: "IG3 (load lock)", data: pldSeries(pldRows, "pressures_ig3") },
        { id: "TCG31 (load lock back)", data: pldSeries(pldRows, "pressures_tcg31") },
        { id: "TCG1 (DP1 foreline, unconfirmed)", data: pldSeries(pldRows, "pressures_tcg0") },
      ] as Serie[];
    }
  } else if (logs.length > 0) {
    const main_vac_pres = logs.map((log) => ({
      x: new Date(log["Time"]),
      y: parseFloat(log["Vac Pres Main"]) === 0 ? 10 : Math.log10(parseFloat(log["Vac Pres Main"])),
    }));

    const main_cdg_pres = logs.map((log) => ({
      x: new Date(log["Time"]),
      y: parseFloat(log["Prc Pres Main"]) === 0 ? 10 : Math.log10(parseFloat(log["Prc Pres Main"])),
    }));

    const main_high_cdg_pres = logs.map((log) => ({
      x: new Date(log["Time"]),
      y: parseFloat(log["Prc Pres Main2"]) === 0 ? 10 : Math.log10(parseFloat(log["Prc Pres Main2"])),
    }));

    data = [
      { id: "TG Main", data: main_vac_pres },
      { id: "CDG Main", data: main_cdg_pres },
      { id: "CDG High Main", data: main_high_cdg_pres },
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
      <PlottingToolbar title="Pressure" settingsMenu={settingsMenu} />
      {driver === "pld" && <PldStreamBanner />}
      <RealTimeLineChart
        chartData={data}
        xaxisName="Time"
        yaxisName="log₁₀ Pressure (Torr)"
        xaxisMin="auto"
        xaxisMax="auto"
        yaxisMin={rangeMin}
        yaxisMax={rangeMax}
        windowSize={windowSize}
      />
    </MediumContainer>
  );
};

export default RealTimePressure;
