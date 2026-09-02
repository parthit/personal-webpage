"use client";

import React, { useEffect, useReducer, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Play, Square } from "lucide-react";
import {
  blockPayload,
  highlightTrailingZeros,
  meetsTrailingZeroTarget,
  parseNonceInput,
} from "@/lib/mining/pow";
import {
  initialMiningState,
  miningReducer,
} from "@/lib/mining/session";

async function sha256Hash(input: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function HashDisplay({ hash, zeros }: { hash: string; zeros: number }) {
  const { prefix, zeros: suffix } = highlightTrailingZeros(hash, zeros);
  if (!suffix) return <>{hash}</>;
  return (
    <>
      {prefix}
      <span className="font-bold text-green-600 dark:text-green-400">{suffix}</span>
    </>
  );
}

export default function Blockchain() {
  const [state, dispatch] = useReducer(miningReducer, initialMiningState);
  const [inputNonce, setInputNonce] = useState("");
  const [inputHash, setInputHash] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);

  useEffect(() => {
    if (!state.mining) return;

    let cancelled = false;
    const runId = state.runId;
    const zeros = state.targetZeros;

    const mine = async () => {
      let nonce = 0;
      while (!cancelled) {
        const hash = await sha256Hash(blockPayload(nonce));
        if (cancelled) return;

        if (meetsTrailingZeroTarget(hash, zeros)) {
          dispatch({ type: "FOUND_NONCE", runId, nonce, hash });
          return;
        }

        dispatch({ type: "TICK", runId, nonce, hash });
        nonce += 1;
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    };

    void mine();
    return () => {
      cancelled = true;
    };
  }, [state.mining, state.runId, state.targetZeros]);

  const parsedNonce = parseNonceInput(inputNonce);

  const checkNonceHash = async () => {
    if (parsedNonce === null) {
      setInputHash("");
      setInputError("Enter a whole number nonce (0 or greater).");
      return;
    }
    setInputError(null);
    const hash = await sha256Hash(blockPayload(parsedNonce));
    setInputHash(hash);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-0 sm:p-4">
      <Card className="bg-white shadow-lg dark:bg-gray-800">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
            <h1 className="text-2xl font-bold">
              Blockchain Mining Demonstration (SHA-256)
            </h1>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            The miner hashes <code className="whitespace-nowrap">Block data with nonce: N</code> until
            the hex digest ends with the target number of zeros.
          </p>
          <div className="space-y-3">
            <label
              htmlFor="target-zeros"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Target zeros: {state.targetZeros}
            </label>
            <Slider
              id="target-zeros"
              min={1}
              max={4}
              step={1}
              value={[state.targetZeros]}
              onValueChange={(value) =>
                dispatch({ type: "SET_TARGET_ZEROS", zeros: value[0] ?? 1 })
              }
              disabled={state.mining}
              aria-label="Target trailing zeros"
              className="w-full"
            />
          </div>

          <Button
            onClick={() =>
              dispatch({
                type: state.mining ? "STOP_MINING" : "START_MINING",
              })
            }
            className={`w-40 ${
              state.mining
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-blue-500 text-white hover:bg-blue-600"
            }`}
          >
            {state.mining ? (
              <>
                <Square className="mr-2 h-4 w-4" /> Stop Mining
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" /> Start Mining
              </>
            )}
          </Button>

          <div className="space-y-3 rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Current nonce: {state.currentHash ? state.nonce : "—"}
            </p>
            <p className="break-all text-sm font-medium text-gray-700 dark:text-gray-300">
              Current hash:{" "}
              {state.currentHash ? (
                <HashDisplay hash={state.currentHash} zeros={state.targetZeros} />
              ) : (
                "Not started"
              )}
            </p>
            {state.foundNonce !== null && (
              <div className="mt-4 rounded-lg bg-green-100 p-4 dark:bg-green-900">
                <p className="text-green-800 dark:text-green-200">
                  Found solution! Nonce: {state.foundNonce}
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 space-y-2">
            <label
              htmlFor="check-nonce"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Check hash for a specific nonce
            </label>
            <input
              id="check-nonce"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={inputNonce}
              onChange={(e) => {
                setInputHash("");
                setInputError(null);
                setInputNonce(e.target.value);
              }}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100"
              placeholder="Enter a nonce value"
            />
            <Button
              onClick={() => void checkNonceHash()}
              className="mt-2 bg-green-500 text-white hover:bg-green-600"
            >
              Check Hash
            </Button>
            {inputError ? (
              <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">
                {inputError}
              </p>
            ) : null}
            {inputHash && parsedNonce !== null && (
              <p className="mt-2 break-all text-sm font-medium text-gray-700 dark:text-gray-300">
                Hash for nonce {parsedNonce}:{" "}
                <HashDisplay hash={inputHash} zeros={state.targetZeros} />
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
