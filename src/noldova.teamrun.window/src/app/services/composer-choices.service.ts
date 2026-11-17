/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DestroyRef, Injectable, type Signal, type WritableSignal, inject, signal } from "@angular/core";

import "@noldova/context.core";

import { Resources } from "../../resources";
import { ComposerChoices } from "../models/composer-choices";
import type { ComposerSettings } from "../models/composer-settings";

@Injectable({ providedIn: "root" })
export class ComposerChoicesService {
  private readonly current: WritableSignal<ComposerChoices> = signal(this.read());

  public readonly choices: Signal<ComposerChoices> = this.current.asReadonly();

  public constructor() {
    ComposerChoicesService.moveLegacy();
    const listener = (event: StorageEvent): void => {
      if (event.key === Resources.composerChoicesStorageKey)
        this.current.set(this.read());
    };
    globalThis.addEventListener("storage", listener);
    inject(DestroyRef).onDestroy(() => globalThis.removeEventListener("storage", listener));
  }

  public choiceOf(conversationId: string): ComposerSettings | null {
    return this.current().conversations.get(conversationId) ?? null;
  }

  public remember(conversationId: string, settings: ComposerSettings): void {
    this.update(t => t.remember(conversationId, settings));
  }

  private update(change: (choices: ComposerChoices) => ComposerChoices): void {
    const next = change(this.current());
    this.current.set(next);
    try {
      globalThis.localStorage.setItem(Resources.composerChoicesStorageKey, JSON.stringify({ ...ComposerChoicesService.readStored(), ...next.toJson() }));
    }
    catch {
      return;
    }
  }

  public static readStored(): Record<string, unknown> {
    let value: unknown;
    try {
      value = JSON.parse(globalThis.localStorage.getItem(Resources.composerChoicesStorageKey) ?? "{}");
    }
    catch {
      return {};
    }
    return Object.isObject(value) && !Array.isArray(value) ? { ...value } : {};
  }

  private static moveLegacy(): void {
    const stored = ComposerChoicesService.readStored();
    if (!(Resources.legacyChatChoicesField in stored))
      return;
    const kept = Object.fromEntries(Object.entries(stored).filter(([name]) => name !== Resources.legacyChatChoicesField));
    try {
      globalThis.localStorage.setItem(Resources.composerChoicesStorageKey, JSON.stringify({ ...kept, ...ComposerChoices.fromJson(stored).toJson() }));
    }
    catch {
      return;
    }
  }

  private read(): ComposerChoices {
    return ComposerChoices.fromJson(ComposerChoicesService.readStored());
  }
}
