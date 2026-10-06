/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, type InputSignal, type Signal, signal, type WritableSignal } from "@angular/core";

import { QualifiedName, SettingScope } from "@noldova/teamrun-shell-protocol";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/teamrun-shell-window";

import { NotesState } from "../../notes-state";

@Component({
  selector: "tr-notes-note",
  templateUrl: "./note.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NoteComponent {
  private static readonly WRAPS_LINES: string = "notes.wrapsLines";
  private static readonly INBOX: SettingScope = new SettingScope(QualifiedName.parse("notes.folder"), "inbox");

  public readonly instance: InputSignal<string> = input.required<string>();
  public readonly title: InputSignal<string> = input.required<string>();

  protected readonly runtime: Signal<string> = NotesState.runtime;
  protected readonly continued: Signal<number> = NotesState.continued;
  protected readonly saving: Signal<string> = NotesState.saving;
  protected readonly savings: readonly ["saves" | "fails" | "hangs", string][] = [["saves", "Save normally"], ["fails", "Fail saving"], ["hangs", "Never finish saving"]];
  protected readonly sections: readonly string[] = ["Context", "Goals", "Decisions", "Open questions", "Risks", "Timeline", "Owners", "Dependencies", "Testing", "Rollout", "Follow-ups", "Notes from review"];
  protected readonly wrapping: WritableSignal<string> = signal("");
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly note: Signal<SettingScope> = computed(() => new SettingScope(QualifiedName.parse("notes.entry"), this.instance()));
  private reads: number = 0;

  public constructor() {
    effect(() => this.readWrapping(this.note()));
    inject(DestroyRef).onDestroy(this.context.onSettingChanged(NoteComponent.WRAPS_LINES, () => this.readWrapping(this.note())));
  }

  protected wrapNote(): void {
    void this.context.writeSettingAsync(NoteComponent.WRAPS_LINES, true, this.note());
  }

  protected resetNote(): void {
    void this.context.resetSettingAsync(NoteComponent.WRAPS_LINES, this.note());
  }

  protected wrapInbox(): void {
    void this.context.writeSettingAsync(NoteComponent.WRAPS_LINES, true, NoteComponent.INBOX);
  }

  protected resetInbox(): void {
    void this.context.resetSettingAsync(NoteComponent.WRAPS_LINES, NoteComponent.INBOX);
  }

  protected saveBy(saving: "saves" | "fails" | "hangs"): void {
    NotesState.saving.set(saving);
  }

  private readWrapping(note: SettingScope): void {
    const read = ++this.reads;
    const show = (text: string): void => {
      if (read === this.reads)
        this.wrapping.set(text);
    };
    this.context.readSettingAsync(NoteComponent.WRAPS_LINES, note).then(
      t => show(`Wraps lines: ${t.value === true ? "yes" : "no"}, ${t.isSet ? "set for this note" : "not set for this note"}`),
      (error: unknown) => show(`The runtime did not answer: ${String(error)}`));
  }
}
