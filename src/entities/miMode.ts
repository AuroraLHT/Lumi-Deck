export interface MiModeCommands {
    commands: string;
    commandsUUID : string;
}

export interface MiModeExecution extends MiModeCommands {
    state: string;
    is_execution_finished: boolean;
    is_aborted: boolean;
    is_cleaned_up: boolean;
    is_stopped: boolean;
}

export type MiModeCommandsList = MiModeCommands[]

export type MiModeExecutionList = MiModeExecution[]

export interface MiModeHeader {
    type: string;
    success: boolean;
}

