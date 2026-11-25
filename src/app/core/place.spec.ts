import { PLACE_LIMITS, validateNewPlace, validatePlacePatch } from './place';

// Invented places only: no real names, addresses or coordinates of the owner.
describe('validateNewPlace', () => {
  it('accepts a name alone and fills the other fields with empty values', () => {
    expect(validateNewPlace({ name: '  Lantern Hill  ' })).toEqual({
      ok: true,
      value: {
        name: 'Lantern Hill',
        description: '',
        images: [],
        category: null,
        tags: [],
        notes: '',
        location: null,
        timeSpent: null,
      },
    });
  });

  it('accepts every field', () => {
    const result = validateNewPlace({
      name: 'Old Mill Museum',
      description: 'A made-up museum',
      images: ['mill-1.jpg'],
      category: 'Museum',
      tags: ['rainy day', 'kids', 'kids'],
      notes: 'Closed on Mondays',
      location: { lat: 12.5, lng: -45.25 },
      timeSpent: 'half-day',
    });
    expect(result).toEqual({
      ok: true,
      value: {
        name: 'Old Mill Museum',
        description: 'A made-up museum',
        images: ['mill-1.jpg'],
        category: 'Museum',
        tags: ['rainy day', 'kids'],
        notes: 'Closed on Mondays',
        location: { lat: 12.5, lng: -45.25 },
        timeSpent: 'half-day',
      },
    });
  });

  it('requires a name', () => {
    expect(validateNewPlace({})).toEqual({ ok: false, errors: ['name is required'] });
    expect(validateNewPlace({ name: '   ' })).toEqual({ ok: false, errors: ['name is required'] });
  });

  it('rejects what is not an object', () => {
    for (const input of [null, 'Lantern Hill', ['Lantern Hill'], 3])
      expect(validateNewPlace(input).ok).toBe(false);
  });
});

describe('validatePlacePatch', () => {
  it('keeps only the fields given', () => {
    expect(validatePlacePatch({ notes: 'Bring water', timeSpent: '2h' })).toEqual({
      ok: true,
      value: { notes: 'Bring water', timeSpent: '2h' },
    });
    expect(validatePlacePatch({})).toEqual({ ok: true, value: {} });
  });

  it('clears category, location and time spent with null, and a blank category to null', () => {
    expect(validatePlacePatch({ category: ' ', location: null, timeSpent: null })).toEqual({
      ok: true,
      value: { category: null, location: null, timeSpent: null },
    });
  });

  it('collects every error', () => {
    const result = validatePlacePatch({
      name: '',
      timeSpent: '3h',
      location: { lat: 91, lng: 0 },
      tags: ['ok', ''],
      colour: 'red',
    });
    expect(result).toEqual({
      ok: false,
      errors: [
        'name is required',
        'timeSpent must be 2h, half-day or full-day',
        'location lat must be between -90 and 90',
        'a tag is required',
        'unknown field colour',
      ],
    });
  });

  it('rejects bad locations', () => {
    for (const location of [
      { lat: 0 },
      { lat: 0, lng: 181 },
      { lat: Number.NaN, lng: 0 },
      { lat: '1', lng: 2 },
      { lat: 1, lng: 2, alt: 3 },
      [1, 2],
    ])
      expect(validatePlacePatch({ location }).ok).toBe(false);
  });

  it('accepts image references only as plain file names', () => {
    expect(validatePlacePatch({ images: ['a.jpg', 'b_2-x.webp'] }).ok).toBe(true);
    for (const ref of ['../secret', 'dir/a.jpg', '.hidden', '', 7])
      expect(validatePlacePatch({ images: [ref] }).ok).toBe(false);
  });

  it('enforces the length limits', () => {
    expect(validatePlacePatch({ name: 'x'.repeat(PLACE_LIMITS.name + 1) }).ok).toBe(false);
    expect(validatePlacePatch({ notes: 'x'.repeat(PLACE_LIMITS.text + 1) }).ok).toBe(false);
    const tags = Array.from({ length: PLACE_LIMITS.tags + 1 }, (_, i) => `tag ${i}`);
    expect(validatePlacePatch({ tags }).ok).toBe(false);
    expect(validatePlacePatch({ tags: 'kids' }).ok).toBe(false);
    expect(validatePlacePatch({ description: 5 }).ok).toBe(false);
    expect(validatePlacePatch({ category: 'x'.repeat(PLACE_LIMITS.category + 1) }).ok).toBe(false);
    const images = Array.from({ length: PLACE_LIMITS.images + 1 }, (_, i) => `img-${i}.jpg`);
    expect(validatePlacePatch({ images }).ok).toBe(false);
    expect(validatePlacePatch({ images: 'a.jpg' }).ok).toBe(false);
    expect(validatePlacePatch({ location: 'here' }).ok).toBe(false);
    expect(validatePlacePatch({ timeSpent: 120 }).ok).toBe(false);
  });
});
