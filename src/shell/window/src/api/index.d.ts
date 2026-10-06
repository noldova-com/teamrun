/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { InjectionToken, InputSignal, Signal, Type } from "@angular/core";
import type { JsonObject, JsonValue } from "@noldova/teamrun-foundation-json";
import type { KeyChord, NotificationPost, SettingEntry, SettingScope } from "@noldova/teamrun-shell-protocol";

/**
 * Whether the shell pads the page a view or document shows. The shell pads
 * every page by default, 0.75rem at the sides in the default theme, so the
 * page's content starts where its tab's icon does, and at the top and bottom
 * by where the page shows: 1rem in the middle or a dialog and 0.5rem in a
 * dock, so a view moved into the middle is padded as a document. A page
 * that runs edge to edge, such as a terminal or a code editor, turns it off at
 * any of three levels: its module for all of its views and documents, its
 * declaration, or the page itself at runtime. The page's choice wins over its
 * declaration's, and the declaration's over its module's.
 */
export declare enum ContentPadding {
  /**
   * The shell's padding for the place the page shows in.
   */
  Default = "Default",

  /**
   * No padding: the page reaches the edges of its panel.
   */
  None = "None"
}

/**
 * The docks a view can belong to.
 */
export declare enum DockSide {
  /**
   * The dock at the window's start.
   */
  Left = "Left",

  /**
   * The dock at the window's end.
   */
  Right = "Right",

  /**
   * The dock along the window's bottom.
   */
  Bottom = "Bottom"
}

/**
 * The side of the status bar an item stands on.
 */
export declare enum StatusBarSide {
  /**
   * The start of the status bar.
   */
  Left = "Left",

  /**
   * The end of the status bar, before the shell's own items.
   */
  Right = "Right"
}

/**
 * The side of the window's top row an action stands on.
 */
export declare enum TopBarSide {
  /**
   * Right after the menus.
   */
  Start = "Start",

  /**
   * Beside the window controls and the active document's breadcrumb.
   */
  End = "End"
}

/**
 * How {@link IWindowPartContext.openDocument} opens a document.
 */
export interface IDocumentOptions {
  /**
   * Whether the document opens as a preview, which the next preview in its
   * group replaces until the person keeps it; false when left out. The
   * shared setting `shell.previewTabs` turns previews off, and then every
   * document opens as an ordinary tab.
   */
  readonly preview?: boolean;
}

/**
 * What a status-bar item shows besides its text, and what it runs.
 */
export interface IStatusBarItemOptions {
  /**
   * The glyph shown before the text; none when left out.
   */
  readonly icon?: string;

  /**
   * The tooltip, which is also the item's accessible name; the text names
   * it when left out.
   */
  readonly tooltip?: string;

  /**
   * The command the item runs, `<module id>.<name>`, from its module or a
   * dependency; the item is a button only when it has one.
   */
  readonly command?: string;

  /**
   * The arguments the command runs with; null when left out.
   */
  readonly commandArguments?: JsonValue;

  /**
   * Whether the item is hidden; false when left out.
   */
  readonly isHidden?: boolean;
}

/**
 * What a top-bar action runs its command with, and whether it shows.
 */
export interface ITopBarActionOptions {
  /**
   * The arguments the command runs with; null when left out.
   */
  readonly commandArguments?: JsonValue;

  /**
   * Whether the action is hidden; false when left out.
   */
  readonly isHidden?: boolean;
}

/**
 * Which view or document {@link IWindowPartContext.showInDialogAsync} shows,
 * and the dialog's title.
 */
export interface IViewDialogOptions {
  /**
   * The instance of a document, as {@link IWindowPartContext.openDocument}
   * names it; left out for a view.
   */
  readonly instance?: string;

  /**
   * The dialog's title; the view's or document's own title when left out.
   */
  readonly title?: string;
}

/**
 * A module's window part: what the window activates, asks to continue after
 * the runtime starts again, and deactivates. A module's window part exports
 * it as `windowPart` from its `src/api/index.ts`, where the build finds it.
 * Activation stays light; a part loads heavy code when its first view opens.
 */
export interface IWindowPart {
  /**
   * The module's id, which is its folder's name.
   */
  readonly moduleId: string;

  /**
   * The padding of the module's views and documents that declare none.
   * Leaving it out keeps the shell's padding.
   *
   * @example
   * ```ts
   * import { Component } from "@angular/core";
   * import { ContentPadding, DockSide, type IWindowPart, type IWindowPartContext, ViewContribution } from "@noldova/teamrun-shell-window";
   *
   * @Component({ selector: "tr-terminal-panel", template: "<div class=\"terminal\"></div>" })
   * export class TerminalPanelComponent {
   * }
   *
   * export class TerminalWindowPart implements IWindowPart {
   *   public readonly moduleId: string = "terminal";
   *   public readonly padding: ContentPadding = ContentPadding.None;
   *
   *   public activateAsync(context: IWindowPartContext): Promise<void> {
   *     context.registerView(new ViewContribution("terminal.panel", "Terminal", "terminal", DockSide.Bottom, true, () => Promise.resolve(TerminalPanelComponent)));
   *     return Promise.resolve();
   *   }
   *
   *   public reconnectAsync(): Promise<boolean> {
   *     return Promise.resolve(true);
   *   }
   *
   *   public deactivateAsync(): Promise<void> {
   *     return Promise.resolve();
   *   }
   * }
   * ```
   */
  readonly padding?: ContentPadding;

  /**
   * Registers the part's contributions through its context. The window
   * calls it once, in module order, after the parts of the module's
   * dependencies have activated.
   *
   * @param context The part's context, which it keeps until it deactivates.
   * @returns A promise that settles once the part has activated; a rejection
   * fails the part in this window alone and withdraws its contributions.
   * @example
   * ```ts
   * import { type IWindowPart, type IWindowPartContext, StatusBarItemContribution, StatusBarItemState, StatusBarSide } from "@noldova/teamrun-shell-window";
   *
   * export class ClockWindowPart implements IWindowPart {
   *   public readonly moduleId: string = "clock";
   *
   *   public activateAsync(context: IWindowPartContext): Promise<void> {
   *     context.registerStatusBarItem(new StatusBarItemContribution("clock.time", StatusBarSide.Right, new StatusBarItemState("12:00")));
   *     return Promise.resolve();
   *   }
   *
   *   public reconnectAsync(): Promise<boolean> {
   *     return Promise.resolve(false);
   *   }
   *
   *   public deactivateAsync(): Promise<void> {
   *     return Promise.resolve();
   *   }
   * }
   * ```
   */
  activateAsync(context: IWindowPartContext): Promise<void>;

