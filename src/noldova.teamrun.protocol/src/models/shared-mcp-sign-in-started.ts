/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.js";

export class SharedMcpSignInStarted {
  public readonly url: string;

  public constructor(url: string) {
    if (!SharedMcpSignInStarted.isHttpUrl(url))
      throw new ArgumentException(Resources.invalidSharedMcpSignInUrl, Resources.urlField);

    this.url = url;
  }

  public static fromJson(value: unknown, path?: string): SharedMcpSignInStarted {
    return new SharedMcpSignInStarted(JsonReader.fromValue(value, path).readNonBlankString(Resources.urlField));
  }

  public toJson(): JsonObject {
    return { [Resources.urlField]: this.url };
  }

  private static isHttpUrl(url: string): boolean {
    try {
      return Resources.httpUrlProtocols.includes(new URL(url).protocol);
    }
    catch {
      return false;
    }
  }
}
