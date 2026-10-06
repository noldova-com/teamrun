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
import EnumValueCheck from "../../checks/enum-value-check.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import Git from "../../repository/git.ts";
import RepositoryFiles from "../../repository/repository-files.ts";
import SyntaxTreeReader from "../../structure/syntax-tree.reader.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class EnumValueCheckTests {
  private static readonly TIMEOUT: number = 120_000;
  private static readonly RULE: string = "; CODING-STANDARDS.md section 10 has a string enum value match its member name, with a spelling fixed outside TeamRun mapped in the package's resources; tests and fixtures follow section 13.";

  public static register(): void {
    test("string values that match their names, numeric and implicit members and names the compiler refuses pass, and tests, fixtures and other folders are left out", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "src/shell/runtime/src/enums/state.ts": [
          "export enum State {",
          "  Ready = \"Ready\",",
          "  \"Quoted\" = \"Quoted\",",
          "  Count = 3,",
          "  Implicit,",
          "  [key] = \"other\"",
          "}",
          ""
        ].join("\n"),
        "src/shell/runtime/src/api/index.d.ts": "export declare enum State { Ready = \"Ready\" }\n",
        "scripts/kinds.ts": "enum Kind { Text = `Text` }\nexport const words = { Ready: \"ready\" };\n",
        "src/shell/runtime/tests/fixtures/state.ts": "export enum Wire { Ready = \"ready\" }\n",
        "scripts/tests/kinds.test.ts": "enum Wire { Ready = \"ready\" }\n",
        "tools/kinds.ts": "enum Wire { Ready = \"ready\" }\n",
        "README.md": "# TeamRun\n"
      });
      const output = new TextOutputFixture();

      const check = EnumValueCheckTests.createCheck(repository);

      assert.equal(await check.runAsync(output), true, output.text);
      assert.equal(output.text, "Checked the enum values of 3 production scripts.\n");
      assert.equal(check.title, "Enum values");
    });

    test("a string value other than its member name fails with where it is, in packages, the Angular parts, declarations and scripts", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "src/shell/cli/src/enums/cli-command.ts": [
          "export enum CliCommand {",
          "  Status = \"status\",",
          "  \"Run\" = \"run\",",
          "  Open = `open`,",
          "  Help = \"Help\"",
          "}",
          ""
        ].join("\n"),
        "src/shell/cli/src/api/index.d.ts": "export declare enum CliCommand { Status = \"status\" }\n",
        "src/shell/window/src/app/enums/edit-action.ts": "export enum EditAction {\n  Undo = \"undo\"\n}\n",
        "scripts/kinds.ts": "namespace Outer {\n  export enum Inner { Text = \"text\" }\n}\n"
      });
      const output = new TextOutputFixture();

      assert.equal(await EnumValueCheckTests.createCheck(repository).runAsync(output), false);
      const rule = EnumValueCheckTests.RULE;
      assert.equal(output.text, [
        `scripts/kinds.ts:2: Inner.Text has the value "text" instead of its name${rule}`,
        `src/shell/cli/src/api/index.d.ts:1: CliCommand.Status has the value "status" instead of its name${rule}`,
        `src/shell/cli/src/enums/cli-command.ts:2: CliCommand.Status has the value "status" instead of its name${rule}`,
        `src/shell/cli/src/enums/cli-command.ts:3: CliCommand.Run has the value "run" instead of its name${rule}`,
        `src/shell/cli/src/enums/cli-command.ts:4: CliCommand.Open has the value "open" instead of its name${rule}`,
        `src/shell/window/src/app/enums/edit-action.ts:2: EditAction.Undo has the value "undo" instead of its name${rule}`,
        "Checked the enum values of 4 production scripts.",
        ""
      ].join("\n"));
    });

    test("a TypeScript API that cannot start fails the check with its reason, and any other error reaches the caller", async t => {
      const file = "scripts/kinds.ts";
      const source = "enum Kind { Text = \"Text\" }\n";
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ [file]: source });
      const output = new TextOutputFixture();
      const files = new RepositoryFiles(repository.directory, new Git(repository.directory, new ProcessRunner()));
      const stopping = new SyntaxTreeReader(repository.directory, [process.execPath, "-e", "process.exit(3)", "--"], EnumValueCheckTests.TIMEOUT);

      assert.equal(await new EnumValueCheck(files, stopping).runAsync(output), false);
      assert.match(output.text, /^The TypeScript API server could not open .+; after \d+ ms it had stopped\.\n(?:.*\n)*Checked the enum values of 1 production scripts\.\n$/);

      const other = await RepositoryFixture.createAsync();
      t.after(() => other.disposeAsync());
      await other.writeAsync({ [file]: source, "_build": "a file where the build folder belongs\n" });
      await assert.rejects(EnumValueCheckTests.createCheck(other).runAsync(new TextOutputFixture()), { code: "ENOTDIR" });
    });
  }

  private static createCheck(repository: RepositoryFixture): EnumValueCheck {
    const directory = repository.directory;
    return new EnumValueCheck(new RepositoryFiles(directory, new Git(directory, new ProcessRunner())), new SyntaxTreeReader(directory, [ApiServer.locateCompiler()], EnumValueCheckTests.TIMEOUT));
  }
}

EnumValueCheckTests.register();