  /**
   * Asks the part, once the runtime is ready again, whether it continues
   * with its context, contributions, views and documents. Before resolving
   * true, the part reads again through its context everything it took from
   * the runtime, including its notifications, because the new runtime may
   * hold other state and events sent while it was away are lost.
   *
   * @returns A promise of true when the part continues, or false to have the
   * window deactivate it and activate it again, which is always safe; a
   * rejection rebuilds it the same way and logs the failure.
   * @example
   * ```ts
   * import type { JsonValue } from "@noldova/teamrun-foundation-json";
   * import type { IWindowPart, IWindowPartContext } from "@noldova/teamrun-shell-window";
   *
   * export class NotesWindowPart implements IWindowPart {
   *   private context: IWindowPartContext | null = null;
   *
   *   public readonly moduleId: string = "notes";
   *   public notes: JsonValue = null;
   *
   *   public async activateAsync(context: IWindowPartContext): Promise<void> {
   *     this.context = context;
   *     this.notes = await context.requestAsync("notes.list", null);
   *   }
   *
   *   public async reconnectAsync(): Promise<boolean> {
   *     if (this.context === null)
   *       return false;
   *     this.notes = await this.context.requestAsync("notes.list", null);
   *     return true;
   *   }
   *
   *   public deactivateAsync(): Promise<void> {
   *     this.context = null;
   *     this.notes = null;
   *     return Promise.resolve();
   *   }
   * }
   * ```
   */
  reconnectAsync(): Promise<boolean>;

  /**
   * Releases what the part holds besides its contributions, such as timers.
   * The window calls it in reverse module order and then withdraws the
   * part's contributions, subscriptions and notifications itself.
   *
   * @returns A promise that settles once the part has released them.
   * @example
   * ```ts
   * import type { IWindowPart } from "@noldova/teamrun-shell-window";
   *
   * export class TickerWindowPart implements IWindowPart {
   *   private timer: ReturnType<typeof setInterval> | null = null;
   *
   *   public readonly moduleId: string = "ticker";
   *
   *   public activateAsync(): Promise<void> {
   *     this.timer = setInterval(() => undefined, 1000);
   *     return Promise.resolve();
   *   }
   *
   *   public reconnectAsync(): Promise<boolean> {
   *     return Promise.resolve(true);
   *   }
   *
   *   public deactivateAsync(): Promise<void> {
   *     if (this.timer !== null)
   *       clearInterval(this.timer);
   *     return Promise.resolve();
   *   }
   * }
   * ```
   */
  deactivateAsync(): Promise<void>;
}

/**
 * What the window gives a window part: registration of its contributions,
 * and access to commands, notifications, documents, the runtime and
 * settings. A part reaches only its own module's names and its dependencies',
 * `<module id>.<name>`; it registers only names its module declares in
 * `module.json`. Everything it registers is withdrawn when it deactivates.
 */
export interface IWindowPartContext {
  /**
   * Registers one of the module's views.
   *
   * @param view The view, which the module declares in
   * `contributes.views`.
   * @throws Error synchronously when the view belongs to another module, the
   * module does not declare it, or it is already registered.
   * @example
   * ```ts
   * import { Component } from "@angular/core";
   * import { DockSide, type IWindowPartContext, ViewContribution } from "@noldova/teamrun-shell-window";
   *
   * @Component({ selector: "tr-notes-list", template: "<ul></ul>" })
   * export class NotesListComponent {
   * }
   *
   * export function registerList(context: IWindowPartContext): void {
   *   context.registerView(new ViewContribution("notes.list", "Notes", "notes", DockSide.Left, true, () => Promise.resolve(NotesListComponent)));
   * }
   * ```
   */
  registerView(view: ViewContribution): void;

  /**
   * Registers one of the module's documents.
   *
   * @param document The document, which the module declares in
   * `contributes.documents`.
   * @throws Error synchronously when the document belongs to another module,
   * the module does not declare it, or it is already registered.
   * @example
   * ```ts
   * import { Component } from "@angular/core";
   * import { DocumentContribution, type IWindowPartContext } from "@noldova/teamrun-shell-window";
   *
   * @Component({ selector: "tr-notes-editor", template: "<textarea></textarea>" })
   * export class NotesEditorComponent {
   * }
   *
   * export function registerEditor(context: IWindowPartContext): void {
   *   context.registerDocument(new DocumentContribution("notes.note", () => Promise.resolve(NotesEditorComponent)));
   * }
   * ```
   */
  registerDocument(document: DocumentContribution): void;

  /**
   * Registers one of the module's commands, which then runs in this window.
   *
   * @param command The command, which the module declares in
   * `contributes.commands`.
   * @throws Error synchronously when the command belongs to another module,
   * the module does not declare it, or a command of that name is already
   * registered.
   * @example
   * ```ts
   * import { CommandContribution, type IWindowPartContext } from "@noldova/teamrun-shell-window";
   *
   * export function registerNewNote(context: IWindowPartContext): void {
   *   context.registerCommand(new CommandContribution("notes.new", "New note", "add", "Mod+Alt+N", () => context.requestAsync("notes.create", null)));
   * }
   * ```
   */
  registerCommand(command: CommandContribution): void;

  /**
   * Registers one of the module's status-bar items.
   *
   * @param item The item, which the module declares in
   * `contributes.statusBarItems`.
   * @returns The registered item, which the part updates or hides.
   * @throws Error synchronously when the item belongs to another module, the
   * module does not declare it, it is already registered, or its command
   * belongs to neither the module nor a dependency.
   * @example
   * ```ts
   * import { type IWindowPartContext, type StatusBarItem, StatusBarItemContribution, StatusBarItemState, StatusBarSide } from "@noldova/teamrun-shell-window";
   *
   * export function registerCount(context: IWindowPartContext): StatusBarItem {
   *   return context.registerStatusBarItem(new StatusBarItemContribution("notes.count", StatusBarSide.Left,
   *     new StatusBarItemState("3 notes", { command: "notes.showList" })));
   * }
   * ```
   */
  registerStatusBarItem(item: StatusBarItemContribution): StatusBarItem;

