/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable } from "@angular/core";
import "@noldova/context.core";
import { Draft } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";
import type { IComposerDrafts } from "../interfaces/i-composer-drafts";
import type { ComposerDraft } from "../models/composer-draft";

@Injectable()
export class KeptComposerDraftService implements IComposerDrafts {
  public restore(key: string): Promise<Draft | null> {
    const text = KeptComposerDraftService.read().get(key);
    return Promise.resolve(Object.isUndefined(text) ? null : new Draft(key, text, [], [], 1, new Date().toISOString()));
  }

  public onStale(): () => void {
    return () => undefined;
  }

  public schedule(draft: ComposerDraft): void {
    KeptComposerDraftService.write(new Map(KeptComposerDraftService.read()).set(draft.conversationId, draft.text));
  }

  public flush(): Promise<boolean> {
    return Promise.resolve(true);
  }

  public save(): Promise<void> {
    return Promise.resolve();
  }

  public drop(key: string): void {
    const drafts = new Map(KeptComposerDraftService.read());
    if (drafts.delete(key))
      KeptComposerDraftService.write(drafts);
  }

  public arrivalsOf(): number {
    return 0;
  }

  public discard(key: string): Promise<void> {
    this.drop(key);
    return Promise.resolve();
  }

  private static read(): ReadonlyMap<string, string> {
    let value: unknown;
    try {
      value = JSON.parse(globalThis.localStorage.getItem(Resources.keptComposerDraftsStorageKey) ?? "{}");
    }
    catch {
      return new Map();
    }
    const drafts = new Map<string, string>();
    if (Object.isPlainObject(value))
      for (const [key, text] of Object.entries(value))
        if (Object.isString(text))
          drafts.set(key, text);
    return drafts;
  }

  private static write(drafts: ReadonlyMap<string, string>): void {
    try {
      globalThis.localStorage.setItem(Resources.keptComposerDraftsStorageKey, JSON.stringify(Object.fromEntries(drafts)));
    }
    catch {
      return;
    }
  }
}
