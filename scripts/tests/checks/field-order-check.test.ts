/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import FieldOrderCheck from "../../checks/field-order-check.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import Git from "../../repository/git.ts";
import RepositoryFiles from "../../repository/repository-files.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class FieldOrderCheckTests {
  private static readonly LATE: string = "FIELD is a public static field after another field; declare public static fields first, unless its initializer uses CLASS, as CODING-STANDARDS.md section 10 says.";
  private static readonly UNORDERED: string = [
    "export class Disordered {",
    "  private readonly count: number = 1;",
    "  public static readonly LATE: string = \"a\";",
    "  static readonly IMPLICIT: number = 2;",
    "  public static readonly OTHER: number = Other.LIMIT;",
    "  public static readonly SPREAD: readonly number[] = [",
    "    1,",
    "    2",
    "  ];",
    "  private static readonly KEPT: number = 3;",
    "  public readonly id: string = \"\";",
    "}",
    "",
    "class Fresh {",
    "  public static readonly FIRST: number = 1;",
    "  private count: number = 0;",
    "}",
    ""
  ].join("\n");

  public static register(): void {
    test("public static fields first, public static fields that build themselves from their class, and everything outside classes and other files pass", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "scripts/ordered.ts": [
          "export function build(): void {",
          "}",
          "",
          "const table = {",
          "  entry: 1,",
          "};",
          "",
          "export default abstract class Ordered {",
          "  public static readonly NAME: string = \"ordered\";",
          "  static readonly IMPLICIT: number = 1;",
          "  private static readonly LIMIT: number = 2;",
          "  protected static readonly STEP: number = 3;",
          "  public static readonly COPY: Ordered = new Ordered(Ordered.NAME);",
          "  public static readonly COUNTS: readonly number[] = [",
          "    Ordered.LIMIT,",
          "    1",
          "  ];",
          "",
          "  private readonly #secret?: string;",
          "  public readonly id: string;",
          "",
          "  public constructor(id: string) {",
          "    this.id = id;",
          "  }",
          "}",
          "",
          "class Second {",
          "  public static readonly FIRST: number = 1;",
          "  private count: number = 0;",
          "}",
          ""
        ].join("\n"),
        "src/shell/types.d.ts": FieldOrderCheckTests.UNORDERED,
        "docs/example.ts": FieldOrderCheckTests.UNORDERED,
        "src/shell/notes.md": FieldOrderCheckTests.UNORDERED
      });
      const output = new TextOutputFixture();

      const check = FieldOrderCheckTests.createCheck(repository);

      assert.equal(await check.runAsync(output), true);
      assert.equal(output.text, "Checked 1 files for the order of class fields.\n");
      assert.equal(check.title, "Field order");
    });

    test("a public static field after another field fails with its line unless it uses its own class", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "scripts/open.ts": "export class Open {\n  private count: number = 1;\n  public static readonly TAIL: number[] = [\n    1\n",
        "scripts/unfinished.ts": "class Unfinished {\n  private count: number = 1;\n  public static readonly LAST: string = \"a\";",
        "src/shell/disordered.ts": FieldOrderCheckTests.UNORDERED
      });
      const output = new TextOutputFixture();

      assert.equal(await FieldOrderCheckTests.createCheck(repository).runAsync(output), false);
      assert.equal(output.text, [
        FieldOrderCheckTests.finding("scripts/open.ts", 3, "TAIL", "Open"),
        FieldOrderCheckTests.finding("scripts/unfinished.ts", 3, "LAST", "Unfinished"),
        FieldOrderCheckTests.finding("src/shell/disordered.ts", 3, "LATE", "Disordered"),
        FieldOrderCheckTests.finding("src/shell/disordered.ts", 4, "IMPLICIT", "Disordered"),
        FieldOrderCheckTests.finding("src/shell/disordered.ts", 5, "OTHER", "Disordered"),
        FieldOrderCheckTests.finding("src/shell/disordered.ts", 6, "SPREAD", "Disordered"),
        "Checked 3 files for the order of class fields.",
        ""
      ].join("\n"));
    });
  }

  private static finding(file: string, line: number, field: string, className: string): string {
    return `${file}:${line}: ${FieldOrderCheckTests.LATE.replace("FIELD", field).replace("CLASS", className)}`;
  }

  private static createCheck(repository: RepositoryFixture): FieldOrderCheck {
    const directory = repository.directory;
    return new FieldOrderCheck(directory, new RepositoryFiles(directory, new Git(directory, new ProcessRunner())));
  }
}

FieldOrderCheckTests.register();
