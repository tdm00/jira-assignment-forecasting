import { normalizeName } from '../core/scheduler';
import { parseClosureCsv, parseVacationCsv } from '../parsers/calendarCsv';
import { parseCrewCsv } from '../parsers/crewCsv';
import { detectFileType, type FileKind } from '../parsers/detectFileType';
import { parseJiraCsv } from '../parsers/jiraCsv';
import { parseStaffCsv } from '../parsers/staffCsv';
import { parseProject } from './persistence';
import { reducer, type Action, type AppState } from './store';

export interface ImportResult {
  kind: FileKind;
  actions: Action[];
  message: string;
  level: 'success' | 'warning' | 'error';
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Turns file contents into store actions without touching the store, so it is easy to test. */
export function importText(
  text: string,
  fileName: string,
  state: AppState,
  forceKind?: FileKind,
): ImportResult {
  const kind = forceKind ?? detectFileType(text, fileName);
  const fail = (message: string): ImportResult => ({ kind, actions: [], message, level: 'error' });
  const skippedNote = (n: number) => (n ? `, skipped ${plural(n, 'row')}` : '');

  try {
    switch (kind) {
      case 'jira': {
        const { items, skipped } = parseJiraCsv(text);
        if (!items.length) return fail(`${fileName}: no Jira items found`);
        return {
          kind,
          actions: [{ type: 'setItems', items, fileName }],
          message: `${fileName}: imported ${plural(items.length, 'Jira item')}${skippedNote(skipped)}`,
          level: skipped ? 'warning' : 'success',
        };
      }
      case 'staff': {
        const { names, usernames, skipped } = parseStaffCsv(text);
        if (!names.length) return fail(`${fileName}: no staff names found`);
        return {
          kind,
          actions: [{ type: 'addStaff', names, usernames }],
          message: `${fileName}: loaded ${plural(names.length, 'staff member')}${skippedNote(skipped)}`,
          level: 'success',
        };
      }
      case 'vacation': {
        const { vacations, skipped } = parseVacationCsv(text);
        const byName = new Map(state.staff.map((s) => [normalizeName(s.name), s.id]));
        const unknown = new Set<string>();
        const mapped = vacations.flatMap((v) => {
          const staffId = byName.get(normalizeName(v.staffName));
          if (!staffId) {
            unknown.add(v.staffName);
            return [];
          }
          return [{ staffId, start: v.start, end: v.end, note: v.note }];
        });
        const unknownRows = vacations.length - mapped.length;
        if (!mapped.length) {
          return fail(
            unknown.size
              ? `${fileName}: no vacations matched the staff list (add staff first)`
              : `${fileName}: no vacations found`,
          );
        }
        const notes = [
          skipped ? `skipped ${plural(skipped, 'invalid row')}` : '',
          unknownRows ? `skipped ${plural(unknownRows, 'row')} for unknown staff` : '',
        ].filter(Boolean);
        return {
          kind,
          actions: [{ type: 'addVacations', vacations: mapped }],
          message: `${fileName}: loaded ${plural(mapped.length, 'vacation')}${notes.length ? `, ${notes.join(', ')}` : ''}`,
          level: notes.length ? 'warning' : 'success',
        };
      }
      case 'closure': {
        const { closures, skipped } = parseClosureCsv(text);
        if (!closures.length) return fail(`${fileName}: no closure dates found`);
        return {
          kind,
          actions: [{ type: 'addClosures', closures }],
          message: `${fileName}: loaded ${plural(closures.length, 'closure')}${skippedNote(skipped)}`,
          level: skipped ? 'warning' : 'success',
        };
      }
      case 'crew': {
        const { assignments, skipped } = parseCrewCsv(text);
        const byName = new Map(state.staff.map((s) => [normalizeName(s.name), s.id]));
        const mapped = assignments.flatMap((a) => {
          const staffId = byName.get(normalizeName(a.staffName));
          return staffId
            ? [{ crew: a.crew, staffId, role: a.role, availableFrom: a.availableFrom }]
            : [];
        });
        const unknownRows = assignments.length - mapped.length;
        if (!mapped.length) {
          return fail(
            assignments.length
              ? `${fileName}: no crew assignments matched the staff list (add staff first)`
              : `${fileName}: no crew assignments found`,
          );
        }
        const notes = [
          skipped ? `skipped ${plural(skipped, 'invalid row')}` : '',
          unknownRows ? `skipped ${plural(unknownRows, 'row')} for unknown staff` : '',
        ].filter(Boolean);
        return {
          kind,
          actions: [{ type: 'importCrewAssignments', assignments: mapped }],
          message: `${fileName}: loaded ${plural(mapped.length, 'crew assignment')}${notes.length ? `, ${notes.join(', ')}` : ''}`,
          level: notes.length ? 'warning' : 'success',
        };
      }
      case 'project': {
        const next = parseProject(text);
        return {
          kind,
          actions: [{ type: 'replaceAll', state: next }],
          message: `${fileName}: project restored`,
          level: 'success',
        };
      }
      case 'unknown':
        return fail(
          `${fileName}: unrecognised file. Expected a Jira, staff, vacation, closure or crew pool CSV.`,
        );
    }
  } catch (err) {
    return fail(`${fileName}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

const KIND_ORDER: Record<FileKind, number> = {
  project: 0,
  staff: 1,
  closure: 2,
  crew: 3,
  jira: 4,
  vacation: 5,
  unknown: 6,
};

export interface NamedText {
  name: string;
  text: string;
}

/**
 * Imports several files at once. Staff are applied before vacations so a staff
 * list and its vacations can be dropped together.
 */
export function importFiles(
  files: NamedText[],
  state: AppState,
): { state: AppState; results: ImportResult[] } {
  const ordered = files
    .map((f) => ({ ...f, kind: detectFileType(f.text, f.name) }))
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  let next = state;
  const results: ImportResult[] = [];
  for (const f of ordered) {
    const res = importText(f.text, f.name, next, f.kind);
    for (const action of res.actions) next = reducer(next, action);
    results.push(res);
  }
  return { state: next, results };
}
