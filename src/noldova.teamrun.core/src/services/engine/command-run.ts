/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { BackgroundTaskStatus } from "@noldova/teamrun.protocol";

import type { IRunningCommand } from "../../interfaces/i-running-command.js";
import type { CommandExit } from "../../models/command-exit.js";
import type { ReplyWork } from "../../models/reply-work.js";
import { Resources } from "../../resources.js";

export class CommandRun {
  private readonly ending: PromiseWithResolvers<CommandExit> = Promise.withResolvers();
  private running: IRunningCommand | null = null;
  private taskId: string = String.empty;
  private tail: string = String.empty;
  private exit: CommandExit | null = null;
  private stopped: boolean = false;

  public readonly key: string;
  public readonly turn: ReplyWork;
  public readonly description: string;

  public constructor(key: string, turn: ReplyWork, description: string) {
    this.key = key;
    this.turn = turn;
    this.description = description;
  }

  public get id(): string {
    return this.taskId;
  }

  public get chatId(): string {
    return this.turn.message.conversationId;
  }

  public get isRunning(): boolean {
    return Object.isNull(this.exit);
  }

  public get wasStopped(): boolean {
    return this.stopped;
  }

  public get ended(): Promise<CommandExit> {
    return this.ending.promise;
  }

  public get endedWith(): CommandExit | null {
    return this.exit;
  }

  public get status(): BackgroundTaskStatus {
    if (this.stopped)
      return BackgroundTaskStatus.Stopped;
    return this.exit?.code === 0 ? BackgroundTaskStatus.Completed : BackgroundTaskStatus.Failed;
  }

  public get exitCode(): number | null {
    return this.exit?.code ?? null;
  }

  public wakeTextOf(exit: CommandExit): string {
    const lines = this.tail.split(Resources.commandLinePattern);
    const written = lines.slice(0, lines.findLastIndex(t => !String.isNullOrWhitespace(t)) + 1);
    return Resources.formatCommandWake(this.description, this.taskId, exit, written.slice(-Resources.commandWakeLines).join(Resources.lineSeparator));
  }

  public begin(taskId: string, running: IRunningCommand): void {
    this.taskId = taskId;
    this.running = running;
    void running.exited.then(exit => {
      this.exit = exit;
      this.ending.resolve(exit);
    });
    if (this.stopped)
      void running.stopAsync();
  }

  public write(text: string): void {
    this.tail = `${this.tail}${text}`.slice(-Resources.commandTailLength);
  }

  public async stopAsync(): Promise<void> {
    if (!this.isRunning || this.stopped)
      return;
    this.stopped = true;
    if (!Object.isNull(this.running))
      await this.running.stopAsync();
  }
}
