export interface BaseMessageHeader {
    // Base interface for message queue headers.
    // Defines required fields that should be present in message headers:
    // - message_type: The type/category of the message
    // - message_timestamp: When the message was created/sent 
    // - message_source: The origin/sender of the message
    message_type: string;
    message_timestamp: string;
    message_source: string;
}

export interface BaseRequestMessageHeader extends BaseMessageHeader {
    // Base interface for request message headers
    request_type: string;
}

export interface BaseResponseMessageHeader extends BaseMessageHeader {
    // Base interface for response message headers
    response_type: string;
    request_type: string;
    succ: boolean;
    error_type: string;
    error_message: string;
}

export interface BaseUpdateMessageHeader extends BaseMessageHeader {
    // Base interface for update message headers
    update_type: string;
}

export interface BaseControlRequestMessageHeader extends BaseMessageHeader {
    // Base interface for control request message headers
    control_request_type: string;
}

export interface BaseControlResponseMessageHeader extends BaseMessageHeader {
    // Base interface for control response message headers
    control_response_type: string;
    control_request_type: string;
    succ: boolean;
    error_type: string;
    error_message: string;
}

export interface BaseStateMessageHeader extends BaseMessageHeader {
    // Base interface for control message headers
    state_type: string;
}

export interface BaseStreamMessageHeader extends BaseMessageHeader {
    stream_type: string;
    succ: boolean;
    error_type: string;
    error_message: string;
}