/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readdir } from "node:fs/promises";
import { join } from "node:path";

import "@noldova/context.core";

import { Resources } from "../../resources.js";

export class CodexSessionFile {
  public static async find(codexHome: string, threadId: string): Promise<string | null> {
    return await CodexSessionFile.findIn(join(codexHome, Resources.codexSessionsFolder), `-${threadId}${Resources.codexRolloutExtension}`);
  }

  private static async findIn(folder: string, suffix: string): Promise<string | null> {
    const entries = (await readdir(folder, { withFileTypes: true })).toSorted((a, b) => b.name.localeCompare(a.name));
    for (const entry of entries) {
      const path = join(folder, entry.name);
      const found = entry.isDirectory() ? await CodexSessionFile.findIn(path, suffix) : entry.name.endsWith(suffix) ? path : null;
      if (!Object.isNull(found))
        return found;
    }
    return null;
  }
}
