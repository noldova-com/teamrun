/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class TeammateCommand {
  public readonly words: string;
  public readonly environment: Readonly<Record<string, string>>;

  public constructor(words: string, environment: Readonly<Record<string, string>> = {}) {
    this.words = words;
    this.environment = environment;
  }
}
