/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import { EndpointKind } from "../enums/endpoint-kind.js";
import { Resources } from "../resources.js";

export class Endpoint {
  public readonly kind: EndpointKind;
  public readonly port: number | null;
  public readonly path: string | null;

  private constructor(kind: EndpointKind, port: number | null, socketPath: string | null) {
    this.kind = kind;
    this.port = port;
    this.path = socketPath;
  }

  public static tcp(port: number): Endpoint {
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(port, Resources.portParameterName);
    if (port > Resources.maximumPort)
      throw new ArgumentOutOfRangeException(Resources.portParameterName, port, Resources.portOutOfRange);

    return new Endpoint(EndpointKind.Tcp, port, null);
  }

  public static socket(socketPath: string): Endpoint {
    if (!path.isAbsolute(socketPath))
      throw new ArgumentException(Resources.socketPathNotAbsolute, Resources.pathParameterName);

    return new Endpoint(EndpointKind.Socket, null, socketPath);
  }

  public static parse(text: string): Endpoint {
    if (!text.startsWith(Resources.tcpEndpointPrefix))
      return Endpoint.socket(text);

    const port = text.slice(Resources.tcpEndpointPrefix.length);
    if (!Resources.portPattern.test(port))
      throw new ArgumentException(Resources.formatEndpointInvalid(text), Resources.textParameterName);
    return Endpoint.tcp(Number(port));
  }

  public toString(): string {
    return Object.isNull(this.port) ? String(this.path) : `${Resources.tcpEndpointPrefix}${this.port}`;
  }
}
