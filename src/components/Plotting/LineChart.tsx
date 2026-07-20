import React from "react";
import { Box } from "@chakra-ui/react";
import { ResponsiveLineCanvas } from "@nivo/line";
import { Serie } from "@nivo/line";
import useNivoTheme from "./nivoTheme";

export interface DataPoint {
  x: number | Date;
  y: number | Date;
}

interface Props {
  // data: DataPoint[];
  chartData: Serie[];
  xaxisName: string;
  yaxisName: string;
  xaxisMin: number | "auto";
  xaxisMax: number | "auto";
  yaxisMin: number | "auto";
  yaxisMax: number | "auto";
}

const LineChart: React.FC<Props> = ({
  chartData,
  xaxisName,
  yaxisName,
  xaxisMin,
  xaxisMax,
  yaxisMin,
  yaxisMax,
}: Props) => {
  const nivoTheme = useNivoTheme();
  //   const [isPaused, setIsPaused] = useState(false);
  return (
    <Box flex="1" minH={0} width="100%">
    <ResponsiveLineCanvas
      theme={nivoTheme}
      // data={chartData}
      data={chartData}
      margin={{ top: 30, right: 30, bottom: 50, left: 80 }}
      yFormat=" >-.4f"
      xScale={{ type: "linear", min: xaxisMin, max: xaxisMax }}
      yScale={{ type: "linear", min: yaxisMin, max: yaxisMax }}
      axisBottom={{
        format: ".2f",
        tickValues: 5,
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
      enableSlices={false}
      isInteractive={true}
      enableArea={false}
      areaOpacity={0.1}
      enableCrosshair={true}
      crosshairType="cross"
      curve="monotoneX"
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

export default LineChart;
