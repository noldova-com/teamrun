/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type JsonObject, JsonReader, type JsonValue } from "@noldova/context.json";
import { type ITurnListener, TaskEnd, TaskStart } from "@noldova/teamrun.core";
import { BackgroundTaskStatus } from "@noldova/teamrun.protocol";

import { InvalidOperationException } from "../../exceptions/invalid-operation.exception.js";
import type { IExitHandler } from "../../interfaces/i-exit-handler.js";
import type { INotificationHandler } from "../../interfaces/i-notification-handler.js";
import { Resources } from "../../resources.js";
import { CommandOutputDecoder } from "../command-output-decoder.js";
import { ShellCommandReader } from "../shell-command.reader.js";
import type { AppServerClient } from "./app-server-client.js";

export class CodexTasks implements INotificationHandler, IExitHandler {
  private readonly client: AppServerClient;
  private readonly threadId: string;
  private readonly listener: ITurnListener;
  private readonly requestTimeout: number;
  private readonly pending: Map<string, { command: string; processId: JsonValue; output: string }> = new Map();
  private readonly running: Map<string, () => Promise<void>> = new Map();
  private readonly stopping: Set<string> = new Set();
  private readonly endedWhileListing: Map<string, JsonReader> = new Map();
  private readonly idle: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private accepting: boolean = true;
  private closed: boolean = false;
  private interrupted: boolean = false;
  private listing: boolean = false;
  private listed: Promise<void> = Promise.resolve();
  private listAgain: boolean = false;

  public constructor(client: AppServerClient, threadId: string, listener: ITurnListener, requestTimeout: number) {
    this.client = client;
    this.threadId = threadId;
    this.listener = listener;
    this.requestTimeout = requestTimeout;
  }

  public get isIdle(): boolean {
    return this.closed || (!this.accepting && this.pending.size === 0 && this.running.size === 0);
  }

  public whenIdle(): Promise<void> {
    return this.idle.promise;
  }

  public async handleNotificationAsync(method: string, params: JsonReader): Promise<void> {
    if (this.closed || !params.hasField(Resources.threadIdField) || params.readValue(Resources.threadIdField) !== this.threadId)
      return;

    switch (method) {
      case Resources.itemStartedNotification:
        this.handleStarted(params.readObject(Resources.itemField));
        break;
      case Resources.commandOutputDeltaNotification:
        this.handleOutput(params.readNonBlankString(Resources.itemIdField), CommandOutputDecoder.decode(params.readString(Resources.deltaField)));
        break;
      case Resources.terminalInteractionNotification:
        await this.promoteAsync(params.readNonBlankString(Resources.itemIdField), params.readValue(Resources.processIdField));
        break;
      case Resources.tokenUsageUpdatedNotification:
        if (!this.interrupted)
          await this.promotePendingAsync();
        break;
      case Resources.itemCompletedNotification:
        await this.handleCompletedAsync(params.readObject(Resources.itemField));
        break;
      default:
        break;
    }
  }

  public async handleExitAsync(): Promise<void> {
    for (const taskId of [...this.running.keys()])
      if (this.running.delete(taskId))
        await this.listener.onTaskEndedAsync(new TaskEnd(taskId, BackgroundTaskStatus.Ended));
    this.running.clear();
    this.pending.clear();
    this.closed = true;
    this.idle.resolve();
  }

  public async stopAll(): Promise<void> {
    while (this.listing)
      await this.listed;
    await Promise.all([...this.running.values()].map(stop => stop().catch(() => undefined)));
  }

  public interrupt(): void {
    this.interrupted = true;
  }

  public finishTurn(): void {
    this.accepting = false;
    if (this.pending.size > 0)
      this.list();
    else
      this.settleIfIdle();
  }

  private handleStarted(item: JsonReader): void {
    const id = item.readNonBlankString(Resources.idField);
    if (this.accepting && item.readNonBlankString(Resources.typeField) === Resources.commandExecutionItemType
      && item.readString(Resources.statusField) === Resources.inProgressItemStatus) {
      const command = item.readString(Resources.commandField);
      const processId = item.hasField(Resources.processIdField) ? item.readValue(Resources.processIdField) : null;
      this.pending.set(id, { command: ShellCommandReader.innerCommand(command) ?? command, processId, output: String.empty });
      return;
    }
    if (this.pending.size > 0)
      this.list();
  }

  private handleOutput(itemId: string, text: string): void {
    if (this.running.has(itemId)) {
      this.listener.onTaskOutput(itemId, text);
      return;
    }
    const waiting = this.pending.get(itemId);
    if (!Object.isUndefined(waiting))
      waiting.output = `${waiting.output}${text}`.slice(-Resources.maximumTaskOutputBytes);
  }

