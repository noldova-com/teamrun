/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { IWindowPartContext } from "@noldova/desktop.window";
import { EventName } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";

export class EngineResync {
  private static readonly listeners: WeakMap<IWindowPartContext, Set<() => void>> = new WeakMap();

  public static on(context: IWindowPartContext, listener: () => void): () => void {
    const listeners = EngineResync.listeners.get(context) ?? new Set<() => void>();
    const entry = (): void => listener();
    EngineResync.listeners.set(context, listeners);
    listeners.add(entry);
    const unsubscribe = context.onEvent(Resources.formatQualifiedName(EventName.StateResyncRequested), entry);
    return () => {
      listeners.delete(entry);
      unsubscribe();
    };
  }

  public static request(context: IWindowPartContext): void {
    for (const listener of [...EngineResync.listeners.get(context) ?? []])
      listener();
  }
}
