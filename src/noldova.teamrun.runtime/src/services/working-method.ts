/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IMethodHandler, IRuntimePartContext, RequestContext } from "@noldova/desktop.runtime";
import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";

export class WorkingMethod implements IMethodHandler {
  private readonly method: IMethodHandler;
  private readonly context: Pick<IRuntimePartContext, "beginWork">;
  private readonly description: string;
  private readonly running: Set<Promise<JsonValue>> = new Set();

  public constructor(method: IMethodHandler, context: Pick<IRuntimePartContext, "beginWork">, description: string) {
    this.method = method;
    this.context = context;
    this.description = description;
  }

  public async handleAsync(request: RequestContext): Promise<JsonValue> {
    const work = this.context.beginWork(this.description);
    const handled = this.method.handleAsync(request);
    this.running.add(handled);
    try {
      return await handled;
    }
    finally {
      this.running.delete(handled);
      work[Symbol.dispose]();
    }
  }

  public async whenIdle(): Promise<void> {
    await Promise.allSettled([...this.running]);
  }
}
