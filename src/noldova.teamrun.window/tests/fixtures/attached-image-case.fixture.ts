/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { MessageAuthor, Provenance } from "@noldova/teamrun.protocol";
import type { ThemeMode } from "@noldova/ui.components.angular";

export class AttachedImageCase {
  public readonly shown: string;
  public readonly author: MessageAuthor;
  public readonly provenance: Provenance | null;
  public readonly column: string;
  public readonly caption: string | null;
  public readonly mode: ThemeMode;

  public constructor(shown: string, author: MessageAuthor, provenance: Provenance | null, column: string, caption: string | null, mode: ThemeMode) {
    this.shown = shown;
    this.author = author;
    this.provenance = provenance;
    this.column = column;
    this.caption = caption;
    this.mode = mode;
  }
}
