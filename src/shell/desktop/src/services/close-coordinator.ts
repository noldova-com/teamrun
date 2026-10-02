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

export class CloseCoordinator {
  private readonly send: (requestId: string) => boolean;
  private readonly timeout: number;
  private readonly pending: Map<string, (canClose: boolean) => void> = new Map();

  public constructor(send: (requestId: string) => boolean, timeout: number) {
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(timeout, Resources.timeoutParameter);

    this.send = send;
    this.timeout = timeout;
  }

  public requestAsync(): Promise<boolean> {
    const requestId = randomUUID();
    return new Promise<boolean>(resolve => {
      const timer = setTimeout(() => finish(true), this.timeout);
      const finish = (canClose: boolean): void => {
        clearTimeout(timer);
        this.pending.delete(requestId);
        resolve(canClose);
      };
      this.pending.set(requestId, finish);
      if (!this.send(requestId))
        finish(true);
    });
  }

  public answer(requestId: unknown, isSaved: unknown): boolean {
    const finish = Object.isString(requestId) ? this.pending.get(requestId) : undefined;
    if (Object.isUndefined(finish) || !Object.isBoolean(isSaved))
      return false;
    finish(isSaved);
    return true;
  }

  public release(): void {
    for (const finish of [...this.pending.values()])
      finish(true);
  }
}
