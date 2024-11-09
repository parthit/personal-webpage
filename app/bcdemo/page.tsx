"use client";

import React, { useReducer, useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Square } from "lucide-react";

// Type definitions
interface MiningState {
  nonce: number;
  targetZeros: number;
  mining: boolean;
  currentHash: string;
  foundNonce: number | null;
  startTime: number | null;
}

// Initial state
const initialState: MiningState = {
  nonce: 0,
  targetZeros: 1,
  mining: false,
  currentHash: "",
  foundNonce: null,
  startTime: null,
};

// Reducer function to handle state transitions
function miningReducer(state: MiningState, action: any): MiningState {
  switch (action.type) {
    case "START_MINING":
      return { ...state, nonce: 0, mining: true, foundNonce: null, startTime: Date.now() };
    case "STOP_MINING":
      return { ...state, mining: false };
    case "UPDATE_NONCE":
      return { ...state, nonce: action.payload };
    case "UPDATE_HASH":
      return { ...state, currentHash: action.payload };
    case "FOUND_NONCE":
      return { ...state, mining: false, foundNonce: action.payload };
    case "SET_TARGET_ZEROS":
      return { ...state, targetZeros: action.payload };
    default:
      return state;
  }
}

// Helper function for SHA-256 hashing
async function sha256Hash(input: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export default function Blockchain() {
  const [state, dispatch] = useReducer(miningReducer, initialState);
  const [inputNonce, setInputNonce] = useState<string>("");
  const [inputHash, setInputHash] = useState<string>("");

  // Mining logic
  const mine = useCallback(() => {
    let currentNonce = state.nonce;
    const startTime = Date.now();
    dispatch({ type: "UPDATE_MINING_SPEED", payload: 0 });

    const miningInterval = setInterval(async () => {
      if (!state.mining) {
        clearInterval(miningInterval);
        return;
      }

      const hash = await sha256Hash(`Block data with nonce: ${currentNonce}`)

      dispatch({ type: "UPDATE_HASH", payload: hash });
      dispatch({ type: "UPDATE_NONCE", payload: currentNonce });

      // Check if hash ends with required number of zeros
      const regexp = new RegExp(`0{${state.targetZeros}}$`);
      if (regexp.test(hash)) {
        dispatch({ type: "FOUND_NONCE", payload: currentNonce });
        clearInterval(miningInterval);
        return;
      }

      currentNonce++;
    }, 10);

    // Cleanup function
    return () => clearInterval(miningInterval);
  }, [state.mining, state.nonce, state.targetZeros]);

  // Start mining
  const startMining = useCallback(() => {
    dispatch({ type: "START_MINING" });
  }, []);

  // Stop mining
  const stopMining = useCallback(() => {
    dispatch({ type: "STOP_MINING" });
  }, []);

  // Handle target zeros change
  const handleTargetZerosChange = useCallback((value: number[]) => {
    dispatch({ type: "SET_TARGET_ZEROS", payload: value[0] });
  }, []);

  // Handle input nonce change
  const handleInputNonceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputHash("");
    setInputNonce(e.target.value);
  };

  // Check hash for a specific nonce
  const checkNonceHash = async () => {
    const hash = await sha256Hash(`Block data with nonce: ${inputNonce}`);
    setInputHash(hash);
  };

  // Effect to run mining process
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    if (state.mining) {
      cleanup = mine();
    }

    return () => {
      if (cleanup) cleanup();
    };
  }, [state.mining, mine]);

  // Format hash with highlighted trailing zeros
  const formatHashWithTrailingZeros = (hash: string) => {
    const trailingZerosMatch = hash.match(new RegExp(`0{${state.targetZeros}}$`));
    if (trailingZerosMatch) {
      const zerosStartIndex = hash.length - state.targetZeros;
      return (
        <>
          {hash.slice(0, zerosStartIndex)}
          <span className="text-green-500 font-bold">
            {hash.slice(zerosStartIndex)}
          </span>
        </>
      );
    }
    return hash;
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <Card className="bg-white dark:bg-gray-800 shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
            Blockchain Mining Demonstration (SHA-256)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Target Zeros: {state.targetZeros}
            </label>
            <Slider
              min={1}
              max={4}
              step={1}
              value={[state.targetZeros]}
              onValueChange={handleTargetZerosChange}
              disabled={state.mining}
              className="w-full"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <Button
                onClick={state.mining ? stopMining : startMining}
                className={`w-40 ${
                  state.mining
                    ? "bg-red-500 hover:bg-red-600 text-white"
                    : "bg-blue-500 hover:bg-blue-600 text-white"
                }`}
              >
                {state.mining ? (
                  <>
                    <Square className="w-4 h-4 mr-2" /> Stop Mining
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" /> Start Mining
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-3 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Current Nonce: {state.nonce}
            </p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 break-all">
              Current Hash:{" "}
              {state.currentHash
                ? formatHashWithTrailingZeros(state.currentHash)
                : "Not started"}
            </p>
            {state.foundNonce !== null && (
              <div className="mt-4 p-4 bg-green-100 dark:bg-green-900 rounded-lg">
                <p className="text-green-800 dark:text-green-200">
                  Found solution! Nonce: {state.foundNonce}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2 mt-6">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Check Hash for a Specific Nonce:
            </label>
            <input
              type="number"
              value={inputNonce}
              onChange={handleInputNonceChange}
              className="border rounded-lg px-3 py-2 w-full text-black bg-white"
              placeholder="Enter a nonce value"
            />
            <Button
              onClick={checkNonceHash}
              className="mt-2 bg-green-500 hover:bg-green-600 text-white"
            >
              Check Hash
            </Button>
            {inputHash && (
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 break-all mt-2">
                Hash for Nonce {inputNonce}: {formatHashWithTrailingZeros(inputHash)}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
