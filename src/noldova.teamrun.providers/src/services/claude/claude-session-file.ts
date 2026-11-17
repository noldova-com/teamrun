/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

import "@noldova/context.core";

import { Resources } from "../../resources.js";

export class ClaudeSessionFile {
  public static async find(configDir: string, sessionId: string): Promise<string | null> {
    const projects = join(configDir, Resources.claudeProjectsFolder);
    const folders = await readdir(projects, { withFileTypes: true });
    const files = await Promise.all(folders.filter(t => t.isDirectory()).map(async t => {
      const file = join(projects, t.name, sessionId + Resources.claudeSessionFileExtension);
      return await stat(file).then(() => file, () => null);
    }));
    return files.find((t): t is string => !Object.isNull(t)) ?? null;
  }
}
