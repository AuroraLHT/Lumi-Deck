export interface NodeState {    
    is_available: boolean;
    is_running: boolean;
}

export interface StreamNodeState extends NodeState {
    is_streaming: boolean;
}


export interface Node<T extends NodeState> {
    state: T;
    setState: (state: T) => void;
}

export interface StreamNode<T extends StreamNodeState> extends Node<T> {
    setStreaming: (isStreaming: boolean) => void;
}
