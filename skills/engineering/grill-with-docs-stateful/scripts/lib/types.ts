import type {
  OptionalMetadataKey,
  RequiredMetadataKey,
  ResumableWorkflowStatus,
  WorkflowStatus,
} from './constants.ts';

export type Brand<Value, Name extends string> = Value & { readonly __brand: Name };

export type StateFilePath = Brand<string, 'StateFilePath'>;
export type PointerFilePath = Brand<string, 'PointerFilePath'>;
export type ContentHash = Brand<string, 'ContentHash'>;
export type QuestionId = Brand<string, 'QuestionId'>;
export type IsoTimestamp = Brand<string, 'IsoTimestamp'>;
export type PositiveInteger = Brand<number, 'PositiveInteger'>;

export type KnownMetadataKey = RequiredMetadataKey | OptionalMetadataKey;
export type StateMetadata = Record<string, string> & Partial<Record<KnownMetadataKey, string>>;

export interface ParsedSection {
  title: string;
  body: string[];
}

export interface QuestionBlock {
  id: QuestionId;
  title: string;
  body: string[];
}

export interface OtherBlock {
  title: string;
  lines: string[];
}

export interface QuestionListItem {
  id: QuestionId;
  text: string;
}

export interface ParsedState {
  title: string;
  preamble: string[];
  sections: ParsedSection[];
  sectionMap: Map<string, ParsedSection>;
  metadata: StateMetadata;
  resolvedQuestions: QuestionBlock[];
  resolvedOtherBlocks: OtherBlock[];
  openQuestions: QuestionBlock[];
  openOtherBlocks: OtherBlock[];
  nextQuestions: QuestionListItem[];
  upcomingQuestions: QuestionListItem[];
  contentHash: ContentHash;
  source: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface RepairResult {
  repaired: ParsedState;
  repairedMarkdown: string;
  changes: string[];
  ambiguities: string[];
  needsConfirmation: boolean;
}

export interface CompactionResult {
  changed: boolean;
  parsedState: ParsedState;
  compactedIds: QuestionId[];
  compactedMarkdown: string;
}

export interface PointerRecord {
  path: StateFilePath | null;
  status: ResumableWorkflowStatus | null;
  description: string | null;
}

export type PointerReadResult =
  | { ok: true; pointer: PointerRecord; error: null }
  | { ok: false; pointer: PointerRecord; error: string };

export interface UpdatePointerResult {
  pointer: PointerRecord;
  stateStatus: WorkflowStatus | null;
}

export function asStateFilePath(value: string): StateFilePath {
  return value as StateFilePath;
}

export function asPointerFilePath(value: string): PointerFilePath {
  return value as PointerFilePath;
}

export function asContentHash(value: string): ContentHash {
  return value as ContentHash;
}

export function asQuestionId(value: string): QuestionId {
  return value as QuestionId;
}

export function asIsoTimestamp(value: string): IsoTimestamp {
  return value as IsoTimestamp;
}

export function asPositiveInteger(value: number): PositiveInteger {
  return value as PositiveInteger;
}

export function isQuestionId(value: string): value is QuestionId {
  return /^Q-\d{3}$/u.test(value);
}

export function isIsoTimestamp(value: string): value is IsoTimestamp {
  return !Number.isNaN(Date.parse(value));
}
