/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";

import "@noldova/teamrun-foundation-core";
import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../resources.js";

export class UpdateSaveCoordinator {
  private readonly send: (requestId: string) => boolean;
  private readonly timeout: number;
  private readonly pending: Map<string, (problems: readonly string[] | null) => void> = new Map();

  public constructor(send: (requestId: string) => boolean, timeout: number) {
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(timeout, Resources.timeoutParameter);

    this.send = send;
    this.timeout = timeout;
  }

  public requestAsync(window: number): Promise<readonly string[]> {
    const requestId = randomUUID();
    return new Promise<readonly string[]>(resolve => {
      const timer = setTimeout(() => finish([Resources.formatWindowSaveUnanswered(window)]), this.timeout);
      const finish = (problems: readonly string[] | null): void => {
        clearTimeout(timer);
        this.pending.delete(requestId);
        resolve(problems ?? [Resources.formatWindowSaveGone(window)]);
      };
      this.pending.set(requestId, finish);
      if (!this.send(requestId))
        finish(null);
    });
  }

  public answer(requestId: unknown, problems: unknown): boolean {
    const finish = Object.isString(requestId) ? this.pending.get(requestId) : undefined;
    const texts: readonly unknown[] = Array.isArray(problems) ? problems : [null];
    if (Object.isUndefined(finish) || !texts.every(t => Object.isString(t)))
      return false;
    finish(texts);
    return true;
  }

  public release(): void {
    for (const finish of [...this.pending.values()])
      finish(null);
  }
}