  /**
   * Registers one of the module's top-bar actions.
   *
   * @param action The action, which the module declares in
   * `contributes.topBarActions`.
   * @returns The registered action, which the part updates or hides.
   * @throws Error synchronously when the action belongs to another module,
   * the module does not declare it, it is already registered, or its command
   * belongs to neither the module nor a dependency.
   * @example
   * ```ts
   * import { type IWindowPartContext, type TopBarAction, TopBarActionContribution, TopBarActionState } from "@noldova/teamrun-shell-window";
   *
   * export function registerSync(context: IWindowPartContext): TopBarAction {
   *   return context.registerTopBarAction(new TopBarActionContribution("notes.sync", new TopBarActionState("sync", "Sync notes", "notes.sync")));
   * }
   * ```
   */
  registerTopBarAction(action: TopBarActionContribution): TopBarAction;

  /**
   * Registers a step that saves the part's unsaved state when TeamRun
   * closes, quits for a newer build or restarts. The window runs every
   * part's steps and its own layout save together and closes only once they
   * settle. A step that rejects keeps TeamRun open: the window logs the
   * error and shows it as a notification naming the module, and the person
   * closes again once it is fixed. A part whose steps have not settled after
   * 4 seconds does not hold closing back: TeamRun closes, and the window
   * logs it and posts a warning naming the module.
   *
   * @param save The step; it resolves once the state is saved.
   * @returns A function that removes the step; deactivation removes it too.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/teamrun-shell-window";
   *
   * export function saveDraftsOnClose(context: IWindowPartContext, saveDraftsAsync: () => Promise<void>): () => void {
   *   return context.registerSave(saveDraftsAsync);
   * }
   * ```
   */
  registerSave(save: () => Promise<void>): () => void;

  /**
   * Supplies the rows of one of the module's dynamic menu groups. The window
   * asks again whenever it builds the menu or toolbar, and leaves out a row
   * whose command belongs to neither the module nor a dependency, and a group
   * without rows.
   *
   * @param group The group's name, which the module's `menus.json` declares
   * as `dynamic`.
   * @param provider Returns the rows for the context object the menu was
   * opened with, `{}` in the main menu and toolbars.
   * @returns A function that withdraws the rows; deactivation withdraws them
   * too.
   * @throws Error synchronously when the group belongs to another module or
   * the module does not declare it as dynamic.
   * @example
   * ```ts
   * import { type IWindowPartContext, MenuRowContribution } from "@noldova/teamrun-shell-window";
   *
   * export function provideRecent(context: IWindowPartContext, recent: readonly string[]): () => void {
   *   return context.provideMenuGroup("notes.recent", () => recent.map(t => new MenuRowContribution("notes.open", { note: t }, t)));
   * }
   * ```
   */
  provideMenuGroup(group: string, provider: (context: JsonObject) => readonly MenuRowContribution[]): () => void;

  /**
   * Sets or removes the badge of one of the module's views.
   *
   * @param view The view's name, which the module declares in
   * `contributes.views`.
   * @param badge The badge, or null to remove it.
   * @throws Error synchronously when the view belongs to another module or
   * the module does not declare it.
   * @example
   * ```ts
   * import { type IWindowPartContext, ViewBadge } from "@noldova/teamrun-shell-window";
   *
   * export function showUnread(context: IWindowPartContext, unread: number): void {
   *   context.setViewBadge("notes.list", unread === 0 ? null : new ViewBadge(unread, `${unread} unread notes`));
   * }
   * ```
   */
  setViewBadge(view: string, badge: ViewBadge | null): void;

  /**
   * Marks the tab of one of the module's views or documents as working. The
   * tab shows a spinner in place of its close glyph, reveals Close when hovered
   * or focused, and is marked busy for assistive technology, until every mark
   * on it is cleared or the part is withdrawn. Real work that should hold up
   * quitting is reported by the module's runtime part, not by this mark.
   *
   * @param name The view's or document's name, which the module declares in
   * `contributes.views` or `contributes.documents`.
   * @param instance The tab's instance, if it has one.
   * @returns A function that clears this mark; calling it again does nothing.
   * @throws Error synchronously when the name belongs to another module, the
   * module declares no such view or document, or the instance is not valid.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/teamrun-shell-window";
   *
   * export async function syncNoteAsync(context: IWindowPartContext, note: string, sync: () => Promise<void>): Promise<void> {
   *   const clear = context.markWorking("notes.note", note);
   *   try {
   *     await sync();
   *   }
   *   finally {
   *     clear();
   *   }
   * }
   * ```
   */
  markWorking(name: string, instance?: string): () => void;

  /**
   * Tells whether a name belongs to the module or one of its dependencies,
   * which is what the part may reach.
   *
   * @param name A name, `<module id>.<name>`.
   * @returns True when the name's module id is the module's own or a
   * dependency's.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/teamrun-shell-window";
   *
   * export function canOpen(context: IWindowPartContext, command: string): boolean {
   *   return context.isAllowed(command);
   * }
   * ```
   */
  isAllowed(name: string): boolean;

  /**
   * Runs a command of the module or a dependency, in the window or in the
   * runtime.
   *
   * @param name The command's name.
   * @param commandArguments The arguments; null when left out.
   * @returns A promise of the command's result; it rejects when the command
   * is not registered, not enabled or fails.
   * @throws Error synchronously when the command belongs to neither the
   * module nor a dependency.
   * @example
   * ```ts
   * import type { JsonValue } from "@noldova/teamrun-foundation-json";
   * import type { IWindowPartContext } from "@noldova/teamrun-shell-window";
   *
   * export function openNote(context: IWindowPartContext, note: string): Promise<JsonValue> {
   *   return context.runCommandAsync("notes.open", { note });
   * }
   * ```
   */
  runCommandAsync(name: string, commandArguments?: JsonValue): Promise<JsonValue>;

