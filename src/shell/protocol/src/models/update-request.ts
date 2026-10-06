/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";

export class UpdateRequest {
  private static readonly FIELDS: readonly string[] = [Resources.installationField];

  public readonly installation: string;

  public constructor(installation: string) {
    ArgumentException.throwIfNullOrWhitespace(installation, Resources.installationField);

    this.installation = installation;
  }

  public static fromJson(value: unknown, path?: string): UpdateRequest {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, UpdateRequest.FIELDS);
    return WireContract.create(reader, () => new UpdateRequest(reader.readString(Resources.installationField)));
  }

  public toJson(): JsonObject {
    return { [Resources.installationField]: this.installation };
  }
}
