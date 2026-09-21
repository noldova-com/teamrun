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
import { ProtocolVersion } from "./protocol-version.js";
import { WireMessage } from "./wire-message.js";

export class Hello extends WireMessage {
  public override readonly kind: WireMessageKind = WireMessageKind.Hello;
  public readonly version: ProtocolVersion;
  public readonly token: string;
  public readonly client: string;

  public constructor(version: ProtocolVersion, token: string, client: string) {
    super();
    ArgumentException.throwIfNullOrWhitespace(token, Resources.tokenField);
    ArgumentException.throwIfNullOrWhitespace(client, Resources.clientField);

    this.version = version;
    this.token = token;
    this.client = client;
  }

  public static fromJson(value: unknown, path?: string): Hello {
    const reader = JsonReader.fromValue(value, path);
    const version = reader.readObject(Resources.versionField);
    return new Hello(
      ProtocolVersion.fromJson(version.toJson(), version.path),
      reader.readNonBlankString(Resources.tokenField),
      reader.readNonBlankString(Resources.clientField));
  }

  protected override toJsonFields(): JsonObject {
    return { [Resources.versionField]: this.version.toJson(), [Resources.tokenField]: this.token, [Resources.clientField]: this.client };
  }
}
