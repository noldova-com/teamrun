/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../resources.js";

export class ProcessRequest {
  public readonly program: string;
  public readonly arguments: readonly string[];
  public readonly workingFolder: string;
  public readonly environment: Readonly<Record<string, string>>;
  public readonly inherit: readonly string[];
  public readonly signal?: AbortSignal;

  public constructor(
    program: string,
    launchArguments: readonly string[],
    workingFolder: string,
    environment: Readonly<Record<string, string>> = {},
    inherit: readonly string[] = [],
    signal?: AbortSignal) {
    ArgumentException.throwIfNullOrWhitespace(program, Resources.programParameterName);
    if (!path.isAbsolute(workingFolder))
      throw new ArgumentException(Resources.workingFolderNotAbsolute, Resources.workingFolderParameterName);
    ProcessRequest.requireNames(Object.keys(environment), Resources.environmentParameterName);
    ProcessRequest.requireNames(inherit, Resources.inheritParameterName);

    this.program = program;
    this.arguments = [...launchArguments];
    this.workingFolder = workingFolder;
    this.environment = { ...environment };
    this.inherit = [...inherit];
    if (!Object.isUndefined(signal))
      this.signal = signal;
  }

  private static requireNames(names: readonly string[], parameterName: string): void {
    const invalid = names.find(t => !Resources.environmentNamePattern.test(t));
    if (!Object.isUndefined(invalid))
      throw new ArgumentException(Resources.formatEnvironmentNameInvalid(invalid), parameterName);
  }
}
