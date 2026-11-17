/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";

export class PendingRequest {
  public readonly method: string;
  private readonly resolvers: PromiseWithResolvers<JsonValue>;
  private readonly timer: NodeJS.Timeout | null;

  public constructor(method: string, resolvers: PromiseWithResolvers<JsonValue>, timer: NodeJS.Timeout | null) {
    this.method = method;
    this.resolvers = resolvers;
    this.timer = timer;
  }

  public stopTimer(): void {
    if (!Object.isNull(this.timer))
      clearTimeout(this.timer);
  }

  public complete(value: JsonValue): void {
    this.stopTimer();
    this.resolvers.resolve(value);
  }

  public fail(error: Error): void {
    this.stopTimer();
    this.resolvers.reject(error);
  }
}
