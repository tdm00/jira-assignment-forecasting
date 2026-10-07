import { describe, expect, it } from 'vitest';
import {
  WorkCalendar,
  addDays,
  dayOfWeek,
  diffDays,
  expandRange,
  isValidIsoDate,
  isWeekend,
  todayIso,
  toUtc,
} from '../../src/core/calendar';

const closure = (start: string, end = start) => ({ id: start, name: 'Closed', start, end });
const vacation = (staffId: string, start: string, end = start) => ({
  id: `${staffId}${start}`,
  staffId,
  start,
  end,
  note: '',
});

describe('date helpers', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('is unaffected by daylight saving changes (REQ-NFR-008)', () => {
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-10-31', 2)).toBe('2026-11-02');
    expect(diffDays('2026-03-01', '2026-04-01')).toBe(31);
  });

  it('identifies weekends', () => {
    expect(dayOfWeek('2026-11-09')).toBe(1);
    expect(isWeekend('2026-11-14')).toBe(true);
    expect(isWeekend('2026-11-15')).toBe(true);
    expect(isWeekend('2026-11-16')).toBe(false);
  });

  it('validates ISO dates', () => {
    expect(isValidIsoDate('2026-02-28')).toBe(true);
    expect(isValidIsoDate('2026-02-30')).toBe(false);
    expect(isValidIsoDate('2026-2-3')).toBe(false);
    expect(() => toUtc('nope')).toThrow();
  });

  it('expands inclusive ranges', () => {
    expect(expandRange('2026-11-09', '2026-11-11')).toEqual([
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
    ]);
  });

  it('formats today in local time', () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});

describe('WorkCalendar', () => {
  it('skips weekends (REQ-CLS-005)', () => {
    const cal = new WorkCalendar();
    expect(cal.nextWorkingDay('2026-11-14')).toBe('2026-11-16');
    expect(cal.addWorkingDays('2026-11-09', 5)).toBe('2026-11-13');
    expect(cal.addWorkingDays('2026-11-12', 3)).toBe('2026-11-16');
  });

  it('skips closures for everyone (REQ-CLS-004)', () => {
    const cal = new WorkCalendar([closure('2026-11-11')]);
    expect(cal.isBusinessDay('2026-11-11')).toBe(false);
    expect(cal.closureName('2026-11-11')).toBe('Closed');
    expect(cal.addWorkingDays('2026-11-09', 3)).toBe('2026-11-12');
    expect(cal.addWorkingDays('2026-11-09', 3, 'alice')).toBe('2026-11-12');
  });

  it('skips multi-day closures', () => {
    const cal = new WorkCalendar([closure('2026-11-26', '2026-11-27')]);
    expect(cal.addWorkingDays('2026-11-25', 2)).toBe('2026-11-30');
  });

  it('skips vacation days only for that person (REQ-VAC-006)', () => {
    const cal = new WorkCalendar([], [vacation('bob', '2026-11-10', '2026-11-12')]);
    expect(cal.addWorkingDays('2026-11-09', 2, 'bob')).toBe('2026-11-13');
    expect(cal.addWorkingDays('2026-11-09', 2, 'alice')).toBe('2026-11-10');
    expect(cal.isOnVacation('bob', '2026-11-11')).toBe(true);
    expect(cal.isOnVacation(null, '2026-11-11')).toBe(false);
  });

  it('counts working days in a range', () => {
    const cal = new WorkCalendar([closure('2026-11-11')], [vacation('bob', '2026-11-12')]);
    expect(cal.countWorkingDays('2026-11-09', '2026-11-15')).toBe(4);
    expect(cal.countWorkingDays('2026-11-09', '2026-11-15', 'bob')).toBe(3);
  });

  it('treats zero or negative durations as one day', () => {
    const cal = new WorkCalendar();
    expect(cal.addWorkingDays('2026-11-14', 0)).toBe('2026-11-16');
  });
});
