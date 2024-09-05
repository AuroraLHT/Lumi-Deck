import React, { useEffect, useState } from 'react'
import RealTimeLineComponent, {DataPoint} from './RealTimeLineChart'
import useLog from '../../hooks/useChamberLog';

const RealTImePressure = () => {
    const [data, setData] = useState<DataPoint[]>([]);
    const {logs, recentLog} = useLog();
    useEffect(() => {
        // console.log(logsRef.current);
        // console.log(logs);
        setData(logs.map(
            log => (
                {
                    // x: new Date(log['Time']).getTime(),                    
                    x: new Date(log['Time']),
                    y: parseFloat(log['Vac Pres L/L'])  
                })));
    }, [logs, recentLog]);

  return (
    <RealTimeLineComponent data={data} />
  )
}

export default RealTImePressure