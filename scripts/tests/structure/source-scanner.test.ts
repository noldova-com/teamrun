/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type SourceLiteral from "../../structure/source-literal.ts";
import SourceScanner from "../../structure/source-scanner.ts";

class SourceScannerTests {
  public static register(): void {
    test("import specifiers of every import form are told apart from other strings", () => {
      const source = new SourceScanner([
        "import a from \"default\";",
        "import \"side-effect\";",
        "import type { T } from 'types';",
        "export * from \"re-export\";",
        "const lazy = await import(\"dynamic\");",
        "const old = require(\"required\");",
        "const call = run(\"argument\");",
        "const from = \"assigned\";"
      ].join("\n")).scan();

      assert.deepEqual(SourceScannerTests.format(source.imports), ["1:default", "2:side-effect", "3:types", "4:re-export", "5:dynamic", "6:required"]);
      assert.deepEqual(SourceScannerTests.format(source.texts), ["7:argument", "8:assigned"]);
      assert.deepEqual(source.selectors, []);
    });

    test("a function body is an arrow, a function, or a block after a parameter list, and never one inside a string, a comment or a property name", () => {
      const bodies = ["const twice = t => t * 2;", "export function run() {}", "class Clock {\n  tick() {\n  }\n}", "class Clock {\n  constructor() {\n  }\n}", "class Clock {\n  get now() {\n    return 1;\n  }\n}"];
      const others = ["const text = \"t => t\";", "// run() {}\nconst a = 1;", "/* function */\nconst b = 2;", "const c = settings.function;", "export class Empty {\n  name = \"x\";\n}", "const d = (1) + 2;", "const e = a >= b;"];

      assert.deepEqual(bodies.map(t => new SourceScanner(t).scan().hasFunctionBody), bodies.map(() => true));
      assert.deepEqual(others.map(t => new SourceScanner(t).scan().hasFunctionBody), others.map(() => false));
    });

    test("selectors are the strings that follow a selector key", () => {
      const source = new SourceScanner("@Component({\n  selector: \"tr-panel\",\n  label: \"selector\",\n  other: \"x\"\n})\n").scan();

      assert.deepEqual(SourceScannerTests.format(source.selectors), ["2:tr-panel"]);
      assert.deepEqual(SourceScannerTests.format(source.texts), ["3:selector", "4:x"]);
    });

    test("escapes, line continuations and unterminated strings keep their content and line numbers", () => {
      const source = new SourceScanner("\"a\\\"b\"\n'c\\\nd'\n\"open\n\"next\"\n'end").scan();

      assert.deepEqual(SourceScannerTests.format(source.texts), ["1:a\"b", "2:cd", "4:open", "5:next", "6:end"]);
    });

    test("template literals yield their text parts and scan their substitutions as code", () => {
      const source = new SourceScanner("`a${ { key: \"inner\" }.key }b`\n`multi\nline \\` ${ `nested${1}` }`\n\"after\"\n`open").scan();

      assert.deepEqual(SourceScannerTests.format(source.texts), [
        "1:a", "1:inner", "1:b", "2:multi\nline ` ", "3:nested", "3:", "3:", "4:after", "5:open"
      ]);
    });

    test("comments are skipped, their lines counted, and the line each starts on kept", () => {
      const source = new SourceScanner("// \"line\"\n/* \"block\"\n*/ \"kept\"\n/* open \"block\"").scan();
      const ending = new SourceScanner("\"first\" // trailing").scan();

      assert.deepEqual(SourceScannerTests.format(source.texts), ["3:kept"]);
      assert.deepEqual(SourceScannerTests.format(ending.texts), ["1:first"]);
      assert.deepEqual(source.comments, [1, 2, 4]);
      assert.deepEqual(ending.comments, [1]);
    });

    test("regular expressions are skipped where an operand may start and slashes elsewhere divide", () => {
      const source = new SourceScanner([
        "const pattern = /\"[/\"]\\/'/giu;",
        "function f() { return /'/; }",
        "if (x) {} /\"/.test(y);",
        "const ratio = 4 / 2 + (a) / b + c[0] / d + e / \"divided\";",
        "const open = /\"unterminated",
        "\"next\""
      ].join("\n")).scan();

      assert.deepEqual(SourceScannerTests.format(source.texts), ["4:divided", "6:next"]);
    });

    test("a regular expression may open the text", () => {
      assert.deepEqual(new SourceScanner("/\"/.test(\"x\")").scan().texts.map(t => t.value), ["x"]);
    });
  }

  private static format(literals: readonly SourceLiteral[]): readonly string[] {
    return literals.map(t => `${t.line}:${t.value}`);
  }
}

SourceScannerTests.register();
