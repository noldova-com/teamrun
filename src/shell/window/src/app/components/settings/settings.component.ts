/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, ErrorHandler, type Signal, type WritableSignal, computed, inject, signal } from "@angular/core";

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import type { SettingDefinition } from "@noldova/teamrun-shell-protocol";
import { SelectOption, TextFieldComponent } from "@noldova/teamrun-shell-ui";

import { SettingsPage } from "../../models/settings/settings-page";
import { ShortcutRow } from "../../models/settings/shortcut-row";
import { TextMatch } from "../../models/settings/text-match";
import type { WindowPartSource } from "../../models/window-part-source";
import { WindowPartTokens } from "../../models/window-part-tokens";
import { Resources } from "../../../resources";
import { CommandService } from "../../services/command.service";
import { DesktopBridgeService } from "../../services/desktop-bridge.service";
import { SettingsService } from "../../services/settings.service";
import { HighlightedTextComponent } from "../highlighted-text/highlighted-text.component";
import { SettingRowComponent } from "../setting-row/setting-row.component";

@Component({
  selector: "tr-settings",
  imports: [HighlightedTextComponent, NgTemplateOutlet, SettingRowComponent, TextFieldComponent],
  templateUrl: "./settings.component.html",
  styleUrl: "./settings.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "class": "tr-settings"
  }
})
export class SettingsComponent {
  private readonly settings: SettingsService = inject(SettingsService);
  private readonly commands: CommandService = inject(CommandService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly bridge: DesktopBridgeService = inject(DesktopBridgeService);
  private readonly selected: WritableSignal<string> = signal(Resources.appearancePage);

  protected readonly resources: typeof Resources = Resources;
  protected readonly query: WritableSignal<string> = signal("");
  private readonly sources: readonly WindowPartSource[] = inject(WindowPartTokens.sources);

  protected readonly modules: readonly SelectOption[] = this.sources.map(t => new SelectOption(t.moduleId, t.displayName));
  protected readonly notifyingModules: readonly SelectOption[] = this.sources
    .filter(t => t.notificationKinds.length > 0)
    .map(t => new SelectOption(t.moduleId, Resources.formatModuleNotifications(t.displayName)));
  protected readonly values: Signal<ReadonlyMap<string, JsonValue>> = this.settings.values;
  protected readonly setFlags: Signal<ReadonlyMap<string, Signal<boolean>>> = computed(() =>
    new Map(this.settings.definitions().map(t => [t.name.text, this.settings.isSet(t.name.text)])));
  protected readonly isSearching: Signal<boolean> = computed(() => this.query().trim().length > 0);
  protected readonly pages: Signal<readonly SettingsPage[]> = computed(() => SettingsPage.pagesOf(this.settings.definitions()));
  protected readonly currentPage: Signal<SettingsPage | undefined> = computed(() => this.pages().find(t => t.title === this.selected()) ?? this.pages()[0]);
  protected readonly shortcuts: Signal<readonly ShortcutRow[]> = computed(() => {
    const map = this.commands.shortcuts();
    return this.commands.commands().map(command => {
      const collision = map.collisions.find(t => t.refused === command.name);
      return new ShortcutRow(command.name, command.title, this.commands.keyLabel(command.name) ?? Resources.noKey,
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
    return this.isSearching() ? this.shortcuts().filter(t => [t.title, t.name, t.key].some(u => TextMatch.contains(u, query))) : this.shortcuts();
  });

  protected search(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected select(page: SettingsPage): void {
    this.query.set("");
    this.selected.set(page.title);
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

  private static matches(definition: SettingDefinition, query: string): boolean {
    return [definition.title, definition.description, definition.name.text].some(t => TextMatch.contains(t, query));
  }
}
