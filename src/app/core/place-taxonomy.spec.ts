import type { Place } from './place';
import { filterPlaces, groupPlaces, reassignPlaceTaxonomy, taxonomyValues } from './place-taxonomy';

const place = (id: string, category: string | null, tags: string[]): Place => ({
  id,
  name: id,
  description: '',
  images: [],
  category,
  tags,
  notes: '',
  location: null,
  timeSpent: null,
  createdAt: '2026-11-27T10:00:00.000Z',
  updatedAt: '2026-11-27T10:00:00.000Z',
});

describe('place taxonomy (F-002-T05)', () => {
  const places = [
    place('Harbour', 'Outdoors', ['water', 'family']),
    place('Museum', 'Culture', ['family']),
    place('Picnic', null, []),
  ];

  it('lists distinct categories and tags in stable sorted order', () => {
    expect(taxonomyValues(places, 'category')).toEqual(['Culture', 'Outdoors']);
    expect(taxonomyValues(places, 'tag')).toEqual(['family', 'water']);
  });

  it('filters by both category and tag', () => {
    expect(filterPlaces(places, 'Outdoors', 'family').map((item) => item.id)).toEqual(['Harbour']);
    expect(filterPlaces(places, 'Culture', 'water')).toEqual([]);
  });

  it('groups places by category or tag, including empty assignments', () => {
    expect(
      groupPlaces(places, 'category').map(({ label, places: items }) => [
        label,
        items.map((p) => p.id),
      ]),
    ).toEqual([
      ['Culture', ['Museum']],
      ['No category', ['Picnic']],
      ['Outdoors', ['Harbour']],
    ]);
    expect(
      groupPlaces(places, 'tag').map(({ label, places: items }) => [label, items.map((p) => p.id)]),
    ).toEqual([
      ['family', ['Harbour', 'Museum']],
      ['No tags', ['Picnic']],
      ['water', ['Harbour']],
    ]);
  });

  it('renames, merges and clears a category or tag on an affected place', () => {
    const harbour = places[0]!;
    expect(reassignPlaceTaxonomy(harbour, 'category', 'Outdoors', 'Nature')).toEqual({
      ...harbour,
      category: 'Nature',
    });
    expect(reassignPlaceTaxonomy(harbour, 'category', 'Outdoors', null)).toEqual({
      ...harbour,
      category: null,
    });
    expect(reassignPlaceTaxonomy(harbour, 'tag', 'water', 'family')).toEqual({
      ...harbour,
      tags: ['family'],
    });
    expect(reassignPlaceTaxonomy(harbour, 'tag', 'water', null)).toEqual({
      ...harbour,
      tags: ['family'],
    });
    expect(reassignPlaceTaxonomy(harbour, 'tag', 'missing', 'family')).toBeNull();
  });
});
