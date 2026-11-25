import {
  type RouteLeg,
  type RoutePlan,
  computeTripTotals,
  formatDistanceKm,
  legKey,
  selectDaysTotals,
} from './route-totals';

describe('route totals (F-004-T01)', () => {
  const multiDayPlan: RoutePlan = {
    from: 'maple-home',
    to: 'maple-home',
    days: [
      {
        day: '2026-07-10',
        stops: [
          { placeId: 'fern-canyon', timeSpent: '2h' },
          { placeId: 'cedar-lake', timeSpent: 'half-day' },
        ],
      },
      {
        day: '2026-07-11',
        stops: [{ placeId: 'granite-peak', timeSpent: 'full-day' }],
      },
      {
        day: '2026-07-12',
        stops: [],
      },
    ],
  };

  const multiDayLegs: readonly RouteLeg[] = [
    { from: 'maple-home', to: 'fern-canyon', distanceMetres: 45_000, travelMinutes: 40 },
    { from: 'fern-canyon', to: 'cedar-lake', distanceMetres: 30_500, travelMinutes: 35 },
    { from: 'cedar-lake', to: 'granite-peak', distanceMetres: 62_000, travelMinutes: 75 },
    { from: 'granite-peak', to: 'maple-home', distanceMetres: 95_000, travelMinutes: 100 },
  ];

  it('computes per-leg, per-day and whole-trip totals matching hand calculation with no stay at from or to', () => {
    const result = computeTripTotals(multiDayPlan, multiDayLegs);

    expect(result.missingLegs).toEqual([]);
    expect(result.legs).toEqual([
      {
        day: '2026-07-10',
        from: 'maple-home',
        to: 'fern-canyon',
        distanceMetres: 45_000,
        travelMinutes: 40,
      },
      {
        day: '2026-07-10',
        from: 'fern-canyon',
        to: 'cedar-lake',
        distanceMetres: 30_500,
        travelMinutes: 35,
      },
      {
        day: '2026-07-11',
        from: 'cedar-lake',
        to: 'granite-peak',
        distanceMetres: 62_000,
        travelMinutes: 75,
      },
      {
        day: '2026-07-12',
        from: 'granite-peak',
        to: 'maple-home',
        distanceMetres: 95_000,
        travelMinutes: 100,
      },
    ]);

    expect(result.days).toEqual([
      {
        day: '2026-07-10',
        stopCount: 2,
        distanceMetres: 75_500,
        travelMinutes: 75,
        stayMinutes: 360,
        totalMinutes: 435,
        legs: [result.legs[0], result.legs[1]],
      },
      {
        day: '2026-07-11',
        stopCount: 1,
        distanceMetres: 62_000,
        travelMinutes: 75,
        stayMinutes: 480,
        totalMinutes: 555,
        legs: [result.legs[2]],
      },
      {
        day: '2026-07-12',
        stopCount: 0,
        distanceMetres: 95_000,
        travelMinutes: 100,
        stayMinutes: 0,
        totalMinutes: 100,
        legs: [result.legs[3]],
      },
    ]);

    expect(result.total).toEqual({
      distanceMetres: 232_500,
      travelMinutes: 250,
      stayMinutes: 840,
      totalMinutes: 1090,
    });
  });

  it('filters totals for a single day, a set of days, or the whole trip without mutating inputs', () => {
    const frozenDays = multiDayPlan.days.map((d) => ({ ...d, stops: [...d.stops] }));
    const result = computeTripTotals(multiDayPlan, multiDayLegs);

    const dayOne = selectDaysTotals(result, ['2026-07-10']);
    expect(dayOne.distanceMetres).toBe(75_500);
    expect(dayOne.travelMinutes).toBe(75);
    expect(dayOne.stayMinutes).toBe(360);
    expect(dayOne.totalMinutes).toBe(435);
    expect(dayOne.stopCount).toBe(2);
    expect(dayOne.legs).toHaveLength(2);

    const daysOneAndThree = selectDaysTotals(result, new Set(['2026-07-10', '2026-07-12']));
    expect(daysOneAndThree.distanceMetres).toBe(170_500);
    expect(daysOneAndThree.travelMinutes).toBe(175);
    expect(daysOneAndThree.stayMinutes).toBe(360);
    expect(daysOneAndThree.totalMinutes).toBe(535);
    expect(daysOneAndThree.stopCount).toBe(2);
    expect(daysOneAndThree.legs).toHaveLength(3);

    const allDays = selectDaysTotals(result);
    expect(allDays.distanceMetres).toBe(232_500);
    expect(allDays.totalMinutes).toBe(1090);
    expect(multiDayPlan.days).toEqual(frozenDays);
  });

  it('handles distinct from/to endpoints on a single-day trip, empty trips, Map leg lookups and missing legs', () => {
    const oneDayPlan: RoutePlan = {
      from: 'harbor-start',
      to: 'summit-end',
      days: [
        {
          day: '2026-08-01',
          stops: [{ placeId: 'valley-overlook', stayMinutes: 90 }],
        },
      ],
    };
    const legMap = new Map([
      [legKey('harbor-start', 'valley-overlook'), { distanceMetres: 18_000, travelMinutes: 22 }],
    ]);

    const partial = computeTripTotals(oneDayPlan, legMap);
    expect(partial.missingLegs).toEqual([
      { day: '2026-08-01', from: 'valley-overlook', to: 'summit-end' },
    ]);
    expect(partial.total).toEqual({
      distanceMetres: 18_000,
      travelMinutes: 22,
      stayMinutes: 90,
      totalMinutes: 112,
    });

    const emptySameHome = computeTripTotals(
      { from: 'maple-home', to: 'maple-home', days: [{ day: '2026-08-02', stops: [] }] },
      [],
    );
    expect(emptySameHome.legs).toEqual([]);
    expect(emptySameHome.total).toEqual({
      distanceMetres: 0,
      travelMinutes: 0,
      stayMinutes: 0,
      totalMinutes: 0,
    });

    const directRelocation = computeTripTotals(
      { from: 'harbor-start', to: 'summit-end', days: [{ day: '2026-08-02', stops: [] }] },
      [{ from: 'harbor-start', to: 'summit-end', distanceMetres: 40_000, travelMinutes: 50 }],
    );
    expect(directRelocation.total).toEqual({
      distanceMetres: 40_000,
      travelMinutes: 50,
      stayMinutes: 0,
      totalMinutes: 50,
    });
  });

  it('totals a one-stop trip that starts and ends at home, with no stay at home', () => {
    const result = computeTripTotals(
      {
        from: 'maple-home',
        to: 'maple-home',
        days: [{ day: '2026-09-01', stops: [{ placeId: 'fern-canyon', timeSpent: '2h' }] }],
      },
      [
        { from: 'maple-home', to: 'fern-canyon', distanceMetres: 45_000, travelMinutes: 40 },
        { from: 'fern-canyon', to: 'maple-home', distanceMetres: 44_600, travelMinutes: 38 },
      ],
    );
    expect(result.legs.map((l) => [l.from, l.to])).toEqual([
      ['maple-home', 'fern-canyon'],
      ['fern-canyon', 'maple-home'],
    ]);
    expect(result.total).toEqual({
      distanceMetres: 89_600,
      travelMinutes: 78,
      stayMinutes: 120,
      totalMinutes: 198,
    });
  });

  it('gives an empty middle day zero totals and continues from the previous day end', () => {
    const result = computeTripTotals(
      {
        from: 'maple-home',
        to: 'maple-home',
        days: [
          { day: '2026-09-01', stops: [{ placeId: 'fern-canyon', timeSpent: 'half-day' }] },
          { day: '2026-09-02', stops: [] },
          { day: '2026-09-03', stops: [{ placeId: 'cedar-lake', timeSpent: 'full-day' }] },
        ],
      },
      [
        { from: 'maple-home', to: 'fern-canyon', distanceMetres: 45_000, travelMinutes: 40 },
        { from: 'fern-canyon', to: 'cedar-lake', distanceMetres: 30_500, travelMinutes: 35 },
        { from: 'cedar-lake', to: 'maple-home', distanceMetres: 50_000, travelMinutes: 55 },
      ],
    );
    expect(result.missingLegs).toEqual([]);
    expect(result.days[1]).toEqual({
      day: '2026-09-02',
      stopCount: 0,
      distanceMetres: 0,
      travelMinutes: 0,
      stayMinutes: 0,
      totalMinutes: 0,
      legs: [],
    });
    expect(result.days[2]!.legs.map((l) => l.from)).toEqual(['fern-canyon', 'cedar-lake']);
    expect(result.total.totalMinutes).toBe(40 + 240 + 35 + 480 + 55);
  });

  it('keeps the whole-trip total equal to the sum of its legs when the plan has no days', () => {
    const result = computeTripTotals({ from: 'harbor-start', to: 'summit-end', days: [] }, [
      { from: 'harbor-start', to: 'summit-end', distanceMetres: 40_000, travelMinutes: 50 },
    ]);
    const legDistance = result.legs.reduce((sum, l) => sum + l.distanceMetres, 0);
    expect(result.total.distanceMetres).toBe(legDistance);
    expect(result.missingLegs.every((m) => m.day !== '')).toBe(true);
  });

  it('formats distances in km at the UI edge and rejects invalid numbers', () => {
    expect(formatDistanceKm(0)).toBe('0 km');
    expect(formatDistanceKm(12_000)).toBe('12 km');
    expect(formatDistanceKm(12_500)).toBe('12.5 km');
    expect(() => formatDistanceKm(-10)).toThrow(RangeError);
    expect(() =>
      computeTripTotals(
        {
          from: 'a',
          to: 'b',
          days: [{ day: '2026-08-01', stops: [{ placeId: 'c', stayMinutes: -5 }] }],
        },
        [],
      ),
    ).toThrow(RangeError);
  });
});
