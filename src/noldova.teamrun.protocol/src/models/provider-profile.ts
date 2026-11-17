/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.js";

export class ProviderProfile {
  public readonly variable: string;
  public readonly signInCommand: string | null;
  public readonly usualFolder: string | null;
  public readonly toolCommand: string | null;
  public readonly signInVariables: Readonly<Record<string, string>>;
  public readonly signInValues: Readonly<Record<string, string>>;
  public readonly personFolders: readonly string[];

  public constructor(variable: string, signInCommand: string | null = null, usualFolder: string | null = null, toolCommand: string | null = null,
    signInVariables: Readonly<Record<string, string>> = {}, signInValues: Readonly<Record<string, string>> = {}, personFolders: readonly string[] = []) {
    if (!Resources.environmentVariablePattern.test(variable))
      throw new ArgumentException(Resources.invalidProfileVariable, Resources.variableField);
    if (!Object.isNull(signInCommand))
      ArgumentException.throwIfNullOrWhitespace(signInCommand, Resources.signInCommandField);
    if (!Object.isNull(usualFolder))
      ArgumentException.throwIfNullOrWhitespace(usualFolder, Resources.usualFolderField);
    if (!Object.isNull(toolCommand))
      ArgumentException.throwIfNullOrWhitespace(toolCommand, Resources.toolCommandField);
    for (const [name, folder] of Object.entries(signInVariables)) {
      if (!Resources.environmentVariablePattern.test(name))
        throw new ArgumentException(Resources.invalidProfileVariable, Resources.signInVariablesField);
      if (name === variable)
        throw new ArgumentException(Resources.profileVariableRepeated, Resources.signInVariablesField);
      if (!Resources.profileSubfolderPattern.test(folder))
        throw new ArgumentException(Resources.invalidProfileSubfolder, Resources.signInVariablesField);
    }
    for (const [name, value] of Object.entries(signInValues)) {
      if (!Resources.environmentVariablePattern.test(name))
        throw new ArgumentException(Resources.invalidProfileVariable, Resources.signInValuesField);
      if (name === variable || Object.hasOwn(signInVariables, name))
        throw new ArgumentException(Resources.profileValueRepeated, Resources.signInValuesField);
      if (value.includes("\0"))
        throw new ArgumentException(Resources.invalidProfileValue, Resources.signInValuesField);
    }
    for (const folder of personFolders)
      ArgumentException.throwIfNullOrWhitespace(folder, Resources.personFoldersField);

    this.variable = variable;
    this.signInCommand = signInCommand;
    this.usualFolder = usualFolder;
    this.toolCommand = toolCommand;
    this.signInVariables = { ...signInVariables };
    this.signInValues = { ...signInValues };
    this.personFolders = [...personFolders];
  }

  public static fromJson(value: unknown, path?: string): ProviderProfile {
    const reader = JsonReader.fromValue(value, path);
    return new ProviderProfile(reader.readNonBlankString(Resources.variableField), reader.readNullableString(Resources.signInCommandField),
      reader.hasField(Resources.usualFolderField) ? reader.readNullableString(Resources.usualFolderField) : null,
      reader.hasField(Resources.toolCommandField) ? reader.readNullableString(Resources.toolCommandField) : null,
      ProviderProfile.variablesFromJson(reader), ProviderProfile.valuesFromJson(reader),
      reader.hasField(Resources.personFoldersField) ? reader.readStringArray(Resources.personFoldersField) : []);
  }

  private static variablesFromJson(reader: JsonReader): Record<string, string> {
    const variables = reader.hasField(Resources.signInVariablesField) ? reader.readObject(Resources.signInVariablesField) : null;
    return Object.fromEntries(Object.keys(variables?.toJson() ?? {}).map(t => [t, variables!.readNonBlankString(t)]));
  }

  private static valuesFromJson(reader: JsonReader): Record<string, string> {
    const values = reader.hasField(Resources.signInValuesField) ? reader.readObject(Resources.signInValuesField) : null;
    return Object.fromEntries(Object.keys(values?.toJson() ?? {}).map(t => [t, values!.readString(t)]));
  }

  public toJson(): JsonObject {
    return {
      [Resources.variableField]: this.variable,
      [Resources.signInCommandField]: this.signInCommand,
      [Resources.usualFolderField]: this.usualFolder,
      [Resources.toolCommandField]: this.toolCommand,
      [Resources.signInVariablesField]: { ...this.signInVariables },
      [Resources.signInValuesField]: { ...this.signInValues },
      [Resources.personFoldersField]: [...this.personFolders]
    };
  }
}
