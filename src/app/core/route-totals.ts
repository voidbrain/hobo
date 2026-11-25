// Framework-free domain code: no Angular imports (eslint and check:conventions enforce it).
import { type TimeSpent, timeSpentMinutes } from './time-spent';

/** Duration on site for one stop: a preset kind or an explicit whole-minute count. */
export type StopStay =
  | { readonly timeSpent: TimeSpent; readonly stayMinutes?: never }
  | { readonly stayMinutes: number; readonly timeSpent?: never };

export type RouteStop = {
  readonly placeId: string;
} & StopStay;

export interface RouteDay {
  readonly day: string;
  readonly stops: readonly RouteStop[];
}

export interface RoutePlan {
  readonly from: string;
  readonly to: string;
  readonly days: readonly RouteDay[];
}

export interface LegMetrics {
  readonly distanceMetres: number;
  readonly travelMinutes: number;
}

export interface RouteLeg extends LegMetrics {
  readonly from: string;
  readonly to: string;
}

export interface ComputedLeg extends RouteLeg {
  readonly day: string;
}

export interface MissingLeg {
  readonly day: string;
  readonly from: string;
  readonly to: string;
}

export interface TotalsSummary {
  readonly distanceMetres: number;
  readonly travelMinutes: number;
  readonly stayMinutes: number;
  readonly totalMinutes: number;
}

export interface DayRouteTotals extends TotalsSummary {
  readonly day: string;
  readonly stopCount: number;
  readonly legs: readonly ComputedLeg[];
}

export interface TripRouteTotals {
  readonly legs: readonly ComputedLeg[];
  readonly days: readonly DayRouteTotals[];
  readonly total: TotalsSummary;
  readonly missingLegs: readonly MissingLeg[];
}

export interface SelectedDaysTotals extends TotalsSummary {
  readonly days: readonly DayRouteTotals[];
  readonly legs: readonly ComputedLeg[];
  readonly stopCount: number;
}

function nonNegativeWhole(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`Invalid ${label}: ${value}`);
  }
  return Math.round(value);
}

function stopStayMinutes(stop: RouteStop): number {
  if (stop.stayMinutes !== undefined) {
    return nonNegativeWhole(stop.stayMinutes, 'stayMinutes');
  }
  return timeSpentMinutes(stop.timeSpent);
}

/** Collision-safe map key for a directed leg between two place IDs. */
export function legKey(from: string, to: string): string {
  return JSON.stringify([from, to]);
}

function toLegLookup(
  legs: readonly RouteLeg[] | ReadonlyMap<string, LegMetrics>,
): ReadonlyMap<string, LegMetrics> {
  if (legs instanceof Map) return legs;
  const map = new Map<string, LegMetrics>();
  for (const leg of legs as readonly RouteLeg[]) {
    map.set(legKey(leg.from, leg.to), {
      distanceMetres: nonNegativeWhole(leg.distanceMetres, 'distanceMetres'),
      travelMinutes: nonNegativeWhole(leg.travelMinutes, 'travelMinutes'),
    });
  }
  return map;
}

function summarize(days: readonly DayRouteTotals[]): TotalsSummary {
  let distanceMetres = 0;
  let travelMinutes = 0;
  let stayMinutes = 0;
  for (const day of days) {
    distanceMetres += day.distanceMetres;
    travelMinutes += day.travelMinutes;
    stayMinutes += day.stayMinutes;
  }
  return {
    distanceMetres,
    travelMinutes,
    stayMinutes,
    totalMinutes: travelMinutes + stayMinutes,
  };
}

/**
 * Pure route totals over a trip's ordered days/stops and leg metrics (F-004-T01):
 * A -> B travel + B stay + B -> C travel + ...; `from` and `to` endpoints add no stay.
 */
