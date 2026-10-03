/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { KeyChord } from "@noldova/teamrun-shell-protocol";

export class ShortcutCollision {
  public readonly key: KeyChord;
  public readonly keptBy: string;
  public readonly refused: string;

  public constructor(key: KeyChord, keptBy: string, refused: string) {
    this.key = key;
    this.keptBy = keptBy;
    this.refused = refused;
  }
}