  /**
   * Posts a notification of one of the module's kinds.
   *
   * @param post The notification; its commands belong to the module or a
   * dependency.
   * @returns A promise of the handle that updates or dismisses it; it rejects
   * when the kind belongs to another module or the module does not declare
   * it, a command belongs to neither the module nor a dependency, or the
   * runtime refuses the post.
   * @example
   * ```ts
   * import { NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/teamrun-shell-protocol";
   * import { type IWindowPartContext, type NotificationHandle } from "@noldova/teamrun-shell-window";
   *
   * export function announceSaved(context: IWindowPartContext): Promise<NotificationHandle> {
   *   return context.postNotificationAsync(new NotificationPost(QualifiedName.parse("notes.saved"), null, "Note saved", null, NotificationSeverity.Info, null, [], null));
   * }
   * ```
   */
  postNotificationAsync(post: NotificationPost): Promise<NotificationHandle>;

  /**
   * Opens one of the module's documents in the active document group, or
   * activates it where it is. While the part first activates with a saved
   * layout, the document shows only when the layout holds it.
   *
   * @param name The document's name.
   * @param instance Which of the document's instances, such as a note's id.
   * @param title The tab's title.
   * @param options Whether it opens as a preview; an ordinary tab when left
   * out.
   * @throws Error synchronously when the document belongs to another module.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/teamrun-shell-window";
   *
   * export function previewNote(context: IWindowPartContext, note: string, title: string): void {
   *   context.openDocument("notes.note", note, title, { preview: true });
   * }
   * ```
   */
  openDocument(name: string, instance: string, title: string, options?: IDocumentOptions): void;

  /**
   * Keeps an open preview of one of the module's documents, so the next
   * preview does not replace it.
   *
   * @param name The document's name.
   * @param instance The instance it opened with.
   * @throws Error synchronously when the document belongs to another module.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/teamrun-shell-window";
   *
   * export function keepEdited(context: IWindowPartContext, note: string): void {
   *   context.keepDocument("notes.note", note);
   * }
   * ```
   */
  keepDocument(name: string, instance: string): void;

  /**
   * Shows a view or document in a large modal dialog. One already open in a
   * tab moves into the dialog and returns when it closes.
   *
   * @param name The view's or document's name, the module's, a
   * dependency's or the shell's.
   * @param options The document's instance and the dialog's title.
   * @returns A promise that settles when the dialog closes; it rejects when
   * the name belongs to another module, another dialog is open, the runtime
   * is starting again, or no such view or document is registered.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/teamrun-shell-window";
   *
   * export function showNote(context: IWindowPartContext, note: string): Promise<void> {
   *   return context.showInDialogAsync("notes.note", { instance: note, title: "Note" });
   * }
   * ```
   */
  showInDialogAsync(name: string, options?: IViewDialogOptions): Promise<void>;

  /**
   * Writes a message to the desktop's log under the module's id. The
   * message holds no secrets and no unnecessary personal or project data.
   *
   * @param message The message.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/teamrun-shell-window";
   *
   * export function logSkipped(context: IWindowPartContext, count: number): void {
   *   context.log(`Skipped ${count} notes that could not be read.`);
   * }
   * ```
   */
  log(message: string): void;

  /**
   * Calls a method of the module's runtime part or a dependency's.
   *
   * @param method The method's name.
   * @param parameters The parameters.
   * @returns A promise of the method's result; it rejects when the method
   * belongs to neither the module nor a dependency, or the runtime refuses
   * or fails the request.
   * @example
   * ```ts
   * import type { JsonValue } from "@noldova/teamrun-foundation-json";
   * import type { IWindowPartContext } from "@noldova/teamrun-shell-window";
   *
   * export function listNotes(context: IWindowPartContext): Promise<JsonValue> {
   *   return context.requestAsync("notes.list", { limit: 50 });
   * }
   * ```
   */
  requestAsync(method: string, parameters: JsonValue): Promise<JsonValue>;

  /**
   * Listens to an event of the module's runtime part or a dependency's.
   *
   * @param event The event's name.
   * @param listener Called with each payload of the event.
   * @returns A function that stops listening; deactivation stops it too.
   * @throws Error synchronously when the event belongs to neither the module
   * nor a dependency.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/teamrun-shell-window";
   *
   * export function followChanges(context: IWindowPartContext, refresh: () => void): () => void {
   *   return context.onEvent("notes.changed", () => refresh());
   * }
   * ```
   */
  onEvent(event: string, listener: (payload: JsonValue) => void): () => void;

  /**
   * Reads the application's value in effect of a setting of the module, a
   * dependency or the shell. `readSettingAsync` reads it for a scope object.
   *
   * @param name The setting's name.
   * @returns The value, or undefined while the window has not loaded the
   * settings or no such setting exists.
   * @throws Error synchronously when the setting belongs to another module.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/teamrun-shell-window";
   *
   * export function readsWrapped(context: IWindowPartContext): boolean {
   *   return context.readSetting("notes.wrapLines") === true;
   * }
   * ```
   */
  readSetting(name: string): JsonValue | undefined;

  /**
   * Asks the runtime for the value in effect of a setting of the module, a
   * dependency or the shell at a scope object: the value set for the
   * object, else for each enclosing object, else for the application, else
   * the default. A change at an enclosing scope or the application reaches
   * `onSettingChanged` with that scope, not with the object's, so a part
   * that shows the object reads it again.
   *
   * @param name The setting's name.
   * @param scope The scope object; the application when left out or null.
   * @returns A promise of the setting's name, the value in effect and
   * whether a value is stored for the object itself; it rejects when the
   * setting belongs to another module that is not a dependency, or the
   * runtime refuses the request, such as for a scope the setting does not
   * list.
   * @example
   * ```ts
   * import { QualifiedName, SettingScope } from "@noldova/teamrun-shell-protocol";
   * import type { IWindowPartContext } from "@noldova/teamrun-shell-window";
   *
   * export async function isWrappedInProject(context: IWindowPartContext, project: string): Promise<boolean> {
   *   const entry = await context.readSettingAsync("notes.wrapLines", new SettingScope(QualifiedName.parse("notes.project"), project));
   *   return entry.value === true;
   * }
   * ```
   */
  readSettingAsync(name: string, scope?: SettingScope | null): Promise<SettingEntry>;

