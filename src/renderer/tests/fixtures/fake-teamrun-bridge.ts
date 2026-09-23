/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { ServiceResponseInfo } from "@noldova/teamrun-foundation-services";
import { ErrorCode, Event, Message, MessagePage, MessagePageParams, MessageIdParams, MethodName, Request, Response,
  ReplySummary, ReplyPage, ReplyPanel, MessageAuthor, DetailKind, AppUpdateState, AppUpdateStatus } from "@noldova/teamrun-protocol";

import type { ITeamRunBridge } from "../../src/app/interfaces/i-teamrun-bridge";

export class FakeTeamRunBridge implements ITeamRunBridge {
  public readonly checkpointListeners: Set<(value: unknown) => void> = new Set();
  public readonly checkpoints: unknown[] = [];

  public onCheckpoint(listener: (value: unknown) => void): () => void {
    this.checkpointListeners.add(listener);
    return () => this.checkpointListeners.delete(listener);
  }

  public checkpoint(result: unknown): Promise<boolean> {
    this.checkpoints.push(result);
    return Promise.resolve(true);
  }
  public readonly requests: Request[] = [];
  public readonly openedUrls: string[] = [];
  public readonly titleBars: { color: string; symbolColor: string }[] = [];
  public readonly handlers: Map<string, (payload: JsonValue) => JsonValue | Promise<JsonValue>> = new Map();
  public pickedDirectory: string | null = null;
  public info: unknown = { dataDirectory: "D:\\data", productVersion: "0.0.1-test", platform: "win32" };
  public readonly images: Map<string, string> = new Map();
  public readonly imageRequests: string[] = [];
  public mismatchNextResponse: boolean = false;
  private readonly listeners: Set<(event: unknown) => void> = new Set();
  public readonly updateListeners: Set<(state: unknown) => void> = new Set();
  public readonly updateCommands: string[] = [];
  public updateState: AppUpdateState = new AppUpdateState(AppUpdateStatus.Disabled, "0.0.1-test", null, null, "No test feed configured.", null, false);
  public updateHandler: ((command: string) => Promise<unknown>) | null = null;

  public get methods(): readonly string[] {
    return this.requests.map(t => t.method);
  }

  public answer(method: string, handler: (payload: JsonValue) => JsonValue | Promise<JsonValue>): this {
    this.handlers.set(method, handler);
    return this;
  }

  public fail(method: string, code: ErrorCode, message: string): this {
    this.handlers.set(method, () => {
      throw new ServiceResponseInfo(code, message);
    });
    return this;
  }

  private pageFromList(method: string): ((payload: JsonValue) => Promise<JsonValue>) | undefined {
    const list = this.handlers.get(MethodName.MessageList);
    if (method !== MethodName.MessagePage || Object.isUndefined(list))
      return undefined;
    return async payload => new MessagePage((await list(payload) as readonly unknown[]).map(t => Message.fromJson(t)), false, false).toJson();
  }

  private repliesFromList(method: string): ((payload: JsonValue) => Promise<JsonValue>) | undefined {
    const list = this.handlers.get(MethodName.MessageList);
    if (Object.isUndefined(list) || ![MethodName.MessageActivityPage, MethodName.MessageChangesPage, MethodName.MessageSummary, MethodName.MessageDetails].some(t => t === method))
      return undefined;
    return async payload => {
      const messages = (await list(payload) as readonly unknown[]).map(t => Message.fromJson(t));
      if (method === MethodName.MessageSummary || method === MethodName.MessageDetails) {
        const found = messages.find(t => t.id === MessageIdParams.fromJson(payload).messageId);
        return Object.isUndefined(found) ? null : method === MethodName.MessageSummary ? ReplySummary.fromMessage(found).toJson()
          : found.withDetails(found.details.filter(t => t.kind !== DetailKind.Text)).toJson();
      }
      const panel = method === MethodName.MessageActivityPage ? ReplyPanel.Activity : ReplyPanel.Changes;
      const params = MessagePageParams.fromJson(payload);
      const all = messages.filter(t => t.author === MessageAuthor.Provider && t.conversationId === params.conversationId)
        .map(t => ReplySummary.fromMessage(t)).filter(t => t.matches(panel)).sort((a,b) => b.preview.sequence-a.preview.sequence);
      const matches = all.filter(t => (Object.isNull(params.beforeSequence) || t.preview.sequence < params.beforeSequence)
        && (Object.isNull(params.afterSequence) || t.preview.sequence > params.afterSequence));
      const replies = Object.isNull(params.afterSequence) ? matches.slice(0, params.limit) : matches.slice(-params.limit);
      return new ReplyPage(replies, all.some(t => t.preview.sequence < (replies.at(-1)?.preview.sequence ?? -1)),
        all.some(t => t.preview.sequence > (replies[0]?.preview.sequence ?? Number.MAX_SAFE_INTEGER))).toJson();
    };
  }

  public async invoke(request: unknown): Promise<unknown> {
    const parsed = Request.fromJson(request);
    this.requests.push(parsed);
    const id = this.mismatchNextResponse ? `${parsed.id}-other` : parsed.id;
    this.mismatchNextResponse = false;
    const handler = this.handlers.get(parsed.method) ?? this.pageFromList(parsed.method) ?? this.repliesFromList(parsed.method);
    if (Object.isUndefined(handler))
      return Promise.resolve(Response.failure(id, new ServiceResponseInfo(ErrorCode.UnknownMethod, parsed.method)).toJson());

    try {
      return Response.success(id, await handler(parsed.payload)).toJson();
    }
    catch (error) {
      if (error instanceof ServiceResponseInfo)
        return Promise.resolve(Response.failure(id, error).toJson());
      throw error;
    }
  }

  public onEvent(listener: (event: unknown) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public openExternal(url: string): Promise<boolean> {
    this.openedUrls.push(url);
    return Promise.resolve(true);
  }

  public pickDirectory(): Promise<string | null> {
    return Promise.resolve(this.pickedDirectory);
  }

  public describe(): Promise<unknown> {
    return Promise.resolve(this.info);
  }

  public update(command: string): Promise<unknown> {
    this.updateCommands.push(command);
    return Object.isNull(this.updateHandler) ? Promise.resolve(this.updateState.toJson()) : this.updateHandler(command);
  }

  public onUpdate(listener: (state: unknown) => void): () => void {
    this.updateListeners.add(listener);
    return () => this.updateListeners.delete(listener);
  }

  public emitUpdate(state: AppUpdateState): void {
    this.updateState = state;
    for (const listener of this.updateListeners)
      listener(state.toJson());
  }

  public setTitleBar(color: string, symbolColor: string): Promise<boolean> {
    this.titleBars.push({ color, symbolColor });
    return Promise.resolve(true);
  }

  public readImage(path: string): Promise<string | null> {
    this.imageRequests.push(path);
    return Promise.resolve(this.images.get(path) ?? null);
  }

  public emit(event: Event): void {
    for (const listener of this.listeners)
      listener(event.toJson());
  }

  public get listenerCount(): number {
    return this.listeners.size;
  }
}
