/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export class DocsModuleWriter {
  private static readonly HEADER: string = [
    "/**",
    " * @license",
    " * Copyright (c) Noldova.",
    " *",
    " * This source code is licensed under the license found in the",
    " * LICENSE file in the root directory of this source tree.",
    " */"
  ].join("\n");
  private static readonly INDENT: number = 2;

  private readonly root: string;

  public constructor(root: string) {
    this.root = root;
  }

  public async writeAsync(file: string, name: string, value: unknown): Promise<void> {
    const target = path.join(this.root, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `${DocsModuleWriter.HEADER}\n\nexport const ${name} = ${JSON.stringify(value, null, DocsModuleWriter.INDENT)};\n`);
  }
}
