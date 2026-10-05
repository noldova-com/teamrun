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

import ModuleException from "./module.exception.ts";

export default class ModuleSettings {
  public static readonly FILE_NAME: string = "settings.json";
  public static readonly SETTINGS_KIND: string = "settings";
  public static readonly SCOPES_KIND: string = "settingScopes";
  private static readonly COMMANDS_KIND: string = "commands";
  private static readonly FIELDS: readonly string[] = ["name", "title", "description", "type", "default", "locality", "scopes", "page", "group"];
  private static readonly TEXT_FIELDS: readonly string[] = ["title", "description", "page", "group"];
  private static readonly LOCALITIES: readonly string[] = ["Device", "Shared"];
  private static readonly KIND_FIELDS: ReadonlyMap<string, readonly string[]> = new Map([
    ["Boolean", []],
    ["Choice", ["options"]],
    ["Number", ["minimum", "maximum", "step"]],
    ["Text", ["maxLength"]],
    ["Modules", []],
    ["Action", ["command", "label"]]
  ]);
  private static readonly STEP_TOLERANCE: number = 1e-9;

  public static async readAsync(
    root: string,
    folder: string,
    dependencies: readonly string[],
    contributions: ReadonlyMap<string, readonly string[]>
  ): Promise<readonly Readonly<Record<string, unknown>>[]> {
    const file = `${folder}/${ModuleSettings.FILE_NAME}`;
    const declared = contributions.get(ModuleSettings.SETTINGS_KIND) ?? [];
    if (!existsSync(path.join(root, file))) {
      if (declared.length > 0)
        throw new ModuleException(`${folder}/module.json declares settings, but ${file} is missing.`);
      return [];
    }
    let value: unknown;
    try {
      value = JSON.parse(await readFile(path.join(root, file), "utf8"));
    }
    catch (error) {
      throw new ModuleException(`${file} could not be read as JSON.`, { cause: error });
    }
    const top = ModuleSettings.record(value);
    const settings = top?.get("settings");
    if (top?.size !== 1 || !Array.isArray(settings))
      throw new ModuleException(`${file} must be an object whose only field, "settings", lists the module's settings.`);
    const scopes = contributions.get(ModuleSettings.SCOPES_KIND) ?? [];
    const commands = contributions.get(ModuleSettings.COMMANDS_KIND) ?? [];
    const definitions = settings.map((t, index) =>
      ModuleSettings.readDefinition(t, (problem: string) => new ModuleException(`${file} settings[${index}] ${problem}.`), dependencies, scopes, commands));
    const names = definitions.map(t => String(t["name"]));
    const undefinedNames = declared.filter(t => !names.includes(t));
    if (new Set(names).size !== names.length || undefinedNames.length > 0 || names.some(t => !declared.includes(t)))
      throw new ModuleException(`${file} must define each setting that module.json declares, once, and no other.`);
    return definitions;
  }

  private static readDefinition(
    value: unknown,
    fail: (problem: string) => ModuleException,
    dependencies: readonly string[],
    ownScopes: readonly string[],
    commands: readonly string[]
  ): Readonly<Record<string, unknown>> {
    const record = ModuleSettings.record(value);
    if (record === null || record.size !== ModuleSettings.FIELDS.length || !ModuleSettings.FIELDS.every(t => record.has(t)))
      throw fail(`must have exactly the fields ${ModuleSettings.FIELDS.join(", ")}`);
    if (!ModuleSettings.TEXT_FIELDS.every(t => ModuleSettings.isText(record.get(t))))
      throw fail("must have a title, description, page and group that are not blank");
    const accepts = ModuleSettings.readType(record.get("type"), fail, commands);
    if (!accepts(record.get("default")))
      throw fail("must have a default its type accepts");
    const locality = record.get("locality");
    if (typeof locality !== "string" || !ModuleSettings.LOCALITIES.includes(locality))
      throw fail(`must have the locality ${ModuleSettings.LOCALITIES.join(" or ")}`);
    const scopes = record.get("scopes");
    const isScope = (scope: unknown): boolean => typeof scope === "string" &&
      (ownScopes.includes(scope) || dependencies.some(t => scope.startsWith(`${t}.`)));
    if (!Array.isArray(scopes) || !scopes.every(isScope) || new Set(scopes).size !== scopes.length || (locality === "Device" && scopes.length > 0))
      throw fail(`must list distinct scopes, each one its module declares among its settingScopes or a dependency's, and none for a device setting`);
    return Object.fromEntries(record);
  }

  private static readType(value: unknown, fail: (problem: string) => ModuleException, commands: readonly string[]): (candidate: unknown) => boolean {
    const record = ModuleSettings.record(value);
    const kind = record?.get("kind");
    const fields = typeof kind === "string" ? ModuleSettings.KIND_FIELDS.get(kind) : undefined;
    if (record === null || fields === undefined || record.size !== fields.length + 1 || !fields.every(t => record.has(t)))
      throw fail("must have a type of kind Boolean, Choice, Number, Text, Modules or Action, with exactly that kind's fields");
    switch (kind) {
      case "Choice":
        return ModuleSettings.readChoice(record.get("options"), fail);
      case "Number":
        return ModuleSettings.readNumber(record.get("minimum"), record.get("maximum"), record.get("step"), fail);
      case "Text": {
        const maxLength = record.get("maxLength");
        if (!Number.isInteger(maxLength) || Number(maxLength) <= 0)
          throw fail("must have a text type whose maxLength is a positive integer");
        return candidate => typeof candidate === "string" && candidate.length <= Number(maxLength);
      }
      case "Modules":
        return candidate => Array.isArray(candidate) && candidate.every(ModuleSettings.isText) && new Set(candidate).size === candidate.length;
      case "Action":
        if (!commands.includes(String(record.get("command"))) || !ModuleSettings.isText(record.get("label")))
          throw fail("must have an action type whose command is one its module declares and whose label is not blank");
        return candidate => candidate === null;
      default:
        return candidate => typeof candidate === "boolean";
    }
  }

  private static readChoice(options: unknown, fail: (problem: string) => ModuleException): (candidate: unknown) => boolean {
    const values = Array.isArray(options) ? options.map(t => {
      const option = ModuleSettings.record(t);
      return option?.size === 2 && ModuleSettings.isText(option.get("value")) && ModuleSettings.isText(option.get("title")) ? option.get("value") : null;
    }) : [];
    if (values.length === 0 || values.includes(null) || new Set(values).size !== values.length)
      throw fail("must have a choice type with options, each with a distinct value and a title, none blank");
    return candidate => values.includes(candidate);
  }

  private static readNumber(minimum: unknown, maximum: unknown, step: unknown, fail: (problem: string) => ModuleException): (candidate: unknown) => boolean {
    if (![minimum, maximum, step].every(t => typeof t === "number" && Number.isFinite(t)) || Number(minimum) > Number(maximum) || Number(step) <= 0)
      throw fail("must have a number type whose minimum is no greater than its maximum and whose step is positive");
    return candidate => {
      const steps = (Number(candidate) - Number(minimum)) / Number(step);
      return typeof candidate === "number" && candidate >= Number(minimum) && candidate <= Number(maximum) && Math.abs(steps - Math.round(steps)) < ModuleSettings.STEP_TOLERANCE;
    };
  }

  private static record(value: unknown): Map<string, unknown> | null {
    return typeof value === "object" && value !== null && !Array.isArray(value) ? new Map(Object.entries(value)) : null;
  }

  private static isText(value: unknown): boolean {
    return typeof value === "string" && value.trim().length > 0;
  }
}
