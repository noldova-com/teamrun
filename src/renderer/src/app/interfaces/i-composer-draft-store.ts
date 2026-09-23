/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ComposerDraft } from "../models/composer-draft";

export interface IComposerDraftStore {
  read(conversationId: string): Promise<ComposerDraft | null>;
  write(draft: ComposerDraft): Promise<void>;
  removeSent(draft: ComposerDraft): Promise<void>;
  close(): void;
}
