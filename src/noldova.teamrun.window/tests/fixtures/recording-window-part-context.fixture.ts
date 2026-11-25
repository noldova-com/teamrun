/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Signal, Type } from "@angular/core";

import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import type { NotificationPost, SettingEntry, SettingOption, SettingScope } from "@noldova/desktop.protocol";
import {
  type CommandContribution,
  type DockSide,
  type DocumentContribution,
  type FileSaveOutcome,
  type ICommandKey,
  type IDocumentOptions,
  type IFileChoiceOptions,
  type IFileGrantOptions,
  type IFilePathChoiceOptions,
  type IInAppBrowser,
  type ILinkOpenOptions,
  IssuedFileGrant,
  IssuedFileGrants,
  type IDocumentUpdate,
  type ISelectionSource,
  type IViewDialogOptions,
  type IViewInstanceOptions,
  type IViewUpdate,
  type IWindowPalette,
  type IWindowPartContext,
  type IWindowWebViews,
  type LinkGesture,
  type LinkPlace,
  type MenuRowContribution,
  NotificationHandle,
  type PlaceholderContribution,
  RuntimeRequestException,
  type SearchSourceContribution,
  type SettingsPageContribution,
  type SettingsRow,
  StatusBarItem,
  type StatusBarItemContribution,
  TopBarAction,
  type TopBarActionContribution,
  type ViewBadge,
  type ViewContribution
} from "@noldova/desktop.window";
import declaration from "@noldova/teamrun/module.json";

import { Resources } from "../../src/resources";
import { DocumentMark } from "./document-mark.fixture";
import { FakeWindowSecrets } from "./fake-window-secrets.fixture";
import { GrownViewDock } from "./grown-view-dock.fixture";
import { OpenedDocument } from "./opened-document.fixture";
import { PostedNotice } from "./posted-notice.fixture";
import { RanCommand } from "./ran-command.fixture";
import { ShownDialog } from "./shown-dialog.fixture";
import { UpdatedDocument } from "./updated-document.fixture";
import { ViewDockMark } from "./view-dock-mark.fixture";
import { WorkingMark } from "./working-mark.fixture";

export class RecordingWindowPartContext implements IWindowPartContext {
  public readonly settingOptions: Map<string, (values: JsonObject) => readonly SettingOption[] | null> = new Map();
  public readonly refreshedSettings: string[] = [];
  private static readonly readSettings: readonly string[] = [Resources.timeFormatSetting, Resources.dateTimeFormatSetting];
  public readonly lines: string[] = [];
  public readonly fileAddresses: Map<string, string> = new Map();
  public readonly discardedGrants: string[] = [];
  public readonly grantedFiles: File[] = [];
  public refusesGrants: boolean = false;
  public readonly views: ViewContribution[] = [];
  public readonly commands: CommandContribution[] = [];
  public readonly ranCommands: RanCommand[] = [];
  public readonly topBarActions: TopBarActionContribution[] = [];
  public readonly registeredTopBarActions: TopBarAction[] = [];
  public readonly statusBarItems: StatusBarItem[] = [];
  public readonly dialogs: ShownDialog[] = [];
  public readonly openedDocuments: OpenedDocument[] = [];
  public readonly keptDocuments: DocumentMark[] = [];
  public readonly closedDocuments: DocumentMark[] = [];
  public readonly forgottenDocuments: DocumentMark[] = [];
  public readonly documents: DocumentContribution[] = [];
  public readonly placeholders: PlaceholderContribution[] = [];
  public readonly searchSources: SearchSourceContribution[] = [];
  public readonly settingsPages: SettingsPageContribution[] = [];
  public readonly settingsRows: Map<string, readonly SettingsRow[]> = new Map();
  public readonly inAppBrowsers: IInAppBrowser[] = [];
  public readonly updates: UpdatedDocument[] = [];
  public readonly workingMarks: WorkingMark[] = [];
  public readonly links: string[] = [];
  public readonly linkGestures: (LinkGesture | undefined)[] = [];
  public readonly linkPlaces: (LinkPlace | undefined)[] = [];
  public linkFailure: string | null = null;
  public readonly shownInFolder: string[] = [];
  public showInFolderFailure: string | null = null;
  public readonly openedFiles: string[] = [];
  public openFileFailure: string | null = null;
  public readonly saves: Set<() => Promise<void>> = new Set();
  public readonly palettes: Type<unknown>[] = [];
  public readonly shownViews: string[] = [];
  public readonly hiddenViewDocks: ViewDockMark[] = [];
  public readonly grownViewDocks: GrownViewDock[] = [];
  public readonly badges: Map<string, ViewBadge | null> = new Map();
  public paletteHost: (<T>(type: Type<T>) => IWindowPalette<T> | null) | null = null;
  public chosenFolder: string | null = null;
  public folderChoices: number = 0;
  public notifications: PostedNotice[] = [];
  public notificationFailure: unknown = null;
  public notificationHold: Promise<void> | null = null;
  public readonly dependencyListeners: Set<(moduleId: string, isActive: boolean) => void> = new Set();
  public readonly activeDependencies: Set<string> = new Set();
  public readonly documentClosedListeners: Set<(instance: string) => void> = new Set();
  public openInstances: readonly string[] | null = null;
  public readonly secretStore: FakeWindowSecrets = new FakeWindowSecrets();

