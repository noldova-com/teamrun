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
  private static readonly VIEWS_KIND: string = "views";
  private static readonly COMMANDS_KIND: string = "commands";
  private static readonly SOURCE_IMPORT: string = "import { WindowPartSource } from \"@noldova/teamrun-shell-window\";\n";
  private static readonly OUTPUT_DECLARATIONS_SEGMENTS: readonly string[] = ["modules", "declarations.json"];

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

  public locateDeclarations(outputFolder: string | null): string {
    return outputFolder === null ? this.declarationsFile : path.join(outputFolder, ...ModuleArtifacts.OUTPUT_DECLARATIONS_SEGMENTS);
  }

  public async writeAsync(declarations: readonly ModuleDeclaration[], outputFolder: string | null): Promise<void> {
    const document = { formatVersion: ModuleArtifacts.FORMAT_VERSION, modules: declarations.map(t => t.toJson()) };
    await ModuleArtifacts.writeFileAsync(this.locateDeclarations(outputFolder), `${JSON.stringify(document, null, 2)}\n`);

    const sources = declarations
      .filter(t => t.windowEntry !== null)
      .map(t => `  new WindowPartSource(${JSON.stringify(t.id)}, ${JSON.stringify(t.displayName)}, ${JSON.stringify(t.dependencies)}, `
        + `${JSON.stringify(t.contributions.get(ModuleArtifacts.VIEWS_KIND) ?? [])}, `
        + `${JSON.stringify(t.contributions.get(ModuleArtifacts.COMMANDS_KIND) ?? [])}, `
        + `() => import("../${String(t.windowEntry).slice(ModuleArtifacts.SOURCE_PREFIX.length)}").then(t => t.windowPart))`);
    const list = sources.length === 0 ? "[]" : `[\n${sources.join(",\n")}\n]`;
    await ModuleArtifacts.writeFileAsync(
      this.windowPartsFile,
      `${ModuleArtifacts.LICENSE_HEADER}\n${ModuleArtifacts.SOURCE_IMPORT}\nexport const windowPartSources: readonly WindowPartSource[] = ${list};\n`);
  }

  private static async writeFileAsync(file: string, text: string): Promise<void> {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, text);
  }
}
