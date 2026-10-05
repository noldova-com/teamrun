/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NgComponentOutlet, NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, ErrorHandler, type Signal, type Type, type WritableSignal, afterNextRender, computed, inject, signal, viewChild } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import type { SettingDefinition } from "@noldova/teamrun-shell-protocol";
import { SelectComponent, SelectOption, TextFieldComponent } from "@noldova/teamrun-shell-ui";

import { GalleryTokens } from "../../models/gallery-tokens";
import { SettingsPage } from "../../models/settings/settings-page";
import { SettingsView } from "../../models/settings/settings-view";
import { ShortcutRow } from "../../models/settings/shortcut-row";
import { TextMatch } from "../../models/settings/text-match";
import { ShellDocuments } from "../../models/shell-documents";
import { Resources } from "../../../resources";
import { CommandService } from "../../services/command.service";
import { DesktopBridgeService } from "../../services/desktop-bridge.service";
import { ModuleStatusService } from "../../services/module-status.service";
import { SettingsService } from "../../services/settings.service";
import { ViewStateService } from "../../services/view-state.service";
import { SettingRowComponent } from "../setting-row/setting-row.component";
import { ShortcutsComponent } from "../shortcuts/shortcuts.component";

@Component({
  selector: "tr-settings",
  imports: [NgComponentOutlet, NgTemplateOutlet, SelectComponent, SettingRowComponent, ShortcutsComponent, TextFieldComponent],
  templateUrl: "./settings.component.html",
  styleUrl: "./settings.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "class": "tr-settings",
    "(focusin)": "noteFocus($event)",
    "(focusout)": "noteBlur($event)"
  }
})
export class SettingsComponent {
  private readonly settings: SettingsService = inject(SettingsService);
  private readonly commands: CommandService = inject(CommandService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly bridge: DesktopBridgeService = inject(DesktopBridgeService);
  private readonly viewStates: ViewStateService = inject(ViewStateService);
  private readonly kept: SettingsView = this.viewStates.find(ShellDocuments.settingsTab.key, SettingsView) ?? SettingsView.initial;
  private readonly selected: WritableSignal<string> = signal(this.kept.page);
  private readonly pageList: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("pageList");
  private readonly pageSelect: Signal<ElementRef<HTMLElement>> = viewChild.required("pageSelect", { read: ElementRef<HTMLElement> });
  private readonly content: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("content");
  private focusedControl: HTMLElement | null = null;

  protected readonly resources: typeof Resources = Resources;
  protected readonly query: WritableSignal<string> = signal(this.kept.query);
  private readonly statuses: ModuleStatusService = inject(ModuleStatusService);

  protected readonly gallery: Type<unknown> | null = inject(GalleryTokens.component);

  protected readonly modules: Signal<readonly SelectOption[]> = computed(() => this.statuses.modules().map(t => new SelectOption(t.id, t.displayName)));
  protected readonly notifyingModules: Signal<readonly SelectOption[]> = computed(() =>
    this.statuses.notifying().map(t => new SelectOption(t.id, Resources.formatModuleNotifications(t.displayName))));
  protected readonly values: Signal<ReadonlyMap<string, JsonValue>> = this.settings.values;
  protected readonly setFlags: Signal<ReadonlyMap<string, Signal<boolean>>> = computed(() =>
    new Map(this.settings.definitions().map(t => [t.name.text, this.settings.isSet(t.name.text)])));
  protected readonly isSearching: Signal<boolean> = computed(() => this.query().trim().length > 0);
  protected readonly pages: Signal<readonly SettingsPage[]> = computed(() => [
    ...SettingsPage.pagesOf(this.settings.definitions()),
    ...Object.isNull(this.gallery) ? [] : [SettingsPage.galleryOf(Resources.galleryPage)]
  ]);
  private readonly currentTitle: Signal<string> = computed(() => this.pages().some(t => t.title === this.selected()) ? this.selected() : Resources.appearancePage);
  protected readonly currentPage: Signal<SettingsPage | undefined> = computed(() => this.pages().find(t => t.title === this.currentTitle()));
  protected readonly pageOptions: Signal<readonly SelectOption[]> = computed(() => this.pages().map(t => new SelectOption(t.title, t.title)));
  protected readonly pageChoice: Signal<string> = computed(() => this.isSearching() ? Resources.settingsSearchResults : this.currentTitle());
  protected readonly shortcuts: Signal<readonly ShortcutRow[]> = computed(() => {
    const map = this.commands.shortcuts();
    const bindings = this.commands.bindings();
    return this.commands.commands().map(command => {
      const collision = map.collisions.find(t => t.refused === command.name);
      const key = this.commands.keyLabel(command.name);
      return new ShortcutRow(command.name, command.title, this.commands.ownerOf(command.name), key ?? Resources.noKey, !Object.isNull(key), bindings.has(command.name),
        Object.isUndefined(collision) ? null : Resources.formatKeyTaken(collision.key.label(this.bridge.platform), this.commands.titleOf(collision.keptBy)));
    });
  });
  protected readonly results: Signal<readonly SettingsPage[]> = computed(() => {
    const query = this.query();
    return this.pages()
      .map(t => t.isShortcuts ? t : t.filter(u => SettingsComponent.matches(u, query)))
      .filter(t => t.isShortcuts ? this.matchingShortcuts().length > 0 : t.groups.length > 0);
  });
  protected readonly matchingShortcuts: Signal<readonly ShortcutRow[]> = computed(() => {
    const query = this.query();
    return this.isSearching() ? this.shortcuts().filter(t => [t.title, t.name, t.owner, t.key].some(u => TextMatch.contains(u, query))) : this.shortcuts();
  });

  public constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.pageList().nativeElement.scrollTop = this.kept.pageListTop;
      this.content().nativeElement.scrollTop = this.kept.contentTop;
      const switched = new ResizeObserver(() => this.keepFocus());
      switched.observe(this.pageList().nativeElement);
      switched.observe(this.pageSelect().nativeElement);
      destroyRef.onDestroy(() => switched.disconnect());
    });
  }

  protected noteFocus(event: FocusEvent): void {
    this.focusedControl = [this.pageList().nativeElement, this.pageSelect().nativeElement].find(t => t.contains(event.target as Node)) ?? null;
  }

  protected noteBlur(event: FocusEvent): void {
    if ((event.target as Element).checkVisibility())
      this.focusedControl = null;
  }

  protected keep(): void {
    this.viewStates.keep(ShellDocuments.settingsTab.key,
      new SettingsView(this.selected(), this.query(), this.pageList().nativeElement.scrollTop, this.content().nativeElement.scrollTop));
  }

  protected search(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.keep();
  }

  protected select(title: string): void {
    this.query.set("");
    this.selected.set(title);
    this.keep();
  }

  protected isMutedModules(definition: SettingDefinition): boolean {
    return definition.name.text === Resources.mutedModulesSetting;
  }

  protected change(definition: SettingDefinition, value: JsonValue): void {
    this.settings.setAsync(definition.name.text, value).catch((error: unknown) => this.errors.handleError(error));
  }

  protected reset(definition: SettingDefinition): void {
    this.settings.resetAsync(definition.name.text).catch((error: unknown) => this.errors.handleError(error));
  }

  private keepFocus(): void {
    const list = this.pageList().nativeElement;
    const select = this.pageSelect().nativeElement;
    const hidden = list.checkVisibility() ? select : list;
    if (this.focusedControl !== hidden)
      return;
    const shown = hidden === list ? select.querySelector<HTMLElement>(Resources.buttonSelector)
      : list.querySelector<HTMLElement>(Resources.currentSettingsPageSelector) ?? list.querySelector<HTMLElement>(Resources.settingsPageSelector);
    shown?.focus();
  }

  private static matches(definition: SettingDefinition, query: string): boolean {
    return [definition.title, definition.description, definition.name.text].some(t => TextMatch.contains(t, query));
  }
}
