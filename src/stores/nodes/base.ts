export interface NodeState {    
    is_available: boolean;
    is_running: boolean;
}

export interface StreamNodeState extends NodeState {
    is_streaming: boolean;
}


export interface Node<T extends NodeState> {
    state: T;
    /**
     * Merges into the current state (`Object.assign`), so callers may send only
     * the fields they know about -- the registry reports a capability's liveness
     * separately from details like frame dimensions.
     */
    setState: (state: Partial<T>) => void;
}

export interface StreamNode<T extends StreamNodeState> extends Node<T> {
    setStreaming: (isStreaming: boolean) => void;
}
