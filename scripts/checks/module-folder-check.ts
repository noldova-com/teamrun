/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import type ModuleCatalog from "../modules/module-catalog.ts";
import ModuleDeclaration from "../modules/module-declaration.ts";
import type ICheck from "./interfaces/i-check.ts";

export default class ModuleFolderCheck implements ICheck {
  private static readonly MODULES_FOLDER: string = "src/modules";
  private static readonly ID_PATTERN: RegExp = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
  private static readonly RESERVED_ID: string = "shell";
  private static readonly DOCUMENT_NAME: string = "README.md";

  private readonly root: string;
  private readonly modules: ModuleCatalog;

  public readonly title: string = "Module folders";

  public constructor(root: string, modules: ModuleCatalog) {
    this.root = root;
    this.modules = modules;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const folder = path.join(this.root, ModuleFolderCheck.MODULES_FOLDER);
    const names = existsSync(folder) ? (await readdir(folder)).sort() : [];
    const findings: string[] = [];
    for (const name of names) {
      const location = `${ModuleFolderCheck.MODULES_FOLDER}/${name}`;
      if (!(await stat(path.join(folder, name))).isDirectory()) {
        findings.push(`${location} is not a module folder.`);
        continue;
      }
      if (!ModuleFolderCheck.ID_PATTERN.test(name) || name === ModuleFolderCheck.RESERVED_ID)
        findings.push(`${location}: "${name}" is not a module id; an id is lowercase kebab-case and not "${ModuleFolderCheck.RESERVED_ID}".`);
      if (!existsSync(path.join(folder, name, ModuleFolderCheck.DOCUMENT_NAME)))
        findings.push(`${location} has no ${ModuleFolderCheck.DOCUMENT_NAME}.`);
      const parts = ModuleDeclaration.PARTS.filter(t => existsSync(path.join(folder, name, t)));
      if (parts.length > 0 && !ModuleDeclaration.hasDeclaration(this.root, location))
        findings.push(`${location} has the parts ${parts.join(", ")} but no module.json.`);
    }
    findings.push(...(await this.modules.readAllAsync()).problems);

    for (const finding of findings)
      output.write(`${finding}\n`);
    output.write(`Checked ${names.length} module folders.\n`);
    return findings.length === 0;
  }
}
