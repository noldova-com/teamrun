/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { KeyChord } from "@noldova/teamrun-shell-protocol";

export class ShortcutNotice {
  public readonly command: string;
  public readonly text: string;
  public readonly key: KeyChord | null;
  public readonly holder: string | null;

  public constructor(command: string, text: string, key: KeyChord | null = null, holder: string | null = null) {
    this.command = command;
    this.text = text;
    this.key = key;
    this.holder = holder;
  }
}
