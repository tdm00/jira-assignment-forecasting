import type { FieldChange, JiraChange, RankChange } from '../core/jiraChanges';
import type { Settings } from '../core/types';

export const PAT_VARIABLE = 'JIRA_PAT';

export type ScriptSettings = Pick<
  Settings,
  | 'jiraBaseUrl'
  | 'storyPointsField'
  | 'slaDaysField'
  | 'architectField'
  | 'architectFieldType'
  | 'targetStartField'
  | 'targetEndField'
  | 'exportRankChanges'
>;

export interface SkippedChange {
  change: JiraChange;
  reason: string;
}

/** All field changes for one issue, sent as a single update. */
export interface IssueUpdate {
  key: string;
  fields: Record<string, unknown>;
  changes: FieldChange[];
}

export interface UpdatePlan {
  issues: IssueUpdate[];
  ranks: RankChange[];
  skipped: SkippedChange[];
}

const FIELD_LABELS: Record<FieldChange['kind'], string> = {
  storyPoints: 'Story points',
  slaDays: 'SLA days',
  architect: 'Architect',
  targetStart: 'Target start',
  targetEnd: 'Target end',
};

const FIELD_SETTINGS = {
  storyPoints: 'storyPointsField',
  slaDays: 'slaDaysField',
  architect: 'architectField',
  targetStart: 'targetStartField',
  targetEnd: 'targetEndField',
} as const satisfies Record<FieldChange['kind'], keyof ScriptSettings>;

