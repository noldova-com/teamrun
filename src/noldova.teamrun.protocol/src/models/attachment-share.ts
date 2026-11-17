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

export class AttachmentShare {
  public readonly grant: string;

  public constructor(grant: string) {
    ArgumentException.throwIfNullOrWhitespace(grant, Resources.grantField);

    this.grant = grant;
  }

  public static fromJson(value: unknown, path?: string): AttachmentShare {
    return new AttachmentShare(JsonReader.fromValue(value, path).readNonBlankString(Resources.grantField));
  }

  public toJson(): JsonObject {
    return { [Resources.grantField]: this.grant };
  }
}
