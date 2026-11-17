/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { SecretFailureReason, SecretFailures } from "@noldova/desktop.protocol";
import { type IModuleSecrets, type IModuleSettings, MethodFailureException } from "@noldova/desktop.runtime";
import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import {
  type IEventListener,
  type ILog,
  type IOutsideMessages,
  type ITimer,
  type OutsideReply,
  Resources as CoreResources
} from "@noldova/teamrun.core";
import { ErrorCode, McpServer, type McpToolCallParams, type McpToolListParams, MessageSender, OutsideConnection } from "@noldova/teamrun.protocol";
import { ServiceException } from "@noldova/teamrun.services";

import type { IMcpEndpointHost } from "../interfaces/i-mcp-endpoint-host.js";
import { Resources } from "../resources.js";
import type { McpHttpEndpoint } from "./mcp-http-endpoint.js";

export class OutsideSessions implements IMcpEndpointHost {
  private readonly settings: IModuleSettings;
  private readonly secrets: IModuleSecrets;
  private readonly outside: IOutsideMessages;
  private readonly events: { subscribe(listener: IEventListener): Disposable };
  private readonly timer: ITimer;
  private readonly endpointOf: () => McpHttpEndpoint;
  private readonly log: ILog;
  private readonly appWindows: { onChanged(listener: () => void): () => void };
  private unfollowWindows: () => void = () => undefined;
  private waitingForApp: boolean = false;
  private appChanges: number = 0;
  private endpoint: McpHttpEndpoint | null = null;
  private tokenHash: Buffer | null = null;
  private failure: string | null = null;
  private note: string | null = null;
  private waits: AbortController = new AbortController();
  private applying: Promise<void> = Promise.resolve();
  private closed: boolean = false;

  public constructor(settings: IModuleSettings, secrets: IModuleSecrets, outside: IOutsideMessages,
    events: { subscribe(listener: IEventListener): Disposable }, timer: ITimer, endpointOf: () => McpHttpEndpoint, log: ILog,
    appWindows: { onChanged(listener: () => void): () => void }) {
    this.settings = settings;
    this.secrets = secrets;
    this.outside = outside;
    this.events = events;
    this.timer = timer;
    this.endpointOf = endpointOf;
    this.log = log;
    this.appWindows = appWindows;
  }

  private get enabled(): boolean {
    return this.settings.read(Resources.outsideSessionsSetting) === true;
  }

  private get port(): number {
    const value = this.settings.read(Resources.outsidePortSetting);
    return typeof value === "number" && Number.isInteger(value) ? value : Resources.outsideDefaultPort;
  }

  public startAsync(): Promise<void> {
    for (const setting of [Resources.outsideSessionsSetting, Resources.outsidePortSetting])
      this.settings.onChanged(setting, () => this.applyLater());
    this.unfollowWindows = this.appWindows.onChanged(() => this.applyOnceAppChanges());
    this.applyLater();
    return Promise.resolve();
  }

  public async readAsync(): Promise<OutsideConnection> {
    await this.applying;
    const token = await this.secrets.readAsync(Resources.outsideTokenSecret).catch(() => null);
    return new OutsideConnection(this.enabled, Resources.formatMcpEndpointUrl(this.port), token, this.failure, this.note);
  }

  public async resetAsync(): Promise<OutsideConnection> {
    await this.queueAsync(() => this.resetNowAsync());
    return this.readAsync();
  }

  public async closeAsync(): Promise<void> {
    this.closed = true;
    this.unfollowWindows();
    await this.applyAsync();
  }

  public acceptsSessionToken(token: string): boolean {
    const hash = this.tokenHash;
    return this.enabled && !Object.isNull(hash) && timingSafeEqual(OutsideSessions.hashOf(token), hash);
  }

  public acceptsSessionTokenAsync(token: string): Promise<boolean> {
    return Promise.resolve(this.acceptsSessionToken(token));
  }

  public listMcpToolsAsync(params: McpToolListParams): Promise<readonly JsonObject[]> {
    if (!this.acceptsSessionToken(params.token))
      return Promise.reject(new ServiceException(ErrorCode.Unauthorized, Resources.outsideTokenRefused));
    return Promise.resolve(OutsideSessions.tools());
  }

  public async callMcpToolAsync(params: McpToolCallParams, signal: AbortSignal = new AbortController().signal): Promise<JsonObject> {
    if (!this.acceptsSessionToken(params.token))
      return McpServer.toolError(Resources.outsideTokenRefused);
    try {
      switch (params.name) {
        case Resources.outsideListTool:
          return OutsideSessions.result(await this.outside.listOutsideAsync());
        case Resources.outsideChatsTool:
          return OutsideSessions.result(await this.outside.listOutsideChatsAsync());
        case Resources.outsideSendTool:
          return OutsideSessions.result(await this.sendAsync(params.arguments));
        case Resources.outsideReadTool:
          return OutsideSessions.result(await this.readRepliesAsync(params.arguments, signal));
        default:
          return McpServer.toolError(Resources.formatOutsideToolUnknown(params.name));
      }
    }
    catch (error) {
      if (error instanceof ServiceException)
        return McpServer.toolError(error.info.name === ErrorCode.Conflict ? OutsideSessions.busyOf(params.arguments) : error.message);
      throw error;
    }
  }

