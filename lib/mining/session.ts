export type MiningState = {
  nonce: number;
  targetZeros: number;
  mining: boolean;
  currentHash: string;
  foundNonce: number | null;
  /** Incremented on start so in-flight hashes cannot land on a later run. */
  runId: number;
};

export type MiningAction =
  | { type: "START_MINING" }
  | { type: "STOP_MINING" }
  | { type: "TICK"; runId: number; nonce: number; hash: string }
  | { type: "FOUND_NONCE"; runId: number; nonce: number; hash: string }
  | { type: "SET_TARGET_ZEROS"; zeros: number };

export const initialMiningState: MiningState = {
  nonce: 0,
  targetZeros: 1,
  mining: false,
  currentHash: "",
  foundNonce: null,
  runId: 0,
};

export function miningReducer(
  state: MiningState,
  action: MiningAction
): MiningState {
  switch (action.type) {
    case "START_MINING":
      return {
        ...state,
        nonce: 0,
        mining: true,
        foundNonce: null,
        currentHash: "",
        runId: state.runId + 1,
      };
    case "STOP_MINING":
      return { ...state, mining: false, runId: state.runId + 1 };
    case "TICK":
      if (!state.mining || action.runId !== state.runId) return state;
      return { ...state, nonce: action.nonce, currentHash: action.hash };
    case "FOUND_NONCE":
      if (!state.mining || action.runId !== state.runId) return state;
      return {
        ...state,
        mining: false,
        nonce: action.nonce,
        currentHash: action.hash,
        foundNonce: action.nonce,
      };
    case "SET_TARGET_ZEROS":
      return { ...state, targetZeros: action.zeros };
    default:
      return state;
  }
}