  /**
   * Changes a setting of the module. A value equal to the setting's default
   * resets it when it would otherwise take its default.
   *
   * @param name The setting's name.
   * @param value The value, which the setting's type accepts.
   * @param scope The setting scope to set it in; the application scope when
   * left out or null.
   * @returns A promise that settles once the runtime has stored it; it
   * rejects when the setting belongs to another module or the runtime
   * refuses the value.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/teamrun-shell-window";
   *
   * export function wrapLines(context: IWindowPartContext, isWrapped: boolean): Promise<void> {
   *   return context.writeSettingAsync("notes.wrapLines", isWrapped);
   * }
   * ```
   */
  writeSettingAsync(name: string, value: JsonValue, scope?: SettingScope | null): Promise<void>;

  /**
   * Removes the stored value of a setting of the module, so it follows its
   * enclosing scopes and its default again.
   *
   * @param name The setting's name.
   * @param scope The setting scope to reset it in; the application scope
   * when left out or null.
   * @returns A promise that settles once the runtime has removed it; it
   * rejects when the setting belongs to another module or the runtime
   * refuses the request.
   * @example
   * ```ts
   * import { QualifiedName, SettingScope } from "@noldova/teamrun-shell-protocol";
   * import type { IWindowPartContext } from "@noldova/teamrun-shell-window";
   *
   * export function resetForProject(context: IWindowPartContext, project: string): Promise<void> {
   *   return context.resetSettingAsync("notes.wrapLines", new SettingScope(QualifiedName.parse("notes.project"), project));
   * }
   * ```
   */
  resetSettingAsync(name: string, scope?: SettingScope | null): Promise<void>;

  /**
   * Listens to changes of a setting of the module, a dependency or the
   * shell, in any scope.
   *
   * @param name The setting's name.
   * @param listener Called with the value now in effect, the scope it
   * changed in, null for the application scope, and whether a value is
   * stored for that scope, false after a reset.
   * @returns A function that stops listening; deactivation stops it too.
   * @throws Error synchronously when the setting belongs to another module.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/teamrun-shell-window";
   *
   * export function followWrapping(context: IWindowPartContext, apply: (isWrapped: boolean) => void): () => void {
   *   return context.onSettingChanged("notes.wrapLines", (value, scope) => {
   *     if (scope === null)
   *       apply(value === true);
   *   });
   * }
   * ```
   */
  onSettingChanged(name: string, listener: (value: JsonValue, scope: SettingScope | null, isSet: boolean) => void): () => void;
}

/**
 * A command a window part registers: a named action with a title, an
 * optional icon and default key, and its handler.
 */
export declare class CommandContribution {
  /**
   * The command's name, `<module id>.<name>`.
   */
  public readonly name: string;

  /**
   * The title that menus, command search and Keyboard shortcuts show.
   */
  public readonly title: string;

  /**
   * The glyph shown beside the title, or null when it has none.
   */
  public readonly icon: string | null;

  /**
   * The key that runs it unless the person binds another, or null when it
   * has none.
   */
  public readonly defaultKey: KeyChord | null;

  /**
   * Runs the command with its arguments and resolves to its result.
   */
  public readonly runAsync: (commandArguments: JsonValue) => Promise<JsonValue>;

  /**
   * Tells whether the command is enabled for given arguments.
   */
  public readonly isEnabled: (commandArguments: JsonValue) => boolean;

  /**
   * Tells whether the command is checked for given arguments, or null when
   * it is never checked, so menus show no checkbox for it.
   */
  public readonly isChecked: ((commandArguments: JsonValue) => boolean) | null;

  /**
   * Tells whether the command applies to given arguments; a menu row whose
   * command does not apply is left out.
   */
  public readonly isApplicable: (commandArguments: JsonValue) => boolean;

  /**
   * Creates the command.
   *
   * @param name The command's name, `<module id>.<name>`.
   * @param title The title, not blank.
   * @param icon The glyph, not blank, or null.
   * @param defaultKey The default key, such as `Mod+Alt+N`, with Mod, Ctrl
   * or Alt or as a function key, and not one editing or the operating
   * system owns; or null.
   * @param runAsync Runs the command with its arguments, null when run
   * without, and resolves to its result.
   * @param isEnabled Whether it is enabled for given arguments; always when
   * left out.
   * @param isChecked Whether it is checked for given arguments; never
   * checked when left out or null.
   * @param isApplicable Whether it applies to given arguments; always when
   * left out.
   * @throws ArgumentException synchronously when the name is not
   * `<module id>.<name>`, the title or icon is blank, or the default key is
   * not a valid default key.
   * @example
   * ```ts
   * import { CommandContribution } from "@noldova/teamrun-shell-window";
   *
   * let isWrapped: boolean = false;
   *
   * export const wrap: CommandContribution = new CommandContribution("notes.toggleWrap", "Wrap lines", "wrap", "Mod+Alt+W",
   *   () => {
   *     isWrapped = !isWrapped;
   *     return Promise.resolve(isWrapped);
   *   },
   *   () => true,
   *   () => isWrapped,
   *   commandArguments => commandArguments === null);
   * ```
   * @example
   * ```ts
   * import { CommandContribution } from "@noldova/teamrun-shell-window";
   *
   * export const refresh: CommandContribution = new CommandContribution("notes.refresh", "Refresh notes", null, null, () => Promise.resolve(null));
   * ```
   */
  public constructor(
    name: string,
    title: string,
    icon: string | null,
    defaultKey: string | null,
    runAsync: (commandArguments: JsonValue) => Promise<JsonValue>,
    isEnabled?: (commandArguments: JsonValue) => boolean,
    isChecked?: ((commandArguments: JsonValue) => boolean) | null,
    isApplicable?: (commandArguments: JsonValue) => boolean);
}

/**
 * The padding choice of the page a tab shows, which the page's component
 * injects with {@link WindowPartTokens.contentPadding} to override its
 * declaration and its module for as long as it is shown.
 */
export declare class ContentPaddingRef {
  /**
   * The page's own choice, or null while it leaves the padding to its
   * declaration and its module.
   */
  public readonly value: Signal<ContentPadding | null>;

  /**
   * Sets the page's padding until it is set again or reset.
   *
   * @param padding The padding the page wants.
   * @example
   * ```ts
   * import { Component, inject } from "@angular/core";
   * import { ContentPadding, WindowPartTokens } from "@noldova/teamrun-shell-window";
   *
   * @Component({ selector: "tr-terminal-page", template: "<div class=\"terminal\"></div>" })
   * export class TerminalPageComponent {
   *   public constructor() {
   *     inject(WindowPartTokens.contentPadding).set(ContentPadding.None);
   *   }
   * }
   * ```
   */
  public set(padding: ContentPadding): void;

