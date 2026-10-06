/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DestroyRef, Injectable, inject } from "@angular/core";

import { CodeTokenKind } from "../enums/code-token-kind";
import type { CodeToken } from "../models/code-token";
import { Resources } from "../../resources";

@Injectable({ providedIn: "root" })
export class CodeHighlights {
  private readonly highlights: Readonly<Record<CodeTokenKind, Highlight>> = {
    [CodeTokenKind.Comment]: new Highlight(),
    [CodeTokenKind.Keyword]: new Highlight(),
    [CodeTokenKind.Control]: new Highlight(),
    [CodeTokenKind.String]: new Highlight(),
    [CodeTokenKind.Number]: new Highlight(),
    [CodeTokenKind.Type]: new Highlight(),
    [CodeTokenKind.Function]: new Highlight(),
    [CodeTokenKind.Variable]: new Highlight(),
    [CodeTokenKind.Regex]: new Highlight(),
    [CodeTokenKind.Meta]: new Highlight()
  };

  public constructor() {
    const kinds = Object.values(CodeTokenKind);
    for (const kind of kinds)
      CSS.highlights.set(CodeHighlights.nameOf(kind), this.highlights[kind]);
    inject(DestroyRef).onDestroy(() => {
      for (const kind of kinds)
        CSS.highlights.delete(CodeHighlights.nameOf(kind));
    });
  }

  public add(text: Text, tokens: readonly CodeToken[]): () => void {
    const removals = tokens.map(t => {
      const highlight = this.highlights[t.kind];
      const range = new StaticRange({ startContainer: text, startOffset: t.start, endContainer: text, endOffset: t.end });
      highlight.add(range);
      return (): boolean => highlight.delete(range);
    });
    return () => {
      for (const remove of removals)
        remove();
    };
  }

  public static nameOf(kind: CodeTokenKind): string {
    return `${Resources.codeHighlightPrefix}${kind.toLowerCase()}`;
  }
}
