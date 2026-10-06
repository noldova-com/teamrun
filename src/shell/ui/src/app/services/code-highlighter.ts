/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable } from "@angular/core";
import type { ShikiPrimitive } from "@shikijs/primitive";
import type { ThemeRegistrationRaw } from "@shikijs/primitive/types";

import "@noldova/teamrun-foundation-core";

import { CodeTokenKind } from "../enums/code-token-kind";
import type { CodeLanguage } from "../models/code-language";
import { CodeToken } from "../models/code-token";
import { Resources } from "../../resources";

@Injectable({ providedIn: "root" })
export class CodeHighlighter {
  private static readonly kinds: ReadonlyMap<string | undefined, CodeTokenKind> = new Map(Object.values(CodeTokenKind).map(t => [t.toLowerCase(), t] as const));
  private static readonly theme: ThemeRegistrationRaw = {
    name: Resources.codeThemeName,
    fg: Resources.codePlainColor,
    bg: Resources.codePlainColor,
    settings: [
      { settings: { foreground: Resources.codePlainColor } },
      ...Object.values(CodeTokenKind).map(t => ({ scope: [...Resources.codeTokenScopes[t]], settings: { foreground: t.toLowerCase() } })),
      { scope: [...Resources.codePlainScopes], settings: { foreground: Resources.codePlainColor } }
    ]
  };

  private readonly languages: Map<string, Promise<void>> = new Map();
  private shiki: Promise<readonly [typeof import("@shikijs/primitive"), ShikiPrimitive]> | null = null;

  public async tokensAsync(code: string, language: CodeLanguage): Promise<readonly CodeToken[]> {
    const [shiki, primitive] = await this.startAsync();
    await this.loadAsync(primitive, language);
    const breaks = code.match(Resources.codeLineBreak) ?? [];
    return shiki.codeToTokensBase(primitive, code, { lang: language.id, theme: Resources.codeThemeName }).flatMap((line, index) => [
      ...line.map(t => new CodeToken(t.content, CodeHighlighter.kinds.get(t.color) ?? null)),
      ...breaks.slice(index, index + 1).map(t => new CodeToken(t, null))
    ]);
  }

  private startAsync(): Promise<readonly [typeof import("@shikijs/primitive"), ShikiPrimitive]> {
    this.shiki ??= Promise.all([import("@shikijs/primitive"), import("@shikijs/engine-javascript")]).then(([shiki, engine]) =>
      [shiki, shiki.createShikiPrimitive({ engine: engine.createJavaScriptRegexEngine({ forgiving: true }), themes: [CodeHighlighter.theme] })] as const);
    return this.shiki;
  }

  private loadAsync(primitive: ShikiPrimitive, language: CodeLanguage): Promise<void> {
    const loading = this.languages.get(language.id) ?? primitive.loadLanguage(language.load);
    this.languages.set(language.id, loading);
    return loading;
  }
}
