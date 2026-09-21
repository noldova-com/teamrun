/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";

export class AppServerInitialization {
  public readonly userAgent: string;
  public readonly version: string | null;

  public constructor(userAgent: string) {
    ArgumentException.throwIfNullOrWhitespace(userAgent, Resources.userAgentParameterName);

    this.userAgent = userAgent;
    const match = Resources.userAgentVersionPattern.exec(userAgent);
    this.version = Object.isNull(match) ? null : String(match[1]);
  }

  public static fromJson(value: unknown, path?: string): AppServerInitialization {
    return new AppServerInitialization(JsonReader.fromValue(value, path).readNonBlankString(Resources.userAgentField));
  }
}
