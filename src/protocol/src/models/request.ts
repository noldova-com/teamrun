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

export class Request extends WireMessage {
  public override readonly kind: WireMessageKind = WireMessageKind.Request;
  public readonly id: string;
  public readonly method: string;
  public readonly payload: JsonValue;

  public constructor(id: string, method: string, payload: JsonValue) {
    super();
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);
    ArgumentException.throwIfNullOrWhitespace(method, Resources.methodField);

    this.id = id;
    this.method = method;
    this.payload = payload;
  }

  public static fromJson(value: unknown, path?: string): Request {
    const reader = JsonReader.fromValue(value, path);
    return new Request(reader.readNonBlankString(Resources.idField), reader.readNonBlankString(Resources.methodField), reader.readValue(Resources.payloadField));
  }

  protected override toJsonFields(): JsonObject {
    return { [Resources.idField]: this.id, [Resources.methodField]: this.method, [Resources.payloadField]: this.payload };
  }
}
