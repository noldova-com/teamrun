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
import { BuildIdentity } from "./build-identity.js";

export class RuntimeHandover {
  private static readonly FIELDS: readonly string[] = [Resources.identityField, Resources.executablePathField];

  public readonly identity: BuildIdentity;
  public readonly executablePath: string;

  public constructor(identity: BuildIdentity, executablePath: string) {
    ArgumentException.throwIfNullOrWhitespace(executablePath, Resources.executablePathField);

    this.identity = identity;
    this.executablePath = executablePath;
  }

  public static fromJson(value: unknown, path?: string): RuntimeHandover {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, RuntimeHandover.FIELDS);
    const identity = reader.readObject(Resources.identityField);
    return WireContract.create(reader, () => new RuntimeHandover(
      BuildIdentity.fromJson(identity.toJson(), identity.path),
      reader.readString(Resources.executablePathField)));
  }

  public toJson(): JsonObject {
    return { [Resources.identityField]: this.identity.toJson(), [Resources.executablePathField]: this.executablePath };
  }
}
