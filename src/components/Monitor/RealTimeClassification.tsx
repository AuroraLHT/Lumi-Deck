import { useEffect, useState } from "react";
import RealTimeLineChart from "../Plotting/RealTimeLineChart";
import { Serie } from "@nivo/line";
import useDetectionCache from "../../hooks/useDetectionCache";
import MediumContainer from "../Plotting/MediumContainer";

const RealTimeClassification = () => {
  const { cache } = useDetectionCache();
  const [data, setData] = useState<Serie[]>([
    {
      id: "Polycrystalline",
      data: [{ x: new Date(), y: 0 }],
    },

    {
      id: "Transmission",
      data: [{ x: new Date(), y: 0 }],
    },

    {
      id: "Epitaxial",
      data: [{ x: new Date(), y: 0 }],
    },
  ]);
  useEffect(() => {
    if (cache.length === 0) {
      return;
    }

    // console.log("Cache timestamps:");
    // cache.forEach((item, index) => {
    //   console.log(item.header.time_stamp);
    // });

    let prob_transmission = cache.map((item) => ({
      x: new Date(item.header.time_stamp),
      y: parseFloat(item.classification["transmission"]),
    }));

    let prob_polycrystalline = cache.map((item) => ({
      x: new Date(item.header.time_stamp),
      y: parseFloat(item.classification["Powder"]),
    }));

    let prob_epitaxial = cache.map((item) => ({
      x: new Date(item.header.time_stamp),
      y: parseFloat(item.classification["Epitaxial"]),
    }));

    setData([
      {
        id: "Polycrystalline",
        data: prob_polycrystalline,
      },

      {
        id: "Epitaxial",
        data: prob_epitaxial,
      },

      {
        id: "Transmission",
        data: prob_transmission,
      },
    ]);
  }, [cache]);

  return (
    <MediumContainer>
      <RealTimeLineChart
        chartData={data}
        xaxisName="Time"
        yaxisName="Probability"
        xaxisMin="auto"
        xaxisMax="auto"
        yaxisMin={0}
        yaxisMax={1}
      />
    </MediumContainer>
  );
};

export default RealTimeClassification;
