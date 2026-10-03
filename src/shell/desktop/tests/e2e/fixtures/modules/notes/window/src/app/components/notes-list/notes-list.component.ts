/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type Signal, computed, inject } from "@angular/core";

import { type IWindowPartContext, MenuDirective, WindowPartTokens } from "@noldova/teamrun-shell-window";

import { NotesState } from "../../notes-state";

@Component({
  selector: "tr-notes-list",
  imports: [MenuDirective],
  templateUrl: "./notes-list.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotesListComponent {
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);

  protected readonly sortBy: Signal<string> = NotesState.sortBy.asReadonly();
  protected readonly wrapsLines: Signal<boolean> = NotesState.wrapsLines.asReadonly();
  protected readonly sorted: Signal<readonly { week: number; title: string }[]> = computed(() => {
    const notes = Array.from({ length: 40 }, (_, index) => ({ week: index + 1, title: `Meeting notes, week ${index + 1}` }));
    return this.sortBy() === "title" ? [...notes].sort((a, b) => a.title.localeCompare(b.title)) : notes;
  });

  protected preview(week: number, title: string): void {
    this.context.openDocument("notes.note", `week-${week}`, title, { preview: true });
  }

  protected keep(week: number): void {
    this.context.keepDocument("notes.note", `week-${week}`);
  }
}
