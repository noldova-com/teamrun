/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";

export class NotificationReference {
  private static readonly FIELDS: readonly string[] = [Resources.idField];

  public readonly id: string;

  public constructor(id: string) {
    if (String.isNullOrWhitespace(id))
      throw new ArgumentException(Resources.notificationIdInvalid, Resources.idField);

    this.id = id;
  }

  public static fromJson(value: unknown, path?: string): NotificationReference {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, NotificationReference.FIELDS);
    return WireContract.create(reader, () => new NotificationReference(reader.readString(Resources.idField)));
  }

  public toJson(): JsonObject {
    return { [Resources.idField]: this.id };
  }
}
