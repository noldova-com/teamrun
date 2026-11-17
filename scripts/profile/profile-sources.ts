/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type { ProfileNode } from "./profile.node.ts";

export class ProfileSources {
  public static readonly FOLDER: string = "sources";
  private static readonly BEFORE: number = 60;
  private static readonly AFTER: number = 140;

  private readonly folder: string;
  private readonly lines: Map<string, readonly string[] | null> = new Map();

  public constructor(folder: string) {
    this.folder = folder;
  }

  public snippetOf(node: ProfileNode): string {
    const lines = this.linesOf(node.fileName);
    const line = lines?.[node.lineNumber];
    if (line === undefined)
      return "";
    return line.slice(Math.max(0, node.columnNumber - ProfileSources.BEFORE), node.columnNumber + ProfileSources.AFTER);
  }

  private linesOf(fileName: string): readonly string[] | null {
    if (fileName.length === 0)
      return null;
    if (!this.lines.has(fileName)) {
      const file = path.join(this.folder, fileName);
      this.lines.set(fileName, existsSync(file) ? readFileSync(file, "utf8").split(/\r?\n/) : null);
    }
    return this.lines.get(fileName)!;
  }
}
