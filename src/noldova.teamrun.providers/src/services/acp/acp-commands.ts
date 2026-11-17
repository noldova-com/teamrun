/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonReader } from "@noldova/context.json";
import type { ITimer } from "@noldova/teamrun.core";

import { Resources } from "../../resources.js";

export class AcpCommands {
  private readonly listed: Map<string, readonly string[]> = new Map();
  private readonly waiting: Map<string, PromiseWithResolvers<void>> = new Map();

  public static nameOf(command: string): string {
    const name = command.slice(Resources.acpCommandPrefix.length);
    const end = name.search(Resources.acpCommandNameEndPattern);
    return end < 0 ? name : name.slice(0, end);
  }

  public static shownOf(command: string): string {
    return Resources.acpCommandPrefix + AcpCommands.nameOf(command);
  }

  public adopt(earlier: AcpCommands): void {
    for (const [sessionId, names] of earlier.listed)
      this.listed.set(sessionId, names);
  }

  public note(method: string, params: JsonReader): void {
    if (method !== Resources.acpSessionUpdate || !params.hasField(Resources.acpUpdateField))
      return;
    const update = params.readObject(Resources.acpUpdateField);
    if (update.readOptionalString(Resources.acpSessionUpdateField) !== Resources.acpAvailableCommandsUpdate)
      return;
    const sessionId = params.readNonBlankString(Resources.sessionIdField);
    this.listed.set(sessionId, update.readObjectArray(Resources.acpAvailableCommandsField)
      .map(t => t.readNonBlankString(Resources.nameField).replace(Resources.acpCommandPrefixPattern, String.empty)));
    this.waiting.get(sessionId)?.resolve();
    this.waiting.delete(sessionId);
  }

  public async listOf(sessionId: string, timer: ITimer, wait: number, signal: AbortSignal): Promise<readonly string[] | null> {
    if (!this.listed.has(sessionId)) {
      const waiter = this.waiting.get(sessionId) ?? Promise.withResolvers<void>();
      this.waiting.set(sessionId, waiter);
      const waited = new AbortController();
      try {
        await Promise.race([waiter.promise, timer.delayAsync(wait, AbortSignal.any([signal, waited.signal])).catch(() => undefined)]);
      }
      finally {
        waited.abort();
        if (this.waiting.get(sessionId) === waiter)
          this.waiting.delete(sessionId);
      }
    }
    return this.listed.get(sessionId) ?? null;
  }
}
