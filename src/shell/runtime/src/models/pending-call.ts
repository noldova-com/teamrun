/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Response } from "@noldova/teamrun-shell-protocol";

export class PendingCall {
  private readonly resolvers: PromiseWithResolvers<Response>;
  private readonly timer: NodeJS.Timeout;
  private readonly cleanup: () => void;

  public constructor(resolvers: PromiseWithResolvers<Response>, timer: NodeJS.Timeout, cleanup: () => void) {
    this.resolvers = resolvers;
    this.timer = timer;
    this.cleanup = cleanup;
  }

  public complete(response: Response): void {
    clearTimeout(this.timer);
    this.cleanup();
    this.resolvers.resolve(response);
  }

  public fail(error: Error): void {
    clearTimeout(this.timer);
    this.cleanup();
    this.resolvers.reject(error);
  }
}
