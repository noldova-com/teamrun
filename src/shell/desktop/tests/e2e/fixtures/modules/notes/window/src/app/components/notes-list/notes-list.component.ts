/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { type IWindowPartContext, WindowPartTokens } from "@noldova/teamrun-shell-window";

@Component({
  selector: "tr-notes-list",
  templateUrl: "./notes-list.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotesListComponent {
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);

  protected readonly notes: readonly string[] = Array.from({ length: 40 }, (_, index) => `Meeting notes, week ${index + 1}`);

  protected preview(index: number, title: string): void {
    this.context.openDocument("notes.note", `week-${index + 1}`, title, { preview: true });
  }

  protected keep(index: number): void {
    this.context.keepDocument("notes.note", `week-${index + 1}`);
  }
}
