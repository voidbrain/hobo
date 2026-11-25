import { TestBed } from '@angular/core/testing';
import { Home } from './home';

describe('Home', () => {
  it('lists the time-on-site options', async () => {
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();
    const items = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('li')).map(
      (li) => li.textContent?.trim(),
    );
    expect(items).toEqual(['2 h', '4 h', '8 h']);
  });
});
