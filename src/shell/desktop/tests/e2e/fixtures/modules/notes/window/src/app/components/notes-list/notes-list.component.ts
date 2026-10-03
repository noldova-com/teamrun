/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "tr-notes-list",
  templateUrl: "./notes-list.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotesListComponent {
  protected readonly notes: readonly string[] = Array.from({ length: 40 }, (_, index) => `Meeting notes, week ${index + 1}`);
}
