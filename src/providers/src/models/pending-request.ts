/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import type { JsonValue } from "@noldova/teamrun-foundation-json";

export class PendingRequest {
  public readonly method: string;
  private readonly resolvers: PromiseWithResolvers<JsonValue>;
  private readonly timer: NodeJS.Timeout | null;

  public constructor(method: string, resolvers: PromiseWithResolvers<JsonValue>, timer: NodeJS.Timeout | null) {
    this.method = method;
    this.resolvers = resolvers;
    this.timer = timer;
  }

  public complete(value: JsonValue): void {
    if (!Object.isNull(this.timer))
      clearTimeout(this.timer);
    this.resolvers.resolve(value);
  }

  public fail(error: Error): void {
    if (!Object.isNull(this.timer))
      clearTimeout(this.timer);
    this.resolvers.reject(error);
  }
}