  private async handleCompletedAsync(item: JsonReader): Promise<void> {
    const id = item.readNonBlankString(Resources.idField);
    if (this.listing && this.pending.has(id)) {
      this.endedWhileListing.set(id, item);
      return;
    }
    this.pending.delete(id);
    if (!this.running.has(id)) {
      this.settleIfIdle();
      return;
    }
    const exitCode = item.readNullableInteger(Resources.exitCodeField);
    const succeeded = item.readString(Resources.statusField) === Resources.completedItemStatus && (Object.isNull(exitCode) || exitCode === 0);
    const status = this.stopping.has(id) ? BackgroundTaskStatus.Stopped : succeeded ? BackgroundTaskStatus.Completed : BackgroundTaskStatus.Failed;
    await this.endAsync(id, status, exitCode);
  }

  private list(): void {
    if (this.listing) {
      this.listAgain = true;
      return;
    }
    this.listing = true;
    this.listed = this.readTerminals().catch(() => undefined).finally(() => {
      this.listing = false;
      for (const id of this.endedWhileListing.keys())
        this.pending.delete(id);
      this.endedWhileListing.clear();
      if (this.listAgain && !this.closed) {
        this.listAgain = false;
        this.list();
        return;
      }
      if (!this.accepting)
        this.pending.clear();
      this.settleIfIdle();
    });
  }

  private async readTerminals(): Promise<void> {
    let cursor: string | null = null;
    for (let page = 0; page < Resources.maximumTerminalPages; page++) {
      const params: JsonObject = Object.isNull(cursor) ? { threadId: this.threadId } : { threadId: this.threadId, [Resources.cursorField]: cursor };
      const response = JsonReader.fromValue(await this.client.request(Resources.backgroundTerminalsListMethod, params, this.requestTimeout), Resources.resultPath);
      const terminals = response.readObjectArray(Resources.dataField);
      await this.client.runInOrderAsync(async () => {
        for (const terminal of terminals)
          await this.promoteAsync(terminal.readNonBlankString(Resources.itemIdField), terminal.readValue(Resources.processIdField));
      });
      cursor = response.hasField(Resources.nextCursorField) ? response.readNullableString(Resources.nextCursorField) : null;
      if (Object.isNull(cursor))
        return;
    }
  }

  private async promotePendingAsync(): Promise<void> {
    for (const [itemId, waiting] of [...this.pending])
      if (!Object.isNull(waiting.processId) && !this.endedWhileListing.has(itemId))
        await this.promoteAsync(itemId, waiting.processId);
  }

  private async promoteAsync(itemId: string, processId: JsonValue): Promise<void> {
    const waiting = this.pending.get(itemId);
    if (this.closed || Object.isUndefined(waiting))
      return;
    this.pending.delete(itemId);
    const stop = (): Promise<void> => this.terminate(itemId, processId);
    this.running.set(itemId, stop);
    await this.listener.onTaskStartedAsync(new TaskStart(itemId, waiting.command, stop));
    if (waiting.output.length > 0)
      this.listener.onTaskOutput(itemId, waiting.output);
    const ended = this.endedWhileListing.get(itemId);
    if (!Object.isUndefined(ended))
      await this.handleCompletedAsync(ended);
  }

  private async terminate(itemId: string, processId: JsonValue): Promise<void> {
    this.stopping.add(itemId);
    try {
      const response = JsonReader.fromValue(await this.client.request(Resources.backgroundTerminalsTerminateMethod, { threadId: this.threadId, processId },
        this.requestTimeout), Resources.resultPath);
      if (!response.readBoolean(Resources.terminatedField))
        throw new InvalidOperationException(Resources.codexTerminalNotTerminated);
    }
    catch (error) {
      this.stopping.delete(itemId);
      throw error;
    }
    await this.client.runInOrderAsync(() => this.running.has(itemId) ? this.endAsync(itemId, BackgroundTaskStatus.Stopped, null) : Promise.resolve());
  }

  private async endAsync(itemId: string, status: BackgroundTaskStatus, exitCode: number | null): Promise<void> {
    this.running.delete(itemId);
    this.stopping.delete(itemId);
    await this.listener.onTaskEndedAsync(new TaskEnd(itemId, status, exitCode));
    this.settleIfIdle();
  }

  private settleIfIdle(): void {
    if (this.isIdle)
      this.idle.resolve();
  }
}