  public registerView(view: ViewContribution): void {
    if (!declaration.contributes.views.includes(view.name))
      throw new Error(`TeamRun's module.json does not declare the view ${view.name}.`);
    this.views.push(view);
  }

  public registerDocument(document: DocumentContribution): void {
    if (!declaration.contributes.documents.includes(document.name))
      throw new Error(`TeamRun's module.json does not declare the document ${document.name}.`);
    this.documents.push(document);
  }

  public registerSearchSource(source: SearchSourceContribution): void {
    if (!source.name.startsWith(`${declaration.id}.`))
      throw new Error(`TeamRun may add only its own search sources, not ${source.name}.`);
    this.searchSources.push(source);
  }

  public registerPlaceholder(placeholder: PlaceholderContribution): void {
    if (!declaration.contributes.placeholders.includes(placeholder.name))
      throw new Error(`TeamRun's module.json does not declare the placeholder ${placeholder.name}.`);
    this.placeholders.push(placeholder);
  }

  public registerCommand(command: CommandContribution): void {
    if (!declaration.contributes.commands.includes(command.name))
      throw new Error(`TeamRun's module.json does not declare the command ${command.name}.`);
    this.commands.push(command);
  }

  public registerStatusBarItem(item: StatusBarItemContribution): StatusBarItem {
    if (!declaration.contributes.statusBarItems.includes(item.name))
      throw new Error(`TeamRun's module.json does not declare the status bar item ${item.name}.`);
    const registered = new StatusBarItem(item, () => undefined);
    this.statusBarItems.push(registered);
    return registered;
  }

  public registerTopBarAction(action: TopBarActionContribution): TopBarAction {
    if (!declaration.contributes.topBarActions.includes(action.name))
      throw new Error(`TeamRun's module.json does not declare the top bar action ${action.name}.`);
    this.topBarActions.push(action);
    const registered = new TopBarAction(action, () => undefined);
    this.registeredTopBarActions.push(registered);
    return registered;
  }

  public registerSave(save: () => Promise<void>): () => void {
    this.saves.add(save);
    return () => {
      this.saves.delete(save);
    };
  }

  public registerSelectionSource(_element: HTMLElement, _source: ISelectionSource): () => void {
    throw new Error("The fixture registers no selection sources.");
  }

  public registerSettingsPage(page: SettingsPageContribution): void {
    if (!declaration.contributes.settingsPages.includes(page.name))
      throw new Error(`TeamRun's module.json does not declare the Settings page ${page.name}.`);
    this.settingsPages.push(page);
  }

  public setSettingsRows(page: string, rows: readonly SettingsRow[]): void {
    if (!declaration.contributes.settingsPages.includes(page))
      throw new Error(`TeamRun's module.json does not declare the Settings page ${page}.`);
    const repeated = rows.find((t, index) => rows.findIndex(other => other.id === t.id) !== index);
    if (!Object.isUndefined(repeated))
      throw new Error(`The Settings page ${page} has the row ${repeated.id} twice.`);
    this.settingsRows.set(page, [...rows]);
  }

