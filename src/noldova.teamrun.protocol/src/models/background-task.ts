/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { BackgroundTaskStatus } from "../enums/background-task-status.js";
import { Resources } from "../resources.js";

export class BackgroundTask {
  public readonly id: string;
  public readonly chatId: string;
  public readonly messageId: string;
  public readonly kind: string;
  public readonly command: string;
  public readonly status: BackgroundTaskStatus;
  public readonly exitCode: number | null;
  public readonly startedAt: string;
  public readonly endedAt: string | null;
  public readonly output: string | null;
  public readonly subAgentId: string | null;
  public readonly commandCut: boolean;

  public constructor(
    id: string,
    chatId: string,
    messageId: string,
    kind: string,
    command: string,
    status: BackgroundTaskStatus,
    exitCode: number | null,
    startedAt: string,
    endedAt: string | null,
    output: string | null,
    subAgentId: string | null = null,
    commandCut: boolean = false) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);
    ArgumentException.throwIfNullOrWhitespace(messageId, Resources.messageIdField);
    ArgumentException.throwIfNullOrWhitespace(kind, Resources.kindField);
    ArgumentException.throwIfNullOrWhitespace(command, Resources.commandField);
    ArgumentException.throwIfNullOrWhitespace(startedAt, Resources.startedAtField);
    if ((status === BackgroundTaskStatus.Running) !== Object.isNull(endedAt))
      throw new ArgumentException(Resources.backgroundTaskEndMismatch, Resources.endedAtField);
    if (status === BackgroundTaskStatus.Running && !Object.isNull(exitCode))
      throw new ArgumentException(Resources.backgroundTaskExitMismatch, Resources.exitCodeField);

    this.id = id;
    this.chatId = chatId;
    this.messageId = messageId;
    this.kind = kind;
    this.command = command;
    this.status = status;
    this.exitCode = exitCode;
    this.startedAt = startedAt;
    this.endedAt = endedAt;
    this.output = output;
    this.subAgentId = String.isNullOrWhitespace(subAgentId) ? null : subAgentId;
    this.commandCut = commandCut;
  }

  public get conversationId(): string {
    return this.chatId;
  }

  public get isRunning(): boolean {
    return this.status === BackgroundTaskStatus.Running;
  }

  public static fromJson(value: unknown, path?: string): BackgroundTask {
    const reader = JsonReader.fromValue(value, path);
    return new BackgroundTask(
      reader.readNonBlankString(Resources.idField),
      reader.readNonBlankString(Resources.chatIdField),
      reader.readNonBlankString(Resources.messageIdField),
      reader.readNonBlankString(Resources.kindField),
      reader.readNonBlankString(Resources.commandField),
      reader.readOneOf(Resources.statusField, Object.values(BackgroundTaskStatus)),
      reader.readNullableInteger(Resources.exitCodeField),
      reader.readNonBlankString(Resources.startedAtField),
      reader.readNullableString(Resources.endedAtField),
      reader.readNullableString(Resources.outputField),
      reader.readNullableString(Resources.subAgentIdField),
      reader.hasField(Resources.commandCutField) && reader.readBoolean(Resources.commandCutField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.chatIdField]: this.chatId,
      [Resources.messageIdField]: this.messageId,
      [Resources.kindField]: this.kind,
      [Resources.commandField]: this.command,
      [Resources.statusField]: this.status,
      [Resources.exitCodeField]: this.exitCode,
      [Resources.startedAtField]: this.startedAt,
      [Resources.endedAtField]: this.endedAt,
      [Resources.outputField]: this.output,
      [Resources.subAgentIdField]: this.subAgentId,
      [Resources.commandCutField]: this.commandCut
    };
  }

  public withOutput(text: string): BackgroundTask {
    if (Object.isNull(this.output))
      return this;
    const output = `${this.output}${text}`;
    return new BackgroundTask(this.id, this.chatId, this.messageId, this.kind, this.command, this.status, this.exitCode, this.startedAt,
      this.endedAt, output.length > Resources.maximumBackgroundTaskOutput ? output.slice(output.length - Resources.maximumBackgroundTaskOutput) : output,
      this.subAgentId, this.commandCut);
  }

  public withoutOutput(): BackgroundTask {
    return Object.isNull(this.output) || this.output.length === 0 ? this : new BackgroundTask(this.id, this.chatId, this.messageId, this.kind, this.command, this.status,
      this.exitCode, this.startedAt, this.endedAt, null, this.subAgentId, this.commandCut);
  }

  public withCommandCut(): BackgroundTask {
    if (this.command.length <= Resources.maximumListedCommand)
      return this;
    const command = this.command.trimStart();
    const cut = command.length > Resources.maximumListedCommand;
    const end = cut && BackgroundTask.isHighSurrogate(command.charCodeAt(Resources.maximumListedCommand - 1)) ? Resources.maximumListedCommand - 1 : Resources.maximumListedCommand;
    return new BackgroundTask(this.id, this.chatId, this.messageId, this.kind, command.slice(0, end), this.status, this.exitCode, this.startedAt, this.endedAt,
      cut ? null : this.output, this.subAgentId, cut);
  }

  private static isHighSurrogate(code: number): boolean {
    return code >= Resources.firstHighSurrogate && code <= Resources.lastHighSurrogate;
  }

  public withEnd(status: BackgroundTaskStatus, exitCode: number | null, endedAt: string): BackgroundTask {
    return new BackgroundTask(this.id, this.chatId, this.messageId, this.kind, this.command, status, exitCode, this.startedAt, endedAt, this.output,
      this.subAgentId, this.commandCut);
  }
}
