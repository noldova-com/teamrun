/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";

export class PendingRequest {
  public readonly method: string;
  private readonly resolvers: PromiseWithResolvers<JsonValue>;
  private readonly elapsed: AbortController;

  public constructor(method: string, resolvers: PromiseWithResolvers<JsonValue>, elapsed: AbortController) {
    this.method = method;
    this.resolvers = resolvers;
    this.elapsed = elapsed;
  }

  public stopTimer(): void {
    this.elapsed.abort();
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
