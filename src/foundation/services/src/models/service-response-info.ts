/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../resources.js";

export class ServiceResponseInfo {
  public readonly name: string;
  public readonly message: string;
  public readonly arguments: readonly string[];

  public constructor(name: string, message: string, args: readonly string[] = []) {
    ArgumentException.throwIfNullOrWhitespace(name, Resources.nameParameterName);
    ArgumentException.throwIfNullOrWhitespace(message, Resources.messageParameterName);

    this.name = name;
    this.message = message;
    this.arguments = [...args];
  }
}
