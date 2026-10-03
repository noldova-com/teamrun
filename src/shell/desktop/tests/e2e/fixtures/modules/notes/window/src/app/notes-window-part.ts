/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader } from "@noldova/teamrun-foundation-json";
import { CommandContribution, DockSide, DocumentContribution, type IWindowPart, type IWindowPartContext, ViewContribution } from "@noldova/teamrun-shell-window";

export class NotesWindowPart implements IWindowPart {
  private static readonly MANY_VIEWS: readonly [string, string, string, DockSide][] = [
    ["notes.search", "Search", "search", DockSide.Left],
    ["notes.changes", "Source control", "account_tree", DockSide.Left],
    ["notes.tasks", "Tasks", "checklist", DockSide.Left],
    ["notes.bookmarks", "Bookmarks", "bookmark", DockSide.Left],
    ["notes.teammates", "Teammates", "group", DockSide.Right],
    ["notes.conversation", "Conversation", "forum", DockSide.Right],
    ["notes.timeline", "Timeline", "timeline", DockSide.Right],
    ["notes.references", "References and call hierarchy", "link", DockSide.Right],
    ["notes.activity", "Activity", "notifications", DockSide.Right],
    ["notes.comments", "Comments", "comment", DockSide.Right],
    ["notes.reviews", "Reviews", "rate_review", DockSide.Right],
    ["notes.history", "History", "history", DockSide.Right],
    ["notes.terminal", "Terminal", "terminal", DockSide.Bottom],
    ["notes.problems", "Problems", "error", DockSide.Bottom],
    ["notes.output", "Output", "article", DockSide.Bottom],
    ["notes.debug", "Debug console", "bug_report", DockSide.Bottom]
  ];
  private static readonly MANY_TITLES: readonly string[] = [
    "Plan", "README.md", "Ideas", "Release checklist for the October build", "Todo", "Meeting notes 2026-09-30",
    "Shell architecture review: the module contract, runtime boundaries and what the window may cache between restarts",
    "Bugs", "Onboarding", "Provider consistency", "Docking", "layout.service.ts", "Status bar", "Window row design",
    "Q4 roadmap", "Draft", "Notes from the launch review", "API", "Sync pricing", "Teammates",
    "Terminal plan", "Keyboard shortcuts and command search, including collisions between modules and the person's own bindings",
    "Fonts", "Themes", "Accessibility audit", "Telemetry", "Crash reports", "Settings", "Search", "Icons",
    "Translations", "Changelog", "Contributing", "Security", "Merge queue", "CI time", "Release notes", "Signing",
    "Updates on Linux", "Packaging", "Menus", "Tooltips", "A very long note title that keeps going so the tab has to truncate somewhere sensible",
    "Help", "FAQ", "Website", "Logo", "Ship it"
  ];

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
    if (!JsonReader.fromValue(await context.requestAsync("notes.manyTabs", null)).readBoolean("isMany"))
      return;
    for (const [name, title, icon, side] of NotesWindowPart.MANY_VIEWS)
      context.registerView(new ViewContribution(name, title, icon, side, true,
        () => import("./components/notes-outline/notes-outline.component").then(t => t.NotesOutlineComponent)));
    NotesWindowPart.MANY_TITLES.forEach((title, index) => context.openDocument("notes.note", String(index + 3), title));
    count += NotesWindowPart.MANY_TITLES.length;
  }

  public async deactivateAsync(): Promise<void> {
  }
}
