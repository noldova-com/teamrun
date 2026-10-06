/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import DependencyOrder from "../ordering/dependency-order.ts";
import ModuleDeclaration from "./module-declaration.ts";
import ModuleInventory from "./module-inventory.ts";
import ModuleMenus from "./module-menus.ts";
import ModuleException from "./module.exception.ts";

export default class ModuleCatalog {
  public static readonly FIXTURE_FOLDER: string = "src/shell/desktop/tests/e2e/fixtures/modules";

  private static readonly MODULES_FOLDER: string = "src/modules";
  private static readonly ROOT_MANIFEST: string = "package.json";
  private static readonly COMMANDS_KIND: string = "commands";
  private static readonly LIST_REQUIRED: string = "The root package.json must list the build's modules once each in teamrun.modules.";

  private readonly root: string;

  public constructor(root: string) {
    this.root = root;
  }

  public async readAllAsync(): Promise<ModuleInventory> {
    const folders = await this.listFoldersAsync();
    const results = await Promise.allSettled(folders.map(([folder, isFixture]) => ModuleDeclaration.readAsync(this.root, folder, isFixture)));
    return new ModuleInventory(
      results.filter(t => t.status === "fulfilled").map(t => t.value),
      results.filter(t => t.status === "rejected").map(t => String(t.reason.message)));
  }

  public async listBuildAsync(includeFixtures: boolean, excluded: readonly string[]): Promise<readonly ModuleDeclaration[]> {
    const listed = await this.readListAsync();
    const declarations: ModuleDeclaration[] = [];
    for (const id of listed) {
      const folder = `${ModuleCatalog.MODULES_FOLDER}/${id}`;
      if (!ModuleDeclaration.hasDeclaration(this.root, folder))
        throw new ModuleException(`The build lists the module ${id}, but ${folder} has no module.json.`);
      declarations.push(await ModuleDeclaration.readAsync(this.root, folder, false));
    }
    if (includeFixtures)
      for (const [folder] of (await this.listFoldersAsync()).filter(([, isFixture]) => isFixture))
        declarations.push(await ModuleDeclaration.readAsync(this.root, folder, true));

    const ids = new Set(declarations.map(t => t.id));
    if (ids.size < declarations.length)
      throw new ModuleException(`Module ids repeat in the build: ${declarations.map(t => t.folder).join(", ")}.`);
    const absent = excluded.filter(t => !ids.has(t));
    if (absent.length > 0)
      throw new ModuleException(`The build has no module ${absent.join(", ")} to leave out.`);
    for (const id of excluded)
      ids.delete(id);
    const included = declarations.filter(t => ids.has(t.id));
    for (const declaration of included) {
      const missing = declaration.dependencies.filter(t => !ids.has(t));
      if (missing.length > 0)
        throw new ModuleException(`${declaration.id} depends on ${missing.join(", ")}, which the build does not include.`);
    }
    const ordered = new DependencyOrder(included, t => t.id, t => t.dependencies)
      .sort(t => new ModuleException(`The dependencies of ${t.join(", ")} form a cycle.`));
    ModuleCatalog.checkMenus(ordered);
    return ordered;
  }

  private static checkMenus(declarations: readonly ModuleDeclaration[]): void {
    const byId = new Map(declarations.map(t => [t.id, t]));
    for (const declaration of declarations) {
      const reachable = [declaration, ...declaration.dependencies.map(t => byId.get(t)).filter(t => t !== undefined)];
      declaration.menus.checkReferences(
        declaration.id,
        new Set([...ModuleMenus.SHELL_PLACES, ...reachable.flatMap(t => t.menus.places.map(u => u.name))]),
        new Set(reachable.flatMap(t => t.menus.places.filter(u => u.toolbar !== null).map(u => u.name))),
        new Set(reachable.flatMap(t => t.contributions.get(ModuleCatalog.COMMANDS_KIND) ?? [])));
    }
  }

  private async readListAsync(): Promise<readonly string[]> {
    let manifest: unknown;
    try {
      manifest = JSON.parse(await readFile(path.join(this.root, ModuleCatalog.ROOT_MANIFEST), "utf8"));
    }
    catch (error) {
      throw new ModuleException(ModuleCatalog.LIST_REQUIRED, { cause: error });
    }
    const settings = typeof manifest === "object" && manifest !== null && "teamrun" in manifest ? manifest.teamrun : undefined;
    const modules = typeof settings === "object" && settings !== null && "modules" in settings ? settings.modules : undefined;
    if (!Array.isArray(modules) || !modules.every(t => typeof t === "string") || new Set(modules).size < modules.length)
      throw new ModuleException(ModuleCatalog.LIST_REQUIRED);
    return modules.map(t => String(t));
  }

  private async listFoldersAsync(): Promise<readonly (readonly [string, boolean])[]> {
    const folders: (readonly [string, boolean])[] = [];
    for (const [parent, isFixture] of [[ModuleCatalog.MODULES_FOLDER, false], [ModuleCatalog.FIXTURE_FOLDER, true]] as const) {
      const absolute = path.join(this.root, parent);
      const names = existsSync(absolute) ? (await readdir(absolute, { withFileTypes: true })).filter(t => t.isDirectory()).map(t => t.name).sort() : [];
      for (const name of names)
        if (ModuleDeclaration.hasDeclaration(this.root, `${parent}/${name}`))
          folders.push([`${parent}/${name}`, isFixture]);
    }
    return folders;
  }
}
