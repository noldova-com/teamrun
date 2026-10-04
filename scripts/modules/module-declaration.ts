/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type IModuleDeclarationJson from "./interfaces/module-declaration-json.ts";
import ModuleMenus from "./module-menus.ts";
import ModuleException from "./module.exception.ts";
import ModuleSettings from "./module-settings.ts";

export default class ModuleDeclaration {
  private static readonly FILE_NAME: string = "module.json";
  private static readonly ID_PATTERN: RegExp = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
  private static readonly MEMBER_PATTERN: RegExp = /^[a-z][a-zA-Z0-9]*$/;
  private static readonly RESERVED_ID: string = "shell";
  private static readonly KINDS: readonly string[] = [
    "methods", "events", "commands", "notifications", "views", "documents", "statusBarItems", "topBarActions", "menus", "themes", ModuleSettings.SETTINGS_KIND, ModuleSettings.SCOPES_KIND
  ];
  private static readonly FIELDS: readonly string[] = ["id", "displayName", "description", "parts", "dependencies", "contributes"];
  private static readonly RUNTIME_PART: string = "runtime";
  private static readonly WINDOW_PART: string = "window";
  private static readonly WINDOW_ENTRY: string = "window/src/api/index";
  private static readonly MENUS_KIND: string = "menus";

  public static readonly PARTS: readonly string[] = ["runtime", "window", "cli"];

  public readonly folder: string;
  public readonly id: string;
  public readonly displayName: string;
  public readonly description: string;
  public readonly parts: readonly string[];
  public readonly dependencies: readonly string[];
  public readonly contributions: ReadonlyMap<string, readonly string[]>;
  public readonly menus: ModuleMenus;
  public readonly settings: readonly Readonly<Record<string, unknown>>[];
  public readonly isFixture: boolean;

  private constructor(
    folder: string,
    id: string,
    displayName: string,
    description: string,
    parts: readonly string[],
    dependencies: readonly string[],
    contributions: ReadonlyMap<string, readonly string[]>,
    menus: ModuleMenus,
    settings: readonly Readonly<Record<string, unknown>>[],
    isFixture: boolean) {
    this.folder = folder;
    this.id = id;
    this.displayName = displayName;
    this.description = description;
    this.parts = parts;
    this.dependencies = dependencies;
    this.contributions = contributions;
    this.menus = menus;
    this.settings = settings;
    this.isFixture = isFixture;
  }

  public static hasDeclaration(root: string, folder: string): boolean {
    return existsSync(path.join(root, folder, ModuleDeclaration.FILE_NAME));
  }

  public static async readAsync(root: string, folder: string, isFixture: boolean): Promise<ModuleDeclaration> {
    const file = `${folder}/${ModuleDeclaration.FILE_NAME}`;
    const fail = (problem: string): ModuleException => new ModuleException(`${file} ${problem}.`);
    let value: unknown;
    try {
      value = JSON.parse(await readFile(path.join(root, file), "utf8"));
    }
    catch (error) {
      throw new ModuleException(`${file} could not be read as JSON.`, { cause: error });
    }
    if (typeof value !== "object" || value === null || Array.isArray(value))
      throw fail("must be a JSON object");
    const record = new Map(Object.entries(value));
    const unknown = [...record.keys()].filter(t => !ModuleDeclaration.FIELDS.includes(t));
    if (unknown.length > 0)
      throw fail(`has unknown fields: ${unknown.join(", ")}`);

    const id = record.get("id");
    if (typeof id !== "string" || id !== path.posix.basename(folder) || !ModuleDeclaration.ID_PATTERN.test(id) || id === ModuleDeclaration.RESERVED_ID)
      throw fail(`must have the id "${path.posix.basename(folder)}", its folder's name: lowercase kebab-case and not "${ModuleDeclaration.RESERVED_ID}"`);
    const displayName = record.get("displayName");
    if (typeof displayName !== "string" || displayName.trim().length === 0)
      throw fail("must have a display name");
    const description = record.get("description");
    if (typeof description !== "string" || description.trim().length === 0)
      throw fail("must have a description");
    const parts = ModuleDeclaration.readList(record.get("parts"), t => ModuleDeclaration.PARTS.includes(t), fail, "parts", "runtime, window or cli");
    const missing = parts.filter(t => !existsSync(path.join(root, folder, t)));
    if (missing.length > 0)
      throw fail(`declares parts without a folder: ${missing.join(", ")}`);
    const dependencies = ModuleDeclaration.readList(record.get("dependencies"), t => ModuleDeclaration.ID_PATTERN.test(t) && t !== id, fail, "dependencies", "other modules' ids");

    const contributes = record.get("contributes");
    if (typeof contributes !== "object" || contributes === null || Array.isArray(contributes))
      throw fail("must list its contributions as an object");
    const contributions = new Map<string, readonly string[]>();
    for (const [kind, names] of Object.entries(contributes)) {
      if (!ModuleDeclaration.KINDS.includes(kind))
        throw fail(`contributes an unknown kind: ${kind}`);
      contributions.set(kind, ModuleDeclaration.readNames(names, id, fail, kind));
    }
    const menus = await ModuleMenus.readAsync(root, folder, id, contributions.get(ModuleDeclaration.MENUS_KIND) ?? []);
    const settings = await ModuleSettings.readAsync(root, folder, dependencies, contributions);
    return new ModuleDeclaration(folder, id, displayName, description, parts, dependencies, contributions, menus, settings, isFixture);
  }

  public get file(): string {
    return `${this.folder}/${ModuleDeclaration.FILE_NAME}`;
  }

  public get runtimePackage(): string | null {
    return this.parts.includes(ModuleDeclaration.RUNTIME_PART)
      ? `@noldova/teamrun-${this.isFixture ? "fixture" : "modules"}-${this.id}-${ModuleDeclaration.RUNTIME_PART}`
      : null;
  }

  public get windowEntry(): string | null {
    return this.parts.includes(ModuleDeclaration.WINDOW_PART) ? `${this.folder}/${ModuleDeclaration.WINDOW_ENTRY}` : null;
  }

  public toJson(): IModuleDeclarationJson {
    return {
      id: this.id,
      displayName: this.displayName,
      description: this.description,
      dependencies: [...this.dependencies],
      runtimePackage: this.runtimePackage,
      contributes: Object.fromEntries([...this.contributions].map(([kind, names]) => [kind, [...names]])),
      settings: [...this.settings]
    };
  }

  private static readList(value: unknown, isValid: (item: string) => boolean, fail: (problem: string) => ModuleException, field: string, expected: string): readonly string[] {
    if (!Array.isArray(value) || !value.every(t => typeof t === "string" && isValid(t)) || new Set(value).size < value.length)
      throw fail(`must list its ${field} once each as ${expected}`);
    return value.map(t => String(t));
  }

  private static readNames(value: unknown, id: string, fail: (problem: string) => ModuleException, kind: string): readonly string[] {
    const isOwned = (name: string): boolean =>
      name.startsWith(`${id}.`) && ModuleDeclaration.MEMBER_PATTERN.test(name.slice(id.length + 1));
    if (!Array.isArray(value) || !value.every(t => typeof t === "string" && isOwned(t)))
      throw fail(`must list its ${kind} as "${id}.<name>", with a camelCase name`);
    return value.map(t => String(t));
  }
}
