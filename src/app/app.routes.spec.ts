import { routes } from './app.routes';

describe('app routes', () => {
  it('loads the trips page at /trips', async () => {
    const route = routes.find((candidate) => candidate.path === 'trips');

    expect(route?.title).toBe('Trips · Hobo');
    expect(await route?.loadComponent?.()).toHaveProperty('TripsPage');
  });
});