  public provideMenuGroup(_group: string, _kind: (context: JsonObject) => readonly MenuRowContribution[]): () => void {
    throw new Error("The fixture provides no menu groups.");
  }

  public keyOf(_command: string): Signal<ICommandKey | null> {
    throw new Error("The fixture has no command keys.");
  }

  public viewDockOf(_name: string, _instance?: string): Signal<DockSide | null> {
    throw new Error("The fixture has no docks.");
  }

  public onDocumentClosed(name: string, listener: (instance: string) => void): () => void {
    if (!declaration.contributes.documents.includes(name))
      throw new Error(`TeamRun's module.json does not declare the document ${name}.`);
    this.documentClosedListeners.add(listener);
    return () => {
      this.documentClosedListeners.delete(listener);
    };
  }

  public onTabRenamed(_name: string, _listener: (instance: string, title: string) => void): () => void {
    throw new Error("The fixture follows no renamed tabs.");
  }

  public listOpenDocumentsAsync(name: string): Promise<readonly string[] | null> {
    if (!declaration.contributes.documents.includes(name))
      return Promise.reject(new Error(`TeamRun's module.json does not declare the document ${name}.`));
    return Object.isNull(this.openInstances) ? Promise.reject(new RuntimeRequestException("failed", "The fixture lists no open documents.")) : Promise.resolve(this.openInstances);
  }

  public showLinkMenu(_url: string, _event: MouseEvent): void {
    throw new Error("The fixture shows no link menus.");
  }

  public registerInAppBrowser(browser: IInAppBrowser): () => void {
    this.inAppBrowsers.push(browser);
    return () => {
      const index = this.inAppBrowsers.indexOf(browser);
      if (index >= 0)
        this.inAppBrowsers.splice(index, 1);
    };
  }

  public chooseFilePathAsync(_options?: IFilePathChoiceOptions): Promise<string | null> {
    return Promise.reject(new Error("The fixture chooses no file paths."));
  }

  public get agentControl(): IWindowPartContext["agentControl"] {
    throw new Error("The fixture follows no agent control.");
  }

  public get webViews(): IWindowWebViews {
    throw new Error("The fixture opens no web views.");
  }

  public get secrets(): IWindowPartContext["secrets"] {
    return this.secretStore;
  }

  public provideSettingOptions(setting: string, provider: (values: JsonObject) => readonly SettingOption[] | null): () => void {
    this.settingOptions.set(setting, provider);
    return () => this.settingOptions.delete(setting);
  }

  public refreshSettingOptions(setting: string): void {
    this.refreshedSettings.push(setting);
  }

  public setViewBadge(view: string, badge: ViewBadge | null): void {
    if (!declaration.contributes.views.includes(view))
      throw new Error(`TeamRun's module.json does not declare the view ${view}.`);
    this.badges.set(view, badge);
  }

  public markWorking(name: string, instance?: string): () => void {
    const mark = new WorkingMark(name, instance);
    this.workingMarks.push(mark);
    return () => {
      const index = this.workingMarks.indexOf(mark);
      if (index >= 0)
        this.workingMarks.splice(index, 1);
    };
  }

  public markWaiting(_name: string, _instance?: string): () => void {
    throw new Error("The fixture marks nothing waiting.");
  }

  public isAllowed(_name: string): boolean {
    throw new Error("The fixture allows nothing.");
  }

  public runCommandAsync(name: string, commandArguments?: JsonValue): Promise<JsonValue> {
    const owner = name.substring(0, name.indexOf("."));
    if (name !== Resources.desktopSearchCommand && ![declaration.id, ...Object.keys(declaration.dependencies), ...Object.keys(declaration.optionalDependencies)].includes(owner))
      throw new Error(`TeamRun's module.json names no module ${owner}, so Noldova Desktop refuses its command ${name}.`);
    this.ranCommands.push(new RanCommand(name, commandArguments));
    return Promise.resolve(null);
  }

  public findWindowCommand(_event: KeyboardEvent): string | null {
    throw new Error("The fixture finds no window commands.");
  }