  private async sendAsync(input: JsonObject): Promise<JsonValue> {
    const chatId = OutsideSessions.idOf(input[Resources.chatIdArgument], Resources.outsideChatRequired);
    const teammateId = OutsideSessions.idOf(input[Resources.teammateIdArgument], Resources.outsideTeammateRequired);
    const text = input[Resources.textArgument];
    const from = input[Resources.fromArgument] ?? null;
    if (Object.isNull(chatId) && Object.isNull(teammateId))
      throw new ServiceException(ErrorCode.InvalidParams, Resources.outsideTeammateRequired);
    if (!Object.isString(text) || String.isNullOrWhitespace(text) || text.length > Resources.outsideTextLimit)
      throw new ServiceException(ErrorCode.InvalidParams, Resources.outsideTextRequired);
    if (!Object.isNull(from) && !Object.isString(from))
      throw new ServiceException(ErrorCode.InvalidParams, Resources.outsideFromNotText);
    const messageId = await this.outside.sendOutsideAsync(teammateId, text, OutsideSessions.labelOf(from), chatId);
    return { [CoreResources.outsideMessageIdField]: messageId };
  }

  private async readRepliesAsync(input: JsonObject, signal: AbortSignal): Promise<JsonValue> {
    const given = input[Resources.messageIdsArgument];
    const seconds = input[Resources.waitSecondsArgument] ?? 0;
    const ids = Array.isArray(given) ? given.filter((t): t is string => Object.isString(t)) : [];
    if (!Array.isArray(given) || ids.length !== given.length || ids.length === 0 || ids.length > Resources.outsideReadLimit)
      throw new ServiceException(ErrorCode.InvalidParams, Resources.outsideIdsRequired);
    if (typeof seconds !== "number" || !Number.isInteger(seconds) || seconds < 0 || seconds > Resources.outsideWaitLimit)
      throw new ServiceException(ErrorCode.InvalidParams, Resources.outsideWaitOutOfRange);
    const readAsync = (): Promise<readonly OutsideReply[]> => Promise.all(ids.map(t => this.outside.readOutsideAsync(t)));
    if (seconds === 0)
      return (await readAsync()).map(t => t.toJson());
    const stop = new AbortController();
    const ended = AbortSignal.any([signal, this.waits.signal, stop.signal]);
    try {
      let woken = OutsideSessions.nextEventAsync(this.events, ended);
      let replies = await readAsync();
      if (replies.every(t => t.hasEnded))
        return replies.map(t => t.toJson());
      void this.timer.delayAsync(seconds * Resources.millisecondsPerSecond, ended).then(() => stop.abort(), () => undefined);
      while (!ended.aborted && !replies.every(t => t.hasEnded)) {
        await woken;
        woken = OutsideSessions.nextEventAsync(this.events, ended);
        replies = await readAsync();
      }
      return replies.map(t => t.toJson());
    }
    finally {
      stop.abort();
    }
  }

  private applyLater(): void {
    void this.applyAsync().catch((error: unknown) => this.log.write(Resources.formatOutsideNotApplied(CoreResources.formatFailureKind(error))));
  }

  private applyOnceAppChanges(): void {
    this.appChanges++;
    if (!this.waitingForApp)
      return;
    this.waitingForApp = false;
    this.applyLater();
  }

  private applyAsync(): Promise<void> {
    return this.queueAsync(() => this.applyNowAsync());
  }

  private async queueAsync(work: () => Promise<void>): Promise<void> {
    const next = this.applying.then(work);
    this.applying = next.catch(() => undefined);
    await next;
  }

  private async resetNowAsync(): Promise<void> {
    const token = randomBytes(Resources.outsideTokenBytes).toString("base64url");
    await this.secrets.saveAsync(Resources.outsideTokenSecret, token);
    this.tokenHash = OutsideSessions.hashOf(token);
    this.endWaits();
    await this.outside.forgetOutsideAsync();
  }

  private async applyNowAsync(): Promise<void> {
    const open = this.endpoint;
    this.endpoint = null;
    this.failure = null;
    this.note = null;
    this.tokenHash = null;
    this.waitingForApp = false;
    this.endWaits();
    await open?.closeAsync();
    if (this.closed || !this.enabled)
      return;
    const changes = this.appChanges;
    let token: string;
    try {
      token = await this.tokenAsync();
    }
    catch (error) {
      const reason = OutsideSessions.reasonOf(error);
      if (reason === SecretFailureReason.NotConnected) {
        this.waitingForApp = true;
        if (this.appChanges !== changes)
          this.applyOnceAppChanges();
        return;
      }
      this.failure = reason === SecretFailureReason.NoDevice ? Resources.outsideTokenNoDevice : Resources.outsideTokenUnkept;
      this.log.write(Resources.formatOutsideNotApplied(CoreResources.formatFailureKind(error)));
      return;
    }
    this.tokenHash = OutsideSessions.hashOf(token);
    const endpoint = this.endpointOf();
    try {
      await endpoint.listenAsync(this.port);
      endpoint.serve(this);
      this.endpoint = endpoint;
    }
    catch (error) {
      this.failure = Resources.formatOutsidePortFailure(this.port, OutsideSessions.codeOf(error));
      this.log.write(Resources.formatOutsideNotListening(this.port, CoreResources.formatFailureKind(error)));
    }
  }

