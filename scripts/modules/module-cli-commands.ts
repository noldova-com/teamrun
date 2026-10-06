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

import { CommandLineNames } from "../../src/shell/cli/src/models/command-line-names.ts";
import ModuleException from "./module.exception.ts";

export default class ModuleCliCommands {
  public static readonly FILE_NAME: string = "cli.json";
  public static readonly KIND: string = "cliCommands";
  private static readonly COMMAND_FIELDS: readonly string[] = ["name", "summary", "description", "arguments", "options", "examples"];
  private static readonly OPTIONAL_COMMAND_FIELDS: readonly string[] = ["description", "examples"];
  private static readonly ARGUMENT_FIELDS: readonly string[] = ["name", "description", "required", "variadic"];
  private static readonly VALUE_FIELDS: readonly string[] = ["name", "description", "type", "required", "repeated", "default"];
  private static readonly BOOLEAN_FIELDS: readonly string[] = ["name", "description", "type"];
  private static readonly EXAMPLE_FIELDS: readonly string[] = ["arguments", "description"];
  private static readonly TYPES: readonly string[] = ["Text", "Number", "Boolean"];
  private static readonly MEMBER_PATTERN: RegExp = /^[a-z][a-zA-Z0-9]*$/;

  public static async readAsync(root: string, folder: string, contributions: ReadonlyMap<string, readonly string[]>): Promise<readonly Readonly<Record<string, unknown>>[]> {
    const file = `${folder}/${ModuleCliCommands.FILE_NAME}`;
    const declared = contributions.get(ModuleCliCommands.KIND) ?? [];
    if (!existsSync(path.join(root, file))) {
      if (declared.length > 0)
        throw new ModuleException(`${folder}/module.json declares command-line commands, but ${file} is missing.`);
      return [];
    }
    let value: unknown;
    try {
      value = JSON.parse(await readFile(path.join(root, file), "utf8"));
    }
    catch (error) {
      throw new ModuleException(`${file} could not be read as JSON.`, { cause: error });
    }
    const top = ModuleCliCommands.record(value);
    const commands = top?.get("commands");
    if (top?.size !== 1 || !Array.isArray(commands))
      throw new ModuleException(`${file} must be an object whose only field, "commands", lists the module's command-line commands.`);
    const definitions = commands.map((t, index) =>
      ModuleCliCommands.readCommand(t, (problem: string) => new ModuleException(`${file} commands[${index}] ${problem}.`)));
    const names = definitions.map(t => String(t["name"]));
    if (new Set(names).size !== names.length || declared.some(t => !names.includes(t)) || names.some(t => !declared.includes(t)))
      throw new ModuleException(`${file} must define each command-line command that module.json declares, once, and no other.`);
    return definitions;
  }

  private static readCommand(value: unknown, fail: (problem: string) => ModuleException): Readonly<Record<string, unknown>> {
    const record = ModuleCliCommands.readFields(value, ModuleCliCommands.COMMAND_FIELDS, ModuleCliCommands.OPTIONAL_COMMAND_FIELDS, fail);
    if (!ModuleCliCommands.isText(record.get("name")) || !ModuleCliCommands.isText(record.get("summary")))
      throw fail("must have a name and a summary that are not blank");
    const description = record.get("description") ?? null;
    if (description !== null && !ModuleCliCommands.isText(description))
      throw fail("must have a description that is not blank, or none");
    const commandArguments = ModuleCliCommands.readEach(record.get("arguments"), fail, "arguments", ModuleCliCommands.readArgument);
    const options = ModuleCliCommands.readEach(record.get("options"), fail, "options", ModuleCliCommands.readOption);
    const examples = ModuleCliCommands.readEach(record.get("examples") ?? [], fail, "examples", ModuleCliCommands.readExample);
    const names = [...commandArguments, ...options].map(t => t["name"]);
    if (new Set(names).size !== names.length)
      throw fail("must name each of its arguments and options once");
    const required = commandArguments.map(t => t["required"] === true);
    if (required.some((t, index) => t && required.slice(0, index).includes(false)))
      throw fail("must not have a required argument after an optional one");
    if (commandArguments.slice(0, -1).some(t => t["variadic"] === true))
      throw fail("must have only its last argument variadic");
    const global = options.map(t => ModuleCliCommands.toKebabCase(String(t["name"]))).filter(t => CommandLineNames.ownOptions.includes(t));
    if (global.length > 0)
      throw fail(`must not have options the command line has itself: ${global.map(t => `--${t}`).join(", ")}`);
    return { name: record.get("name"), summary: record.get("summary"), description, arguments: commandArguments, options, examples };
  }

