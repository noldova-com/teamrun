/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { EndpointKind } from "../enums/endpoint-kind.js";
import { Resources } from "../resources.js";

export class Endpoint {
  private static readonly KINDS: readonly EndpointKind[] = Object.values(EndpointKind);

  public readonly kind: EndpointKind;
  public readonly port: number | null;
  public readonly path: string | null;

  public constructor(kind: EndpointKind, port: number | null, path: string | null) {
    if (kind === EndpointKind.Tcp && (Object.isNull(port) || !Object.isNull(path)))
      throw new ArgumentException(Resources.tcpEndpointNeedsPort, Resources.portParameterName);
    if (kind === EndpointKind.Socket && (Object.isNull(path) || !Object.isNull(port)))
      throw new ArgumentException(Resources.socketEndpointNeedsPath, Resources.pathParameterName);
    if (!Object.isNull(port))
      ArgumentOutOfRangeException.throwIfNotPositiveInteger(port, Resources.portParameterName);
    if (!Object.isNull(path))
      ArgumentException.throwIfNullOrWhitespace(path, Resources.pathParameterName);

    this.kind = kind;
    this.port = port;
    this.path = path;
  }

  public static tcp(port: number): Endpoint {
    return new Endpoint(EndpointKind.Tcp, port, null);
  }

  public static socket(path: string): Endpoint {
    return new Endpoint(EndpointKind.Socket, null, path);
  }

  public static fromJson(value: unknown, path?: string): Endpoint {
    const reader = JsonReader.fromValue(value, path);
    const kind = reader.readOneOf(Resources.kindField, Endpoint.KINDS);
    const port = reader.hasField(Resources.portField) ? reader.readNullableInteger(Resources.portField) : null;
    const socketPath = reader.hasField(Resources.pathField) ? reader.readNullableString(Resources.pathField) : null;

    return new Endpoint(kind, port, socketPath);
  }

  public describe(): string {
    return Object.isNull(this.port) ? String(this.path) : Resources.formatTcpEndpoint(Resources.loopbackHost, this.port);
  }

  public toJson(): JsonObject {
    return { [Resources.kindField]: this.kind, [Resources.portField]: this.port, [Resources.pathField]: this.path };
  }
}