  /**
   * Drops the page's choice, so its declaration and its module decide again.
   *
   * @example
   * ```ts
   * import { Component, inject } from "@angular/core";
   * import { ContentPadding, type ContentPaddingRef, WindowPartTokens } from "@noldova/teamrun-shell-window";
   *
   * @Component({
   *   selector: "tr-notes-preview",
   *   template: "<button type=\"button\" (click)=\"showFullWidth()\">Full width</button><button type=\"button\" (click)=\"showDefault()\">Default</button>"
   * })
   * export class NotesPreviewComponent {
   *   private readonly padding: ContentPaddingRef = inject(WindowPartTokens.contentPadding);
   *
   *   protected showFullWidth(): void {
   *     this.padding.set(ContentPadding.None);
   *   }
   *
   *   protected showDefault(): void {
   *     this.padding.reset();
   *   }
   * }
   * ```
   */
  public reset(): void;
}

/**
 * A document a window part registers: its name and the component its tabs
 * show.
 */
export declare class DocumentContribution {
  /**
   * The document's name, `<module id>.<name>`.
   */
  public readonly name: string;

  /**
   * Loads the component the document's tabs show.
   */
  public readonly loadComponent: () => Promise<Type<unknown>>;

  /**
   * The padding the document declares, or null when its module decides.
   */
  public readonly padding: ContentPadding | null;

  /**
   * Creates the document's contribution.
   *
   * @param name The document's name, `<module id>.<name>`.
   * @param loadComponent Loads the component the document shows, which a
   * part loads lazily so activation stays light.
   * @param padding The padding of its page; left out, its module decides.
   * @throws ArgumentException synchronously when the name is not
   * `<module id>.<name>`.
   * @example
   * ```ts
   * import { Component } from "@angular/core";
   * import { ContentPadding, DocumentContribution } from "@noldova/teamrun-shell-window";
   *
   * @Component({ selector: "tr-editor-file", template: "<div class=\"code\"></div>" })
   * export class FileEditorComponent {
   * }
   *
   * export const editor: DocumentContribution = new DocumentContribution("editor.file", () => Promise.resolve(FileEditorComponent), ContentPadding.None);
   * ```
   */
  public constructor(name: string, loadComponent: () => Promise<Type<unknown>>, padding?: ContentPadding);
}

/**
 * A row a window part supplies to one of its dynamic menu groups: a command
 * with its arguments and an optional label.
 */
export declare class MenuRowContribution {
  /**
   * The command the row runs, `<module id>.<name>`.
   */
  public readonly command: string;

  /**
   * The arguments, into which the menu's context object is merged, the
   * row's own fields winning.
   */
  public readonly commandArguments: JsonObject;

  /**
   * The row's label, or null to show the command's title.
   */
  public readonly label: string | null;

  /**
   * Creates the row.
   *
   * @param command The command, from the module or a dependency.
   * @param commandArguments The arguments; `{}` when left out.
   * @param label The label, not blank; the command's title when left out or
   * null.
   * @throws ArgumentException synchronously when the command is not
   * `<module id>.<name>` or the label is blank.
   * @example
   * ```ts
   * import { MenuRowContribution } from "@noldova/teamrun-shell-window";
   *
   * export const row: MenuRowContribution = new MenuRowContribution("notes.open", { note: "n1" }, "Groceries");
   * ```
   */
  public constructor(command: string, commandArguments?: JsonObject, label?: string | null);
}

/**
 * The handle of a notification a window part posted, which updates or
 * dismisses it.
 */
export declare class NotificationHandle {
  /**
   * The notification's id, which no other notification has.
   */
  public readonly id: string;

  /**
   * Creates the handle. The window creates it for each post; a test double
   * creates its own.
   *
   * @param id The notification's id.
   * @param change Changes the notification and resolves to whether it is
   * still there.
   * @param remove Removes the notification.
   * @example
   * ```ts
   * import { NotificationHandle } from "@noldova/teamrun-shell-window";
   *
   * export const handle: NotificationHandle = new NotificationHandle("1", () => Promise.resolve(true), () => undefined);
   * ```
   */
  public constructor(id: string, change: (post: NotificationPost) => Promise<boolean>, remove: () => void);

  /**
   * Changes the notification in place: it keeps its place, its time and
   * whether it was read, and never changes its kind.
   *
   * @param post The new content, of the same kind.
   * @returns A promise of true while the notification is still there, or
   * false once it is gone, because the person dismissed it, it was cleared
   * or dropped, or the runtime started again; the part posts again one that
   * still matters. It rejects when the post breaks the rules of
   * {@link IWindowPartContext.postNotificationAsync}.
   * @example
   * ```ts
   * import { NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/teamrun-shell-protocol";
   * import type { NotificationHandle } from "@noldova/teamrun-shell-window";
   *
   * export function reportProgress(handle: NotificationHandle, share: number): Promise<boolean> {
   *   return handle.updateAsync(new NotificationPost(QualifiedName.parse("notes.export"), null, "Exporting notes", null, NotificationSeverity.Info, null, [], share));
   * }
   * ```
   */
  public updateAsync(post: NotificationPost): Promise<boolean>;

  /**
   * Removes the notification; nothing happens once it is gone.
   *
   * @example
   * ```ts
   * import type { NotificationHandle } from "@noldova/teamrun-shell-window";
   *
   * export function finish(handle: NotificationHandle): void {
   *   handle.dismiss();
   * }
   * ```
   */
  public dismiss(): void;
}

/**
 * A registered status-bar item, which its window part updates.
 */
export declare class StatusBarItem {
  /**
   * The item's name, `<module id>.<name>`.
   */
  public readonly name: string;

  /**
   * The side it stands on.
   */
  public readonly side: StatusBarSide;

  /**
   * What it shows now.
   */
  public readonly state: Signal<StatusBarItemState>;

