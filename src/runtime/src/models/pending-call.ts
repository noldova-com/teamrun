/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Response } from "@noldova/teamrun-protocol";

export class PendingCall {
  public readonly method: string;
  private readonly resolvers: PromiseWithResolvers<Response>;
  private readonly timer: NodeJS.Timeout;

  public constructor(method: string, resolvers: PromiseWithResolvers<Response>, timer: NodeJS.Timeout) {
    this.method = method;
    this.resolvers = resolvers;
    this.timer = timer;
  }

  public complete(response: Response): void {
    clearTimeout(this.timer);
    this.resolvers.resolve(response);
  }

  public fail(error: Error): void {
    clearTimeout(this.timer);
    this.resolvers.reject(error);
  }
}
