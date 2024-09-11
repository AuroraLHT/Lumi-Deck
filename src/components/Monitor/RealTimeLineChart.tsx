import React, { useEffect, useState } from "react";
import { ResponsiveLine } from "@nivo/line";
import { Box } from "@chakra-ui/react";
import { useColorModeValue } from "@chakra-ui/react";
import { Serie } from "@nivo/line";

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
}

const RealTimeLineComponent: React.FC<Props> = ({ chartData, xaxisName, yaxisName, xaxisMin, xaxisMax, yaxisMin, yaxisMax }: Props) => {
  //   const [isPaused, setIsPaused] = useState(false);
  const [windowedChartData, setWindowedChartData] = useState<Serie[]>([]);

  const bg = useColorModeValue("white", "white");
  const color = useColorModeValue("black", "black");

  useEffect(() => {
    // TODO: add some ui for windows size selection
    // console.log("data", data);

    const windowSize = 100;
        
    let _chartData = chartData.map(serie => ({
      ...serie,
      data: serie.data.slice(        
        -windowSize)
    }));
    
    
    setWindowedChartData(_chartData);
  }, [chartData]);

  if (windowedChartData.length === 0) { return null; }

  return (
    <Box
      width="100%"
      height={{
        base: "150px",
        sm: "200px",
        md: "250px",
        lg: "300px",
        xl: "350px",
      }}
      bg={bg}
      color={color}
    >
      <ResponsiveLine
        // data={chartData}
        data={windowedChartData}
        margin={{ top: 30, right: 30, bottom: 50, left: 80 }}
        // xScale={{ type: "linear", min: "auto", max: "auto" }}
        yFormat=" >-.4f"
        xScale={{ type: "time", min: xaxisMin, max: xaxisMax, format: "native" }}
        yScale={{ type: "linear", min: yaxisMin, max: yaxisMax }}
        // axisBottom={{
        //   legend: "Time",
        //   legendOffset: 36,
        //   legendPosition: "middle",
        // }}
        axisTop={{
          format: "%H:%M:%S",
          tickValues: 5,
          // tickValues: 'every 15 minutes',
        }}
        axisBottom={{
          format: "%H:%M:%S",
          // tickValues: 'every 15 minutes',
          tickValues: 5,
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
        useMesh={true}
        enableSlices={false}
        animate={false}
        isInteractive={true}
        enableArea={false}
        areaOpacity={0.1}
        enableCrosshair={true}
        crosshairType="cross"
        curve="monotoneX"

        tooltip={({ point }) => {
          const date = new Date(point.data.x);
          const formattedDate = date.toLocaleDateString(undefined, { 
            year: 'numeric', 
            month: 'numeric', 
            day: 'numeric' 
          });
          const formattedTime = date.toLocaleTimeString(undefined, { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
          });
          return (
            <div style={{ background: 'white', padding: '9px 12px', border: '1px solid #ccc' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ 
                  width: '12px', 
                  height: '12px', 
                  backgroundColor: point.serieColor,
                  marginRight: '8px'
                }}></div>
                <strong>{point.serieId}</strong>
              </div>
              x: <strong>{formattedDate} {formattedTime}</strong><br />
              y: <strong>{point.data.yFormatted}</strong>
            </div>
          );
        }}

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

export default RealTimeLineComponent;
