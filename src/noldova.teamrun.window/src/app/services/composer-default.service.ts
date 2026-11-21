/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type FactoryProvider, type Signal, type WritableSignal, inject, signal } from "@angular/core";

import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import { ComposerDefaultSaveParams, EventName, MethodName } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";
import { ComposerSettings } from "../models/composer-settings";
import { ComposerChoicesService } from "./composer-choices.service";

export class ComposerDefaultService {
  public static readonly provider: FactoryProvider =
    { provide: ComposerDefaultService, useFactory: (): ComposerDefaultService => ComposerDefaultService.of(inject(WindowPartTokens.context)) };

  private static readonly stores: WeakMap<IWindowPartContext, ComposerDefaultService> = new WeakMap();

  private readonly context: IWindowPartContext;
  private readonly stored: ComposerSettings | null = ComposerDefaultService.readStored();
  private readonly current: WritableSignal<ComposerSettings | null> = signal(this.stored);
  private readonly subscriptions: readonly (() => void)[];
  private held: ComposerSettings | null = null;
  private isOpen: boolean = false;
  private latest: ComposerSettings | null = null;
  private edits: number = 0;
  private received: number = 0;
  private saving: number = 0;
  private isBehind: boolean = false;
  private saved: Promise<void> = Promise.resolve();

  public readonly defaultChoice: Signal<ComposerSettings | null> = this.current.asReadonly();

  public constructor(context: IWindowPartContext) {
    this.context = context;
    this.subscriptions = [
      context.onEvent(Resources.formatQualifiedName(EventName.ComposerDefaultUpdated), t => {
        this.received++;
        this.latest = ComposerSettings.fromJson(t);
        if (this.saving === 0)
          this.current.set(this.held ?? this.latest);
        else
          this.isBehind = true;
      }),
      context.onEvent(Resources.formatQualifiedName(EventName.StateResyncRequested), () => void this.load())
    ];
    void this.open();
  }

  public static of(context: IWindowPartContext): ComposerDefaultService {
    const found = ComposerDefaultService.stores.get(context);
    if (!Object.isUndefined(found))
      return found;
    const store = new ComposerDefaultService(context);
    ComposerDefaultService.stores.set(context, store);
    return store;
  }

  public static release(context: IWindowPartContext): void {
    ComposerDefaultService.stores.get(context)?.dispose();
    ComposerDefaultService.stores.delete(context);
  }

  public remember(settings: ComposerSettings): void {
    const choice = settings.withResponder(null);
    this.edits++;
    this.current.set(choice);
    if (this.isOpen)
      void this.save(choice.toJson());
    else
      this.held = choice;
  }

  private async open(): Promise<void> {
    let base = this.stored;
    const kept = await this.request(MethodName.ComposerDefaultRead, null).catch(() => undefined);
    if (this.received > 0) {
      base = this.latest;
      ComposerDefaultService.removeStored();
    }
    else if (!Object.isNull(kept) && !Object.isUndefined(kept)) {
      base = ComposerSettings.fromJson(kept);
      ComposerDefaultService.removeStored();
    }
    else if (Object.isNull(kept) && !Object.isNull(this.stored)) {
      const moved = await this.save(this.stored.toJson(), true);
      if (!Object.isUndefined(moved)) {
        base = ComposerSettings.fromJson(moved);
        ComposerDefaultService.removeStored();
      }
    }
    this.isOpen = true;
    const held = this.held;
    this.held = null;
    this.current.set(held ?? base);
    if (!Object.isNull(held))
      void this.save(held.toJson());
  }

  private async load(): Promise<void> {
    const [edits, received] = [this.edits, this.received];
    try {
      const kept = await this.request(MethodName.ComposerDefaultRead, null);
      if (!Object.isNull(kept) && edits === this.edits && received === this.received && this.saving === 0)
        this.current.set(ComposerSettings.fromJson(kept));
    }
    catch {
      return;
    }
  }

  private save(choice: JsonObject, onlyIfNone: boolean = false): Promise<JsonValue | undefined> {
    this.saving++;
    const done = this.saved.then(() => this.request(MethodName.ComposerDefaultSave, new ComposerDefaultSaveParams(choice, onlyIfNone).toJson()))
      .catch(() => undefined)
      .finally(() => this.settle());
    this.saved = done.then(() => undefined);
    return done;
  }

  private settle(): void {
    this.saving--;
    if (this.saving > 0 || !this.isBehind)
      return;
    this.isBehind = false;
    this.current.set(this.held ?? this.latest);
  }

  private request(method: MethodName, parameters: JsonValue): Promise<JsonValue> {
    return this.context.requestAsync(Resources.formatQualifiedName(method), parameters);
  }

  private dispose(): void {
    for (const unsubscribe of this.subscriptions)
      unsubscribe();
  }

  private static readStored(): ComposerSettings | null {
    const stored = ComposerChoicesService.readStored();
    if (!(Resources.defaultChoiceField in stored))
      return null;
    const choice = ComposerSettings.fromJson(stored[Resources.defaultChoiceField]);
    if (Object.isNull(choice))
      ComposerDefaultService.removeStored();
    return choice;
  }

  private static removeStored(): void {
    const stored = ComposerChoicesService.readStored();
    if (!(Resources.defaultChoiceField in stored))
      return;
    try {
      globalThis.localStorage.setItem(Resources.composerChoicesStorageKey,
        JSON.stringify(Object.fromEntries(Object.entries(stored).filter(([name]) => name !== Resources.defaultChoiceField))));
    }
    catch {
      return;
    }
  }
}
