/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { CodeLanguage } from "../../../src/app/models/code-language";

describe("CodeLanguage", () => {
  it("finds a language by its name or an alias, whatever its case and surrounding spaces, and nothing for an unknown name or none", () => {
    const named = ["TypeScript", "ts", "Shell", " bash ", "C#", "C++", "Dockerfile", "Makefile", "Klingon"].map(t => CodeLanguage.named(t)?.id ?? null);

    expect(named).toEqual(["typescript", "typescript", "shellscript", "shellscript", "csharp", "cpp", "docker", "make", null]);
    expect(CodeLanguage.named(null)).toBeNull();
  });

  it("lists each language once, and gives each name or alias to one language only", () => {
    const names = CodeLanguage.all.flatMap(t => [t.id, ...t.aliases]);

    expect(CodeLanguage.all.length).toBe(35);
    expect(new Set(names).size).toBe(names.length);
    expect(names.every(t => t === t.toLowerCase())).toBe(true);
  });
});
