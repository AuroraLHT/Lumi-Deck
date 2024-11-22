import { StateCreator } from "zustand";
import {  MiModeExecution, MiModeCommandsList, MiModeExecutionList } from "../../entities/miMode";


export interface MiModeStore {
    executionList: MiModeExecutionList;
    currentExecution: MiModeExecution;
    requestCommandsList: MiModeCommandsList;
    updateExecutionListFromPayload: (payload: MiModeExecutionList) => void;
    updateCurrentExecutionFromPayload: (payload: MiModeExecution) => void;
    updateRegisterCommandFromPayload: (payload: MiModeExecution) => void;
}

const createMiModeSlice: StateCreator<
  MiModeStore,
  [["zustand/immer", never]],
  [],
  MiModeStore
> = (set) => ({
    executionList: [] as MiModeExecutionList,
    requestCommandsList: [] as MiModeExecutionList,
    currentExecution: {
        commands: "",
        commandsUUID: "",
        state: "",
        is_execution_finished: false,
        is_aborted: false,
        is_cleaned_up: false,
        is_stopped: false
    },
    

    updateRegisterCommandFromPayload: (payload: MiModeExecution) => {
        set((state) => {
            const commandIndex = state.requestCommandsList.findIndex(
                command => command.commandsUUID === payload.commandsUUID
            );
            if (commandIndex !== -1) {
                state.requestCommandsList.splice(commandIndex, 1);
            }
            // if (commandIndex !== -1) {
            //     state.requestCommandsList[commandIndex] = {
            //         commands: payload.commands,
            //         commandsUUID: payload.commandsUUID
            //     };
            // }
        });
    },

    updateExecutionListFromPayload: (payload: MiModeExecutionList) => {
        set((state) => {
            state.executionList = payload;
        });
    },

    updateCurrentExecutionFromPayload: (payload: MiModeExecution) => {
        set((state) => {
            state.currentExecution = payload;
        });
    },
});

export default createMiModeSlice;