  public postNotificationAsync(post: NotificationPost): Promise<NotificationHandle> {
    if (!declaration.contributes.notifications.includes(post.kind.text))
      return Promise.reject(new Error(`TeamRun's module.json does not declare the notification ${post.kind.text}.`));
    if (!Object.isNull(this.notificationFailure))
      return Promise.reject(this.notificationFailure);
    const replaced = this.notifications.filter(t => t.isShown && !Object.isNull(post.key) && t.post.kind.text === post.kind.text && t.post.key === post.key);
    for (const notice of replaced)
      notice.isShown = false;
    const posted = new PostedNotice(replaced.at(0)?.id ?? String(this.notifications.length + 1), post, true);
    this.notifications.push(posted);
    const handle = new NotificationHandle(posted.id, () => {
      for (const notice of this.notifications.filter(t => t.id === posted.id))
        notice.isShown = false;
    });
    return Object.isNull(this.notificationHold) ? Promise.resolve(handle) : this.notificationHold.then(() => handle);
  }

  public shownNotices(kind?: string): readonly NotificationPost[] {
    return this.notifications.filter(t => t.isShown && (Object.isUndefined(kind) || t.post.kind.text === kind)).map(t => t.post);
  }

  public noticeText(): string | null {
    const shown = this.shownNotices();
    return shown.at(-1)?.text ?? null;
  }

  public openDocument(name: string, instance: string, title: string, options?: IDocumentOptions): void {
    this.openedDocuments.push(new OpenedDocument(name, instance, title, options));
  }

  public keepDocument(name: string, instance: string): void {
    this.keptDocuments.push(new DocumentMark(name, instance));
  }

  public closeDocument(name: string, instance: string): void {
    this.closedDocuments.push(new DocumentMark(name, instance));
  }

  public forgetDocument(name: string, instance: string): void {
    this.forgottenDocuments.push(new DocumentMark(name, instance));
  }

  public updateDocument(name: string, instance: string, update: IDocumentUpdate): void {
    this.updates.push(new UpdatedDocument(name, instance, update));
  }

  public openView(_name: string, _instance: string, _title: string, _options?: IViewInstanceOptions): void {
    throw new Error("The fixture opens no view instances.");
  }

  public updateView(_name: string, _instance: string, _update: IViewUpdate): void {
    throw new Error("The fixture updates no view instances.");
  }

  public closeView(_name: string, _instance: string): void {
    throw new Error("The fixture closes no view instances.");
  }

  public returnView(_name: string, _instance: string): void {
    throw new Error("The fixture returns no view instances.");
  }

  public onViewClosed(_name: string, _listener: (instance: string) => void): () => void {
    throw new Error("The fixture closes no view instances.");
  }

  public showView(name: string): void {
    this.shownViews.push(name);
  }

  public hideViewDock(name: string, instance?: string): void {
    this.hiddenViewDocks.push(new ViewDockMark(name, instance ?? null));
  }

  public growViewDock(name: string, minimum: number, instance?: string): () => void {
    this.grownViewDocks.push(new GrownViewDock(name, instance ?? null, minimum));
    return () => undefined;
  }

  public async openBelowWindowRowAsync<T>(load: () => Promise<Type<T>>): Promise<IWindowPalette<T> | null> {
    const type = await load();
    this.palettes.push(type);
    return this.paletteHost?.(type) ?? null;
  }

  public showInDialogAsync(name: string, options?: IViewDialogOptions): Promise<void> {
    this.dialogs.push(new ShownDialog(name, options));
    return Promise.resolve();
  }

  public closeDialog(_name: string, _instance?: string): void {
    throw new Error("The fixture closes no dialogs.");
  }

  public recordPlace(_view: string, _place: string, _instance?: string): void {
    throw new Error("The fixture records no places.");
  }

  public forgetPlace(_view: string, _place: string, _instance?: string): void {
    throw new Error("The fixture records no places.");
  }

  public onPlaceShown(_view: string, _listener: (place: string, instance: string | null) => void): () => void {
    throw new Error("The fixture records no places.");
  }

  public log(message: string): void {
    this.lines.push(message);
  }

