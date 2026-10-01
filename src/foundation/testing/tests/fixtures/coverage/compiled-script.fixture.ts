/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { writeFile } from "node:fs/promises";

export class CompiledScriptFixture {
  private static readonly UNMAPPED_SOURCE_MAP: string = JSON.stringify({ version: 3, sources: [], mappings: "" });

  public static async writeAsync(path: string, text: string): Promise<void> {
    await writeFile(path, text);
    await writeFile(`${path}.map`, CompiledScriptFixture.UNMAPPED_SOURCE_MAP);
  }
}
