/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import type { JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";

export class DesktopInfo {
  public readonly dataDirectory: string;
  public readonly productVersion: string;
  public readonly platform: string;

  public constructor(dataDirectory: string, productVersion: string, platform: string) {
    ArgumentException.throwIfNullOrWhitespace(dataDirectory, Resources.dataDirectoryParameterName);
    ArgumentException.throwIfNullOrWhitespace(productVersion, Resources.productVersionParameterName);
    ArgumentException.throwIfNullOrWhitespace(platform, Resources.platformParameterName);

    this.dataDirectory = dataDirectory;
    this.productVersion = productVersion;
    this.platform = platform;
  }

  public toJson(): JsonObject {
    return {
      [Resources.dataDirectoryField]: this.dataDirectory,
      [Resources.productVersionField]: this.productVersion,
      [Resources.platformField]: this.platform
    };
  }
}
