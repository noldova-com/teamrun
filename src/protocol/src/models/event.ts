/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject, type JsonValue } from "@noldova/teamrun-foundation-json";

import { WireMessageKind } from "../enums/wire-message-kind.js";
import { Resources } from "../resources.js";
import { WireMessage } from "./wire-message.js";

export class Event extends WireMessage {
  public override readonly kind: WireMessageKind = WireMessageKind.Event;
  public readonly name: string;
  public readonly payload: JsonValue;

  public constructor(name: string, payload: JsonValue) {
    super();
    ArgumentException.throwIfNullOrWhitespace(name, Resources.nameField);

    this.name = name;
    this.payload = payload;
  }

  public static fromJson(value: unknown, path?: string): Event {
    const reader = JsonReader.fromValue(value, path);
    return new Event(reader.readNonBlankString(Resources.nameField), reader.readValue(Resources.payloadField));
  }

  protected override toJsonFields(): JsonObject {
    return { [Resources.nameField]: this.name, [Resources.payloadField]: this.payload };
  }
}
