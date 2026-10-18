import type { JiraChange } from '../core/jiraChanges';
import type { Settings } from '../core/types';

export const PAT_VARIABLE = 'JIRA_PAT';

export type ScriptSettings = Pick<
  Settings,
  | 'jiraBaseUrl'
  | 'storyPointsField'
  | 'slaDaysField'
  | 'architectField'
  | 'architectFieldType'
  | 'exportRankChanges'
>;

export interface SkippedChange {
  change: JiraChange;
  reason: string;
}

export interface JiraScript {
  text: string;
  /** Number of curl commands in the script. */
  commands: number;
  skipped: SkippedChange[];
}

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

function curl(method: string, url: string, body: unknown, label: string): string {
  return [
    `curl -sS -X ${method} ${shellQuote(url)}`,
    `-H "Authorization: Bearer $${PAT_VARIABLE}"`,
    `-H 'Content-Type: application/json'`,
    `--data ${shellQuote(JSON.stringify(body))}`,
    `-w ${shellQuote(`${writeOutText(label)} -> HTTP %{http_code}\\n`)}`,
  ].join(' ');
}

const show = (n: number | null) => (n === null ? 'blank' : String(n));

function describe(change: JiraChange): string {
  switch (change.kind) {
    case 'storyPoints':
      return `${change.key} story points ${show(change.from)} to ${show(change.to)}`;
    case 'slaDays':
      return `${change.key} SLA days ${show(change.from)} to ${show(change.to)}`;
    case 'architect':
      return `${change.key} architect ${change.from || 'unassigned'} to ${change.to.name}`;
    case 'rank':
      return change.after
        ? `${change.key} rank after ${change.after}`
        : `${change.key} rank before ${change.before}`;
  }
}

function fieldUpdate(
  change: JiraChange,
  s: ScriptSettings,
): { field: string; value: unknown } | { reason: string } {
  switch (change.kind) {
    case 'storyPoints':
      return s.storyPointsField.trim()
        ? { field: s.storyPointsField.trim(), value: change.to }
        : { reason: 'no story points field id in Settings' };
    case 'slaDays':
      return s.slaDaysField.trim()
        ? { field: s.slaDaysField.trim(), value: change.to }
        : { reason: 'no SLA days field id in Settings' };
    case 'architect': {
      const field = s.architectField.trim();
      if (!field) return { reason: 'no architect field id in Settings' };
      if (s.architectFieldType === 'select') return { field, value: { value: change.to.name } };
      if (s.architectFieldType === 'text') return { field, value: change.to.name };
      const username = change.to.jiraUsername?.trim();
      return username
        ? { field, value: { name: username } }
        : { reason: `no Jira username for ${change.to.name} in Settings` };
    }
    case 'rank':
      return { reason: 'rank changes are turned off in Settings' };
  }
}

export function buildJiraScript(
  changes: JiraChange[],
  settings: ScriptSettings,
  opts: { now?: Date; source?: string | null } = {},
): JiraScript {
  const base = normalizeBaseUrl(settings.jiraBaseUrl);
  const commands: string[] = [];
  const skipped: SkippedChange[] = [];

  for (const change of changes) {
    if (change.kind === 'rank') {
      if (!settings.exportRankChanges) {
        skipped.push({ change, reason: 'rank changes are turned off in Settings' });
        continue;
      }
      const body = change.after
        ? { issues: [change.key], rankAfterIssue: change.after }
        : { issues: [change.key], rankBeforeIssue: change.before };
      commands.push(curl('PUT', `${base}/rest/agile/1.0/issue/rank`, body, describe(change)));
      continue;
    }
    const update = fieldUpdate(change, settings);
    if ('reason' in update) {
      skipped.push({ change, reason: update.reason });
      continue;
    }
    commands.push(
      curl(
        'PUT',
        `${base}/rest/api/2/issue/${encodeURIComponent(change.key)}`,
        { fields: { [update.field]: update.value } },
        describe(change),
      ),
    );
  }

  const header = [
    '#!/bin/bash',
    `# Jira updates from Jira Gantt Forecaster, generated ${(opts.now ?? new Date()).toISOString()}`,
    ...(opts.source ? [`# Jira export: ${opts.source}`] : []),
    `# Server: ${base}`,
    `# ${commands.length} update${commands.length === 1 ? '' : 's'}, one curl command per line.`,
    '#',
    '# Run it from a macOS Terminal with your Jira personal access token:',
    `#   export ${PAT_VARIABLE}='your-personal-access-token'`,
    '#   bash this-file.sh',
    '# Or paste the curl lines into the terminal. Keep them in order: rank moves build on',
    '# the ones before them. Each line prints the change and its HTTP status (204 = done).',
    '#',
    '# List field ids to configure Settings > Jira update script:',
    `#   curl -sS -H "Authorization: Bearer $${PAT_VARIABLE}" ${shellQuote(`${base}/rest/api/2/field`)}`,
    ...(skipped.length
      ? [
          '#',
          `# Not included (${skipped.length}):`,
          ...skipped.map((s) => `#   ${describe(s.change)}: ${s.reason}`),
        ]
      : []),
    '',
    `: "\${${PAT_VARIABLE}:?Set ${PAT_VARIABLE} to your Jira personal access token first}"`,
  ];

  return {
    text: [...header, ...commands, ''].join('\n'),
    commands: commands.length,
    skipped,
  };
}
