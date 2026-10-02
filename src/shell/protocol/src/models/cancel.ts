/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { WireMessageKind } from "../enums/wire-message-kind.js";
import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";
import { WireMessage } from "./wire-message.js";

export class Cancel extends WireMessage {
  public override readonly kind: WireMessageKind = WireMessageKind.Cancel;
  public readonly id: string;

  public constructor(id: string) {
    super();
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);

    this.id = id;
  }

  public static fromJson(value: unknown, path?: string): Cancel {
    const reader = JsonReader.fromValue(value, path);
    return WireContract.create(reader, () => new Cancel(reader.readString(Resources.idField)));
  }

  protected override toJsonFields(): JsonObject {
    return { [Resources.idField]: this.id };
  }
}
