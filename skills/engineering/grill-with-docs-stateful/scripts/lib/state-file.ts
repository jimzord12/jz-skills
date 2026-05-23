import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import {
  FORMAT_VERSION,
  REQUIRED_METADATA_KEYS,
  REQUIRED_SECTION_ORDER,
  isRequiredSectionTitle,
  isWorkflowStatus,
} from './constants.ts';
import {
  asContentHash,
  asIsoTimestamp,
  asPositiveInteger,
  asQuestionId,
  isQuestionId,
  type CompactionResult,
  type ContentHash,
  type IsoTimestamp,
  type OtherBlock,
  type ParsedSection,
  type ParsedState,
  type PositiveInteger,
  type QuestionBlock,
  type QuestionId,
  type QuestionListItem,
  type RepairResult,
  type StateFilePath,
  type StateMetadata,
  type ValidationResult,
} from './types.ts';

interface SplitMarkdownResult {
  title: string;
  preamble: string[];
  sections: ParsedSection[];
}

interface ParsedQuestionBlocks {
  questions: QuestionBlock[];
  otherBlocks: OtherBlock[];
}

const METADATA_LINE_PATTERN = /^-\s+([^:]+):\s*(.*)$/u;
const QUESTION_HEADING_PATTERN = /^###\s+(Q-\d{3}):\s+(.*)$/u;
const SUBHEADING_PATTERN = /^###\s+(.*)$/u;
const QUESTION_LIST_PATTERN = /^-\s+(Q-\d{3}):\s+(.*)$/u;

function parseRecoverableQuestionHeading(line: string): { id: QuestionId; title: string } | null {
  const match = /^###\s+(Q-\d{3})(?::\s*|\s+)(.+)$/u.exec(line);
  if (match === null) {
    return null;
  }

  const [, rawId = '', rawTitle = ''] = match;
  const title = rawTitle.trim();

  if (title.length === 0) {
    return null;
  }

  return { id: asQuestionId(rawId), title };
}

function parseRecoverableQuestionListItem(line: string): { id: QuestionId; text: string } | null {
  const match = /^-\s+(Q-\d{3})(?::\s*|\s+)(.+)$/u.exec(line);
  if (match === null) {
    return null;
  }

  const [, rawId = '', rawText = ''] = match;
  const text = rawText.trim();

  if (text.length === 0) {
    return null;
  }

  return { id: asQuestionId(rawId), text };
}

function trimBlankLines(lines: readonly string[]): string[] {
  let start = 0;
  let end = lines.length;

  while (start < end && lines[start]?.trim() === '') {
    start += 1;
  }

  while (end > start && lines[end - 1]?.trim() === '') {
    end -= 1;
  }

  return lines.slice(start, end);
}

function splitIntoSections(markdown: string): SplitMarkdownResult {
  const lines = markdown.replace(/\r\n/gu, '\n').split('\n');
  let title = '';
  const preamble: string[] = [];
  const sections: ParsedSection[] = [];
  let currentSection: ParsedSection | null = null;

  for (const line of lines) {
    if (title.length === 0 && line.startsWith('# ')) {
      title = line.slice(2).trim();
      continue;
    }

    if (line.startsWith('## ')) {
      if (currentSection !== null) {
        sections.push({ ...currentSection, body: trimBlankLines(currentSection.body) });
      }

      currentSection = { title: line.slice(3).trim(), body: [] };
      continue;
    }

    if (currentSection !== null) {
      currentSection.body.push(line);
      continue;
    }

    preamble.push(line);
  }

  if (currentSection !== null) {
    sections.push({ ...currentSection, body: trimBlankLines(currentSection.body) });
  }

  return { title, preamble: trimBlankLines(preamble), sections };
}

function parseMetadata(lines: readonly string[]): StateMetadata {
  const metadata: StateMetadata = {};

  for (const line of lines) {
    const match = METADATA_LINE_PATTERN.exec(line);
    if (match === null) {
      continue;
    }

    const [, rawKey = '', rawValue = ''] = match;
    metadata[rawKey.trim()] = rawValue.trim();
  }

  return metadata;
}

