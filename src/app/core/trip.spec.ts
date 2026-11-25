import {
  addTripStop,
  datesBetween,
  moveTripStop,
  reconcileTripDays,
  removeTripStop,
  tripPlaceIds,
  validateNewTrip,
  validateSettingsPatch,
  validateTripPatch,
  type TripEndpoint,
} from './trip';

// Invented places, dates and coordinates only.
const home: TripEndpoint = {
  name: 'Harbour Base',
  location: { lat: -33.86, lng: 151.21 },
  placeId: null,
};

describe('trip domain model and pure helpers (F-003-T01)', () => {
  it('computes calendar dates inclusively across month boundaries and reconciles days', () => {
    expect(datesBetween('2026-06-10', '2026-06-10')).toEqual(['2026-06-10']);
    expect(datesBetween('2026-06-29', '2026-07-02')).toEqual([
      '2026-06-29',
      '2026-06-30',
      '2026-07-01',
      '2026-07-02',
    ]);

    const reconciled = reconcileTripDays('2026-06-30', '2026-07-02', [
      { date: '2026-06-29', stops: ['p-drop'] },
      { date: '2026-06-30', stops: ['p-1', 'p-2'] },
    ]);
    expect(reconciled).toEqual([
      { date: '2026-06-30', stops: ['p-1', 'p-2'] },
      { date: '2026-07-01', stops: [] },
      { date: '2026-07-02', stops: [] },
    ]);
  });

  it('adds, removes and moves stops across days purely and collects referenced place ids', () => {
    const start = reconcileTripDays('2026-08-01', '2026-08-02');
    const withStops = addTripStop(
      addTripStop(addTripStop(start, '2026-08-01', 'p-1'), '2026-08-01', 'p-2'),
      '2026-08-02',
      'p-3',
    );
    expect(withStops).toEqual([
      { date: '2026-08-01', stops: ['p-1', 'p-2'] },
      { date: '2026-08-02', stops: ['p-3'] },
    ]);

    const moved = moveTripStop(withStops, '2026-08-01', 0, '2026-08-02', 1);
    expect(moved).toEqual([
      { date: '2026-08-01', stops: ['p-2'] },
      { date: '2026-08-02', stops: ['p-3', 'p-1'] },
    ]);

    const afterRemove = removeTripStop(moved, '2026-08-02', 0);
    expect(afterRemove).toEqual([
      { date: '2026-08-01', stops: ['p-2'] },
      { date: '2026-08-02', stops: ['p-1'] },
    ]);

    expect(
      tripPlaceIds({
        from: { name: 'Depot', location: null, placeId: 'p-start' },
        to: home,
        days: afterRemove,
      }),
    ).toEqual(['p-start', 'p-2', 'p-1']);
  });

  it('defaults from and to to the home setting when omitted, and lets explicit values override it', () => {
    const defaulted = validateNewTrip(
      { name: 'South Coast Loop', startDate: '2026-09-04', endDate: '2026-09-05' },
      home,
    );
    expect(defaulted).toEqual({
      ok: true,
      value: {
        name: 'South Coast Loop',
        startDate: '2026-09-04',
        endDate: '2026-09-05',
        from: home,
        to: home,
        days: [
          { date: '2026-09-04', stops: [] },
          { date: '2026-09-05', stops: [] },
        ],
      },
    });

    const overridden = validateNewTrip(
      {
        name: 'One-Way Ridge Walk',
        startDate: '2026-09-04',
        endDate: '2026-09-04',
        from: { name: 'Railhead', location: { lat: 12.5, lng: 45.25 } },
        to: null,
        days: [{ date: '2026-09-04', stops: ['p-1'] }],
      },
      home,
    );
    expect(overridden).toEqual({
      ok: true,
      value: {
        name: 'One-Way Ridge Walk',
        startDate: '2026-09-04',
        endDate: '2026-09-04',
        from: { name: 'Railhead', location: { lat: 12.5, lng: 45.25 }, placeId: null },
        to: null,
        days: [{ date: '2026-09-04', stops: ['p-1'] }],
      },
    });
  });

  it('rejects impossible calendar dates, reversed ranges, mismatched days and unknown fields', () => {
    const badDates = validateNewTrip(
      { name: '', startDate: '2026-02-29', endDate: '2026-02-28', extra: 1 },
      null,
    );
    expect(badDates.ok).toBe(false);
    if (!badDates.ok) {
      expect(badDates.errors).toContain('name is required');
      expect(badDates.errors).toContain('startDate must be a valid YYYY-MM-DD date');
      expect(badDates.errors).toContain('unknown field extra');
    }

    const reversed = validateNewTrip(
      { name: 'Backwards', startDate: '2026-05-10', endDate: '2026-05-08' },
      null,
    );
    expect(reversed).toEqual({
      ok: false,
      errors: ['endDate must not be before startDate'],
    });

    const wrongDays = validateNewTrip(
      {
        name: 'Gap',
        startDate: '2026-05-08',
        endDate: '2026-05-09',
        days: [{ date: '2026-05-08', stops: [] }],
      },
      null,
    );
    expect(wrongDays).toEqual({
      ok: false,
      errors: ['days must list each date from startDate to endDate in order'],
    });
  });

  it('validates settings patches and trip patches against existing trip bounds', () => {
    expect(validateSettingsPatch({ home: { name: '  Harbour Base ' } })).toEqual({
      ok: true,
      value: { home: { name: 'Harbour Base', location: null, placeId: null } },
    });
    expect(validateSettingsPatch({ home: null })).toEqual({
      ok: true,
      value: { home: null },
    });
    expect(validateSettingsPatch({ nope: true }).ok).toBe(false);

    const existing = {
      startDate: '2026-10-01',
      endDate: '2026-10-02',
      days: [
        { date: '2026-10-01', stops: ['p-1'] },
        { date: '2026-10-02', stops: ['p-2'] },
      ],
    };
    const extended = validateTripPatch({ endDate: '2026-10-03' }, existing);
    expect(extended).toEqual({
      ok: true,
      value: {
        endDate: '2026-10-03',
        days: [
          { date: '2026-10-01', stops: ['p-1'] },
          { date: '2026-10-02', stops: ['p-2'] },
          { date: '2026-10-03', stops: [] },
        ],
      },
    });
  });
});
