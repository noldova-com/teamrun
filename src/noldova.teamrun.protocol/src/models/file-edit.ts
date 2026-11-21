/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DiffLineKind } from "../enums/diff-line-kind.js";
import type { DiffLine } from "./diff-line.js";

export class FileEdit {
  public readonly path: string;
  public readonly kind: string;
  public readonly lines: readonly DiffLine[];
  public readonly movePath: string | null;

  public constructor(path: string, kind: string, lines: readonly DiffLine[], movePath: string | null = null) {
    this.path = path;
    this.kind = kind;
    this.lines = lines;
    this.movePath = movePath;
  }

  public get additions(): number {
    return this.lines.filter(t => t.kind === DiffLineKind.Added).length;
  }

  public get deletions(): number {
    return this.lines.filter(t => t.kind === DiffLineKind.Removed).length;
  }

  public get hasDiff(): boolean {
    return this.lines.some(t => t.kind !== DiffLineKind.Meta);
  }
}