function parseQuestionBlocks(lines: readonly string[]): ParsedQuestionBlocks {
  const questions: QuestionBlock[] = [];
  const otherBlocks: OtherBlock[] = [];
  let currentQuestion: QuestionBlock | null = null;
  let currentOtherBlock: OtherBlock | null = null;

  const flushQuestion = (): void => {
    if (currentQuestion === null) {
      return;
    }

    questions.push({ ...currentQuestion, body: trimBlankLines(currentQuestion.body) });
    currentQuestion = null;
  };

  const flushOther = (): void => {
    if (currentOtherBlock === null) {
      return;
    }

    const normalizedBlock: OtherBlock = {
      ...currentOtherBlock,
      lines: trimBlankLines(currentOtherBlock.lines),
    };

    if (normalizedBlock.title.length > 0 || normalizedBlock.lines.length > 0) {
      otherBlocks.push(normalizedBlock);
    }

    currentOtherBlock = null;
  };

  for (const line of lines) {
    const questionHeading = parseRecoverableQuestionHeading(line);
    if (questionHeading !== null) {
      flushQuestion();
      flushOther();
      currentQuestion = { id: questionHeading.id, title: questionHeading.title, body: [] };
      continue;
    }

    const subheadingMatch = SUBHEADING_PATTERN.exec(line);
    if (subheadingMatch !== null) {
      const [, rawTitle = ''] = subheadingMatch;
      flushQuestion();
      flushOther();
      currentOtherBlock = { title: rawTitle.trim(), lines: [] };
      continue;
    }

    if (currentQuestion !== null) {
      currentQuestion.body.push(line);
      continue;
    }

    if (currentOtherBlock === null) {
      currentOtherBlock = { title: '', lines: [] };
    }

    currentOtherBlock.lines.push(line);
  }

  flushQuestion();
  flushOther();

  return { questions, otherBlocks };
}

function parseQuestionList(lines: readonly string[]): QuestionListItem[] {
  const items: QuestionListItem[] = [];

  for (const line of lines) {
    const item = parseRecoverableQuestionListItem(line);
    if (item === null) {
      continue;
    }

    items.push(item);
  }

  return items;
}

function buildSectionMap(sections: readonly ParsedSection[]): Map<string, ParsedSection> {
  return new Map(sections.map(section => [section.title, section]));
}

function getSectionLines(sectionMap: ReadonlyMap<string, ParsedSection>, title: string): string[] {
  return sectionMap.get(title)?.body ?? [];
}

function formatQuestionBlocks(
  questions: readonly QuestionBlock[],
  otherBlocks: readonly OtherBlock[]
): string[] {
  const lines: string[] = [];

  for (const block of otherBlocks) {
    if (block.title.length > 0) {
      lines.push(`### ${block.title}`);
      if (block.lines.length > 0) {
        lines.push('');
      }
    }

    lines.push(...block.lines);
    lines.push('');
  }

  for (const question of questions) {
    lines.push(`### ${question.id}: ${question.title}`);
    lines.push('');

    if (question.body.length > 0) {
      lines.push(...question.body);
      lines.push('');
    }
  }

  return trimBlankLines(lines);
}

function formatQuestionList(items: readonly QuestionListItem[], fallbackLine: string): string[] {
  if (items.length === 0) {
    return [fallbackLine];
  }

  return items.map(item => `- ${item.id}: ${item.text}`);
}

function toIsoTimestamp(value: string): IsoTimestamp {
  return asIsoTimestamp(value);
}

function nextQuestionId(existingIds: readonly QuestionId[]): QuestionId {
  const max = existingIds.reduce((currentMax, questionId) => {
    const numericPortion = Number(questionId.replace('Q-', ''));
    return Number.isInteger(numericPortion) && numericPortion > currentMax
      ? numericPortion
      : currentMax;
  }, 0);

  return asQuestionId(`Q-${String(max + 1).padStart(3, '0')}`);
}

function defaultSectionBody(sectionTitle: (typeof REQUIRED_SECTION_ORDER)[number]): string[] {
  switch (sectionTitle) {
    case 'Resume Brief':
      return ['Recovered state file. Review this summary before resuming.'];
    case 'Session Metadata': {
      const now = new Date().toISOString();
      return [
        `- Format version: ${FORMAT_VERSION}`,
        '- Status: paused',
        `- Created at: ${now}`,
        `- Updated at: ${now}`,
        '- Chat sessions touched: 1',
      ];
    }
    case 'User Preferences':
      return ['### Communication', '', '- Use simple language.'];
    case 'Resolved Questions':
      return ['### Compacted Summary', '', '- None recorded yet.'];
    case 'Open Questions':
      return ['### Q-001: Recovery follow-up', '', '- Status: open'];
    case 'Next Question':
      return ['- Q-001: Review the recovered state and choose the next question.'];
    case 'Upcoming Questions':
      return ['- Q-002: Add the next likely follow-up question.'];
    case 'Artifact Updates':
      return ['- None recorded yet.'];
  }
}

