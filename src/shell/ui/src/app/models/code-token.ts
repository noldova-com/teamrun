/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import type { CodeTokenKind } from "../enums/code-token-kind";
import { Resources } from "../../resources";

export class CodeToken {
  public readonly text: string;
  public readonly kind: CodeTokenKind | null;
  public readonly className: string | null;

  public constructor(text: string, kind: CodeTokenKind | null) {
    this.text = text;
    this.kind = kind;
    this.className = Object.isNull(kind) ? null : `${Resources.codeTokenClass} ${Resources.codeTokenClass}-${kind.toLowerCase()}`;
  }
}
