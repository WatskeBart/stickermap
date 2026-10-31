import { Component, booleanAttribute, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Distance pill on the map: halfway along a distance line, or `compact` as a tag under a sticker.
 * Put it on a `<button>` when clicking it should do something.
 */
@Component({
  selector: '[appDistanceLabel]',
  imports: [MatIconModule],
  templateUrl: './distance-label.component.html',
  styleUrl: './distance-label.component.scss',
  host: { '[class.compact]': 'compact()' },
})
export class DistanceLabelComponent {
  readonly distance = input.required<string>();
  readonly icon = input<string | null>(null);
  readonly poster = input<string | null>(null);
  readonly compact = input(false, { transform: booleanAttribute });
}
