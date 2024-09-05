import React, { useEffect, useState } from "react";
import { ResponsiveLine } from "@nivo/line";
import { Box } from "@chakra-ui/react";
import { useColorModeValue } from "@chakra-ui/react";

export interface DataPoint {
  x: number | Date;
  y: number | Date;
}

interface Props {
  data: DataPoint[];
}

const RealTimeLineComponent: React.FC<Props> = ({ data }: Props) => {
  //   const [isPaused, setIsPaused] = useState(false);
  const [windowedData, setWindowedData] = useState<DataPoint[]>([]);

  const bg = useColorModeValue("white", "white");
  const color = useColorModeValue("black", "black");

  useEffect(() => {
    // TODO: add some ui for windows size selection
    // console.log("data", data);
    const windowSize = 100;
    // console.log("windowedData", data.slice(-windowSize));
    setWindowedData(data.slice(-windowSize));
  }, [data]);

  const chartData = [
    {
      id: "realtime-data",
      data: windowedData,
    },
  ];

  return (
    <Box
      boxSize={{
        base: "300px",
        sm: "400px",
        md: "500px",
        lg: "600px",
        xl: "700px",
      }}
      bg={bg}
      color={color}
    >
      <ResponsiveLine
        data={chartData}
        margin={{ top: 50, right: 110, bottom: 50, left: 60 }}
        // xScale={{ type: "linear", min: "auto", max: "auto" }}
        xScale={{ type: "time", min: "auto", max: "auto", format: "native" }}
        yScale={{ type: "linear", min: "auto", max: "auto" }}
        // axisBottom={{
        //   legend: "Time",
        //   legendOffset: 36,
        //   legendPosition: "middle",
        // }}
        axisTop={{
          format: "%H:%M:%S",
          tickValues: 10,
        }}
        axisBottom={{
          format: "%H:%M:%S",
          // tickValues: 'every 4 hours',
          tickValues: 10,
          // legend: `${chartData[0].data[0]?.x} ——— ${chartData[0].data[chartData[0].data.length-1]?.x}}`,
          legend: "Time",
          legendPosition: "middle",
          legendOffset: 46,
        }}

        axisLeft={{
          legend: "Value",
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
            anchor: "bottom-right",
            direction: "column",
            justify: false,
            translateX: 100,
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
