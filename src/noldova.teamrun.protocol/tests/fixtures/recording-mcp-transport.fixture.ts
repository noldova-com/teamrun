/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";
import type { IMcpTransport } from "@noldova/teamrun.protocol";

export class RecordingMcpTransport implements IMcpTransport {
  private readonly waiters: { condition: () => boolean; resolve: () => void }[] = [];

  public readonly sent: JsonObject[] = [];
  public started: boolean = false;
  public closed: boolean = false;
  public failsSends: boolean = false;
  public sendAttempts: number = 0;
  public onmessage?: ((message: unknown) => void) | undefined;
  public onclose?: (() => void) | undefined;

  public start(): Promise<void> {
    this.started = true;
    return Promise.resolve();
  }

  public send(message: JsonObject): Promise<void> {
    this.sendAttempts++;
    if (!this.failsSends)
      this.sent.push(message);
    this.wake();
    return this.failsSends ? Promise.reject(new Error("The pipe is closed.")) : Promise.resolve();
  }

  public close(): Promise<void> {
    this.closed = true;
    this.onclose?.();
    return Promise.resolve();
  }

  public deliver(message: unknown): void {
    this.onmessage?.(message);
  }

  public async next(count: number = this.sent.length + 1): Promise<JsonObject> {
    await this.until(() => this.sent.length >= count);
    return this.sent[count - 1]!;
  }

  public async answerTo(id: string | number): Promise<JsonObject> {
    await this.until(() => this.sent.some(t => t["id"] === id));
    return this.sent.find(t => t["id"] === id)!;
  }

  public until(condition: () => boolean): Promise<void> {
    if (condition())
      return Promise.resolve();
    return new Promise(resolve => this.waiters.push({ condition, resolve }));
  }

  private wake(): void {
    for (const waiter of [...this.waiters])
      if (waiter.condition()) {
        this.waiters.splice(this.waiters.indexOf(waiter), 1);
        waiter.resolve();
      }
  }
}
