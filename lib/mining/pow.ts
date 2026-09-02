/** Helpers for the SHA-256 proof-of-work demo at `/bcdemo`. */

export function blockPayload(nonce: number): string {
  return `Block data with nonce: ${nonce}`;
}

export function parseNonceInput(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (!/^-?\d+$/.test(trimmed)) return null;
  const nonce = Number(trimmed);
  if (!Number.isSafeInteger(nonce) || nonce < 0) return null;
  return nonce;
}

export function meetsTrailingZeroTarget(hash: string, zeros: number): boolean {
  if (zeros <= 0) return true;
  if (hash.length < zeros) return false;
  return hash.slice(-zeros) === "0".repeat(zeros);
}

export function highlightTrailingZeros(hash: string, zeros: number) {
  if (!meetsTrailingZeroTarget(hash, zeros)) {
    return { prefix: hash, zeros: "" };
  }
  return {
    prefix: hash.slice(0, hash.length - zeros),
    zeros: hash.slice(hash.length - zeros),
  };
}