  /**
   * Creates the registered item. The window creates it when a part
   * registers the item; a test double creates its own.
   *
   * @param contribution The item as registered.
   * @param check Throws when a state may not be shown, such as one whose
   * command another module owns; it checks the first state and every update.
   * @throws Error synchronously when `check` throws for the first state.
   * @example
   * ```ts
   * import { StatusBarItem, StatusBarItemContribution, StatusBarItemState, StatusBarSide } from "@noldova/teamrun-shell-window";
   *
   * export const item: StatusBarItem = new StatusBarItem(new StatusBarItemContribution("clock.time", StatusBarSide.Right, new StatusBarItemState("12:00")), () => undefined);
   * ```
   */
  public constructor(contribution: StatusBarItemContribution, check: (state: StatusBarItemState) => void);

  /**
   * Changes what the item shows.
   *
   * @param state The new state.
   * @throws Error synchronously when its command belongs to neither the
   * module nor a dependency; the item keeps its state.
   * @example
   * ```ts
   * import { type StatusBarItem, StatusBarItemState } from "@noldova/teamrun-shell-window";
   *
   * export function showTime(item: StatusBarItem, time: string): void {
   *   item.update(new StatusBarItemState(time, { tooltip: `The time is ${time}` }));
   * }
   * ```
   */
  public update(state: StatusBarItemState): void;
}

/**
 * A status-bar item a window part registers: its name, side and first
 * state.
 */
export declare class StatusBarItemContribution {
  /**
   * The item's name, `<module id>.<name>`.
   */
  public readonly name: string;

  /**
   * The side it stands on.
   */
  public readonly side: StatusBarSide;

  /**
   * What it shows first.
   */
  public readonly state: StatusBarItemState;

  /**
   * Creates the item.
   *
   * @param name The item's name, which the module declares in
   * `contributes.statusBarItems`.
   * @param side The side it stands on, in module order and then declared
   * order.
   * @param state What it shows first.
   * @throws ArgumentException synchronously when the name is not
   * `<module id>.<name>`.
   * @example
   * ```ts
   * import { StatusBarItemContribution, StatusBarItemState, StatusBarSide } from "@noldova/teamrun-shell-window";
   *
   * export const time: StatusBarItemContribution = new StatusBarItemContribution("clock.time", StatusBarSide.Right, new StatusBarItemState("12:00"));
   * ```
   */
  public constructor(name: string, side: StatusBarSide, state: StatusBarItemState);
}

/**
 * What a status-bar item shows: text, an icon or both, a tooltip, and the
 * command it runs.
 */
export declare class StatusBarItemState {
  /**
   * The text, which may be empty when the item has an icon and a tooltip.
   */
  public readonly text: string;

  /**
   * The glyph, or null when it has none.
   */
  public readonly icon: string | null;

  /**
   * The tooltip, or null when the text names the item.
   */
  public readonly tooltip: string | null;

  /**
   * The command the item runs, or null when it runs none and is no button.
   */
  public readonly command: string | null;

  /**
   * The arguments the command runs with; null when it has none.
   */
  public readonly commandArguments: JsonValue;

  /**
   * Whether the item is hidden.
   */
  public readonly isHidden: boolean;

  /**
   * The item's accessible name: its tooltip, or else its text.
   */
  public get label(): string;

  /**
   * Creates the state.
   *
   * @param text The text; empty only with an icon and a tooltip.
   * @param options The icon, tooltip, command and visibility; none when left
   * out.
   * @throws ArgumentException synchronously when the icon or tooltip is
   * blank, the text is blank without an icon or without a tooltip, or the
   * command is not `<module id>.<name>`.
   * @example
   * ```ts
   * import { StatusBarItemState } from "@noldova/teamrun-shell-window";
   *
   * export const alarm: StatusBarItemState = new StatusBarItemState("", { icon: "alarm", tooltip: "Alarm at 7:00", command: "clock.showAlarms" });
   * ```
   * @example
   * ```ts
   * import { StatusBarItemState } from "@noldova/teamrun-shell-window";
   *
   * // @ts-expect-error
   * export const unnamed: StatusBarItemState = new StatusBarItemState({ icon: "alarm" });
   * ```
   */
  public constructor(text: string, options?: IStatusBarItemOptions);
}

/**
 * A registered top-bar action, which its window part updates.
 */
export declare class TopBarAction {
  /**
   * The action's name, `<module id>.<name>`.
   */
  public readonly name: string;

  /**
   * The side of the top row it stands on.
   */
  public readonly side: TopBarSide;

  /**
   * What it shows and runs now.
   */
  public readonly state: Signal<TopBarActionState>;

  /**
   * Creates the registered action. The window creates it when a part
   * registers the action; a test double creates its own.
   *
   * @param contribution The action as registered.
   * @param check Throws when a state may not be shown, such as one whose
   * command another module owns; it checks the first state and every update.
   * @throws Error synchronously when `check` throws for the first state.
   * @example
   * ```ts
   * import { TopBarAction, TopBarActionContribution, TopBarActionState } from "@noldova/teamrun-shell-window";
   *
   * export const action: TopBarAction = new TopBarAction(new TopBarActionContribution("notes.sync", new TopBarActionState("sync", "Sync notes", "notes.sync")), () => undefined);
   * ```
   */
  public constructor(contribution: TopBarActionContribution, check: (state: TopBarActionState) => void);

  /**
   * Changes what the action shows and runs.
   *
   * @param state The new state.
   * @throws Error synchronously when its command belongs to neither the
   * module nor a dependency; the action keeps its state.
   * @example
   * ```ts
   * import { type TopBarAction, TopBarActionState } from "@noldova/teamrun-shell-window";
   *
   * export function hideWhileSyncing(action: TopBarAction, isSyncing: boolean): void {
   *   action.update(new TopBarActionState("sync", "Sync notes", "notes.sync", { isHidden: isSyncing }));
   * }
   * ```
   */
  public update(state: TopBarActionState): void;
}

/**
 * A top-bar action a window part registers: its name, first state and side.
 */
export declare class TopBarActionContribution {
  /**
   * The action's name, `<module id>.<name>`.
   */
  public readonly name: string;

  /**
   * What it shows and runs first.
   */
  public readonly state: TopBarActionState;

  /**
   * The side of the top row it stands on.
   */
  public readonly side: TopBarSide;

