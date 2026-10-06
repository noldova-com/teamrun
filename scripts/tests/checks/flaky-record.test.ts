/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";

import FlakyRecordException from "../../checks/flaky-record.exception.ts";
import FlakyRecord from "../../checks/flaky-record.ts";
import FlakyTest from "../../checks/flaky-test.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class FlakyRecordTests {
  private static readonly MALFORMED: string = "The flaky test record is not a list of tests with a runner, a file, a name and a failure.";

  public static register(): void {
    test("adding flaky tests keeps them in the record after those already there, names them in the output and adds a table to the job summary", async t => {
      const repository = await FlakyRecordTests.createRepositoryAsync(t);
      const summary = path.join(repository.directory, "summary.md");
      const record = new FlakyRecord(repository.directory, { GITHUB_STEP_SUMMARY: summary });
      const first = new TextOutputFixture();
      const second = new TextOutputFixture();

      await record.addAsync([new FlakyTest("Script tests", "scripts/tests/a.test.ts", "group > first", "not ok 1 - first\n  error: 'once'")], first);
      await record.addAsync([new FlakyTest("Angular tests", "shell/b.spec.ts", "B | `c` <d> & e", "Error: x\n    at y")], second);

      assert.deepEqual(FlakyRecord.parse(await readFile(path.join(repository.directory, "_build", "flaky-tests.json"), "utf8")), [
        new FlakyTest("Script tests", "scripts/tests/a.test.ts", "group > first", "not ok 1 - first\n  error: 'once'"),
        new FlakyTest("Angular tests", "shell/b.spec.ts", "B | `c` <d> & e", "Error: x\n    at y")
      ]);
      assert.deepEqual([first.text, second.text], [
        "Flaky, passed when run again: group > first (scripts/tests/a.test.ts)\n",
        "Flaky, passed when run again: B | `c` <d> & e (shell/b.spec.ts)\n"
      ]);
      const header = "### Flaky tests\n\nThese tests failed, then passed when they ran again in the same job.\n\n| Runner | Test | File | Failure |\n|---|---|---|---|\n";
      assert.equal(await readFile(summary, "utf8"),
        `${header}| Script tests | group &gt; first | scripts/tests/a.test.ts | not ok 1 - first |\n\n` +
        `${header}| Angular tests | B &#124; &#96;c&#96; &lt;d&gt; &amp; e | shell/b.spec.ts | Error: x |\n\n`);
    });

    test("adding no tests changes nothing, and without a job summary only the record and the output get them", async t => {
      const repository = await FlakyRecordTests.createRepositoryAsync(t);
      const record = new FlakyRecord(repository.directory, {});
      const output = new TextOutputFixture();

      await record.addAsync([], output);
      assert.equal(existsSync(path.join(repository.directory, "_build", "flaky-tests.json")), false);
      await record.addAsync([new FlakyTest("Package tests", "src/a.test.ts", "A.b", "failed")], output);

      assert.equal(output.text, "Flaky, passed when run again: A.b (src/a.test.ts)\n");
      assert.equal(existsSync(path.join(repository.directory, "summary.md")), false);
    });

    test("reading gives the recorded tests in order, and nothing without a record", async t => {
      const repository = await FlakyRecordTests.createRepositoryAsync(t);
      const record = new FlakyRecord(repository.directory, {});
      const first = new FlakyTest("Package tests", "src/a.test.ts", "A.b", "failed");
      const second = new FlakyTest("Script tests", "scripts/tests/a.test.ts", "a", "failed");

      assert.deepEqual(await record.readAsync(), []);
      await record.addAsync([first, second], new TextOutputFixture());

      assert.deepEqual(await record.readAsync(), [first, second]);
    });

    test("clearing removes the record, and clearing without one does nothing", async t => {
      const repository = await FlakyRecordTests.createRepositoryAsync(t);
      const record = new FlakyRecord(repository.directory, {});
      await record.clearAsync();
      await record.addAsync([new FlakyTest("Package tests", "src/a.test.ts", "A.b", "failed")], new TextOutputFixture());

      await record.clearAsync();

      assert.equal(existsSync(path.join(repository.directory, "_build", "flaky-tests.json")), false);
    });

    test("a failure is kept to its first twenty lines and two thousand characters, ending with an ellipsis when it is cut", () => {
      const lines = Array.from({ length: 25 }, (_, t) => `line ${t}`);
      const long = "x".repeat(2500);

      assert.equal(FlakyRecord.cap(lines.join("\n")), lines.slice(0, 20).join("\n"));
      assert.equal(FlakyRecord.cap("short"), "short");
      assert.equal(FlakyRecord.cap(long), `${"x".repeat(1999)}…`);
      assert.equal(FlakyRecord.cap("y".repeat(2000)), "y".repeat(2000));
      assert.deepEqual([FlakyRecord.MAXIMUM_FAILURE_LINES, FlakyRecord.MAXIMUM_FAILURE_LENGTH], [20, 2000]);
    });

    test("adding keeps each failure capped in the record", async t => {
      const repository = await FlakyRecordTests.createRepositoryAsync(t);

      await new FlakyRecord(repository.directory, {}).addAsync([new FlakyTest("Script tests", "a", "b", "z".repeat(3000))], new TextOutputFixture());

      assert.equal(FlakyRecord.parse(await readFile(path.join(repository.directory, "_build", "flaky-tests.json"), "utf8"))[0]?.failure, `${"z".repeat(1999)}…`);
    });

    test("a record that is not JSON or not a list of complete tests is refused, and adding to one fails", async t => {
      const repository = await FlakyRecordTests.createRepositoryAsync(t);
      await repository.writeAsync({ "_build/flaky-tests.json": "{}" });

      assert.throws(() => FlakyRecord.parse("{"), (t: unknown) => t instanceof FlakyRecordException && t.message === FlakyRecordTests.MALFORMED && t.cause instanceof SyntaxError);
      for (const text of ["{}", "[null]", "[1]", "[{\"runner\":\"a\",\"file\":\"b\",\"name\":\"c\"}]", "[{\"runner\":\"a\",\"file\":\"b\",\"name\":\"c\",\"failure\":1}]"])
        assert.throws(() => FlakyRecord.parse(text), new FlakyRecordException(FlakyRecordTests.MALFORMED));
      assert.deepEqual(FlakyRecord.parse("[]"), []);
      await assert.rejects(new FlakyRecord(repository.directory, {}).addAsync([new FlakyTest("a", "b", "c", "d")], new TextOutputFixture()), new FlakyRecordException(FlakyRecordTests.MALFORMED));
    });
  }

  private static async createRepositoryAsync(t: TestContext): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    return repository;
  }
}

FlakyRecordTests.register();
