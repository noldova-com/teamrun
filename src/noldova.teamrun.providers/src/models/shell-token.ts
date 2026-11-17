/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ShellTokenKind } from "../enums/shell-token-kind.js";

export class ShellToken {
  public readonly kind: ShellTokenKind;
  public readonly text: string;
  public readonly isLiteral: boolean;
  public readonly isQuoted: boolean;
  public readonly runsCommands: boolean;
  public readonly items: readonly ShellToken[];

  public constructor(kind: ShellTokenKind, text: string, isLiteral: boolean = true, isQuoted: boolean = false, runsCommands: boolean = false,
    items: readonly ShellToken[] = []) {
    this.kind = kind;
    this.text = text;
    this.isLiteral = isLiteral;
    this.isQuoted = isQuoted;
    this.runsCommands = runsCommands;
    this.items = items;
  }

  public static word(text: string, isLiteral: boolean = true, isQuoted: boolean = false, runsCommands: boolean = false,
    items: readonly ShellToken[] = []): ShellToken {
    return new ShellToken(ShellTokenKind.Word, text, isLiteral, isQuoted, runsCommands, items);
  }
}
