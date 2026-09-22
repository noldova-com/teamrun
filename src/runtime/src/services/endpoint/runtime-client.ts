/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Socket, connect } from "node:net";

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { ServiceResponseInfo } from "@noldova/teamrun-foundation-services";
import { ErrorCode, Event, Hello, ProtocolVersion, Request, Response, WireDecoder, type WireMessage } from "@noldova/teamrun-protocol";

import { ConnectionException } from "../../exceptions/connection.exception.js";
import type { IRuntimeClientListener } from "../../interfaces/i-runtime-client-listener.js";
import type { Endpoint } from "../../models/endpoint.js";
import { LineBuffer } from "../../models/line-buffer.js";
import { PendingCall } from "../../models/pending-call.js";
import type { RuntimeTimings } from "../../models/runtime-timings.js";
import { Resources } from "../../resources.js";

export class RuntimeClient {
  private readonly socket: Socket;
  private readonly clientName: string;
  private readonly listener: IRuntimeClientListener;
  private readonly timings: RuntimeTimings;
  private readonly decoder: WireDecoder = new WireDecoder();
  private readonly lines: LineBuffer = new LineBuffer();
  private readonly pending: Map<string, PendingCall> = new Map();
  private readonly welcome: PromiseWithResolvers<ProtocolVersion> = Promise.withResolvers<ProtocolVersion>();
  private runtimeVersion: ProtocolVersion | null = null;
  private nextId: number = 1;
  private closed: boolean = false;

  private constructor(socket: Socket, clientName: string, listener: IRuntimeClientListener, timings: RuntimeTimings) {
    this.socket = socket;
    this.clientName = clientName;
    this.listener = listener;
    this.timings = timings;
    socket.setEncoding(Resources.utf8Encoding);
    socket.on(Resources.dataEvent, (chunk: string) => this.receive(chunk));
    socket.on(Resources.errorEvent, () => this.socket.destroy());
    socket.on(Resources.closeEvent, () => this.handleClosed());
  }

  public static async connect(
    endpoint: Endpoint,
    token: string,
    clientName: string,
    listener: IRuntimeClientListener,
    timings: RuntimeTimings): Promise<RuntimeClient> {
    ArgumentException.throwIfNullOrWhitespace(clientName, Resources.clientNameParameterName);

    const socket = await RuntimeClient.open(endpoint);
    const client = new RuntimeClient(socket, clientName, listener, timings);
    await client.sayHello(token);

    return client;
  }

  public get isConnected(): boolean {
    return !this.closed;
  }

  public get version(): ProtocolVersion | null {
    return this.runtimeVersion;
  }

  public call(method: string, payload: JsonValue): Promise<Response> {
    if (this.closed)
      return Promise.reject(new ConnectionException(Resources.clientClosed, null));

    const id = `${this.clientName}${Resources.requestIdSeparator}${this.nextId++}`;
    const resolvers = Promise.withResolvers<Response>();
    const timer = setTimeout(() => {
      this.pending.delete(id);
      resolvers.reject(new ConnectionException(Resources.formatCallTimedOut(method), null));
    }, this.timings.callTimeout);
    this.pending.set(id, new PendingCall(method, resolvers, timer));
    this.write(new Request(id, method, payload));

    return resolvers.promise;
  }

  public close(): void {
    this.socket.destroy();
  }

  private static open(endpoint: Endpoint): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const socket = Object.isNull(endpoint.port) ? connect(String(endpoint.path)) : connect(endpoint.port, Resources.loopbackHost);
      socket.once(Resources.errorEvent, (error: Error) => reject(new ConnectionException(error.message, null)));
      socket.once(Resources.connectEvent, () => resolve(socket));
    });
  }

  private async sayHello(token: string): Promise<void> {
    const timer = setTimeout(() => this.welcome.reject(new ConnectionException(Resources.helloTimedOut, null)), this.timings.helloTimeout);
    this.write(new Hello(ProtocolVersion.current, token, this.clientName));
    try {
      await this.welcome.promise;
    }
    catch (error) {
      this.socket.destroy();
      throw error;
    }
    finally {
      clearTimeout(timer);
    }
  }

  private write(message: WireMessage): void {
    this.socket.write(`${message.toText()}${Resources.lineSeparator}`);
  }

  private receive(chunk: string): void {
    for (const line of this.lines.append(chunk))
      this.receiveLine(line);
  }

  private receiveLine(line: string): void {
    let message: WireMessage;
    try {
      message = this.decoder.decodeText(line);
    }
    catch {
      return;
    }
    if (message instanceof Response)
      this.handleResponse(message);
    else if (message instanceof Event && !Object.isNull(this.runtimeVersion))
      this.listener.onEvent(message);
  }

  private handleResponse(response: Response): void {
    if (Object.isNull(response.id)) {
      this.handleWelcome(response);
      return;
    }

    const pending = this.pending.get(response.id);
    if (Object.isUndefined(pending))
      return;

    this.pending.delete(response.id);
    pending.complete(response);
  }

  private handleWelcome(response: Response): void {
    if (!Object.isNull(this.runtimeVersion))
      return;
    if (!Object.isNull(response.info)) {
      this.welcome.reject(new ConnectionException(response.info.message, response.info));
      return;
    }

    let version: ProtocolVersion;
    try {
      version = ProtocolVersion.fromJson(response.payload);
    }
    catch {
      const info = new ServiceResponseInfo(ErrorCode.InvalidParams, Resources.invalidWelcomeVersion);
      this.welcome.reject(new ConnectionException(info.message, info));
      return;
    }

    const current = ProtocolVersion.current;
    if (!version.canServe(current)) {
      const text = Resources.formatVersionMismatch(current.toString(), version.toString());
      const info = new ServiceResponseInfo(ErrorCode.VersionMismatch, text, [current.toString(), version.toString()]);
      this.welcome.reject(new ConnectionException(info.message, info));
      return;
    }

    this.runtimeVersion = version;
    this.welcome.resolve(version);
  }

  private handleClosed(): void {
    this.closed = true;
    this.welcome.reject(new ConnectionException(Resources.helloRefused, null));
    for (const pending of this.pending.values())
      pending.fail(new ConnectionException(Resources.clientClosed, null));
    this.pending.clear();
    this.listener.onDisconnected();
  }
}
