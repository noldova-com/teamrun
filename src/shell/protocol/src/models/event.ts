/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject, type JsonValue } from "@noldova/teamrun-foundation-json";

import { WireMessageKind } from "../enums/wire-message-kind.js";
import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";
import { QualifiedName } from "./qualified-name.js";
import { WireMessage } from "./wire-message.js";

export class Event extends WireMessage {
  public override readonly kind: WireMessageKind = WireMessageKind.Event;
  public readonly name: QualifiedName;
  public readonly payload: JsonValue;

  public constructor(name: QualifiedName, payload: JsonValue) {
    super();

    this.name = name;
    this.payload = payload;
  }

  public static fromJson(value: unknown, path?: string): Event {
    const reader = JsonReader.fromValue(value, path);
    return WireContract.create(reader, () => new Event(
      QualifiedName.parse(reader.readString(Resources.nameField), Resources.nameField),
      reader.readValue(Resources.payloadField)));
  }

  protected override toJsonFields(): JsonObject {
    return { [Resources.nameField]: this.name.text, [Resources.payloadField]: this.payload };
  }
}
