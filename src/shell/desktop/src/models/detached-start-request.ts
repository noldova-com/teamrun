/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException, type JsonObject, JsonReader } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";

export class DetachedStartRequest {
  public readonly executable: string;
  public readonly launchArguments: readonly string[];
  public readonly errorFile: string;
  public readonly environment: Readonly<Record<string, string>>;

  public constructor(executable: string, launchArguments: readonly string[], errorFile: string, environment: NodeJS.ProcessEnv) {
    ArgumentException.throwIfNullOrWhitespace(executable, Resources.executableField);
    ArgumentException.throwIfNullOrWhitespace(errorFile, Resources.errorFileField);

    this.executable = executable;
    this.launchArguments = [...launchArguments];
    this.errorFile = errorFile;
    this.environment = Object.fromEntries(Object.entries(environment).filter((t): t is [string, string] => Object.isString(t[1])));
  }

  public static fromJson(value: unknown): DetachedStartRequest {
    const json = JsonReader.fromValue(value);
    const environment = json.readObject(Resources.environmentField);
    const variables: Record<string, string> = {};
    for (const [name, variable] of Object.entries(environment.toJson())) {
      if (!Object.isString(variable))
        throw new JsonException(Resources.environmentNotText, `${environment.path}.${name}`);
      variables[name] = variable;
    }
    return new DetachedStartRequest(
      json.readNonBlankString(Resources.executableField),
      json.readStringArray(Resources.argumentsField),
      json.readNonBlankString(Resources.errorFileField),
      variables);
  }

  public toJson(): JsonObject {
    return {
      [Resources.executableField]: this.executable,
      [Resources.argumentsField]: [...this.launchArguments],
      [Resources.errorFileField]: this.errorFile,
      [Resources.environmentField]: { ...this.environment }
    };
  }
}
