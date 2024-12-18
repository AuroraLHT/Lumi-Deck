import { useCallback } from 'react';
import useSSE from './useSSE';
import useRHEEDNodeStore, { RHEEDNodeState } from '../stores/nodes/rheed';
import useRHEEDCameraNodeStore, { RHEEDCameraNodeState } from '../stores/nodes/rheedCamera';
import useChamberLogNodeStore, { ChamberLogNodeState } from '../stores/nodes/chamberLog';
import useDetectorNodeStore, { DetectorNodeState } from '../stores/nodes/detector';
import useSTFTNodeStore, { STFTNodeState } from '../stores/nodes/stft';
import useIntegratorNodeStore, { IntegratorNodeState } from '../stores/nodes/integrator';
import useMIModeNodeStore, { MIModeNodeState } from '../stores/nodes/miMode';

type NodeState = {
  client_name: string;
  state: { [key: string]: string };
}
const suffix = ' State Monitor';

const rheedIntegratorNodeName = 'Live RHEED Integrator' + suffix;
const rheedCameraNodeName = 'Live RHEED Camera' + suffix;
const rheedDetectorNodeName = 'Live RHEED Detection' + suffix;
const rheedSTFTNodeName = 'Live RHEED STFT' + suffix;
const rheedVideoNodeName = 'Live RHEED Video' + suffix;

const chamberLogNodeName = 'Live Chamber Log' + suffix;
const chamberMIModeNodeName = 'MI Mode' + suffix;

const useNodesState = () => {
  const setRHEEDNodeState = useRHEEDNodeStore((s) => s.setState);
  const setRHEEDCameraNodeState = useRHEEDCameraNodeStore((s) => s.setState);
  const setChamberLogNodeState = useChamberLogNodeStore((s) => s.setState);
  const setDetectorNodeState = useDetectorNodeStore((s) => s.setState);
  const setSTFTNodeState = useSTFTNodeStore((s) => s.setState);
  const setIntegratorNodeState = useIntegratorNodeStore((s) => s.setState);
  const setMIModeNodeState = useMIModeNodeStore((s) => s.setState);

  const onMessage = useCallback((event: MessageEvent) => {
    const data : NodeState = JSON.parse(event.data);
    switch (data.client_name) {
      case rheedVideoNodeName:
        // console.log("RHEEDNodeState", data, typeof data);
        // console.log("RHEEDNodeState", data.state, typeof data.state);
        setRHEEDNodeState(data.state as unknown as RHEEDNodeState);
        break;
      case chamberLogNodeName:
        setChamberLogNodeState(data.state as unknown as ChamberLogNodeState);
        break;
      case rheedDetectorNodeName:
        setDetectorNodeState(data.state as unknown as DetectorNodeState);
        break;
      case rheedSTFTNodeName:
        setSTFTNodeState(data.state as unknown as STFTNodeState);
        break;
      case rheedIntegratorNodeName:
        setIntegratorNodeState(data.state as unknown as IntegratorNodeState);
        break;
      case rheedCameraNodeName:
        setRHEEDCameraNodeState(data.state as unknown as RHEEDCameraNodeState);
        break;
      case chamberMIModeNodeName:
        setMIModeNodeState(data.state as unknown as MIModeNodeState);
        break;
      default:
        console.warn(`Unknown client name: "${data.client_name}"`);
    }
  }, []);

  const { isLoading, error } = useSSE("/nodes/state", onMessage);

  return { isLoading, error };
};

export default useNodesState;