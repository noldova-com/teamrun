/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CommandContribution, DockSide, DocumentContribution, type IWindowPart, type IWindowPartContext, ViewContribution } from "@noldova/teamrun-shell-window";

export class NotesWindowPart implements IWindowPart {
  public readonly moduleId: string = "notes";

  public async activateAsync(context: IWindowPartContext): Promise<void> {
    context.registerView(new ViewContribution("notes.list", "Notes", "sticky_note_2", DockSide.Left, true,
      () => import("./components/notes-list/notes-list.component").then(t => t.NotesListComponent)));
    context.registerView(new ViewContribution("notes.outline", "Outline", "toc", DockSide.Left, true,
      () => import("./components/notes-outline/notes-outline.component").then(t => t.NotesOutlineComponent)));
    context.registerDocument(new DocumentContribution("notes.note",
      () => import("./components/note/note.component").then(t => t.NoteComponent)));
    context.openDocument("notes.note", "1", "Note 1");
    context.openDocument("notes.note", "2", "Note 2");
    let count = 2;
    context.registerCommand(new CommandContribution("notes.newNote", "New note", "note_add", "Mod+Alt+N", async () => {
      count++;
      context.openDocument("notes.note", String(count), `Note ${count}`);
      return count;
    }));
  }

  public async deactivateAsync(): Promise<void> {
  }
}
