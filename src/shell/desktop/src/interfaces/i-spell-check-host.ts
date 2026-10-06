/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface ISpellCheckHost {
  setSpellCheckerEnabled(isEnabled: boolean): void;
  setSpellCheckerLanguages(languages: string[]): void;
  setSpellCheckerDictionaryDownloadURL(url: string): void;
}
