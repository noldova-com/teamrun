/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Draft } from "@noldova/teamrun.protocol";

import type { ComposerDraft } from "../models/composer-draft";

export interface IComposerDrafts {
  restore(conversationId: string): Promise<Draft | null>;
  onStale(watcher: (conversationId: string) => void): () => void;
  schedule(draft: ComposerDraft): void;
  flush(): Promise<boolean>;
  save(): Promise<void>;
  drop(conversationId: string): void;
  arrivalsOf(conversationId: string): number;
  discard(conversationId: string, arrivals?: number): Promise<void>;
}
