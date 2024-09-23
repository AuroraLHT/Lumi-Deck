import { useEffect, useState } from "react";
import RealTimeLineComponent from "../Plotting/RealTimeLineChart";
import { Serie } from "@nivo/line";
import useLiveAnalysisStore from "../../stores/liveAnalysis";
import useIntegrationCache from "../../hooks/useIntegrationCache";

const IntegratorVisualizer = () => {

  const {cache} = useIntegrationCache();
  const focusedDetection = useLiveAnalysisStore(s => s.focusedDetection);

  const [data, setData] = useState<Serie[]>([
    {
      id: "Box -",
      data: [{ x: new Date(), y: 0 }],
    },
  ]);
  useEffect(() => {
    if (Object.keys(cache).length === 0) {
      return;
    }
    
    if (focusedDetection && focusedDetection.id && focusedDetection.id in cache) {
      // console.log("Focused detection in cache");
      let cacheFocused = cache[focusedDetection.id];

      let liveIntegration = cacheFocused.map((item) => ({
        x: new Date(item.header.time_stamp),
        y: item.content.mean,
      }));
      setData([
        {
          id: `${focusedDetection.name}`,
          data: liveIntegration,
        },
      ]);  
    }

  }, [cache]);

  return (
    <RealTimeLineComponent
      chartData = {data}
      xaxisName = "Time"
      yaxisName = "Intensity"
      xaxisMin = "auto"
      xaxisMax = "auto"
      yaxisMin = {0}
      yaxisMax = "auto"
    />
  );
};

export default IntegratorVisualizer;