  /**
   * Creates the action.
   *
   * @param name The action's name, which the module declares in
   * `contributes.topBarActions`.
   * @param state What it shows and runs first.
   * @param side The side it asks for, in module order and then declared
   * order; the end when left out.
   * @throws ArgumentException synchronously when the name is not
   * `<module id>.<name>`.
   * @example
   * ```ts
   * import { TopBarActionContribution, TopBarActionState, TopBarSide } from "@noldova/teamrun-shell-window";
   *
   * export const search: TopBarActionContribution = new TopBarActionContribution("notes.search", new TopBarActionState("search", "Search notes", "notes.search"), TopBarSide.Start);
   * ```
   */
  public constructor(name: string, state: TopBarActionState, side?: TopBarSide);
}

/**
 * What a top-bar action shows and runs: an icon button with a title.
 */
export declare class TopBarActionState {
  /**
   * The glyph of its button.
   */
  public readonly icon: string;

  /**
   * The title, its tooltip and accessible name.
   */
  public readonly title: string;

  /**
   * The command it runs; the button is disabled while it is not registered.
   */
  public readonly command: string;

  /**
   * The arguments the command runs with; null when it has none.
   */
  public readonly commandArguments: JsonValue;

  /**
   * Whether the action is hidden.
   */
  public readonly isHidden: boolean;

  /**
   * Creates the state.
   *
   * @param icon The glyph, not blank.
   * @param title The title, not blank.
   * @param command The command, `<module id>.<name>`.
   * @param options The arguments and visibility; none when left out.
   * @throws ArgumentException synchronously when the icon or title is blank
   * or the command is not `<module id>.<name>`.
   * @example
   * ```ts
   * import { TopBarActionState } from "@noldova/teamrun-shell-window";
   *
   * export const sync: TopBarActionState = new TopBarActionState("sync", "Sync notes", "notes.sync", { commandArguments: { force: true } });
   * ```
   */
  public constructor(icon: string, title: string, command: string, options?: ITopBarActionOptions);
}

/**
 * The badge on a view's icon or after its tab's title: a count or a dot,
 * with a description for its accessible name.
 */
export declare class ViewBadge {
  /**
   * The count, or null for a dot.
   */
  public readonly count: number | null;

  /**
   * What the badge means, which the view's accessible name includes.
   */
  public readonly description: string;

  /**
   * Creates the badge.
   *
   * @param count A whole number from 1, or null for a dot.
   * @param description What the badge means, not blank.
   * @throws ArgumentException synchronously when the count is not a whole
   * number from 1 or the description is blank.
   * @example
   * ```ts
   * import { ViewBadge } from "@noldova/teamrun-shell-window";
   *
   * export const changed: ViewBadge = new ViewBadge(null, "Notes changed elsewhere");
   * ```
   */
  public constructor(count: number | null, description: string);
}

/**
 * A view a window part registers: content for a panel, in a dock or in the
 * middle, with its title and icon.
 */
export declare class ViewContribution {
  /**
   * The view's name, `<module id>.<name>`.
   */
  public readonly name: string;

  /**
   * The title of its tab.
   */
  public readonly title: string;

  /**
   * The glyph of its tab.
   */
  public readonly icon: string;

  /**
   * The dock it opens in until the person moves it.
   */
  public readonly defaultSide: DockSide;

  /**
   * Whether it shows in a new layout.
   */
  public readonly isShownByDefault: boolean;

  /**
   * Loads the component the view shows.
   */
  public readonly loadComponent: () => Promise<Type<unknown>>;

  /**
   * The padding the view declares, or null when its module decides.
   */
  public readonly padding: ContentPadding | null;

  /**
   * Creates the view's contribution.
   *
   * @param name The view's name, `<module id>.<name>`.
   * @param title The title of its tab, not blank.
   * @param icon The glyph of its tab, not blank.
   * @param defaultSide The dock it opens in.
   * @param isShownByDefault Whether it shows in a new layout.
   * @param loadComponent Loads the component the view shows, which a part
   * loads lazily so activation stays light.
   * @param padding The padding of its page; left out, its module decides.
   * @throws ArgumentException synchronously when the name is not
   * `<module id>.<name>` or the title or icon is blank.
   * @example
   * ```ts
   * import { Component } from "@angular/core";
   * import { ContentPadding, DockSide, ViewContribution } from "@noldova/teamrun-shell-window";
   *
   * @Component({ selector: "tr-terminal-panel", template: "<div class=\"terminal\"></div>" })
   * export class TerminalPanelComponent {
   * }
   *
   * export const terminal: ViewContribution = new ViewContribution("terminal.panel", "Terminal", "terminal", DockSide.Bottom, true,
   *   () => Promise.resolve(TerminalPanelComponent), ContentPadding.None);
   * ```
   */
  public constructor(name: string, title: string, icon: string, defaultSide: DockSide, isShownByDefault: boolean, loadComponent: () => Promise<Type<unknown>>,
    padding?: ContentPadding);
}

/**
 * The injection tokens of the window-part contract.
 */
export declare class WindowPartTokens {
  /**
   * The {@link IWindowPartContext} of the window part whose views and
   * documents the component belongs to.
   */
  public static readonly context: InjectionToken<IWindowPartContext>;

  /**
   * The {@link ContentPaddingRef} of the page the component is shown on.
   */
  public static readonly contentPadding: InjectionToken<ContentPaddingRef>;
}

/**
 * Opens one of the module's menu places, or a dependency's, as a context
 * menu of its host element. The context object is merged into each item's
 * arguments, the item's own fields winning, so one declared item acts on
 * whatever the menu was opened on.
 */
export declare class MenuDirective {
  /**
   * The place the menu shows, `trMenu`; one of the module's or a
   * dependency's. Setting another module's place reports an error to
   * Angular's error handler.
   */
  public readonly place: InputSignal<string>;

  /**
   * The context object, `trMenuContext`; `{}` when not bound.
   */
  public readonly context: InputSignal<JsonObject>;

  /**
   * Creates the directive in a component of a window part, which Angular
   * does for each element that uses `trMenu`.
   *
   * @example
   * ```ts
   * import { Component } from "@angular/core";
   * import { MenuDirective } from "@noldova/teamrun-shell-window";
   *
   * @Component({
   *   selector: "tr-notes-row",
   *   imports: [MenuDirective],
   *   template: "<li [trMenu]=\"'notes.row'\" [trMenuContext]=\"{ note: id }\">{{ title }}</li>"
   * })
   * export class NotesRowComponent {
   *   protected readonly id: string = "n1";
   *   protected readonly title: string = "Groceries";
   * }
   * ```
   */
  public constructor();
}
