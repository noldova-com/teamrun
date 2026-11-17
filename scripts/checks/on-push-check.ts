/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import type { ICheck } from "./interfaces/i-check.ts";

export class OnPushCheck implements ICheck {
  private static readonly SOURCE: RegExp = /\.m?ts$/u;
  private static readonly STRATEGY: RegExp = /\bchangeDetection\s*:(?!\s*ChangeDetectionStrategy\.Eager\b)/gu;
  private static readonly LINE_FEED: string = "\n";

  private readonly root: string;
  private readonly listFilesAsync: () => Promise<readonly string[]>;

  public readonly title: string = "OnPush strategies";

  public constructor(root: string, listFilesAsync: () => Promise<readonly string[]>) {
    this.root = root;
    this.listFilesAsync = listFilesAsync;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    let checked = 0;
    let failures = 0;
    for (const file of await this.listFilesAsync()) {
      if (!OnPushCheck.SOURCE.test(file))
        continue;
      checked++;
      const text = await readFile(path.join(this.root, file), "utf8");
      for (const match of text.matchAll(OnPushCheck.STRATEGY)) {
        output.write(`${file}:${text.slice(0, match.index).split(OnPushCheck.LINE_FEED).length} sets a changeDetection other than Eager; OnPush is the default since Angular 22, so leave the strategy out, and write one only to choose Eager, with the reason.\n`);
        failures++;
      }
    }
    if (checked === 0) {
      output.write("The OnPush strategies check found no TypeScript file in the repository, so it read nothing.\n");
      return false;
    }
    output.write(`Read ${checked} TypeScript files for a changeDetection other than Eager.\n`);
    return failures === 0;
  }
}
