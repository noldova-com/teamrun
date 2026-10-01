/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException, JsonReader, type JsonObject, type JsonValue } from "@noldova/teamrun-foundation-json";

import { WireMessageKind } from "../enums/wire-message-kind.js";
import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";
import { Failure } from "./failure.js";
import { WireMessage } from "./wire-message.js";

export class Response extends WireMessage {
  private readonly outcome: JsonObject;

  public override readonly kind: WireMessageKind = WireMessageKind.Response;
  public readonly id: string | null;
  public readonly payload?: JsonValue;
  public readonly failure?: Failure;

  private constructor(id: string | null, payload: JsonValue, failure?: Failure) {
    super();
    if (!Object.isNull(id))
      ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);

    this.id = id;
    if (Object.isUndefined(failure)) {
      this.payload = payload;
      this.outcome = { [Resources.payloadField]: payload };
    }
    else {
      this.failure = failure;
      this.outcome = { [Resources.failureField]: failure.toJson() };
    }
  }

  public get hasFailed(): boolean {
    return !Object.isUndefined(this.failure);
  }

  public static success(id: string, payload: JsonValue): Response {
    return new Response(id, payload);
  }

  public static failure(id: string | null, failure: Failure): Response {
    return new Response(id, null, failure);
  }

  public static fromJson(value: unknown, path?: string): Response {
    const reader = JsonReader.fromValue(value, path);
    const hasPayload = reader.hasField(Resources.payloadField);
    const hasFailure = reader.hasField(Resources.failureField);
    if (hasPayload === hasFailure)
      throw new JsonException(hasPayload ? Resources.responseOutcomeAmbiguous : Resources.responseOutcomeMissing, reader.path);

    const id = reader.readNullableString(Resources.idField);
    if (hasPayload)
      return WireContract.create(reader, () => new Response(id, reader.readValue(Resources.payloadField)));

    const failure = reader.readObject(Resources.failureField);
    return WireContract.create(reader, () => new Response(id, null, Failure.fromJson(failure.toJson(), failure.path)));
  }

  protected override toJsonFields(): JsonObject {
    return { [Resources.idField]: this.id, ...this.outcome };
  }
}
