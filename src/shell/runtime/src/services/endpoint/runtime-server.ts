/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { rm } from "node:fs/promises";
import { type Server, type Socket, createServer } from "node:net";

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException, type JsonValue } from "@noldova/teamrun-foundation-json";
import {
  type BuildIdentity,
  Cancel,
  type Event,
  Failure,
  FailureCode,
  Handshake,
  ProtocolException,
  Request,
  Response,
  type RuntimeHandover,
  ShellMethods,
  type WireMessage
} from "@noldova/teamrun-shell-protocol";

import { SessionState } from "../../enums/session-state.js";
import { ConnectionException } from "../../exceptions/connection.exception.js";
import { MethodFailureException } from "../../exceptions/method-failure.exception.js";
import type { IEventSink } from "../../interfaces/event-sink.js";
import type { ISessionListener } from "../../interfaces/session-listener.js";
import type { CapabilityToken } from "../../models/capability-token.js";
import { Endpoint } from "../../models/endpoint.js";
import { ProductInfo } from "../../models/product-info.js";
import type { Refusal } from "../../models/refusal.js";
import { RequestContext } from "../../models/request-context.js";
import type { ServerSettings } from "../../models/server-settings.js";
import { Resources } from "../../resources.js";
import type { MethodRegistry } from "../registry/method-registry.js";
import { ClientSession } from "./client-session.js";

export class RuntimeServer implements IEventSink {
  private readonly identity: BuildIdentity;
  private readonly token: CapabilityToken;
  private readonly handover: RuntimeHandover;
  private readonly methods: MethodRegistry;
  private readonly settings: ServerSettings;
  private readonly changed: () => void;
  private readonly listener: ISessionListener;
  private readonly sessions: Set<ClientSession> = new Set();
  private readonly refusals: Map<ClientSession, Refusal> = new Map();
  private server: Server | null = null;
  private socketPath: string | null = null;
  private refusal: Refusal | null = null;

  public constructor(
    identity: BuildIdentity,
    token: CapabilityToken,
    handover: RuntimeHandover,
    methods: MethodRegistry,
    settings: ServerSettings,
    changed: () => void) {
    this.identity = identity;
    this.token = token;
    this.handover = handover;
    this.methods = methods;
    this.settings = settings;
    this.changed = changed;
    this.listener = {
      onMessage: (session, message) => this.handleMessage(session, message),
      onInvalidFrame: (session, error) => this.handleInvalidFrame(session, error),
      onClosed: session => this.handleClosed(session)
    };
  }

  public get sessionCount(): number {
    return this.sessions.size;
  }

  public async listenTcpAsync(): Promise<Endpoint> {
    const server = this.createListener();
    await RuntimeServer.listenAsync(server, () => server.listen(0, Resources.loopbackHost));
    const address = server.address();
    if (Object.isNull(address) || Object.isString(address))
      throw new ConnectionException(Resources.endpointUnavailable);
    return Endpoint.tcp(address.port);
  }

  public async listenSocketAsync(socketPath: string): Promise<Endpoint> {
    const endpoint = Endpoint.socket(socketPath);
    if (Buffer.byteLength(socketPath) > Resources.maximumSocketPathLength)
      throw new ArgumentException(Resources.formatSocketPathTooLong(socketPath), Resources.pathParameterName);

    await rm(socketPath, { force: true });
    const server = this.createListener();
    await RuntimeServer.listenAsync(server, () => server.listen(socketPath));
    this.socketPath = socketPath;
    return endpoint;
  }

  public refuse(refusal: Refusal): void {
    this.refusal = refusal;
  }

  public admit(): void {
    this.refusal = null;
    for (const session of this.refusals.keys())
      session.end();
  }

  public broadcast(event: Event): void {
    for (const session of this.sessions)
      if (session.state === SessionState.Authenticated)
        session.send(event);
  }

  public async closeAsync(): Promise<void> {
    const server = this.server;
    if (Object.isNull(server))
      return;

    this.server = null;
    const closed = new Promise<void>(resolve => server.close(() => resolve()));
    for (const session of this.sessions)
      session.end();
    const deadline = setTimeout(() => {
      for (const session of this.sessions)
        session.close();
    }, Resources.closeGrace);
    await closed;
    clearTimeout(deadline);
    if (!Object.isNull(this.socketPath))
      await rm(this.socketPath, { force: true });
  }

