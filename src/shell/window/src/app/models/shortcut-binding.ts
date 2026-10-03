/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { KeyChord } from "@noldova/teamrun-shell-protocol";

export class ShortcutBinding {
  public readonly command: string;
  public readonly key: KeyChord | null;

  public constructor(command: string, key: KeyChord | null) {
    this.command = command;
    this.key = key;
  }
}