function mergeSectionsWithRequiredOrder(sections: readonly ParsedSection[]): ParsedSection[] {
  const sectionMap = buildSectionMap(sections);
  const orderedSections = REQUIRED_SECTION_ORDER.map(sectionTitle => ({
    title: sectionTitle,
    body: sectionMap.get(sectionTitle)?.body ?? defaultSectionBody(sectionTitle),
  }));

  const extraSections = sections.filter(section => !isRequiredSectionTitle(section.title));
  return [...orderedSections, ...extraSections];
}

export function parseStateMarkdown(markdown: string): ParsedState {
  const { title, preamble, sections } = splitIntoSections(markdown);
  const sectionMap = buildSectionMap(sections);
  const resolved = parseQuestionBlocks(getSectionLines(sectionMap, 'Resolved Questions'));
  const open = parseQuestionBlocks(getSectionLines(sectionMap, 'Open Questions'));

  return {
    title,
    preamble,
    sections,
    sectionMap,
    metadata: parseMetadata(getSectionLines(sectionMap, 'Session Metadata')),
    resolvedQuestions: resolved.questions,
    resolvedOtherBlocks: resolved.otherBlocks,
    openQuestions: open.questions,
    openOtherBlocks: open.otherBlocks,
    nextQuestions: parseQuestionList(getSectionLines(sectionMap, 'Next Question')),
    upcomingQuestions: parseQuestionList(getSectionLines(sectionMap, 'Upcoming Questions')),
    contentHash: hashContent(markdown),
    source: markdown,
  };
}

