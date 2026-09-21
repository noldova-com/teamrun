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

export class AppServerClientInfo {
  public readonly name: string;
  public readonly title: string;
  public readonly version: string;

  public constructor(name: string, title: string, version: string) {
    ArgumentException.throwIfNullOrWhitespace(name, Resources.nameParameterName);
    ArgumentException.throwIfNullOrWhitespace(title, Resources.titleParameterName);
    ArgumentException.throwIfNullOrWhitespace(version, Resources.versionParameterName);

    this.name = name;
    this.title = title;
    this.version = version;
  }

  public toJson(): JsonObject {
    return { name: this.name, title: this.title, version: this.version };
  }
}
