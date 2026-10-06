/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ISpellCheckHost } from "@noldova/teamrun-shell-desktop";

import { FakePermissionHost } from "./fake-permission-host.fixture.js";

export class FakeSession extends FakePermissionHost implements ISpellCheckHost {
  public readonly spellCalls: string[] = [];
  public refusal: Error | null = null;

  public setSpellCheckerEnabled(isEnabled: boolean): void {
    this.spellCalls.push(`enabled ${isEnabled}`);
  }

  public setSpellCheckerLanguages(languages: string[]): void {
    if (!Object.isNull(this.refusal))
      throw this.refusal;
    this.spellCalls.push(`languages ${languages.join(",")}`);
  }

  public setSpellCheckerDictionaryDownloadURL(url: string): void {
    this.spellCalls.push(`url ${url}`);
  }
}