export function normalizeBaseUrl(raw: string): string {
  const url = raw.trim().replace(/\/+$/, '');
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/** Single-quotes for bash and zsh; nothing inside is expanded. */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** curl `-w` treats `%` and `\` as format characters. */
function writeOutText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '%%');
}

function curl(method: string, url: string, body: unknown, label: string, extra = ''): string {
  return [
    `curl -sS${extra} -X ${method} ${shellQuote(url)}`,
    `-H "Authorization: Bearer $${PAT_VARIABLE}"`,
    `-H 'Content-Type: application/json'`,
    `--data ${shellQuote(JSON.stringify(body))}`,
    `-w ${shellQuote(`${writeOutText(label)} -> HTTP %{http_code}\\n`)}`,
  ].join(' ');
}

const show = (v: string | number | null) => (v === null || v === '' ? 'blank' : String(v));

const COMMENT_LABELS: Record<FieldChange['kind'], string> = {
  storyPoints: 'Story Points',
  slaDays: 'SLA',
  architect: 'Architect',
  targetStart: 'Forecast Start',
  targetEnd: 'Forecast End',
};

/** `Story points: 5 to 8` — the terminal status line, not the Jira comment. */
export function describeField(change: FieldChange): string {
  const label = FIELD_LABELS[change.kind];
  if (change.kind === 'architect') {
    return `${label}: ${change.from || 'unassigned'} to ${change.to.name}`;
  }
  return `${label}: ${show(change.from)} to ${show(change.to)}`;
}

/** One plain comment line, such as `Story Points: 5 to 8` or `Rank: ABC-4 to ABC-9`. */
export function describeComment(change: FieldChange | RankChange): string {
  if (change.kind === 'rank') {
    const from = change.previous ?? 'start';
    return change.before
      ? `Rank: ${from} to before ${change.before}`
      : `Rank: ${from} to ${change.after}`;
  }
  const label = COMMENT_LABELS[change.kind];
  if (change.kind === 'architect') {
    return `${label}: ${change.from || 'unassigned'} to ${change.to.name}`;
  }
  return `${label}: ${show(change.from)} to ${show(change.to)}`;
}

function describe(change: JiraChange): string {
  if (change.kind !== 'rank') return `${change.key} ${describeField(change)}`;
  return change.after
    ? `${change.key} rank after ${change.after}`
    : `${change.key} rank before ${change.before}`;
}

export function defaultNote(date: Date = new Date()): string {
  const day = date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const time = date
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    .replace(/[\u202f\u00a0]/g, ' ');
  return `Based on a meeting on ${day} at ${time}, the following fields of this Jira issue were changed`;
}

/** The note followed by one plain line per change that is actually sent. */
export function commentText(note: string, changes: Array<FieldChange | RankChange>): string {
  const lines = changes.map(describeComment);
  return note.trim() ? [note.trim(), '', ...lines].join('\n') : lines.join('\n');
}

/**
 * Issues in the order their comment is posted. Field-only comments run with the
 * field update; rank-only and combined comments run with the rank move.
 */
export function commentedIssues(
  plan: UpdatePlan,
): { key: string; changes: Array<FieldChange | RankChange> }[] {
  const fieldsByKey = new Map(plan.issues.map((issue) => [issue.key, issue.changes]));
  const ranked = new Set(plan.ranks.map((rank) => rank.key));
  const fieldOnly = plan.issues
    .filter((issue) => !ranked.has(issue.key))
    .map((issue) => ({ key: issue.key, changes: [...issue.changes] }));
  const withRank = plan.ranks.map((rank) => ({
    key: rank.key,
    changes: [...(fieldsByKey.get(rank.key) ?? []), rank],
  }));
  return [...fieldOnly, ...withRank];
}

/** Bash 3.2 names are `[A-Za-z_][A-Za-z0-9_]*`. `A-1` becomes `A_1_ok`. */
function bashOkVar(key: string): string {
  const safe = key.replace(/[^A-Za-z0-9_]/g, '_');
  const named = /^[A-Za-z_]/.test(safe) ? safe : `_${safe}`;
  return `${named}_ok`;
}

function fieldValue(
  change: FieldChange,
  s: ScriptSettings,
): { value: unknown } | { reason: string } {
  if (change.kind !== 'architect') return { value: change.to };
  if (s.architectFieldType === 'select') return { value: { value: change.to.name } };
  if (s.architectFieldType === 'text') return { value: change.to.name };
  const username = change.to.jiraUsername?.trim();
  return username
    ? { value: { name: username } }
    : { reason: `no Jira username for ${change.to.name} in Settings` };
}

export function planUpdates(changes: JiraChange[], settings: ScriptSettings): UpdatePlan {
  const byKey = new Map<string, IssueUpdate>();
  const ranks: RankChange[] = [];
  const skipped: SkippedChange[] = [];
  for (const change of changes) {
    if (change.kind === 'rank') {
      if (settings.exportRankChanges) ranks.push(change);
      else skipped.push({ change, reason: 'rank changes are turned off in Settings' });
      continue;
    }
    const field = settings[FIELD_SETTINGS[change.kind]].trim();
    if (!field) {
      skipped.push({ change, reason: `no field id for ${FIELD_LABELS[change.kind]} in Settings` });
      continue;
    }
    const value = fieldValue(change, settings);
    if ('reason' in value) {
      skipped.push({ change, reason: value.reason });
      continue;
    }
    const issue = byKey.get(change.key) ?? { key: change.key, fields: {}, changes: [] };
    issue.fields[field] = value.value;
    issue.changes.push(change);
    byKey.set(change.key, issue);
  }
  return { issues: [...byKey.values()], ranks, skipped };
}

/**
 * Field updates, then rank moves in order. Each changed issue gets a comment
 * after the updates that apply to it succeed: on the field line when there is
 * no rank move, and on the rank line when there is one.
 */
export function buildJiraScript(
  plan: UpdatePlan,
  settings: ScriptSettings,
  opts: { now?: Date; source?: string | null; note?: string | null } = {},
): string {
  const base = normalizeBaseUrl(settings.jiraBaseUrl);
  const withComment = opts.note !== null && opts.note !== undefined;
  const rankedKeys = new Set(plan.ranks.map((rank) => rank.key));
  const commentByKey = new Map(commentedIssues(plan).map((issue) => [issue.key, issue.changes]));
  const commentFor = (key: string) =>
    curl(
      'POST',
      `${base}/rest/api/2/issue/${encodeURIComponent(key)}/comment`,
      { body: commentText(opts.note!, commentByKey.get(key) ?? []) },
      `${key} comment added`,
      ' -o /dev/null',
    );

  const issueLines = plan.issues.map((issue) => {
    const update = curl(
      'PUT',
      `${base}/rest/api/2/issue/${encodeURIComponent(issue.key)}`,
      { fields: issue.fields },
      `${issue.key} ${issue.changes.map(describeField).join('; ')}`,
      ' --fail-with-body',
    );
    if (!withComment) return update;
    if (rankedKeys.has(issue.key)) {
      const flag = bashOkVar(issue.key);
      return `${flag}=0; ${update} && ${flag}=1`;
    }
    return `${update} && ${commentFor(issue.key)}`;
  });
  const rankLines = plan.ranks.map((r) => {
    const rank = curl(
      'PUT',
      `${base}/rest/agile/1.0/issue/rank`,
      r.after
        ? { issues: [r.key], rankAfterIssue: r.after }
        : { issues: [r.key], rankBeforeIssue: r.before },
      describe(r),
      withComment ? ' --fail-with-body' : '',
    );
    if (!withComment) return rank;
    const comment = commentFor(r.key);
    if (!plan.issues.some((issue) => issue.key === r.key)) return `${rank} && ${comment}`;
    const flag = bashOkVar(r.key);
    return `${rank} && [ "$${flag}" = 1 ] && ${comment}`;
  });

  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const noteLines = withComment && opts.note!.trim() ? opts.note!.trim().split('\n') : [];
  const header = [
    '#!/bin/bash',
    `# Jira updates from Jira Gantt Forecaster, generated ${(opts.now ?? new Date()).toISOString()}`,
    ...(opts.source ? [`# Jira export: ${opts.source}`] : []),
    `# Server: ${base}`,
    `# ${plural(plan.issues.length, 'issue')} to update and ${plural(plan.ranks.length, 'rank move')}, one curl line each.`,
    ...(withComment
      ? [
          '# Each changed issue gets a comment: the meeting note, then one plain line per change sent.',
          "# The comment is posted only after that issue's field update and rank move, if any, succeed.",
          ...(plan.issues.some((issue) => rankedKeys.has(issue.key))
            ? [
                '# When an issue changes fields and rank, the field line sets KEY_ok (A-1 becomes A_1_ok).',
                '# The rank line then comments only if that flag is 1. A failed field update still lets',
                '# later rank moves run, and skips the comment.',
              ]
            : []),
          ...(noteLines.length ? ['# Comment note:', ...noteLines.map((l) => `#   ${l}`)] : []),
        ]
      : []),
    '#',
    '# Run it from a macOS Terminal (needs curl 7.76 or later, macOS 12+) with your token:',
    `#   export ${PAT_VARIABLE}='your-personal-access-token'`,
    '#   bash this-file.sh',
    '# Or paste the curl lines into the terminal in order: rank moves build on the ones',
    '# before them. Each line prints what it changed and the HTTP status',
    '# (204 = fields updated, 201 = comment added).',
    '#',
    '# List field ids to configure Settings > Jira update file:',
    `#   curl -sS -H "Authorization: Bearer $${PAT_VARIABLE}" ${shellQuote(`${base}/rest/api/2/field`)}`,
    ...(plan.skipped.length
      ? [
          '#',
          `# Not included (${plan.skipped.length}):`,
          ...plan.skipped.map((s) => `#   ${describe(s.change)} (${s.reason})`),
        ]
      : []),
    '',
    `: "\${${PAT_VARIABLE}:?Set ${PAT_VARIABLE} to your Jira personal access token first}"`,
  ];

  return [...header, ...issueLines, ...rankLines, ''].join('\n');
}