export function computeTripTotals(
  plan: RoutePlan,
  legs: readonly RouteLeg[] | ReadonlyMap<string, LegMetrics>,
): TripRouteTotals {
  const lookup = toLegLookup(legs);
  const missingLegs: MissingLeg[] = [];
  const allLegs: ComputedLeg[] = [];
  const dayBuckets = plan.days.map((d) => ({
    day: d.day,
    stopCount: d.stops.length,
    stayMinutes: 0,
    legs: [] as ComputedLeg[],
  }));

  const appendLeg = (bucketIndex: number, dayName: string, from: string, to: string) => {
    let distanceMetres = 0;
    let travelMinutes = 0;
    if (from !== to) {
      const found = lookup.get(legKey(from, to));
      if (found) {
        distanceMetres = nonNegativeWhole(found.distanceMetres, 'distanceMetres');
        travelMinutes = nonNegativeWhole(found.travelMinutes, 'travelMinutes');
      } else {
        missingLegs.push({ day: dayName, from, to });
      }
    }
    const leg: ComputedLeg = { day: dayName, from, to, distanceMetres, travelMinutes };
    allLegs.push(leg);
    if (bucketIndex >= 0) dayBuckets[bucketIndex]!.legs.push(leg);
  };

  const totalStops = plan.days.reduce((sum, d) => sum + d.stops.length, 0);
  let cursor = plan.from;

  for (let i = 0; i < plan.days.length; i++) {
    const dayInput = plan.days[i]!;
    const bucket = dayBuckets[i]!;
    for (const stop of dayInput.stops) {
      appendLeg(i, dayInput.day, cursor, stop.placeId);
      cursor = stop.placeId;
      bucket.stayMinutes += stopStayMinutes(stop);
    }
  }

  // Return/final leg to `plan.to` (no stay at `to`); skipped when 0 stops and `from === to`, or when already at `to`.
  if (totalStops > 0 ? cursor !== plan.to : plan.from !== plan.to) {
    const lastIdx = dayBuckets.length - 1;
    const lastDay = lastIdx >= 0 ? dayBuckets[lastIdx]!.day : '';
    appendLeg(lastIdx, lastDay, cursor, plan.to);
  }

  const days: DayRouteTotals[] = dayBuckets.map((bucket) => {
    const distanceMetres = bucket.legs.reduce((sum, l) => sum + l.distanceMetres, 0);
    const travelMinutes = bucket.legs.reduce((sum, l) => sum + l.travelMinutes, 0);
    return {
      day: bucket.day,
      stopCount: bucket.stopCount,
      distanceMetres,
      travelMinutes,
      stayMinutes: bucket.stayMinutes,
      totalMinutes: travelMinutes + bucket.stayMinutes,
      legs: bucket.legs,
    };
  });

  return {
    legs: allLegs,
    days,
    total: summarize(days),
    missingLegs,
  };
}

/** Filters computed trip totals to one day, a set of days, or the whole trip when omitted. */
export function selectDaysTotals(
  tripTotals: TripRouteTotals,
  selectedDays?: ReadonlySet<string> | readonly string[],
): SelectedDaysTotals {
  const filter = selectedDays
    ? selectedDays instanceof Set
      ? selectedDays
      : new Set(selectedDays)
    : undefined;
  const days = filter ? tripTotals.days.filter((d) => filter.has(d.day)) : tripTotals.days;
  const legs = days.flatMap((d) => d.legs);
  const stopCount = days.reduce((sum, d) => sum + d.stopCount, 0);
  return {
    days,
    legs,
    stopCount,
    ...summarize(days),
  };
}

/** 12500 -> "12.5 km", 12000 -> "12 km", 0 -> "0 km". */
export function formatDistanceKm(metres: number): string {
  if (!Number.isFinite(metres) || metres < 0) {
    throw new RangeError(`Not a distance in metres: ${metres}`);
  }
  const tenths = Math.round(metres / 100);
  const km = tenths / 10;
  return `${Number.isInteger(km) ? km.toFixed(0) : km.toFixed(1)} km`;
}