  public openLinkAsync(url: string, options?: ILinkOpenOptions): Promise<void> {
    this.links.push(url);
    this.linkGestures.push(options?.gesture);
    this.linkPlaces.push(options?.place);
    return Object.isNull(this.linkFailure) ? Promise.resolve() : Promise.reject(new Error(this.linkFailure));
  }

  public showInFolderAsync(path: string): Promise<void> {
    this.shownInFolder.push(path);
    return Object.isNull(this.showInFolderFailure) ? Promise.resolve() : Promise.reject(new Error(this.showInFolderFailure));
  }

  public openFileAsync(path: string): Promise<void> {
    this.openedFiles.push(path);
    return Object.isNull(this.openFileFailure) ? Promise.resolve() : Promise.reject(new Error(this.openFileFailure));
  }

  public chooseFolderAsync(): Promise<string | null> {
    this.folderChoices++;
    return Promise.resolve(this.chosenFolder);
  }

  public saveFileAsync(_name: string, _bytes: Uint8Array): Promise<FileSaveOutcome> {
    return Promise.reject(new Error("The fixture saves no files."));
  }

  public chooseFilesAsync(_options?: IFileChoiceOptions): Promise<IssuedFileGrants> {
    return Promise.reject(new Error("The fixture chooses no files."));
  }

  public grantFilesAsync(files: readonly File[], _options?: IFileGrantOptions): Promise<IssuedFileGrants> {
    if (this.refusesGrants)
      return Promise.resolve(new IssuedFileGrants([], files.map(t => t.name)));
    const issued = files.map(t => {
      this.grantedFiles.push(t);
      return new IssuedFileGrant(`grant-${this.grantedFiles.length}`, t.name, t.type, t.size);
    });
    return Promise.resolve(new IssuedFileGrants(issued, []));
  }

  public discardFileGrants(grants: readonly string[]): void {
    this.discardedGrants.push(...grants);
  }

  public fileAddressOf(grant: string): string {
    return this.fileAddresses.get(grant) ?? `desktop-file://${grant}/`;
  }

  public requestAsync(_method: string, _parameters: JsonValue): Promise<JsonValue> {
    return Promise.reject(new Error("The fixture sends no requests."));
  }

  public onEvent(_event: string, _listener: (payload: JsonValue) => void): () => void {
    return () => undefined;
  }

  public readSetting(name: string): JsonValue | undefined {
    RecordingWindowPartContext.readable(name);
    return undefined;
  }

  public readSettingAsync(_name: string, _scope?: SettingScope | null): Promise<SettingEntry> {
    return Promise.reject(new Error("The fixture has no settings."));
  }

  public writeSettingAsync(_name: string, _value: JsonValue, _scope?: SettingScope | null): Promise<void> {
    return Promise.reject(new Error("The fixture has no settings."));
  }

  public resetSettingAsync(_name: string, _scope?: SettingScope | null): Promise<void> {
    return Promise.reject(new Error("The fixture has no settings."));
  }

  public provideSettingCheck(setting: string, _check: (value: string) => string | null): () => void {
    throw new Error(`TeamRun's settings.json declares no checked text ${setting}.`);
  }

  public onSettingChanged(name: string, _listener: (value: JsonValue, scope: SettingScope | null, isSet: boolean) => void): () => void {
    RecordingWindowPartContext.readable(name);
    return () => undefined;
  }

  public isDependencyActive(moduleId: string): boolean {
    return this.activeDependencies.has(moduleId);
  }

  public onDependencyChanged(listener: (moduleId: string, isActive: boolean) => void): () => void {
    this.dependencyListeners.add(listener);
    return () => {
      this.dependencyListeners.delete(listener);
    };
  }

  public changeDependency(moduleId: string, isActive: boolean): void {
    if (isActive)
      this.activeDependencies.add(moduleId);
    else
      this.activeDependencies.delete(moduleId);
    for (const listener of [...this.dependencyListeners])
      listener(moduleId, isActive);
  }

  private static readable(name: string): void {
    if (!RecordingWindowPartContext.readSettings.includes(name))
      throw new Error(`The fixture has no setting ${name}.`);
  }
}
