/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader } from "@noldova/teamrun-foundation-json";
import { CommandRun, NotificationAction, NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/teamrun-shell-protocol";
import {
  CommandContribution, ContentPadding, DockSide, DocumentContribution, type IViewDialogOptions, type IWindowPart, type IWindowPartContext, MenuRowContribution, type StatusBarItem, StatusBarItemContribution, StatusBarItemState, StatusBarSide,
  TopBarActionContribution, TopBarActionState, TopBarSide, ViewContribution
} from "@noldova/teamrun-shell-window";

import { NotesState } from "./notes-state";

export class NotesWindowPart implements IWindowPart {
  private static readonly SORTINGS: readonly [string, string, string][] = [["notes.sortByTitle", "Sort by title", "title"], ["notes.sortByWeek", "Sort by week", "week"]];
  private static readonly SHOWN_IN_DIALOG: readonly [string, string, string, IViewDialogOptions][] = [
    ["notes.showListInDialog", "Show the notes list in a dialog", "notes.list", {}],
    ["notes.showNoteInDialog", "Show note 1 in a dialog", "notes.note", { instance: "1", title: "Note 1" }],
    ["notes.showSettingsInDialog", "Show Settings in a dialog", "shell.settings", {}]
  ];
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
    "Translations", "Changelog", "Contributing", "Security", "Rate limits", "CI time", "Release notes", "Signing",
    "Updates on Linux", "Packaging", "Menus", "Tooltips", "A very long note title that keeps going so the tab has to truncate somewhere sensible",
    "Help", "FAQ", "Website", "Logo", "Ship it"
  ];

  private static readonly DEEP_BREADCRUMB: readonly string[] = [
    "Team notes kept for the whole release", "Archive of everything decided before the launch", "Reviews of the window and its controls", "Weeks 38 to 41"
  ];

  private static readonly LONG_COUNT: string = "2 notes, neither pinned nor archived, both last changed today by the person who wrote them, and both waiting for review";
  private static readonly SAVE_FAILED: NotificationPost = new NotificationPost(
    QualifiedName.parse("notes.saveFailed"), null, "Note 2 couldn't be saved", "The disk is full.", NotificationSeverity.Error, null,
    [new NotificationAction("New note", new CommandRun(QualifiedName.parse("notes.newNote"), null))], null);

  private continueAsync: () => Promise<void> = () => Promise.reject(new Error("The notes window part is not active."));

  public readonly moduleId: string = "notes";

  public async activateAsync(context: IWindowPartContext): Promise<void> {
    context.registerView(new ViewContribution("notes.list", "Notes", "sticky_note_2", DockSide.Left, true,
      () => import("./components/notes-list/notes-list.component").then(t => t.NotesListComponent)));
    context.registerView(new ViewContribution("notes.outline", "Outline", "toc", DockSide.Left, true,
      () => import("./components/notes-outline/notes-outline.component").then(t => t.NotesOutlineComponent), ContentPadding.None));
    context.registerDocument(new DocumentContribution("notes.note",
      () => import("./components/note/note.component").then(t => t.NoteComponent)));
    context.registerSave(() => NotesWindowPart.saveAsync());
    context.openDocument("notes.note", "1", "Note 1", { breadcrumb: ["Notes", "Drafts"] });
    context.openDocument("notes.note", "2", "Note 2", { breadcrumb: ["Notes"] });
    let count = 2;
    const counter = context.registerStatusBarItem(new StatusBarItemContribution("notes.count", StatusBarSide.Left, new StatusBarItemState("2 notes")));
    context.registerCommand(new CommandContribution("notes.newNote", "New note", "note_add", "Mod+Alt+N", async () => {
      count++;
      context.openDocument("notes.note", String(count), `Note ${count}`);
      counter.update(new StatusBarItemState(`${count} notes`));
      return count;
    }));
    context.registerCommand(new CommandContribution("notes.openNote", "Open note", "open_in_new", null, async commandArguments => {
      const note = JsonReader.fromValue(commandArguments);
      context.openDocument("notes.note", `week-${note.readInteger("week")}`, note.readString("title"));
      return null;
    }, commandArguments => commandArguments !== null && JsonReader.fromValue(commandArguments).hasField("week")));
    context.registerCommand(new CommandContribution("notes.moveNote", "Move note 2 deep into the archive", null, null, async () => {
      context.updateDocument("notes.note", "2", { title: "Note 2, moved after the review of the window row", breadcrumb: NotesWindowPart.DEEP_BREADCRUMB });
      return null;
    }));
    for (const [name, title, by] of NotesWindowPart.SORTINGS)
      context.registerCommand(new CommandContribution(name, title, null, null, async () => {
        NotesState.sortBy.set(by);
        return null;
      }, () => true, () => NotesState.sortBy() === by));
    context.registerCommand(new CommandContribution("notes.wrapLines", "Wrap lines", "wrap_text", null, async () => {
      NotesState.wrapsLines.update(t => !t);
      return null;
    }, () => true, () => NotesState.wrapsLines()));
    for (const [name, title, shown, options] of NotesWindowPart.SHOWN_IN_DIALOG)
      context.registerCommand(new CommandContribution(name, title, "open_in_full", null, async () => {
        await context.showInDialogAsync(shown, options);
        return null;
      }));
    context.provideMenuGroup("notes.mainRecent", () => [1, 2].map(week => new MenuRowContribution("notes.openNote", { week, title: `Week ${week}` }, `Week ${week}`)));
    context.registerTopBarAction(new TopBarActionContribution("notes.compose", new TopBarActionState("note_add", "New note", "notes.newNote")));
    context.registerTopBarAction(new TopBarActionContribution("notes.back", new TopBarActionState("arrow_back", "Back", "notes.sortByWeek"), TopBarSide.Start));
    let saveFailed = await context.postNotificationAsync(NotesWindowPart.SAVE_FAILED);
    const options = await NotesWindowPart.readOptionsAsync(context, counter);
    this.continueAsync = async () => {
      if (!await saveFailed.updateAsync(NotesWindowPart.SAVE_FAILED))
        saveFailed = await context.postNotificationAsync(NotesWindowPart.SAVE_FAILED);
      await NotesWindowPart.readOptionsAsync(context, counter);
      NotesState.continued.update(t => t + 1);
    };
    if (!options.readBoolean("isMany"))
      return;
    for (const [name, title, icon, side] of NotesWindowPart.MANY_VIEWS)
      context.registerView(new ViewContribution(name, title, icon, side, true,
        () => import("./components/notes-outline/notes-outline.component").then(t => t.NotesOutlineComponent)));
    NotesWindowPart.MANY_TITLES.forEach((title, index) => context.openDocument("notes.note", String(index + 3), title));
    count += NotesWindowPart.MANY_TITLES.length;
    counter.update(new StatusBarItemState(`${count} notes`));
  }

  public async reconnectAsync(): Promise<boolean> {
    await this.continueAsync();
    return true;
  }

  public async deactivateAsync(): Promise<void> {
  }

  private static saveAsync(): Promise<void> {
    switch (NotesState.saving()) {
      case "fails":
        return Promise.reject(new Error("The disk is full."));
      case "hangs":
        return new Promise<void>(() => undefined);
      default:
        return Promise.resolve();
    }
  }

  private static async readOptionsAsync(context: IWindowPartContext, counter: StatusBarItem): Promise<JsonReader> {
    const options = JsonReader.fromValue(await context.requestAsync("notes.options", null));
    NotesState.runtime.set(options.readString("runtime"));
    if (options.readBoolean("isLongCount"))
      counter.update(new StatusBarItemState(NotesWindowPart.LONG_COUNT, { command: "notes.newNote" }));
    return options;
  }
}