  private static listenAsync(server: Server, listen: () => void): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      server.once(Resources.errorEvent, reject);
      server.once(Resources.listeningEvent, () => {
        server.off(Resources.errorEvent, reject);
        resolve();
      });
      listen();
    });
  }

  private static answer(session: ClientSession, response: Response): void {
    try {
      session.send(response);
    }
    catch (error) {
      if (!(error instanceof ProtocolException))
        throw error;
      session.send(Response.failure(response.id, new Failure(error.code, error.message)));
    }
  }

  private static describeFailure(error: unknown): Failure {
    if (error instanceof MethodFailureException)
      return error.failure;
    if (error instanceof ProtocolException)
      return new Failure(error.code, error.message);
    if (error instanceof JsonException)
      return new Failure(FailureCode.InvalidParams, error.message);
    return new Failure(FailureCode.Internal, Resources.internalFailure);
  }

  private handleMessage(session: ClientSession, message: WireMessage): void {
    if (session.state === SessionState.AwaitingHandshake)
      this.handleHandshake(session, message);
    else if (message instanceof Request)
      this.handleRequest(session, message);
    else if (message instanceof Cancel)
      session.cancelRequest(message.id, FailureCode.Cancelled);
    else
      session.send(Response.failure(null, new Failure(FailureCode.InvalidMessage, Resources.unexpectedMessage)));
  }

  private handleInvalidFrame(session: ClientSession, error: unknown): void {
    const failure = error instanceof ProtocolException ? new Failure(error.code, error.message) : new Failure(FailureCode.InvalidMessage, Resources.invalidFrame);
    session.send(Response.failure(null, failure));
    if (failure.code === FailureCode.FrameTooLarge || session.state === SessionState.AwaitingHandshake)
      session.end();
  }

  private handleClosed(session: ClientSession): void {
    this.sessions.delete(session);
    this.refusals.delete(session);
    this.changed();
  }

  private createListener(): Server {
    const server = createServer(t => this.accept(t));
    this.server = server;
    return server;
  }

  private accept(socket: Socket): void {
    const session = new ClientSession(socket, this.settings.maximumFrameLength, this.listener);
    this.sessions.add(session);
    const timer = setTimeout(() => {
      if (session.state === SessionState.AwaitingHandshake)
        session.close();
    }, this.settings.handshakeTimeout);
    socket.once(Resources.closeEvent, () => clearTimeout(timer));
    this.changed();
  }

  private handleHandshake(session: ClientSession, message: WireMessage): void {
    if (!(message instanceof Handshake)) {
      session.send(Response.failure(null, new Failure(FailureCode.InvalidMessage, Resources.handshakeRequired)));
      session.end();
      return;
    }
    if (!this.token.matches(message.token)) {
      session.send(Response.failure(message.id, new Failure(FailureCode.Unauthorized, Resources.unauthorized)));
      session.end();
      return;
    }
    if (!Object.isNull(this.identity.findMismatch(message.identity))) {
      session.enter(SessionState.OtherBuild, message.client);
      session.send(Response.failure(message.id, new Failure(FailureCode.BuildMismatch, Resources.formatBuildMismatchFailure(ProductInfo.current.name), this.handover.toJson())));
      return;
    }
    if (!Object.isNull(this.refusal)) {
      this.refusals.set(session, this.refusal);
      session.enter(SessionState.Refused, message.client);
      session.send(Response.failure(message.id, this.refusal.failure));
      return;
    }

    session.enter(SessionState.Authenticated, message.client);
    session.send(Response.success(message.id, this.identity.toJson()));
  }

  private handleRequest(session: ClientSession, request: Request): void {
    if (session.state === SessionState.OtherBuild && !request.method.equals(ShellMethods.stop)) {
      session.send(Response.failure(request.id, new Failure(FailureCode.BuildMismatch, Resources.otherBuildMayOnlyStop)));
      return;
    }
    const refusal = this.refusals.get(session);
    if (!Object.isUndefined(refusal) && !request.method.equals(refusal.method) && !request.method.equals(ShellMethods.stop)) {
      session.send(Response.failure(request.id, refusal.failure));
      return;
    }
    const handler = this.methods.find(request.method);
    if (Object.isUndefined(handler)) {
      session.send(Response.failure(request.id, new Failure(FailureCode.UnknownMethod, Resources.formatUnknownMethod(request.method.text))));
      return;
    }
    if (session.hasRequest(request.id)) {
      session.send(Response.failure(request.id, new Failure(FailureCode.InvalidMessage, Resources.formatDuplicateRequest(request.id))));
      return;
    }

    const controller = new AbortController();
    const timeout = Math.min(request.timeoutMilliseconds ?? this.settings.defaultRequestTimeout, this.settings.maximumRequestTimeout);
    const timer = setTimeout(() => controller.abort(FailureCode.DeadlineExceeded), timeout);
    let isSettled = false;
    const settle = (response: Response): void => {
      if (isSettled)
        return;
      isSettled = true;
      clearTimeout(timer);
      session.releaseRequest(request.id);
      RuntimeServer.answer(session, response);
    };
    controller.signal.addEventListener(Resources.abortEvent, () => {
      const code = controller.signal.reason === FailureCode.DeadlineExceeded ? FailureCode.DeadlineExceeded : FailureCode.Cancelled;
      settle(Response.failure(request.id, new Failure(code, code === FailureCode.DeadlineExceeded ? Resources.deadlineExceeded : Resources.cancelled)));
    }, { once: true });
    session.trackRequest(request.id, controller);
    Promise.try(() => handler.handleAsync(new RequestContext(session.client, request.payload, controller.signal))).then(
      (result: JsonValue) => settle(Response.success(request.id, result)),
      (error: unknown) => settle(Response.failure(request.id, RuntimeServer.describeFailure(error))));
  }
}
