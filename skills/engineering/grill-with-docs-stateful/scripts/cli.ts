import { argv } from 'node:process';

import { asContentHash, asPositiveInteger, type ContentHash, type PositiveInteger } from './lib/types.ts';

export function readOption(name: `--${string}`, args: readonly string[] = argv): string | null {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] ?? null : null;
}

export function requireOption(name: `--${string}`, args: readonly string[] = argv): string {
  const value = readOption(name, args);
  if (value === null || value.length === 0) {
    throw new Error(`Missing ${name} argument.`);
  }

  return value;
}

export function hasFlag(name: `--${string}`, args: readonly string[] = argv): boolean {
  return args.includes(name);
}

export function readCommand(args: readonly string[] = argv): string | null {
  return args[2] ?? null;
}

export function parsePositiveIntegerOption(
  name: `--${string}`,
  fallbackValue: number,
  args: readonly string[] = argv
): PositiveInteger {
  const rawValue = readOption(name, args);
  const numericValue = Number(rawValue ?? fallbackValue);

  if (!Number.isInteger(numericValue) || numericValue < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return asPositiveInteger(numericValue);
}

export function parseExpectedHash(args: readonly string[] = argv): ContentHash {
  return asContentHash(requireOption('--expected-hash', args));
}

export function printJson(payload: unknown): void {
  console.log(JSON.stringify(payload, null, 2));
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}