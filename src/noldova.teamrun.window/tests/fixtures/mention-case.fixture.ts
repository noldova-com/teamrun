/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { MessageAuthor, MessageSender, Provenance } from "@noldova/teamrun.protocol";

export class MentionCase {
  public readonly shown: string;
  public readonly author: MessageAuthor;
  public readonly provenance: Provenance | null;
  public readonly sender: MessageSender | null;
  public readonly marked: readonly string[];

  public constructor(shown: string, author: MessageAuthor, provenance: Provenance | null, sender: MessageSender | null, marked: readonly string[]) {
    this.shown = shown;
    this.author = author;
    this.provenance = provenance;
    this.sender = sender;
    this.marked = marked;
  }
}
