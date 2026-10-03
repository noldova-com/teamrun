/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, input, type InputSignal } from "@angular/core";

@Component({
  selector: "tr-notes-note",
  templateUrl: "./note.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NoteComponent {
  public readonly instance: InputSignal<string> = input.required<string>();
  public readonly title: InputSignal<string> = input.required<string>();

  protected readonly sections: readonly string[] = ["Context", "Goals", "Decisions", "Open questions", "Risks", "Timeline", "Owners", "Dependencies", "Testing", "Rollout", "Follow-ups", "Notes from review"];
}
