/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import type { JsonObject } from "@noldova/teamrun-foundation-json";

import type { ISpellCheckHost } from "../interfaces/i-spell-check-host.js";
import { Resources } from "../resources.js";

export class SpellChecker {
  private readonly host: () => ISpellCheckHost;
  private readonly languages: readonly string[];
  private readonly address: string;
  private readonly isSystemChecker: boolean;
  private readonly readSystemLanguages: () => readonly string[];
  private readonly log: (text: string) => void;

  public constructor(host: () => ISpellCheckHost, languages: readonly string[], address: string, platform: string, readSystemLanguages: () => readonly string[], log: (text: string) => void) {
    this.host = host;
    this.languages = languages;
    this.address = address;
    this.isSystemChecker = platform === Resources.macPlatform;
    this.readSystemLanguages = readSystemLanguages;
    this.log = log;
  }

  public start(): void {
    if (this.isSystemChecker)
      return;
    this.host().setSpellCheckerDictionaryDownloadURL(this.address);
    this.choose([]);
  }

  public apply(isChecking: boolean, chosen: readonly string[]): void {
    this.host().setSpellCheckerEnabled(isChecking);
    if (!this.isSystemChecker)
      this.choose(chosen);
  }

  public toJson(): JsonObject {
    const offered = this.isSystemChecker ? [] : this.languages;
    return {
      [Resources.languagesField]: [...offered],
      [Resources.fallbackField]: this.findSystemLanguages().length === 0 ? offered[0] ?? null : null
    };
  }

  private choose(chosen: readonly string[]): void {
    const kept = this.languages.filter(t => chosen.includes(t));
    const system = this.findSystemLanguages();
    const languages = kept.length > 0 ? kept : system.length > 0 ? system : this.languages.slice(0, 1);
    try {
      this.host().setSpellCheckerLanguages([...languages]);
    }
    catch (error) {
      this.log(Resources.formatSpellingLanguagesRefused(languages.join(Resources.listSeparator), String(error)));
    }
  }

  private findSystemLanguages(): readonly string[] {
    const shipped = new Map(this.languages.map(t => [t.toLowerCase(), t]));
    return [...new Set(this.readSystemLanguages().flatMap(t => shipped.get(t.toLowerCase()) ?? []))];
  }
}
