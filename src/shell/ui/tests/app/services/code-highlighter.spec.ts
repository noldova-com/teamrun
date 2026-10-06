/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { CodeTokenKind } from "../../../src/app/enums/code-token-kind";
import { CodeLanguage } from "../../../src/app/models/code-language";
import { CodeHighlighter } from "../../../src/app/services/code-highlighter";

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

  it("forgets a grammar that failed to load, so the next call loads it again", async () => {
    const highlighter = TestBed.inject(CodeHighlighter);
    const failure = new Error("The grammar's chunk did not load.");
    const failing = Object.create(typescript, { load: { value: (): Promise<never> => Promise.reject(failure) } }) as CodeLanguage;

    await expect(highlighter.tokensAsync("let a;", failing, signal)).rejects.toBe(failure);

    expect((await highlighter.tokensAsync("let a;", typescript, signal)).map(t => t.text)).toEqual(["let", "a"]);
  });

  it("tokenizes nothing once its call is aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(TestBed.inject(CodeHighlighter).tokensAsync("let a;", typescript, controller.signal)).resolves.toEqual([]);
  });

  it("leaves code longer than its limit plain, and a line longer than its limit plain among colored ones", async () => {
    const highlighter = TestBed.inject(CodeHighlighter);
    const longLine = `let b = 1;${" ".repeat(2000)}`;

    const long = await highlighter.tokensAsync(`let a;${" ".repeat(100_000)}`, typescript, signal);
    const mixed = await highlighter.tokensAsync(`let a;\n${longLine}\nlet c;`, typescript, signal);

    expect(long).toEqual([]);
    expect(mixed.map(t => t.text)).toEqual(["let", "a", "let", "c"]);
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
