/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import ApiServer from "../../api/api-server.ts";
import InterfaceNameCheck from "../../checks/interface-name-check.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import Git from "../../repository/git.ts";
import RepositoryFiles from "../../repository/repository-files.ts";
import SyntaxTreeReader from "../../structure/syntax-tree.reader.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class InterfaceNameCheckTests {
  private static readonly TIMEOUT: number = 120_000;
  private static readonly RULE: string = "; CODING-STANDARDS.md section 10 names an interface I plus PascalCase, as in IProviderAdapter, in production code, scripts and tests; an interface in declare global or declare module augments an existing type and keeps its name.";

  public static register(): void {
    test("interfaces named I plus PascalCase pass, and interfaces that augment a global or another module's type keep their names", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "src/shell/runtime/src/interfaces/i-provider-adapter.ts": "export interface IProviderAdapter {\n  readonly id: string;\n}\n",
        "src/foundation/core/src/extensions/string.extensions.ts": [
          "declare global {",
          "  interface StringConstructor {",
          "    isEmpty(value: string): boolean;",
          "  }",
          "}",
          "export {};",
          ""
        ].join("\n"),
        "src/shell/desktop/src/api/index.d.ts": "declare module \"electron\" {\n  interface App {\n    readonly teamrun: boolean;\n  }\n}\nexport declare interface IDesktop {}\n",
        "src/shell/desktop/tests/e2e/fixtures/i-point.ts": "export interface IPoint {\n  readonly x: number;\n}\n",
        "scripts/notes.mjs": "export const text = \"interface Point {}\";\n",
        "README.md": "# TeamRun\n"
      });
      const output = new TextOutputFixture();

      const check = InterfaceNameCheckTests.createCheck(repository);

      assert.equal(await check.runAsync(output), true, output.text);
      assert.equal(output.text, "Checked the interface names of 5 scripts.\n");
      assert.equal(check.title, "Interface names");
    });

    test("an interface without the I prefix fails with the file, the line and the interface, in production code, declarations, namespaces, scripts and tests", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "src/shell/runtime/src/interfaces/provider-adapter.ts": "export interface ProviderAdapter {\n  readonly id: string;\n}\n",
        "src/shell/runtime/src/api/index.d.ts": "export declare interface Item {}\n",
        "scripts/text.ts": [
          "namespace Text {",
          "  export interface Line {}",
          "}",
          "interface Iterator {}",
          "interface I {}",
          ""
        ].join("\n"),
        "src/shell/desktop/tests/e2e/fixtures/off-cursor-placement.ts": "export interface Point {\n  readonly x: number;\n}\n"
      });
      const output = new TextOutputFixture();

      assert.equal(await InterfaceNameCheckTests.createCheck(repository).runAsync(output), false);
      const rule = InterfaceNameCheckTests.RULE;
      assert.equal(output.text, [
        `scripts/text.ts:2: the interface Line does not start with I and a capital letter; name it ILine${rule}`,
        `scripts/text.ts:4: the interface Iterator does not start with I and a capital letter; name it IIterator${rule}`,
        `scripts/text.ts:5: the interface I does not start with I and a capital letter; name it II${rule}`,
        `src/shell/desktop/tests/e2e/fixtures/off-cursor-placement.ts:1: the interface Point does not start with I and a capital letter; name it IPoint${rule}`,
        `src/shell/runtime/src/api/index.d.ts:1: the interface Item does not start with I and a capital letter; name it IItem${rule}`,
        `src/shell/runtime/src/interfaces/provider-adapter.ts:1: the interface ProviderAdapter does not start with I and a capital letter; name it IProviderAdapter${rule}`,
        "Checked the interface names of 4 scripts.",
        ""
      ].join("\n"));
    });

    test("a TypeScript API that cannot start fails the check with its reason, and any other error reaches the caller", async t => {
      const file = "scripts/text.ts";
      const source = "interface ILine {}\n";
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ [file]: source });
      const output = new TextOutputFixture();
      const files = new RepositoryFiles(repository.directory, new Git(repository.directory, new ProcessRunner()));
      const stopping = new SyntaxTreeReader(repository.directory, [process.execPath, "-e", "process.exit(3)", "--"], InterfaceNameCheckTests.TIMEOUT);

      assert.equal(await new InterfaceNameCheck(files, stopping).runAsync(output), false);
      assert.match(output.text, /^The TypeScript API server could not open .+; after \d+ ms it had stopped\.\n(?:.*\n)*Checked the interface names of 1 scripts\.\n$/);

      const other = await RepositoryFixture.createAsync();
      t.after(() => other.disposeAsync());
      await other.writeAsync({ [file]: source, "_build": "a file where the build folder belongs\n" });
      await assert.rejects(InterfaceNameCheckTests.createCheck(other).runAsync(new TextOutputFixture()), { code: "ENOTDIR" });
    });
  }

  private static createCheck(repository: RepositoryFixture): InterfaceNameCheck {
    const directory = repository.directory;
    return new InterfaceNameCheck(new RepositoryFiles(directory, new Git(directory, new ProcessRunner())), new SyntaxTreeReader(directory, [ApiServer.locateCompiler()], InterfaceNameCheckTests.TIMEOUT));
  }
}

InterfaceNameCheckTests.register();
