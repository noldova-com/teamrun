/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources.js";

export class SignInLinkPayload {
  public readonly providerId: string;
  public readonly url: string;

  public constructor(providerId: string, url: string) {
    ArgumentException.throwIfNullOrWhitespace(providerId, Resources.providerIdField);
    ArgumentException.throwIfNullOrWhitespace(url, Resources.urlField);

    this.providerId = providerId;
    this.url = url;
  }

  public static fromJson(value: unknown, path?: string): SignInLinkPayload {
    const reader = JsonReader.fromValue(value, path);
    return new SignInLinkPayload(reader.readNonBlankString(Resources.providerIdField), reader.readNonBlankString(Resources.urlField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.providerIdField]: this.providerId,
      [Resources.urlField]: this.url
    };
  }
}
