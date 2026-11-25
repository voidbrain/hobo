import { Component } from '@angular/core';
import { TIME_SPENT_OPTIONS, formatMinutes, timeSpentMinutes } from '../../core/time-spent';

@Component({
  selector: 'hobo-home',
  template: `
    <h1>Plan a trip</h1>
    <p class="lead">Collect places, build trips, compare routes. Nothing here yet: places come first.</p>
    <p class="muted">Time on site per place:</p>
    <ul>
      @for (option of options; track option) {
        <li>{{ format(minutes(option)) }}</li>
      }
    </ul>
  `,
  styles: `
    .lead {
      font-size: var(--font-size-body);
    }
    .muted {
      color: var(--color-muted);
      font-size: var(--font-size-small);
    }
  `,
})
export class Home {
  protected readonly options = TIME_SPENT_OPTIONS;
  protected readonly minutes = timeSpentMinutes;
  protected readonly format = formatMinutes;
}