  private async tokenAsync(): Promise<string> {
    let stored: string | null;
    let undecryptable = false;
    try {
      stored = await this.secrets.readAsync(Resources.outsideTokenSecret);
    }
    catch (error) {
      if (OutsideSessions.reasonOf(error) !== SecretFailureReason.Undecryptable)
        throw error;
      stored = null;
      undecryptable = true;
    }
    if (!Object.isNull(stored))
      return stored;
    const token = randomBytes(Resources.outsideTokenBytes).toString("base64url");
    await this.secrets.saveAsync(Resources.outsideTokenSecret, token);
    if (undecryptable)
      this.note = Resources.outsideTokenRemade;
    return token;
  }

  private static reasonOf(error: unknown): SecretFailureReason | null {
    return error instanceof MethodFailureException ? SecretFailures.reasonOf(error.failure) : null;
  }

  private endWaits(): void {
    this.waits.abort();
    this.waits = new AbortController();
  }

  private static nextEventAsync(events: { subscribe(listener: IEventListener): Disposable }, ended: AbortSignal): Promise<void> {
    return new Promise(resolve => {
      if (ended.aborted) {
        resolve();
        return;
      }
      const done = (): void => {
        subscription[Symbol.dispose]();
        ended.removeEventListener(Resources.abortEvent, done);
        resolve();
      };
      const subscription = events.subscribe({ onEvent: done });
      ended.addEventListener(Resources.abortEvent, done);
    });
  }

  private static idOf(value: JsonValue | undefined, error: string): string | null {
    if (Object.isUndefined(value) || Object.isNull(value))
      return null;
    if (!Object.isString(value) || String.isNullOrWhitespace(value))
      throw new ServiceException(ErrorCode.InvalidParams, error);
    return value;
  }

  private static busyOf(input: JsonObject): string {
    return Object.isString(input[Resources.chatIdArgument]) ? Resources.outsideChatBusy : Resources.outsideTeammateBusy;
  }

  private static labelOf(from: string | null): string {
    const cleaned = [...(from ?? String.empty).replace(Resources.outsideLabelUnsafePattern, Resources.outsideLabelSpace)
      .replace(Resources.outsideLabelSpacesPattern, Resources.outsideLabelSpace).trim()].slice(0, Resources.outsideLabelLimit).join(String.empty).trim();
    return MessageSender.allowsOutsideLabel(cleaned) ? cleaned : Resources.outsideDefaultLabel;
  }

  private static codeOf(error: unknown): string | null {
    return error instanceof Error && "code" in error && Object.isString(error.code) ? error.code : null;
  }

  private static hashOf(token: string): Buffer {
    return createHash(Resources.sha256Algorithm).update(token).digest();
  }

  private static result(value: JsonValue): JsonObject {
    return { content: [{ type: Resources.mcpTextType, text: JSON.stringify(value) }] };
  }

  private static tools(): readonly JsonObject[] {
    return [
      {
        name: Resources.outsideListTool,
        description: Resources.outsideListDescription,
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true }
      },
      {
        name: Resources.outsideChatsTool,
        description: Resources.outsideChatsDescription,
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true }
      },
      {
        name: Resources.outsideSendTool,
        description: Resources.outsideSendDescription,
        inputSchema: {
          type: "object",
          properties: {
            [Resources.chatIdArgument]: { type: "string", description: Resources.outsideChatIdDescription },
            [Resources.teammateIdArgument]: { type: "string", description: Resources.outsideTeammateIdDescription },
            [Resources.textArgument]: { type: "string", maxLength: Resources.outsideTextLimit, description: Resources.outsideTextDescription },
            [Resources.fromArgument]: { type: "string", description: Resources.outsideFromDescription }
          },
          required: [Resources.textArgument],
          additionalProperties: false
        }
      },
      {
        name: Resources.outsideReadTool,
        description: Resources.outsideReadDescription,
        inputSchema: {
          type: "object",
          properties: {
            [Resources.messageIdsArgument]: { type: "array", items: { type: "string" }, minItems: 1, maxItems: Resources.outsideReadLimit,
              description: Resources.outsideMessageIdsDescription },
            [Resources.waitSecondsArgument]: { type: "integer", minimum: 0, maximum: Resources.outsideWaitLimit, description: Resources.outsideWaitDescription }
          },
          required: [Resources.messageIdsArgument],
          additionalProperties: false
        },
        annotations: { readOnlyHint: true }
      }
    ];
  }
}
