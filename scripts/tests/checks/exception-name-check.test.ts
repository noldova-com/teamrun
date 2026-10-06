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
import ExceptionNameCheck from "../../checks/exception-name-check.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import Git from "../../repository/git.ts";
import RepositoryFiles from "../../repository/repository-files.ts";
import SyntaxTreeReader from "../../structure/syntax-tree.reader.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class ExceptionNameCheckTests {
  private static readonly TIMEOUT: number = 120_000;
  private static readonly RULE: string = "; CODING-STANDARDS.md section 10 has each exception class set name to its own class name, written out, because a minified build renames classes.";

  public static register(): void {
    test("exceptions that set their own class name pass, and abstract exceptions, other classes, declarations, tests, fixtures and scripts are left out", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "src/foundation/exceptions/src/exceptions/exception.ts": "export abstract class Exception extends Error {\n  public abstract override readonly name: string;\n}\n",
        "src/shell/runtime/src/exceptions/launch.exception.ts": [
          "export class LaunchException extends Exception {",
          "  public override readonly name: string = \"LaunchException\";",
          "}",
          ""
        ].join("\n"),
        "src/shell/runtime/src/exceptions/base.exception.ts": "export abstract class BaseException extends Exception {\n}\n",
        "src/shell/runtime/src/exceptions/qualified.exception.ts": "export class QualifiedException extends errors.BaseException {\n  public override readonly name: string = `QualifiedException`;\n}\n",
        "src/shell/runtime/src/models/plain.ts": "export class Plain {\n}\nexport class Child extends Plain {\n}\nexport class Mixed extends mix(Plain) {\n}\nexport default class extends Exception {\n}\n",
        "src/shell/runtime/src/api/index.d.ts": "export declare class LaunchException extends Exception {\n  public override readonly name: string;\n}\n",
        "src/shell/runtime/tests/fixtures/sample.exception.ts": "export class SampleException extends Exception {\n}\n",
        "scripts/packages/package.exception.ts": "export default class PackageException extends Exception {\n}\n",
        "README.md": "# TeamRun\n"
      });
      const output = new TextOutputFixture();

      const check = ExceptionNameCheckTests.createCheck(repository);

      assert.equal(await check.runAsync(output), true, output.text);
      assert.equal(output.text, "Checked the exception names of 5 production sources.\n");
      assert.equal(check.title, "Exception names");
    });

    test("an exception without its name, or with another name or a value other than a string, fails with the file, the class and the expected literal", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "src/shell/window/src/app/exceptions/view-dialog.exception.ts": "export class ViewDialogException extends Exception {\n  public readonly code: string;\n}\n",
        "src/shell/window/src/app/exceptions/link.exception.ts": "export class LinkException extends Exception {\n  public override readonly name: string = \"LinkError\";\n}\n",
        "src/shell/cli/src/exceptions/usage.exception.ts": [
          "export class UsageException extends Exception {",
          "  public override readonly name: string = Resources.usage;",
          "}",
          "export class InnerException extends UsageException {",
          "  public override readonly name: string;",
          "}",
          ""
        ].join("\n"),
        "src/shell/runtime/src/services/launcher.ts": "export function fail(): never {\n  class LocalException extends Exception {\n  }\n  throw new LocalException();\n}\n"
      });
      const output = new TextOutputFixture();

      assert.equal(await ExceptionNameCheckTests.createCheck(repository).runAsync(output), false);
      const rule = ExceptionNameCheckTests.RULE;
      assert.equal(output.text, [
        `src/shell/cli/src/exceptions/usage.exception.ts:1: UsageException sets its name to a value other than a string instead of "UsageException"${rule}`,
        `src/shell/cli/src/exceptions/usage.exception.ts:4: InnerException sets its name to a value other than a string instead of "InnerException"${rule}`,
        `src/shell/runtime/src/services/launcher.ts:2: LocalException does not set its name; declare public override readonly name: string = "LocalException"${rule}`,
        `src/shell/window/src/app/exceptions/link.exception.ts:1: LinkException sets its name to "LinkError" instead of "LinkException"${rule}`,
        `src/shell/window/src/app/exceptions/view-dialog.exception.ts:1: ViewDialogException does not set its name; declare public override readonly name: string = "ViewDialogException"${rule}`,
        "Checked the exception names of 4 production sources.",
        ""
      ].join("\n"));
    });

    test("a TypeScript API that cannot start fails the check with its reason, and any other error reaches the caller", async t => {
      const file = "src/shell/cli/src/exceptions/usage.exception.ts";
      const source = "export class UsageException extends Exception {\n  public override readonly name: string = \"UsageException\";\n}\n";
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ [file]: source });
      const output = new TextOutputFixture();
      const files = new RepositoryFiles(repository.directory, new Git(repository.directory, new ProcessRunner()));
      const stopping = new SyntaxTreeReader(repository.directory, [process.execPath, "-e", "process.exit(3)", "--"], ExceptionNameCheckTests.TIMEOUT);

      assert.equal(await new ExceptionNameCheck(files, stopping).runAsync(output), false);
      assert.match(output.text, /^The TypeScript API server could not open .+; after \d+ ms it had stopped\.\n(?:.*\n)*Checked the exception names of 1 production sources\.\n$/);

      const other = await RepositoryFixture.createAsync();
      t.after(() => other.disposeAsync());
      await other.writeAsync({ [file]: source, "_build": "a file where the build folder belongs\n" });
      await assert.rejects(ExceptionNameCheckTests.createCheck(other).runAsync(new TextOutputFixture()), { code: "ENOTDIR" });
    });
  }

  private static createCheck(repository: RepositoryFixture): ExceptionNameCheck {
    const directory = repository.directory;
    return new ExceptionNameCheck(new RepositoryFiles(directory, new Git(directory, new ProcessRunner())), new SyntaxTreeReader(directory, [ApiServer.locateCompiler()], ExceptionNameCheckTests.TIMEOUT));
  }
}

ExceptionNameCheckTests.register();
