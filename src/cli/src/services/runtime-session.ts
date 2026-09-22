/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import type { RuntimeClient } from "@noldova/teamrun-runtime";

import { CommandFailedException } from "../exceptions/command-failed.exception.js";
import type { IConnectionFactory } from "../interfaces/i-connection-factory.js";
import type { IEventHandler } from "../interfaces/i-event-handler.js";
import type { EventSubscription } from "../models/event-subscription.js";
import { SessionListener } from "./session-listener.js";

export class RuntimeSession implements Disposable {
  private readonly client: RuntimeClient;
  private readonly listener: SessionListener;

  private constructor(client: RuntimeClient, listener: SessionListener) {
    this.client = client;
    this.listener = listener;
  }

  public static async open(connections: IConnectionFactory): Promise<RuntimeSession> {
    const listener = new SessionListener();
    return new RuntimeSession(await connections.connect(listener), listener);
  }

  public get isConnected(): boolean {
    return !this.listener.isDisconnected;
  }

  public async call(method: string, payload: JsonValue): Promise<JsonValue> {
    const response = await this.client.call(method, payload);
    if (!Object.isNull(response.info))
      throw new CommandFailedException(response.info);

    return response.payload;
  }

  public subscribe(handler: IEventHandler): EventSubscription {
    return this.listener.subscribe(handler);
  }

  public [Symbol.dispose](): void {
    this.client.close();
  }
}
