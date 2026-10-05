/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Socket, connect } from "node:net";

import "@noldova/teamrun-foundation-core";
import { ArgumentException, ArgumentOutOfRangeException, ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import {
  BuildIdentity,
  Cancel,
  Event,
  Failure,
  FailureCode,
  FrameReader,
  FrameWriter,
  Handshake,
  PreShellData,
  ProtocolException,
  type QualifiedName,
  Request,
  Response,
  RuntimeHandover,
  ShellMethods,
  type StopPolicy,
  StopRequest,
  type WireMessage,
  WireDecoder
} from "@noldova/teamrun-shell-protocol";

import { ConnectionException } from "../../exceptions/connection.exception.js";
import type { IRuntimeClientListener } from "../../interfaces/runtime-client-listener.js";
import { ClientSettings } from "../../models/client-settings.js";
import type { Endpoint } from "../../models/endpoint.js";
import { PendingCall } from "../../models/pending-call.js";
import { Resources } from "../../resources.js";

export class RuntimeClient {
  private readonly socket: Socket;
  private readonly identity: BuildIdentity;
  private readonly listener: IRuntimeClientListener;
  private readonly settings: ClientSettings;
  private readonly reader: FrameReader;
  private readonly writer: FrameWriter;
  private readonly decoder: WireDecoder = new WireDecoder();
  private readonly pending: Map<string, PendingCall> = new Map();
  private readonly handshake: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private readonly handshakeId: string;
  private otherBuild: RuntimeHandover | null = null;
  private preShell: PreShellData | null = null;
  private failure: Failure | null = null;
  private isEstablished: boolean = false;
  private isClosed: boolean = false;
  private nextId: number = 1;

  public readonly clientName: string;

  private constructor(socket: Socket, identity: BuildIdentity, clientName: string, listener: IRuntimeClientListener, settings: ClientSettings) {
    this.socket = socket;
    this.identity = identity;
    this.clientName = clientName;
    this.listener = listener;
    this.settings = settings;
    this.reader = new FrameReader(settings.maximumFrameLength);
    this.writer = new FrameWriter(settings.maximumFrameLength);
    this.handshakeId = `${clientName}${Resources.requestIdSeparator}0`;
    socket.setEncoding(Resources.utf8Encoding);
    socket.on(Resources.dataEvent, (chunk: string) => this.receive(chunk));
    socket.on(Resources.errorEvent, () => socket.destroy());
    socket.on(Resources.closeEvent, () => this.handleClosed());
  }

  public get handover(): RuntimeHandover | null {
    return this.otherBuild;
  }

  public get preShellData(): PreShellData | null {
    return this.preShell;
  }

  public get isConnected(): boolean {
    return !this.isClosed;
  }

  public static async connectAsync(
    endpoint: Endpoint,
    token: string,
    identity: BuildIdentity,
    clientName: string,
    listener: IRuntimeClientListener,
    settings: ClientSettings = new ClientSettings()): Promise<RuntimeClient> {
    ArgumentException.throwIfNullOrWhitespace(clientName, Resources.clientNameParameterName);

    const socket = await RuntimeClient.openAsync(endpoint);
    const client = new RuntimeClient(socket, identity, clientName, listener, settings);
    await client.shakeHandsAsync(token);
    return client;
  }

  public callAsync(method: QualifiedName, payload: JsonValue, timeoutMilliseconds: number = this.settings.callTimeout, signal?: AbortSignal): Promise<Response> {
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(timeoutMilliseconds, Resources.timeoutMillisecondsParameterName);
    if (this.isClosed)
      return Promise.reject(new ConnectionException(Resources.clientClosed));

    const id = `${this.clientName}${Resources.requestIdSeparator}${this.nextId++}`;
    if (signal?.aborted === true)
      return Promise.resolve(Response.failure(id, new Failure(FailureCode.Cancelled, Resources.cancelled)));
    let frame: string;
    try {
      frame = this.writer.write(new Request(id, method, payload, timeoutMilliseconds));
    }
    catch (error) {
      if (!(error instanceof ProtocolException))
        throw error;
      return Promise.resolve(Response.failure(id, new Failure(error.code, error.message)));
    }

    const resolvers = Promise.withResolvers<Response>();
    const cancel = (): void => this.send(new Cancel(id));
    signal?.addEventListener(Resources.abortEvent, cancel, { once: true });
    const timer = setTimeout(() => {
      this.pending.get(id)?.fail(new ConnectionException(Resources.formatNoAnswer(method.text)));
    }, timeoutMilliseconds + this.settings.answerGrace);
    this.pending.set(id, new PendingCall(resolvers, timer, () => {
      this.pending.delete(id);
      signal?.removeEventListener(Resources.abortEvent, cancel);
    }));
    this.socket.write(frame);
    return resolvers.promise;
  }

  public stopAsync(policy: StopPolicy): Promise<Response> {
    return this.callAsync(ShellMethods.stop, new StopRequest(policy).toJson());
  }

  public moveAsideAsync(): Promise<Response> {
    return this.callAsync(ShellMethods.moveAside, null);
  }

  public close(): void {
    this.socket.destroy();
  }

  private static openAsync(endpoint: Endpoint): Promise<Socket> {
    return new Promise<Socket>((resolve, reject) => {
      const socket = Object.isNull(endpoint.port) ? connect(String(endpoint.path)) : connect(endpoint.port, Resources.loopbackHost);
      socket.once(Resources.errorEvent, (error: Error) => reject(new ConnectionException(Resources.formatUnreachable(endpoint.toString()), null, new ExceptionOptions(error))));
      socket.once(Resources.connectEvent, () => resolve(socket));
    });
  }

  private async shakeHandsAsync(token: string): Promise<void> {
    const timer = setTimeout(() => this.handshake.reject(new ConnectionException(Resources.handshakeTimedOut)), this.settings.handshakeTimeout);
    this.send(new Handshake(this.handshakeId, this.identity, token, this.clientName));
    try {
      await this.handshake.promise;
      this.isEstablished = true;
    }
    catch (error) {
      this.socket.destroy();
      throw error;
    }
    finally {
      clearTimeout(timer);
    }
  }

  private send(message: WireMessage): void {
    if (!this.isClosed)
      this.socket.write(this.writer.write(message));
  }

  private receive(chunk: string): void {
    try {
      for (const frame of this.reader.read(chunk))
        this.dispatch(this.decoder.decode(frame));
    }
    catch (error) {
      this.failure = error instanceof ProtocolException ? new Failure(error.code, error.message) : new Failure(FailureCode.InvalidMessage, Resources.invalidFrame);
      this.socket.destroy();
    }
  }

  private dispatch(message: WireMessage): void {
    if (message instanceof Response)
      this.handleResponse(message);
    else if (message instanceof Event && this.isEstablished)
      this.listener.onEvent(message);
  }

  private handleResponse(response: Response): void {
    if (response.id === this.handshakeId) {
      this.handleHandshake(response);
      return;
    }
    if (Object.isNull(response.id)) {
      this.handshake.reject(new ConnectionException(response.failure?.message ?? Resources.handshakeRefused, response.failure ?? null));
      this.socket.destroy();
      return;
    }
    this.pending.get(response.id)?.complete(response);
  }

  private handleHandshake(response: Response): void {
    const failure = response.failure;
    if (Object.isUndefined(failure)) {
      const runtime = BuildIdentity.fromJson(response.payload);
      if (Object.isNull(this.identity.findMismatch(runtime)))
        this.handshake.resolve();
      else
        this.handshake.reject(new ConnectionException(Resources.handshakeIdentityMismatch));
      return;
    }
    if (failure.code === FailureCode.BuildMismatch && !Object.isUndefined(failure.details)) {
      this.otherBuild = RuntimeHandover.fromJson(failure.details);
      this.handshake.resolve();
      return;
    }
    if (failure.code === FailureCode.PreShellData && !Object.isUndefined(failure.details)) {
      this.preShell = PreShellData.fromJson(failure.details);
      this.handshake.resolve();
      return;
    }
    this.handshake.reject(new ConnectionException(failure.message, failure));
  }

  private handleClosed(): void {
    this.isClosed = true;
    this.handshake.reject(new ConnectionException(Resources.handshakeRefused));
    for (const call of [...this.pending.values()])
      call.fail(new ConnectionException(Resources.clientClosed));
    if (this.isEstablished)
      this.listener.onDisconnected(this.failure);
  }
}
