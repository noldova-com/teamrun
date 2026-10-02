/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../resources.js";
import { DataDirectory } from "../services/data-directory/data-directory.js";
import { ServerSettings } from "./server-settings.js";

export class RuntimeOptions {
  public readonly dataDirectory: DataDirectory;
  public readonly idleGraceMilliseconds: number;
  public readonly serverSettings: ServerSettings;

  public constructor(dataDirectory: DataDirectory, idleGraceMilliseconds: number = Resources.idleGrace, serverSettings: ServerSettings = new ServerSettings()) {
    this.dataDirectory = dataDirectory;
    this.idleGraceMilliseconds = idleGraceMilliseconds;
    this.serverSettings = serverSettings;
  }

  public static parse(entryArguments: readonly string[]): RuntimeOptions {
    let dataDirectory: string | undefined;
    let idleGrace = Resources.idleGrace;
    for (let index = 0; index < entryArguments.length; index += 2) {
      const name = entryArguments[index];
      const value = entryArguments[index + 1];
      if (Object.isUndefined(value))
        throw new ArgumentException(Resources.formatArgumentWithoutValue(String(name)), Resources.argumentsParameterName);
      if (name === Resources.dataDirectoryArgument)
        dataDirectory = value;
      else if (name === Resources.idleGraceArgument && Resources.positiveIntegerPattern.test(value))
        idleGrace = Number(value);
      else
        throw new ArgumentException(Resources.formatArgumentInvalid(String(name), value), Resources.argumentsParameterName);
    }
    if (Object.isUndefined(dataDirectory))
      throw new ArgumentException(Resources.dataDirectoryRequired, Resources.argumentsParameterName);
    return new RuntimeOptions(new DataDirectory(dataDirectory), idleGrace);
  }
}
