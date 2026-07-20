import React from "react";
import { Box } from "@chakra-ui/react";
import { ResponsiveLineCanvas } from "@nivo/line";
import { Serie } from "@nivo/line";
import useNivoTheme from "./nivoTheme";


export interface TimeWindowOptions {
  windowSize: number; // in milliseconds
  data: Array<{ x: Date; y: number }>;
}


export interface DataPoint {
  x: number | Date;
  y: number | Date;
}

interface Props {
  // data: DataPoint[];
  chartData: Serie[];
  xaxisName: string;
  yaxisName: string;
  xaxisMin: Date | string;
  xaxisMax: Date | string;
  yaxisMin: number | "auto";
  yaxisMax: number | "auto";
  windowSize: number;
}

export const filterByTimeWindow = ({ windowSize, data }: TimeWindowOptions) => {
  if (data.length === 0) { return data; }

  const cutoff = data[data.length - 1].x.getTime() - windowSize;
  const windowed = data.filter(point => point.x.getTime() > cutoff);

  // A single point draws nothing. When the sample interval is wider than the
  // window (e.g. one log every few minutes against a 60s window), the filter
  // keeps only the newest point and the trace vanishes. Fall back to the last
  // two samples so a line is always drawn when we actually have the data for one.
  if (windowed.length < 2 && data.length >= 2) {
    return data.slice(-2);
  }

  return windowed;
};

const RealTimeLineChart: React.FC<Props> = ({ chartData, xaxisName, yaxisName, xaxisMin, xaxisMax, yaxisMin, yaxisMax, windowSize }: Props) => {
  const nivoTheme = useNivoTheme();
  //   const [isPaused, setIsPaused] = useState(false);
  // TODO: add some ui for windows size selection

  // console.log("RealTimeLineChart re-rendered", new Date().toISOString(), uuidv4());

  // const windowSize = 100;
  // const windowedChartData = chartData.map(serie => ({
  //       ...serie,
  //       data: serie.data.slice(        
  //         -windowSize)
  //     }));

  const windowedChartData = chartData.map(serie => ({
    ...serie,
    data: filterByTimeWindow({
      windowSize: windowSize,
      data: [...serie.data] as Array<{ x: Date; y: number }>
    })
  }));

  // console.log("windowedChartData", windowedChartData);

  if (windowedChartData.length === 0) { return null; }

  return (
    <Box flex="1" minH={0} width="100%">
      <ResponsiveLineCanvas
      theme={nivoTheme}
        // data={chartData}
        data={windowedChartData}
        margin={{ top: 30, right: 30, bottom: 50, left: 80 }}
        // xScale={{ type: "linear", min: "auto", max: "auto" }}
        yFormat=" >-.4f"
        xFormat="time:%Y-%m-%d %H:%M:%S"
        xScale={{ type: "time", min: xaxisMin, max: xaxisMax, format: "native" }}
        yScale={{ type: "linear", min: yaxisMin, max: yaxisMax }}
        // axisBottom={{
        //   legend: "Time",
        //   legendOffset: 36,
        //   legendPosition: "middle",
        // }}
        axisTop={{
          format: "%H:%M:%S",
          tickValues: 4,
          // tickValues: 'every 15 minutes',
        }}
        axisBottom={{
          format: "%H:%M:%S",
          // tickValues: 'every 15 minutes',
          tickValues: 4,
          // legend: `${chartData[0].data[0]?.x} ——— ${chartData[0].data[chartData[0].data.length-1]?.x}}`,
          legend: xaxisName,
          legendPosition: "middle",
          legendOffset: 46,
        }}

        axisLeft={{
          legend: yaxisName,
          legendOffset: -60,
          legendPosition: "middle",
        }}
        enablePoints={false}
        enableSlices="x"
        isInteractive={true}
        enableArea={false}
        areaOpacity={0.1}
        enableCrosshair={true}
        crosshairType="cross"
        curve="monotoneX"

        // tooltip={({ point }) => {
        //   const date = new Date(point.data.x);
        //   const formattedDate = date.toLocaleDateString(undefined, { 
        //     year: 'numeric', 
        //     month: 'numeric', 
        //     day: 'numeric' 
        //   });
        //   const formattedTime = date.toLocaleTimeString(undefined, { 
        //     hour: '2-digit', 
        //     minute: '2-digit', 
        //     second: '2-digit' 
        //   });
        //   return (
        //     <div style={{ background: 'white', padding: '9px 12px', border: '1px solid #ccc' }}>
        //       <div style={{ display: 'flex', alignItems: 'center' }}>
        //         <div style={{ 
        //           width: '12px', 
        //           height: '12px', 
        //           backgroundColor: point.serieColor,
        //           marginRight: '8px'
        //         }}></div>
        //         <strong>{point.serieId}</strong>
        //       </div>
        //       x: <strong>{formattedDate} {formattedTime}</strong><br />
        //       y: <strong>{point.data.yFormatted}</strong>
        //     </div>
        //   );
        // }}

        legends={[
          {
            anchor: "top-right",
            direction: "column",
            justify: false,
            translateX: 0,
            translateY: 0,
            itemsSpacing: 0,
            itemDirection: "left-to-right",
            itemWidth: 80,
            itemHeight: 20,
            itemOpacity: 0.75,
            symbolSize: 12,
            symbolShape: "circle",
            symbolBorderColor: "rgba(0, 0, 0, .5)",
            effects: [
              {
                on: "hover",
                style: {
                  itemBackground: "rgba(0, 0, 0, .03)",
                  itemOpacity: 1,
                },
              },
            ],
          },
        ]}
      />
    </Box>
  );
};

export default RealTimeLineChart;
