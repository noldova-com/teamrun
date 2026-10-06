/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler, Injectable, PendingTasks, type Signal, type WritableSignal, computed, effect, inject, signal, untracked } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import { type JsonObject, JsonReader, type JsonValue } from "@noldova/teamrun-foundation-json";
import { SelectOption } from "@noldova/teamrun-shell-ui";

import { MenuItem } from "../models/menu-item";
import { SpellingOffer } from "../models/spelling-offer";
import { Resources } from "../../resources";
import { DesktopBridgeService } from "./desktop-bridge.service";
import { MenuService } from "./menu.service";
import { SettingsService } from "./settings.service";

@Injectable({ providedIn: "root" })
export class SpellingService {
  private readonly bridge: DesktopBridgeService = inject(DesktopBridgeService);
  private readonly offer: WritableSignal<SpellingOffer> = signal(SpellingOffer.none);
  private readonly names: Intl.DisplayNames = new Intl.DisplayNames(undefined, { type: "language", languageDisplay: "standard" });
  private kept: string | null = null;

  public readonly options: Signal<readonly SelectOption[]> = computed(() => this.offer().languages.map(t => new SelectOption(t, this.titleOf(t))));

  public constructor() {
    const settings = inject(SettingsService);
    const errors = inject(ErrorHandler);
    inject(MenuService).provideGroup(Resources.fieldSpellingGroup, t => this.itemsFor(t));
    void inject(PendingTasks).run(() => this.bridge.readSpellingAsync().then(t => this.offer.set(t), (error: unknown) => errors.handleError(error)));
    effect(() => {
      const isChecking = settings.values().get(Resources.spellCheckSetting);
      const languages = settings.values().get(Resources.spellCheckLanguagesSetting);
      if (Object.isBoolean(isChecking) && Array.isArray(languages) && languages.every(t => Object.isString(t)))
        untracked(() => this.keep(isChecking, languages));
    });
  }

  public noteFor(value: JsonValue | undefined): string | null {
    if (this.bridge.isMac)
      return Resources.macSpellingNote;
    const offer = this.offer();
    if (offer.languages.length === 0)
      return Resources.noLanguagesNote;
    const isChosen = Array.isArray(value) && value.some(t => Object.isString(t) && offer.languages.includes(t));
    return isChosen || Object.isNull(offer.fallback) ? null : Resources.formatSpellingFallback(this.titleOf(offer.fallback));
  }

  private itemsFor(context: JsonObject): readonly MenuItem[] {
    const json = JsonReader.fromValue(context);
    const word = json.readOptionalString(Resources.wordArgument);
    if (Object.isUndefined(word) || word.length === 0)
      return [];
    const suggestions = json.readStringArray(Resources.suggestionsArgument).slice(0, Resources.suggestionLimit)
      .map(t => MenuItem.ofCommand(Resources.replaceMisspellingCommand, { [Resources.textArgument]: t }, t));
    return suggestions.length > 0 ? suggestions : [MenuItem.ofCommand(Resources.replaceMisspellingCommand, {}, Resources.noSuggestionsLabel)];
  }

  private keep(isChecking: boolean, languages: readonly string[]): void {
    const preferences = JSON.stringify([isChecking, languages]);
    if (preferences === this.kept)
      return;
    this.kept = preferences;
    this.bridge.keepSpelling(isChecking, languages);
  }

  private titleOf(language: string): string {
    return String(this.names.of(language));
  }
}
