/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonReader } from "@noldova/context.json";
import type { ITimer } from "@noldova/teamrun.core";

import { Deadline } from "../deadline.js";
import { AcpActivity } from "./acp-activity.js";
import type { AcpChannel } from "./acp-channel.js";
import type { AcpClient } from "./acp-client.js";
import type { AcpCommands } from "./acp-commands.js";

export class AcpKeptSession {
  public readonly client: AcpClient;
  public readonly environment: NodeJS.ProcessEnv;
  public readonly sessionId: string;
  public readonly key: string;
  public readonly params: string;
  public readonly initialized: JsonReader;
  public readonly started: JsonReader;
  public readonly toolsUnlisted: boolean;
  public readonly sender: string | null;
  public readonly token: string | null;
  public readonly revoke: () => void;
  public readonly commands: AcpCommands;
  private readonly channel: AcpChannel;
  private readonly idle: Deadline;
  private readonly silence: Deadline;
  private readonly close: (kept: AcpKeptSession) => void;
  private ended: boolean = false;
  private retired: boolean = false;

  public constructor(client: AcpClient, environment: NodeJS.ProcessEnv, sessionId: string, key: string, params: string, initialized: JsonReader, started: JsonReader,
    toolsUnlisted: boolean, sender: string | null, token: string | null, revoke: () => void, channel: AcpChannel, commands: AcpCommands, timer: ITimer, idleLimit: number, silenceLimit: number,
    close: (kept: AcpKeptSession) => void, stopWork: (kept: AcpKeptSession) => void) {
    this.client = client;
    this.environment = environment;
    this.sessionId = sessionId;
    this.key = key;
    this.params = params;
    this.initialized = initialized;
    this.started = started;
    this.toolsUnlisted = toolsUnlisted;
    this.sender = sender;
    this.token = token;
    this.revoke = revoke;
    this.channel = channel;
    this.commands = commands;
    this.close = close;
    this.idle = new Deadline(timer, idleLimit, () => close(this));
    this.silence = new Deadline(timer, silenceLimit, () => stopWork(this));
  }

  public get isIdle(): boolean {
    return this.channel.isIdle;
  }

  public get isRetired(): boolean {
    return this.retired;
  }

  public hold(): void {
    if (this.channel.isIdle) {
      this.idle.start();
      return;
    }
    this.client.setListener(new AcpActivity(this.channel, this.silence));
    this.silence.start();
    const idle = (): void => {
      this.silence.stop();
      if (!this.ended)
        this.idle.start();
    };
    void this.channel.whenIdle().then(idle, idle);
  }

  public retire(): void {
    this.retired = true;
    const retire = (): void => {
      if (!this.ended) {
        this.end();
        this.close(this);
      }
    };
    void this.channel.whenIdle().then(retire, retire);
  }

  public stopTasks(): Promise<void> {
    return this.channel.stopTasks();
  }

  public end(): void {
    this.ended = true;
    this.idle.stop();
    this.silence.stop();
  }
}
