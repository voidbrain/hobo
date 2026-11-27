import { routes } from './app.routes';
import { TripsPage } from './pages/trips/trips-page';

describe('app routes', () => {
  it('loads the trips page at /trips', async () => {
    const route = routes.find((candidate) => candidate.path === 'trips');

    expect(route?.title).toBe('Trips · Hobo');
    expect(await route?.loadComponent?.()).toBe(TripsPage);
  });
});