  private static readArgument(value: unknown, fail: (problem: string) => ModuleException): Readonly<Record<string, unknown>> {
    const record = ModuleCliCommands.readFields(value, ModuleCliCommands.ARGUMENT_FIELDS, ["required", "variadic"], fail);
    ModuleCliCommands.readMember(record, fail);
    const required = record.get("required") ?? true;
    const variadic = record.get("variadic") ?? false;
    if (typeof required !== "boolean" || typeof variadic !== "boolean")
      throw fail("must have a required and a variadic that are true or false");
    return { name: record.get("name"), description: record.get("description"), required, variadic };
  }

  private static readOption(value: unknown, fail: (problem: string) => ModuleException): Readonly<Record<string, unknown>> {
    const type = ModuleCliCommands.record(value)?.get("type");
    if (typeof type !== "string" || !ModuleCliCommands.TYPES.includes(type))
      throw fail("must have the type Text, Number or Boolean");
    if (type === "Boolean") {
      const record = ModuleCliCommands.readFields(value, ModuleCliCommands.BOOLEAN_FIELDS, [], fail);
      ModuleCliCommands.readMember(record, fail);
      return { name: record.get("name"), description: record.get("description"), type, required: false, repeated: false, default: null };
    }
    const record = ModuleCliCommands.readFields(value, ModuleCliCommands.VALUE_FIELDS, ["required", "repeated", "default"], fail);
    ModuleCliCommands.readMember(record, fail);
    const required = record.get("required") ?? false;
    const repeated = record.get("repeated") ?? false;
    if (typeof required !== "boolean" || typeof repeated !== "boolean")
      throw fail("must have a required and a repeated that are true or false");
    const fallback = record.get("default") ?? null;
    const isAccepted = type === "Text" ? typeof fallback === "string" : typeof fallback === "number";
    if (fallback !== null && (!isAccepted || required || repeated))
      throw fail("must have a default its type accepts, or none, and none when it is required or repeated");
    return { name: record.get("name"), description: record.get("description"), type, required, repeated, default: fallback };
  }

  private static readExample(value: unknown, fail: (problem: string) => ModuleException): Readonly<Record<string, unknown>> {
    const record = ModuleCliCommands.readFields(value, ModuleCliCommands.EXAMPLE_FIELDS, [], fail);
    if (typeof record.get("arguments") !== "string" || !ModuleCliCommands.isText(record.get("description")))
      throw fail("must have arguments as text and a description that is not blank");
    return Object.fromEntries(record);
  }

  private static readMember(record: ReadonlyMap<string, unknown>, fail: (problem: string) => ModuleException): void {
    const name = record.get("name");
    if (typeof name !== "string" || !ModuleCliCommands.MEMBER_PATTERN.test(name) || !ModuleCliCommands.isText(record.get("description")))
      throw fail("must have a camelCase name and a description that is not blank");
  }

  private static readFields(value: unknown, fields: readonly string[], optional: readonly string[], fail: (problem: string) => ModuleException): ReadonlyMap<string, unknown> {
    const record = ModuleCliCommands.record(value);
    if (record === null || [...record.keys()].some(t => !fields.includes(t)) || fields.some(t => !optional.includes(t) && !record.has(t))) {
      const optionalText = optional.length > 0 ? `, and optionally ${optional.join(", ")}` : "";
      throw fail(`must be an object with the fields ${fields.filter(t => !optional.includes(t)).join(", ")}${optionalText}`);
    }
    return record;
  }

  private static readEach(
    value: unknown,
    fail: (problem: string) => ModuleException,
    field: string,
    read: (item: unknown, fail: (problem: string) => ModuleException) => Readonly<Record<string, unknown>>
  ): readonly Readonly<Record<string, unknown>>[] {
    if (!Array.isArray(value))
      throw fail(`must list its ${field}`);
    return value.map((t: unknown, index) => read(t, (problem: string) => fail(`${field}[${index}] ${problem}`)));
  }

  private static toKebabCase(name: string): string {
    return name.replace(/[A-Z]/g, t => `-${t.toLowerCase()}`);
  }

  private static record(value: unknown): Map<string, unknown> | null {
    return typeof value === "object" && value !== null && !Array.isArray(value) ? new Map(Object.entries(value)) : null;
  }

  private static isText(value: unknown): boolean {
    return typeof value === "string" && value.trim().length > 0;
  }
}
