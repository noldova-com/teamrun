/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import type { ShikiPrimitive } from "@shikijs/primitive";

import { CodeTokenKind } from "../../../src/app/enums/code-token-kind";
import { CodeLanguage } from "../../../src/app/models/code-language";
import { CodeHighlighter } from "../../../src/app/services/code-highlighter";
import { Resources } from "../../../src/resources";

const primitives = vi.hoisted((): ShikiPrimitive[] => []);

vi.mock("@shikijs/primitive", async importOriginal => {
  const shiki = await importOriginal<typeof import("@shikijs/primitive")>();
  return {
    ...shiki,
    createShikiPrimitive: (...options: Parameters<typeof shiki.createShikiPrimitive>): ShikiPrimitive => {
      const primitive = shiki.createShikiPrimitive(...options);
      primitives.push(primitive);
      return primitive;
    }
  };
});

describe("CodeHighlighter", () => {
  const signal = new AbortController().signal;
  const typescript = CodeLanguage.named("ts") as CodeLanguage;
  const samples: Readonly<Record<string, string>> = {
    typescript: "const a: number = 1;",
    javascript: "const a = 1; // note",
    tsx: "const a = <div>{1}</div>;",
    jsx: "const a = <div>{1}</div>;",
    json: "{ \"a\": 1 }",
    jsonc: "{\n  // note\n  \"a\": 1\n}",
    yaml: "a: 1 # note",
    toml: "a = 1 # note",
    shellscript: "echo \"hi\" # note",
    powershell: "Write-Host \"hi\" # note",
    bat: "echo hi\r\nREM note",
    python: "def a():\n    return 1  # note",
    go: "func a() int { return 1 }",
    rust: "fn a() -> i32 { 1 }",
    java: "class A { int a = 1; }",
    kotlin: "fun a(): Int = 1",
    c: "int a = 1; // note",
    csharp: "class A { int a = 1; }",
    swift: "let a = 1 // note",
    php: "<?php $a = 1; // note",
    sql: "SELECT 1 FROM a; -- note",
    html: "<div class=\"a\">hi</div>",
    css: "a { color: red; }",
    scss: "$a: 1px;\na { width: $a; }",
    markdown: "# Title\n\nText",
    xml: "<a b=\"c\">d</a>",
    docker: "FROM node:22\nRUN echo hi",
    diff: "--- a\n+++ b\n-old\n+new",
    ini: "[a]\nb = 1 ; note",
    graphql: "query A { b }",
    lua: "local a = 1 -- note",
    r: "a <- 1 # note",
    make: "all:\n\techo hi # note"
  };

  it("colors a sample of every language it knows, each token at its place in the sample", async () => {
    const highlighter = TestBed.inject(CodeHighlighter);
    const results: (readonly [string, boolean, boolean])[] = [];

    for (const language of CodeLanguage.all) {
      const sample = samples[language.id] ?? String.empty;
      const tokens = await highlighter.tokensAsync(sample, language, signal);
      results.push([language.id, tokens.every(t => sample.slice(t.start, t.end) === t.text), tokens.length > 0]);
    }

    expect(results).toEqual(CodeLanguage.all.map(t => [t.id, true, true]));
  });

  it("releases its highlighter with its injector, so highlighters made one after another never pile up", async () => {
    const warn = vi.spyOn(console, "warn");

    for (let index = 0; index < 12; index++) {
      await TestBed.inject(CodeHighlighter).tokensAsync("let a;", typescript, signal);
      TestBed.resetTestingModule();
    }

    expect(warn.mock.calls.filter(t => String(t[0]).includes("[Shiki]"))).toEqual([]);
  });

  it("gives nothing to a call still in flight when its injector goes, and never reaches the released highlighter", async () => {
    const tokens = TestBed.inject(CodeHighlighter).tokensAsync("let a;", typescript, signal);

    TestBed.resetTestingModule();

    await expect(tokens).resolves.toEqual([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports a grammar that failed to load once, leaves code plain while the failure is held, then loads the grammar again", async () => {
    const errors: unknown[] = [];
    const failure = new Error("The grammar's chunk did not load.");
    TestBed.overrideProvider(ErrorHandler, { useValue: { handleError: (error: unknown) => errors.push(error) } });
    const highlighter = TestBed.inject(CodeHighlighter);
    await highlighter.tokensAsync("echo hi", CodeLanguage.named("sh") as CodeLanguage, signal);
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    const loadLanguage = vi.spyOn(primitives.at(-1) as ShikiPrimitive, "loadLanguage").mockRejectedValueOnce(failure);

    const held: unknown[] = [];
    for (const code of ["let", "let a", "let a;"])
      held.push(await highlighter.tokensAsync(code, typescript, signal));
    vi.advanceTimersByTime(Resources.codeLoadFailureHold);
    const loaded = await highlighter.tokensAsync("let a;", typescript, signal);

    expect([held, errors, loadLanguage.mock.calls.length]).toEqual([[[], [], []], [failure], 2]);
    expect(loaded.map(t => t.text)).toEqual(["let", "a"]);
  });

  it("tokenizes nothing once its call is aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(TestBed.inject(CodeHighlighter).tokensAsync("let a;", typescript, controller.signal)).resolves.toEqual([]);
  });

  it("colors code as long as its limit and leaves longer code plain, and colors a line as long as its limit and leaves a longer line plain among colored ones", async () => {
    const highlighter = TestBed.inject(CodeHighlighter);
    const texts = async (code: string): Promise<readonly string[]> => (await highlighter.tokensAsync(code, typescript, signal)).map(t => t.text);
    const code = (length: number): string => `let a;${"\n".repeat(length - 6)}`;
    const line = (length: number): string => `let a;\nlet b = 1;${" ".repeat(length - 10)}\nlet c;`;

    const results = [await texts(code(100_000)), await texts(code(100_001)), await texts(line(2000)), await texts(line(2001))];

    expect(results).toEqual([["let", "a"], [], ["let", "a", "let", "b", "1", "let", "c"], ["let", "a", "let", "c"]]);
  });

  it("gives each colored token its kind and place, across line breaks, and leaves plain text out", async () => {
    const tokens = await TestBed.inject(CodeHighlighter).tokensAsync("return 1;\r\nlet a;", typescript, signal);

    expect(tokens.map(t => [t.start, t.end, t.text, t.kind])).toEqual([
      [0, 6, "return", CodeTokenKind.Control],
      [7, 8, "1", CodeTokenKind.Number],
      [11, 14, "let", CodeTokenKind.Keyword],
      [15, 16, "a", CodeTokenKind.Variable]
    ]);
  });
});
