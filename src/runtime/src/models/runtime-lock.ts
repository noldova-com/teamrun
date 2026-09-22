/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";
import { ProtocolVersion } from "@noldova/teamrun-protocol";

import { Resources } from "../resources.js";
import { Endpoint } from "./endpoint.js";

export class RuntimeLock {
  public readonly processId: number;
  public readonly endpoint: Endpoint;
  public readonly token: string;
  public readonly protocolVersion: ProtocolVersion;
  public readonly productVersion: string;
  public readonly startedAt: string;

  public constructor(processId: number, endpoint: Endpoint, token: string, protocolVersion: ProtocolVersion, productVersion: string, startedAt: string) {
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(processId, Resources.processIdParameterName);
    ArgumentException.throwIfNullOrWhitespace(token, Resources.tokenParameterName);
    ArgumentException.throwIfNullOrWhitespace(productVersion, Resources.productVersionParameterName);
    ArgumentException.throwIfNullOrWhitespace(startedAt, Resources.startedAtField);

    this.processId = processId;
    this.endpoint = endpoint;
    this.token = token;
    this.protocolVersion = protocolVersion;
    this.productVersion = productVersion;
    this.startedAt = startedAt;
  }

  public static fromJson(value: unknown, path?: string): RuntimeLock {
    const reader = JsonReader.fromValue(value, path);
    const endpoint = reader.readObject(Resources.endpointField);
    const version = reader.readObject(Resources.protocolVersionField);

    return new RuntimeLock(
      reader.readInteger(Resources.processIdField),
      Endpoint.fromJson(endpoint.toJson(), endpoint.path),
      reader.readNonBlankString(Resources.tokenField),
      ProtocolVersion.fromJson(version.toJson(), version.path),
      reader.readNonBlankString(Resources.productVersionField),
      reader.readNonBlankString(Resources.startedAtField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.processIdField]: this.processId,
      [Resources.endpointField]: this.endpoint.toJson(),
      [Resources.tokenField]: this.token,
      [Resources.protocolVersionField]: this.protocolVersion.toJson(),
      [Resources.productVersionField]: this.productVersion,
      [Resources.startedAtField]: this.startedAt
    };
  }
}
