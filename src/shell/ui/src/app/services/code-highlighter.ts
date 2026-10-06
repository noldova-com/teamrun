/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DestroyRef, Injectable, inject } from "@angular/core";
import type { ShikiPrimitive } from "@shikijs/primitive";
import type { ThemeRegistrationRaw } from "@shikijs/primitive/types";

import "@noldova/teamrun-foundation-core";

import { CodeTokenKind } from "../enums/code-token-kind";
import type { CodeLanguage } from "../models/code-language";
import { CodeToken } from "../models/code-token";
import { LoadOnce } from "../models/load-once";
import { Resources } from "../../resources";

@Injectable({ providedIn: "root" })
export class CodeHighlighter {
  private static readonly kindsByMarker: ReadonlyMap<string | undefined, CodeTokenKind> =
    new Map(Object.values(CodeTokenKind).map((t): [string, CodeTokenKind] => [CodeHighlighter.markerOf(t), t]));
  private static readonly theme: ThemeRegistrationRaw = {
    name: Resources.codeThemeName,
    fg: Resources.codePlainMarker,
    bg: Resources.codePlainMarker,
    settings: [
      { settings: { foreground: Resources.codePlainMarker } },
      ...Object.values(CodeTokenKind).map(t => ({ scope: [...Resources.codeTokenScopes[t]], settings: { foreground: CodeHighlighter.markerOf(t) } })),
      { scope: [...Resources.codePlainScopes], settings: { foreground: Resources.codePlainMarker } }
    ]
  };

  private readonly shiki: LoadOnce<readonly [typeof import("@shikijs/primitive"), ShikiPrimitive]> = new LoadOnce();
  private readonly languages: Map<string, LoadOnce<void>> = new Map();
  private isDisposed: boolean = false;

  public constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.isDisposed = true;
      this.shiki.whenLoaded(([, primitive]) => primitive.dispose());
    });
  }

  public async tokensAsync(code: string, language: CodeLanguage, signal: AbortSignal): Promise<readonly CodeToken[]> {
    if (code.length > Resources.codeLengthLimit)
      return [];
    const [shiki, primitive] = await this.shiki.getAsync(() => CodeHighlighter.startAsync());
    if (this.isDisposed)
      return [];
    await this.loadAsync(primitive, language);
    if (signal.aborted || this.isDisposed)
      return [];
    const options = { lang: language.id, theme: Resources.codeThemeName, tokenizeMaxLineLength: Resources.codeLineLengthLimit };
    return shiki.codeToTokensBase(primitive, code, options).flat().flatMap(t => {
      const kind = CodeHighlighter.kindsByMarker.get(t.color);
      return Object.isUndefined(kind) ? [] : [new CodeToken(t.offset, t.content, kind)];
    });
  }

  private static async startAsync(): Promise<readonly [typeof import("@shikijs/primitive"), ShikiPrimitive]> {
    const [shiki, engine] = await Promise.all([import("@shikijs/primitive"), import("@shikijs/engine-javascript")]);
    return [shiki, shiki.createShikiPrimitive({ engine: engine.createJavaScriptRegexEngine({ forgiving: true }), themes: [CodeHighlighter.theme] })];
  }

  private static markerOf(kind: CodeTokenKind): string {
    return kind.toLowerCase();
  }

  private loadAsync(primitive: ShikiPrimitive, language: CodeLanguage): Promise<void> {
    const loading = this.languages.get(language.id) ?? new LoadOnce<void>();
    this.languages.set(language.id, loading);
    return loading.getAsync(() => primitive.loadLanguage(language.load));
  }
}
