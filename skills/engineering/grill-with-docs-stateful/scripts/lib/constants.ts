export const FORMAT_VERSION = '1' as const;

export const VALID_STATUSES = ['active', 'paused', 'completed', 'abandoned'] as const;
export type WorkflowStatus = (typeof VALID_STATUSES)[number];

export const REQUIRED_SECTION_ORDER = [
  'Resume Brief',
  'Session Metadata',
  'User Preferences',
  'Resolved Questions',
  'Open Questions',
  'Next Question',
  'Upcoming Questions',
  'Artifact Updates',
] as const;
export type RequiredSectionTitle = (typeof REQUIRED_SECTION_ORDER)[number];

export const REQUIRED_METADATA_KEYS = [
  'Format version',
  'Status',
  'Created at',
  'Updated at',
  'Chat sessions touched',
] as const;
export type RequiredMetadataKey = (typeof REQUIRED_METADATA_KEYS)[number];

export const OPTIONAL_METADATA_KEYS = [
  'Session id',
  'Last loaded at',
  'Last writer',
] as const;
export type OptionalMetadataKey = (typeof OPTIONAL_METADATA_KEYS)[number];

export type ResumableWorkflowStatus = Extract<WorkflowStatus, 'active' | 'paused'>;

const VALID_STATUS_SET = new Set<string>(VALID_STATUSES);
const REQUIRED_SECTION_SET = new Set<string>(REQUIRED_SECTION_ORDER);

export const POINTER_EMPTY_RECORD = {
  path: null,
  status: null,
  description: null,
} as const;

export function isWorkflowStatus(value: string): value is WorkflowStatus {
  return VALID_STATUS_SET.has(value);
}

export function isResumableWorkflowStatus(value: WorkflowStatus): value is ResumableWorkflowStatus {
  return value === 'active' || value === 'paused';
}

export function isRequiredSectionTitle(value: string): value is RequiredSectionTitle {
  return REQUIRED_SECTION_SET.has(value);
}