/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { LanguageRegistration } from "@shikijs/primitive/types";

import "@noldova/teamrun-foundation-core";

import { CodeLanguage } from "../../../src/app/models/code-language";

describe("CodeLanguage", () => {
  it("finds a language by its name or an alias, whatever its case and surrounding spaces, and nothing for an unknown name or none", () => {
    const named = ["TypeScript", "ts", "Shell", " bash ", "C#", "Dockerfile", "Makefile", "C++", "Ruby", "Klingon"].map(t => CodeLanguage.named(t)?.id ?? null);

    expect(named).toEqual(["typescript", "typescript", "shellscript", "shellscript", "csharp", "docker", "make", null, null, null]);
    expect(CodeLanguage.named(null)).toBeNull();
  });

  it("lists each language once, and gives each name or alias to one language only", () => {
    const names = CodeLanguage.all.flatMap(t => [t.id, ...t.aliases]);

    expect(CodeLanguage.all.length).toBe(33);
    expect(new Set(names).size).toBe(names.length);
    expect(names.every(t => t === t.toLowerCase())).toBe(true);
  });

  it("brings with each language only the grammars of languages it lists, so no other grammar ships", async () => {
    const ids = new Set(CodeLanguage.all.map(t => t.id));
    const loaded = await Promise.all(CodeLanguage.all.map(async t =>
      (await (t.load as () => Promise<{ readonly default: readonly LanguageRegistration[] }>)()).default.map(grammar => grammar.name)));

    expect(loaded.flat().filter(t => !ids.has(t))).toEqual([]);
  });
});
