/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { CliOptionType } from "../enums/cli-option-type.js";
import type { CliArgumentDefinition } from "../models/cli-argument-definition.js";
import type { CliCommandDefinition } from "../models/cli-command-definition.js";
import type { CliModule } from "../models/cli-module.js";
import type { CliOptionDefinition } from "../models/cli-option-definition.js";
import { Resources } from "../resources.js";

export class CliHelp {
  public static formatAll(modules: readonly CliModule[]): string {
    const listed = modules.filter(t => t.commands.length > 0);
    if (listed.length === 0)
      return Resources.usage;
    const indent = Resources.helpIndent;
    const rows = listed.flatMap(module => [
      [`${indent}${module.displayName}`, String.empty] as const,
      ...module.commands.map(t => [`${indent}${indent}${Resources.formatModuleCommand(module.id, t.word)}`, t.summary] as const)
    ]);
    return [Resources.usage, String.empty, Resources.moduleCommandsTitle, ...CliHelp.formatRows(rows)].join(Resources.lineEnd);
  }

  public static formatModule(module: CliModule): string {
    const commands = module.commands.length === 0
      ? [`${Resources.helpIndent}${Resources.noModuleCommands}`]
      : [...CliHelp.formatRows(module.commands.map(t => [`${Resources.helpIndent}${t.word}`, t.summary])), String.empty, Resources.formatModuleHelpHint(module.id)];
    return [
      Resources.formatModuleUsage(module.id),
      String.empty,
      Resources.formatModuleHeading(module.displayName, module.description),
      String.empty,
      Resources.commandsTitle,
      ...commands
    ].join(Resources.lineEnd);
  }

  public static formatCommand(module: CliModule, command: CliCommandDefinition): string {
    const indent = Resources.helpIndent;
    const syntax = [...command.arguments.map(t => CliHelp.formatArgumentSyntax(t)), ...command.options.map(t => CliHelp.formatOptionSyntax(t))];
    const sections = [
      [Resources.formatCommandUsage(module.id, command.word, syntax), String.empty, command.description ?? command.summary],
      CliHelp.formatSection(Resources.argumentsTitle, command.arguments.map(t =>
        [`${indent}${t.placeholder}${t.isVariadic ? Resources.repeatedSuffix : String.empty}`, t.isRequired ? t.description : `${t.description} ${Resources.optionalArgument}`]
      )),
      CliHelp.formatSection(Resources.optionsTitle, command.options.map(t => [`${indent}${CliHelp.formatOptionForm(t)}`, CliHelp.describeOption(t)])),
      command.examples.length === 0 ? [] : [String.empty, Resources.examplesTitle, ...command.examples.flatMap(([exampleArguments, description]) =>
        [`${indent}${Resources.formatExample(module.id, command.word, exampleArguments)}`, `${indent}${indent}${description}`])]
    ];
    return sections.flat().join(Resources.lineEnd);
  }

  private static formatSection(title: string, rows: readonly (readonly [string, string])[]): readonly string[] {
    return rows.length === 0 ? [] : [String.empty, title, ...CliHelp.formatRows(rows)];
  }

  private static formatRows(rows: readonly (readonly [string, string])[]): readonly string[] {
    const width = Math.max(...rows.filter(([, right]) => right.length > 0).map(([left]) => left.length));
    return rows.map(([left, right]) => right.length === 0 ? left : `${left.padEnd(width)}${Resources.helpGap}${right}`);
  }

  private static formatArgumentSyntax(argument: CliArgumentDefinition): string {
    const syntax = `${argument.placeholder}${argument.isVariadic ? Resources.repeatedSuffix : String.empty}`;
    return argument.isRequired ? syntax : Resources.formatOptional(syntax);
  }

  private static formatOptionSyntax(option: CliOptionDefinition): string {
    const syntax = option.isRequired ? CliHelp.formatOptionForm(option) : Resources.formatOptional(CliHelp.formatOptionForm(option));
    return option.isRepeated ? `${syntax}${Resources.repeatedSuffix}` : syntax;
  }

  private static formatOptionForm(option: CliOptionDefinition): string {
    switch (option.type) {
      case CliOptionType.Boolean:
        return option.flag;
      case CliOptionType.Text:
        return `${option.flag} ${Resources.textPlaceholder}`;
      case CliOptionType.Number:
        return `${option.flag} ${Resources.numberPlaceholder}`;
    }
  }

  private static describeOption(option: CliOptionDefinition): string {
    return [
      option.description,
      option.isRequired ? Resources.requiredOption : String.empty,
      option.isRepeated ? Resources.repeatedOption : String.empty,
      Object.isNull(option.defaultValue) ? String.empty : Resources.formatDefault(String(option.defaultValue))
    ].filter(t => t.length > 0).join(" ");
  }
}
