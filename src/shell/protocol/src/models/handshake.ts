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
import { BuildIdentity } from "./build-identity.js";
import { WireMessage } from "./wire-message.js";

export class Handshake extends WireMessage {
  private static readonly FIELDS: readonly string[] = [Resources.kindField, Resources.idField, Resources.identityField, Resources.tokenField, Resources.clientField];

  public override readonly kind: WireMessageKind = WireMessageKind.Handshake;
  public readonly id: string;
  public readonly identity: BuildIdentity;
  public readonly token: string;
  public readonly client: string;

  public constructor(id: string, identity: BuildIdentity, token: string, client: string) {
    super();
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);
    ArgumentException.throwIfNullOrWhitespace(token, Resources.tokenField);
    ArgumentException.throwIfNullOrWhitespace(client, Resources.clientField);

    this.id = id;
    this.identity = identity;
    this.token = token;
    this.client = client;
  }

  public static fromJson(value: unknown, path?: string): Handshake {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, Handshake.FIELDS);
    const identity = reader.readObject(Resources.identityField);
    return WireContract.create(reader, () => new Handshake(
      reader.readString(Resources.idField),
      BuildIdentity.fromJson(identity.toJson(), identity.path),
      reader.readString(Resources.tokenField),
      reader.readString(Resources.clientField)));
  }

  protected override toJsonFields(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.identityField]: this.identity.toJson(),
      [Resources.tokenField]: this.token,
      [Resources.clientField]: this.client
    };
  }
}
