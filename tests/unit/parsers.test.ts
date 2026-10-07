import { describe, expect, it } from 'vitest';
import { parseClosureCsv, parseVacationCsv } from '../../src/parsers/calendarCsv';
import { normalizeHeader, parseCsv, parseDate, parseNumber } from '../../src/parsers/csv';
import { detectFileType } from '../../src/parsers/detectFileType';
import { parseJiraCsv } from '../../src/parsers/jiraCsv';
import { parseStaffCsv } from '../../src/parsers/staffCsv';
import { fixture, sample } from '../helpers';

describe('csv helpers', () => {
  it('parses quoted fields with commas, quotes and new lines (REQ-IMP-011)', () => {
    const rows = parseCsv('\uFEFFa,b\n"x, y","say ""hi""\nthere"\n\n');
    expect(rows).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"\nthere'],
    ]);
  });

  it('normalizes headers including Jira custom fields (REQ-IMP-004)', () => {
    expect(normalizeHeader('Custom field (Story Points)')).toBe('story points');
    expect(normalizeHeader('  Issue Key ')).toBe('issue key');
    expect(normalizeHeader('SLA (Days)')).toBe('sla days');
  });

  it.each([
    ['2026-01-15', '2026-01-15'],
    ['2026-1-5 10:30', '2026-01-05'],
    ['1/15/2026', '2026-01-15'],
    ['1/15/26', '2026-01-15'],
    ['15/Jan/26 9:00 AM', '2026-01-15'],
    ['05-Feb-2026', '2026-02-05'],
    ['', null],
    ['2026-02-30', null],
    ['15/Foo/26', null],
    ['tomorrow', null],
  ])('parses date %s', (input, expected) => {
    expect(parseDate(input)).toBe(expected);
  });

  it('parses numbers', () => {
    expect(parseNumber('1,234.5')).toBe(1234.5);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber(undefined)).toBeNull();
  });
});

describe('detectFileType (REQ-IMP-003)', () => {
  it.each([
    ['jira-export.csv', 'jira'],
    ['staff.csv', 'staff'],
    ['vacations.csv', 'vacation'],
    ['closures.csv', 'closure'],
  ])('detects sample %s as %s', (file, kind) => {
    expect(detectFileType(sample(file), file)).toBe(kind);
  });

  it('detects plain name lists and project files', () => {
    expect(detectFileType('Alice\nBob\n', 'people.txt')).toBe('staff');
    expect(detectFileType('{"app":"x"}', 'p.json')).toBe('project');
    expect(detectFileType('  {"app":"x"}', 'p.txt')).toBe('project');
  });

  it('rejects unknown files', () => {
    expect(detectFileType('foo,bar\n1,2\n', 'x.csv')).toBe('unknown');
    expect(detectFileType('', 'x.csv')).toBe('unknown');
  });
});

describe('parseJiraCsv', () => {
  it('maps columns and sorts by rank (REQ-IMP-004, REQ-IMP-005)', () => {
    const { items, skipped, missingColumns } = parseJiraCsv(fixture('jira.csv'));
    expect(skipped).toBe(0);
    expect(missingColumns).toEqual([]);
    expect(items.map((i) => i.key)).toEqual(['A-1', 'A-2', 'B-1', 'U-1']);
    expect(items[0]).toMatchObject({
      summary: 'Alpha discovery',
      crew: 'Phoenix',
      architect: 'Alice Chen',
      status: 'To Do',
      storyPoints: 5,
      slaDays: 3,
      startDate: null,
      endDate: '2026-11-30',
      rank: '0|i0001:',
    });
    expect(items[2]!.summary).toBe('Bravo platform, with "quotes"');
  });

  it('sorts by LexoRank and puts unranked items last in file order', () => {
    const csv = [
      'Issue key,Summary,Rank',
      'K-1,one,',
      'K-2,two,0|i000a:',
      'K-3,three,0|i0009:',
      'K-4,four,',
    ].join('\n');
    expect(parseJiraCsv(csv).items.map((i) => i.key)).toEqual(['K-3', 'K-2', 'K-1', 'K-4']);
  });

  it('accepts alternative headers', () => {
    const csv =
      'Key,Task Summary,Team,Architect Assigned,SP,SLA of days to complete,Start,Due\nX-1,Hello,Nova,Bob,2,4,1/2/2026,15/Jan/26';
    expect(parseJiraCsv(csv).items[0]).toMatchObject({
      crew: 'Nova',
      architect: 'Bob',
      storyPoints: 2,
      slaDays: 4,
      startDate: '2026-01-02',
      endDate: '2026-01-15',
    });
  });

  it('skips rows without a key and duplicate keys (REQ-IMP-006)', () => {
    const csv = 'Issue key,Summary,Story Points\nA,one,-3\n,missing,1\nA,dup,1\nB,two,x';
    const { items, skipped, missingColumns } = parseJiraCsv(csv);
    expect(items.map((i) => i.key)).toEqual(['A', 'B']);
    expect(items[0]!.storyPoints).toBeNull();
    expect(items[1]!.storyPoints).toBeNull();
    expect(skipped).toBe(2);
    expect(missingColumns).toContain('rank');
  });

  it('requires a key column', () => {
    expect(() => parseJiraCsv('Summary\nfoo')).toThrow(/Issue key/);
  });
});

describe('parseStaffCsv', () => {
  it('reads a staff column and removes duplicates', () => {
    expect(parseStaffCsv('Name,Email\nAlice,a@x\n alice ,b@x\n,\nBob,c@x')).toEqual({
      names: ['Alice', 'Bob'],
      skipped: 1,
    });
  });
  it('reads a plain list without header', () => {
    expect(parseStaffCsv('Alice Chen\nBob  Martinez\n').names).toEqual([
      'Alice Chen',
      'Bob Martinez',
    ]);
  });
  it('prefers a person column', () => {
    expect(parseStaffCsv('Team,Architect\nX,Carla').names).toEqual(['Carla']);
  });
  it('handles empty input', () => {
    expect(parseStaffCsv('')).toEqual({ names: [], skipped: 0 });
  });
});

describe('calendar CSVs', () => {
  it('parses vacations (REQ-VAC-004)', () => {
    const { vacations, skipped } = parseVacationCsv(
      'Staff,Start Date,End Date,Note\nBob,2026-11-12,2026-11-13,Trip\nAmy,2026-11-20,,\nBad,2026-11-10,2026-11-01,\n,2026-01-01,,',
    );
    expect(vacations).toEqual([
      { staffName: 'Bob', start: '2026-11-12', end: '2026-11-13', note: 'Trip' },
      { staffName: 'Amy', start: '2026-11-20', end: '2026-11-20', note: '' },
    ]);
    expect(skipped).toBe(2);
  });

  it('requires vacation columns', () => {
    expect(() => parseVacationCsv('Foo,Bar\n1,2')).toThrow();
  });

  it('parses closures (REQ-CLS-002)', () => {
    const { closures, skipped } = parseClosureCsv(
      'Date,End Date,Holiday\n2026-11-26,2026-11-27,Thanksgiving\n12/25/2026,,\nnot a date,,x',
    );
    expect(closures).toEqual([
      { name: 'Thanksgiving', start: '2026-11-26', end: '2026-11-27' },
      { name: 'Closed', start: '2026-12-25', end: '2026-12-25' },
    ]);
    expect(skipped).toBe(1);
  });

  it('requires a closure date column', () => {
    expect(() => parseClosureCsv('Name\nX')).toThrow();
  });
});
