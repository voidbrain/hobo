import { TIME_SPENT_OPTIONS, formatMinutes, timeSpentMinutes } from './time-spent';

describe('time spent', () => {
  it('maps each option to minutes on site', () => {
    expect(TIME_SPENT_OPTIONS.map(timeSpentMinutes)).toEqual([120, 240, 480]);
  });

  it('formats durations', () => {
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(120)).toBe('2 h');
    expect(formatMinutes(135)).toBe('2 h 15 min');
    expect(formatMinutes(0)).toBe('0 min');
  });

  it('rejects negative or non-finite durations', () => {
    expect(() => formatMinutes(-1)).toThrow(RangeError);
    expect(() => formatMinutes(Number.NaN)).toThrow(RangeError);
  });
});
