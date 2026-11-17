/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonReader } from "@noldova/context.json";
import { type ITurnListener, SharedMcpFailure, SharedMcpFailureKind } from "@noldova/teamrun.core";

import type { INotificationHandler } from "../../interfaces/i-notification-handler.js";
import { Resources } from "../../resources.js";

export class CodexSharedServerStatuses implements INotificationHandler {
  private readonly providerId: string;
  private readonly providerLabel: string;
  private readonly names: ReadonlySet<string>;
  private readonly listener: ITurnListener;
  private readonly held: (readonly [string | null, SharedMcpFailure])[] = [];
  private threadId: string | null = null;

  public constructor(providerId: string, providerLabel: string, names: readonly string[], listener: ITurnListener) {
    this.providerId = providerId;
    this.providerLabel = providerLabel;
    this.names = new Set(names);
    this.listener = listener;
  }

  public async handleNotificationAsync(method: string, params: JsonReader): Promise<void> {
    const json = params.toJson();
    const name = json[Resources.nameField];
    if (method !== Resources.mcpServerStartupStatusNotification || !Object.isString(name) || !this.names.has(name)
      || json[Resources.statusField] !== Resources.mcpServerStartupFailedState)
      return;
    const threadId = json[Resources.threadIdField];
    const kind = json[Resources.failureReasonField] === Resources.mcpServerReauthenticationRequired ? SharedMcpFailureKind.SignIn
      : SharedMcpFailureKind.Connection;
    const failure = new SharedMcpFailure(this.providerId, this.providerLabel, name, kind);
    if (Object.isNull(this.threadId))
      this.held.push([Object.isString(threadId) ? threadId : null, failure]);
    else if (!Object.isString(threadId) || threadId === this.threadId)
      await this.listener.onSharedServerFailedAsync(failure);
  }

  public async followAsync(threadId: string): Promise<void> {
    this.threadId = threadId;
    for (const [thread, failure] of this.held.splice(0))
      if (Object.isNull(thread) || thread === threadId)
        await this.listener.onSharedServerFailedAsync(failure);
  }
}