export function validateParsedState(parsedState: ParsedState): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (parsedState.title.length === 0) {
    errors.push('Missing top-level title heading.');
  }

  const actualRequiredSectionOrder = parsedState.sections
    .map(section => section.title)
    .filter(isRequiredSectionTitle);

  for (const sectionTitle of REQUIRED_SECTION_ORDER) {
    if (!parsedState.sectionMap.has(sectionTitle)) {
      errors.push(`Missing required section: ${sectionTitle}.`);
    }
  }

  const expectedOrder = REQUIRED_SECTION_ORDER.join(' > ');
  const actualOrder = actualRequiredSectionOrder.join(' > ');

  if (actualRequiredSectionOrder.length > 0 && actualOrder !== expectedOrder) {
    errors.push(`Required sections are out of order. Expected ${expectedOrder}.`);
  }

  for (const key of REQUIRED_METADATA_KEYS) {
    if (!parsedState.metadata[key]) {
      errors.push(`Missing required metadata key: ${key}.`);
    }
  }

  const status = parsedState.metadata.Status;
  if (status && !isWorkflowStatus(status)) {
    errors.push(`Invalid status: ${status}.`);
  }

  const touchedValue = parsedState.metadata['Chat sessions touched'];
  const touchedCount = Number(touchedValue);
  if (touchedValue && (!Number.isInteger(touchedCount) || touchedCount < 0)) {
    errors.push('Chat sessions touched must be a non-negative integer.');
  }

  if (parsedState.nextQuestions.length !== 1) {
    errors.push('Next Question must contain exactly one Q-XXX bullet.');
  }

  const trackedIds = [
    ...parsedState.resolvedQuestions.map(question => question.id),
    ...parsedState.openQuestions.map(question => question.id),
  ];

  const duplicateIds = trackedIds.filter(
    (questionId, index) => trackedIds.indexOf(questionId) !== index
  );

  if (duplicateIds.length > 0) {
    errors.push(`Duplicate question ids: ${[...new Set(duplicateIds)].join(', ')}.`);
  }

  const knownQuestionIds = new Set(trackedIds);

  for (const question of parsedState.nextQuestions) {
    if (!knownQuestionIds.has(question.id)) {
      errors.push(`Next Question references unknown question id ${question.id}.`);
    }
  }

  for (const question of parsedState.upcomingQuestions) {
    if (!knownQuestionIds.has(question.id)) {
      warnings.push(`Upcoming Questions references unknown question id ${question.id}.`);
    }
  }

  if (
    parsedState.upcomingQuestions.some(question =>
      parsedState.nextQuestions.some(nextQuestion => nextQuestion.id === question.id)
    )
  ) {
    warnings.push('Upcoming Questions repeats the current next-question id.');
  }

  if (parsedState.upcomingQuestions.length > 5) {
    warnings.push('Upcoming Questions is longer than 5 items.');
  }

  if (parsedState.resolvedQuestions.length === 0) {
    warnings.push('Resolved Questions has no detailed question entries yet.');
  }

  const createdAt = parsedState.metadata['Created at'];
  if (createdAt && !Number.isNaN(Date.parse(createdAt))) {
    toIsoTimestamp(createdAt);
  }

  const updatedAt = parsedState.metadata['Updated at'];
  if (updatedAt && !Number.isNaN(Date.parse(updatedAt))) {
    toIsoTimestamp(updatedAt);
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function serializeStateMarkdown(parsedState: ParsedState): string {
  const metadata: StateMetadata = {
    'Format version': parsedState.metadata['Format version'] ?? FORMAT_VERSION,
    Status: parsedState.metadata.Status ?? 'paused',
    'Created at': parsedState.metadata['Created at'] ?? new Date().toISOString(),
    'Updated at': parsedState.metadata['Updated at'] ?? new Date().toISOString(),
    'Chat sessions touched': parsedState.metadata['Chat sessions touched'] ?? '1',
  };

  const optionalKeys = ['Session id', 'Last loaded at', 'Last writer'] as const;
  for (const key of optionalKeys) {
    const value = parsedState.metadata[key];
    if (value) {
      metadata[key] = value;
    }
  }

  const sectionBodies = new Map<string, string[]>([
    [
      'Resume Brief',
      getSectionLines(parsedState.sectionMap, 'Resume Brief').length > 0
        ? getSectionLines(parsedState.sectionMap, 'Resume Brief')
        : ['Resume summary still needs review.'],
    ],
    ['Session Metadata', Object.entries(metadata).map(([key, value]) => `- ${key}: ${value}`)],
    [
      'User Preferences',
      getSectionLines(parsedState.sectionMap, 'User Preferences').length > 0
        ? getSectionLines(parsedState.sectionMap, 'User Preferences')
        : [
            '### Communication',
            '',
            '- Use simple language.',
            '',
            '### Process',
            '',
            '- Ask one question at a time.',
          ],
    ],
    [
      'Resolved Questions',
      formatQuestionBlocks(parsedState.resolvedQuestions, parsedState.resolvedOtherBlocks),
    ],
    [
      'Open Questions',
      formatQuestionBlocks(parsedState.openQuestions, parsedState.openOtherBlocks),
    ],
    [
      'Next Question',
      formatQuestionList(parsedState.nextQuestions, '- Q-001: Define the next question.'),
    ],
    [
      'Upcoming Questions',
      formatQuestionList(parsedState.upcomingQuestions, '- Q-002: Add the next likely question.'),
    ],
    [
      'Artifact Updates',
      getSectionLines(parsedState.sectionMap, 'Artifact Updates').length > 0
        ? getSectionLines(parsedState.sectionMap, 'Artifact Updates')
        : ['- None recorded yet.'],
    ],
  ]);

  const extraSections = parsedState.sections.filter(
    section => !isRequiredSectionTitle(section.title)
  );
  const lines: string[] = [`# ${parsedState.title || 'Untitled grilling session'}`, ''];

  for (const sectionTitle of REQUIRED_SECTION_ORDER) {
    lines.push(`## ${sectionTitle}`);
    lines.push('');
    lines.push(...(sectionBodies.get(sectionTitle) ?? defaultSectionBody(sectionTitle)));
    lines.push('');
  }

  for (const section of extraSections) {
    lines.push(`## ${section.title}`);
    lines.push('');
    lines.push(...section.body);
    lines.push('');
  }

  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  lines.push('');
  return lines.join('\n');
}

export function repairParsedState(
  parsedState: ParsedState,
  now: IsoTimestamp | string = new Date().toISOString()
): RepairResult {
  const changes: string[] = [];
  const ambiguities: string[] = [];
  const normalizedNow = typeof now === 'string' ? toIsoTimestamp(now) : now;
  const repaired: ParsedState = {
    ...parsedState,
    title: parsedState.title || 'Recovered grilling session',
    metadata: { ...parsedState.metadata },
    sections: parsedState.sections.map(section => ({ ...section, body: [...section.body] })),
    sectionMap: new Map(parsedState.sectionMap),
    resolvedQuestions: parsedState.resolvedQuestions.map(question => ({
      ...question,
      body: [...question.body],
    })),
    resolvedOtherBlocks: parsedState.resolvedOtherBlocks.map(block => ({
      ...block,
      lines: [...block.lines],
    })),
    openQuestions: parsedState.openQuestions.map(question => ({
      ...question,
      body: [...question.body],
    })),
    openOtherBlocks: parsedState.openOtherBlocks.map(block => ({
      ...block,
      lines: [...block.lines],
    })),
    nextQuestions: parsedState.nextQuestions.map(question => ({ ...question })),
    upcomingQuestions: parsedState.upcomingQuestions.map(question => ({ ...question })),
    source: parsedState.source,
    contentHash: parsedState.contentHash,
  };

  const duplicateRequiredSections = [
    ...new Set(
      parsedState.sections
        .map(section => section.title)
        .filter(
          (sectionTitle, index, titles) =>
            isRequiredSectionTitle(sectionTitle) && titles.indexOf(sectionTitle) !== index
        )
    ),
  ];

  if (duplicateRequiredSections.length > 0) {
    ambiguities.push(`Found duplicate required sections: ${duplicateRequiredSections.join(', ')}.`);
  }

  if (parsedState.title.length === 0) {
    changes.push('Added a recovery title.');
  }

  const resumeLines = getSectionLines(parsedState.sectionMap, 'Resume Brief');
  if (resumeLines.length === 0) {
    repaired.sections = repaired.sections.filter(section => section.title !== 'Resume Brief');
    repaired.sections.unshift({
      title: 'Resume Brief',
      body: ['Recovered state file. Review the summary before continuing.'],
    });
    changes.push('Rebuilt the Resume Brief section.');
  }

  for (const sectionTitle of REQUIRED_SECTION_ORDER) {
    if (!parsedState.sectionMap.has(sectionTitle)) {
      repaired.sections.push({ title: sectionTitle, body: defaultSectionBody(sectionTitle) });
      changes.push(`Recreated missing section ${sectionTitle}.`);
    }
  }

  repaired.metadata['Format version'] ??= FORMAT_VERSION;
  repaired.metadata.Status ??= 'paused';
  repaired.metadata['Created at'] ??= normalizedNow;
  repaired.metadata['Updated at'] ??= normalizedNow;
  repaired.metadata['Chat sessions touched'] ??= String(asPositiveInteger(1));

  for (const key of REQUIRED_METADATA_KEYS) {
    if (!parsedState.metadata[key]) {
      changes.push(`Filled missing metadata key ${key}.`);
    }
  }

  const repairedStatus = repaired.metadata.Status;
  if (repairedStatus && !isWorkflowStatus(repairedStatus)) {
    ambiguities.push(`Status ${repairedStatus} is invalid. Resetting to paused.`);
    repaired.metadata.Status = 'paused';
  }

  const seenIds = new Set<QuestionId>([
    ...repaired.resolvedQuestions.map(question => question.id),
    ...repaired.openQuestions.map(question => question.id),
  ]);

  if (repaired.nextQuestions.length === 0) {
    const firstOpenQuestion = repaired.openQuestions[0];

    if (firstOpenQuestion) {
      repaired.nextQuestions = [{ id: firstOpenQuestion.id, text: firstOpenQuestion.title }];
    } else {
      const fallbackId = nextQuestionId([...seenIds]);
      seenIds.add(fallbackId);
      repaired.openQuestions.push({
        id: fallbackId,
        title: 'Recovery follow-up',
        body: [
          '- Status: open',
          '- Notes: Review the recovered state and choose the next question.',
        ],
      });
      repaired.nextQuestions = [{ id: fallbackId, text: 'Recovery follow-up' }];
    }

    changes.push('Rebuilt the Next Question section.');
  } else if (repaired.nextQuestions.length > 1) {
    ambiguities.push('Next Question had multiple entries. Keeping the first one only.');
    const [firstNextQuestion] = repaired.nextQuestions;
    if (firstNextQuestion) {
      repaired.nextQuestions = [firstNextQuestion];
    }
  }

  if (repaired.upcomingQuestions.length === 0) {
    const existingUpcomingCandidates = repaired.openQuestions.filter(
      question => !repaired.nextQuestions.some(nextQuestion => nextQuestion.id === question.id)
    );

    if (existingUpcomingCandidates.length > 0) {
      repaired.upcomingQuestions = existingUpcomingCandidates
        .slice(0, 3)
        .map(question => ({ id: question.id, text: question.title }));
    } else {
      const fallbackId = nextQuestionId([
        ...seenIds,
        ...repaired.nextQuestions.map(question => question.id),
      ]);
      repaired.openQuestions.push({
        id: fallbackId,
        title: 'Add the next likely follow-up question.',
        body: ['- Status: open'],
      });
      repaired.upcomingQuestions = [
        { id: fallbackId, text: 'Add the next likely follow-up question.' },
      ];
    }

    changes.push('Rebuilt the Upcoming Questions section.');
  }

  repaired.sections = mergeSectionsWithRequiredOrder(repaired.sections);
  repaired.sectionMap = buildSectionMap(repaired.sections);
  const repairedMarkdown = serializeStateMarkdown(repaired);
  const repairedParsedState = parseStateMarkdown(repairedMarkdown);

  return {
    repaired: repairedParsedState,
    repairedMarkdown,
    changes,
    ambiguities,
    needsConfirmation: ambiguities.length > 0,
  };
}

export function compactParsedState(
  parsedState: ParsedState,
  resolvedLimit: PositiveInteger | number = 6
): CompactionResult {
  const normalizedResolvedLimit = typeof resolvedLimit === 'number' ? resolvedLimit : resolvedLimit;

  if (parsedState.resolvedQuestions.length <= normalizedResolvedLimit) {
    return { changed: false, parsedState, compactedIds: [], compactedMarkdown: parsedState.source };
  }

  const questionsToCompact = parsedState.resolvedQuestions.slice(
    0,
    parsedState.resolvedQuestions.length - normalizedResolvedLimit
  );
  const questionsToKeep = parsedState.resolvedQuestions.slice(-normalizedResolvedLimit);
  const summaryLines = questionsToCompact.map(question => {
    const summaryBody = question.body
      .map(line => line.replace(/^-\s+/u, '').trim())
      .filter(line => line.length > 0)
      .join(' ')
      .replace(/\s+/gu, ' ')
      .trim();

    return `- ${question.id}: ${question.title}${summaryBody ? ` -- ${summaryBody}` : ''}`;
  });

  const existingSummaryBlockIndex = parsedState.resolvedOtherBlocks.findIndex(
    block => block.title === 'Compacted Summary'
  );

  const resolvedOtherBlocks = parsedState.resolvedOtherBlocks.map(block => ({
    ...block,
    lines: [...block.lines],
  }));

  if (existingSummaryBlockIndex >= 0) {
    const existingBlock = resolvedOtherBlocks[existingSummaryBlockIndex];
    if (existingBlock) {
      resolvedOtherBlocks[existingSummaryBlockIndex] = {
        title: 'Compacted Summary',
        lines: [...existingBlock.lines, ...summaryLines],
      };
    }
  } else {
    resolvedOtherBlocks.unshift({ title: 'Compacted Summary', lines: summaryLines });
  }

  const compactedMarkdown = serializeStateMarkdown({
    ...parsedState,
    resolvedQuestions: questionsToKeep,
    resolvedOtherBlocks,
  });
  const compactedState = parseStateMarkdown(compactedMarkdown);

  return {
    changed: true,
    parsedState: compactedState,
    compactedIds: questionsToCompact.map(question => question.id),
    compactedMarkdown,
  };
}

export function hashContent(content: string): ContentHash {
  return asContentHash(createHash('sha256').update(content, 'utf8').digest('hex'));
}

export async function readStateFile(filePath: StateFilePath | string): Promise<string> {
  return readFile(filePath, 'utf8');
}

export async function loadParsedState(filePath: StateFilePath | string): Promise<ParsedState> {
  return parseStateMarkdown(await readStateFile(filePath));
}

export { buildSectionMap, getSectionLines, isQuestionId };
