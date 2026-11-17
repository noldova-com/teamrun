/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IRuntimePartContext, WorkItem } from "@noldova/desktop.runtime";
import "@noldova/context.core";
import type { ConversationEngine, IEventListener } from "@noldova/teamrun.core";

import { Resources } from "../resources.js";

export class ReplyWork implements IEventListener, Disposable {
  private readonly context: IRuntimePartContext;
  private readonly engine: Pick<ConversationEngine, "activeRunCount" | "waitForIdle">;
  private item: WorkItem | null = null;

  public constructor(context: IRuntimePartContext, engine: Pick<ConversationEngine, "activeRunCount" | "waitForIdle">) {
    this.context = context;
    this.engine = engine;
  }

  public onEvent(): void {
    if (this.engine.activeRunCount === 0)
      this[Symbol.dispose]();
    else if (Object.isNull(this.item)) {
      const item = this.context.beginWork(Resources.replyWork);
      this.item = item;
      void this.endWhenIdle(item);
    }
  }

  public [Symbol.dispose](): void {
    const item = this.item;
    this.item = null;
    item?.[Symbol.dispose]();
  }

  private async endWhenIdle(item: WorkItem): Promise<void> {
    while (this.item === item && this.engine.activeRunCount > 0)
      await this.engine.waitForIdle().catch(() => undefined);
    if (this.item === item)
      this[Symbol.dispose]();
  }
}
