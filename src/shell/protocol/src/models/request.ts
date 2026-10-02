/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject, type JsonValue } from "@noldova/teamrun-foundation-json";

import { WireMessageKind } from "../enums/wire-message-kind.js";
import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";
import { QualifiedName } from "./qualified-name.js";
import { WireMessage } from "./wire-message.js";

export class Request extends WireMessage {
  public override readonly kind: WireMessageKind = WireMessageKind.Request;
  public readonly id: string;
  public readonly method: QualifiedName;
  public readonly payload: JsonValue;
  public readonly timeoutMilliseconds?: number;

  public constructor(id: string, method: QualifiedName, payload: JsonValue, timeoutMilliseconds?: number) {
    super();
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);
    if (!Object.isUndefined(timeoutMilliseconds) && (!Number.isInteger(timeoutMilliseconds) || timeoutMilliseconds <= 0))
      throw new ArgumentOutOfRangeException(Resources.timeoutField, timeoutMilliseconds, Resources.timeoutInvalid);

    this.id = id;
    this.method = method;
    this.payload = payload;
    if (!Object.isUndefined(timeoutMilliseconds))
      this.timeoutMilliseconds = timeoutMilliseconds;
  }

  public static fromJson(value: unknown, path?: string): Request {
    const reader = JsonReader.fromValue(value, path);
    return WireContract.create(reader, () => new Request(
      reader.readString(Resources.idField),
      QualifiedName.parse(reader.readString(Resources.methodField), Resources.methodField),
      reader.readValue(Resources.payloadField),
      reader.hasField(Resources.timeoutField) ? reader.readInteger(Resources.timeoutField) : undefined));
  }

  protected override toJsonFields(): JsonObject {
    const fields = { [Resources.idField]: this.id, [Resources.methodField]: this.method.text, [Resources.payloadField]: this.payload };
    return Object.isUndefined(this.timeoutMilliseconds) ? fields : { ...fields, [Resources.timeoutField]: this.timeoutMilliseconds };
  }
}
