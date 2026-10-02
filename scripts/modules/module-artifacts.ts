/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type ModuleDeclaration from "./module-declaration.ts";

export default class ModuleArtifacts {
  private static readonly DECLARATIONS_FILE: string = "_build/modules/declarations.json";
  private static readonly WINDOW_PARTS_FILE: string = "src/generated/window-parts.ts";
  private static readonly LICENSE_HEADER: string = [
    "/**",
    " * @license",
    " * Copyright (c) Noldova.",
    " *",
    " * This source code is licensed under the license found in the",
    " * LICENSE file in the root directory of this source tree.",
    " */",
    ""
  ].join("\n");
  private static readonly FORMAT_VERSION: number = 1;
  private static readonly SOURCE_PREFIX: string = "src/";
  private static readonly PART_IMPORT: string = "import type { IWindowPart } from \"@noldova/teamrun-shell-window\";\n";
  private static readonly LOADER_TYPE: string = "readonly (() => Promise<IWindowPart>)[]";

  private readonly root: string;

  public constructor(root: string) {
    this.root = root;
  }

  public get declarationsFile(): string {
    return path.join(this.root, ModuleArtifacts.DECLARATIONS_FILE);
  }

  public get windowPartsFile(): string {
    return path.join(this.root, ModuleArtifacts.WINDOW_PARTS_FILE);
  }

  public async writeAsync(declarations: readonly ModuleDeclaration[]): Promise<void> {
    const document = { formatVersion: ModuleArtifacts.FORMAT_VERSION, modules: declarations.map(t => t.toJson()) };
    await ModuleArtifacts.writeFileAsync(this.declarationsFile, `${JSON.stringify(document, null, 2)}\n`);

    const loaders = declarations
      .map(t => t.windowEntry)
      .filter(t => t !== null)
      .map(t => `  () => import("../${t.slice(ModuleArtifacts.SOURCE_PREFIX.length)}").then(t => t.windowPart)`);
    const list = loaders.length === 0 ? "[]" : `[\n${loaders.join(",\n")}\n]`;
    await ModuleArtifacts.writeFileAsync(
      this.windowPartsFile,
      `${ModuleArtifacts.LICENSE_HEADER}\n${ModuleArtifacts.PART_IMPORT}\nexport const windowPartLoaders: ${ModuleArtifacts.LOADER_TYPE} = ${list};\n`);
  }

  private static async writeFileAsync(file: string, text: string): Promise<void> {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, text);
  }
}
