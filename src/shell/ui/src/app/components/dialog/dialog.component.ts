/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, inject, input, output } from "@angular/core";

import { DialogTokens } from "../../models/dialog-tokens";

@Component({
  selector: "tr-dialog",
  templateUrl: "./dialog.component.html",
  styleUrl: "./dialog.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "(keydown.escape)": "dismiss($event)"
  }
})
export class DialogComponent {
  protected readonly titleId: string = inject(DialogTokens.titleId);

  public readonly title = input.required<string>();
  public readonly dismissed = output<void>();

  protected dismiss(event: Event): void {
    event.preventDefault();
    this.dismissed.emit();
  }
}
