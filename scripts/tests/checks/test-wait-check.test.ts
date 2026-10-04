/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import TestWaitCheck from "../../checks/test-wait-check.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import Git from "../../repository/git.ts";
import RepositoryFiles from "../../repository/repository-files.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class TestWaitCheckTests {
  private static readonly TIMERS: string = "node:timers/promises";
  private static readonly TIMER: string = "setTimeout";
  private static readonly SCHEDULER_WAIT: string = "scheduler.wait";
  private static readonly PAGE_WAIT: string = "page.waitForTimeout";
  private static readonly DELAY_IMPORT: string = `import { ${TestWaitCheckTests.TIMER} as delay } from "${TestWaitCheckTests.TIMERS}";\n`;
  private static readonly RULE: string = ": pauses for a fixed time; a test waits for a condition, and only the files that TESTING.md section 3 lists may pause.";

  public static register(): void {
    test("listed test files may pause, and waits for conditions, deadlines and production code are not pauses", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "docs/TESTING.md": [
          "# Testing",
          "",
          "| Test file | Why it pauses |",
          "|---|---|",
          "| `src/shell/desktop/tests/fixtures/condition.fixture.ts` | The poll interval of its bounded wait. |",
          "| `scripts/tests/fixtures/repository.fixture.ts` | Between bounded attempts to remove a folder. |",
          "| not a file | A row that names no file is not an entry. |",
          "",
          "| `src/other.test.ts` | Another table is not the list. |",
          ""
        ].join("\n"),
        "src/shell/desktop/tests/fixtures/condition.fixture.ts": TestWaitCheckTests.DELAY_IMPORT,
        "scripts/tests/fixtures/repository.fixture.ts": `await new Promise(resolve => ${TestWaitCheckTests.TIMER}(resolve, 50));\n`,
        "src/shell/runtime/tests/services/host.test.ts": [
          "const limit = setTimeout(() => arrival.resolve(), 500);",
          "test.setTimeout(90_000);",
          "this.testInfo.setTimeout(this.testInfo.timeout + 10);",
          "await page.waitForFunction(() => ready);",
          "const script = \"setTimeout(() => {}, 300)\";",
          ""
        ].join("\n"),
        "src/shell/runtime/src/services/host.ts": TestWaitCheckTests.DELAY_IMPORT,
        "src/shell/desktop/tests/e2e/notes.md": `await ${TestWaitCheckTests.PAGE_WAIT}(100);\n`
      });
      const output = new TextOutputFixture();

      const check = TestWaitCheckTests.createCheck(repository);

      assert.equal(await check.runAsync(output), true);
      assert.equal(output.text, "Checked 3 test files for fixed pauses; 2 may pause.\n");
      assert.equal(check.title, "Test waits");
    });

    test("each form of fixed pause in an unlisted test file fails with its line, and so does an entry whose file no longer pauses", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "docs/TESTING.md": "| Test file | Why it pauses |\n|---|---|\n| `src/shell/ui/tests/fixtures/calm.fixture.ts` | It used to pause. |\n",
        "src/shell/ui/tests/fixtures/calm.fixture.ts": "export const calm = true;\n",
        "src/shell/runtime/tests/services/host.test.ts": [
          `import { ${TestWaitCheckTests.TIMER} as delay, setImmediate } from "${TestWaitCheckTests.TIMERS}";`,
          `await ${TestWaitCheckTests.SCHEDULER_WAIT}(100);`,
          `await new Promise<void>(t => ${TestWaitCheckTests.TIMER}(t, 60_000));`,
          ""
        ].join("\n"),
        "src/modules/notes/e2e/notes.spec.ts": `await ${TestWaitCheckTests.PAGE_WAIT}(100);\n`,
        "scripts/tests/build.test.ts": `import { ${TestWaitCheckTests.TIMER} } from '${TestWaitCheckTests.TIMERS}';\n`
      });
      const output = new TextOutputFixture();

      assert.equal(await TestWaitCheckTests.createCheck(repository).runAsync(output), false);
      assert.equal(output.text, [
        `scripts/tests/build.test.ts:1${TestWaitCheckTests.RULE}`,
        `src/modules/notes/e2e/notes.spec.ts:1${TestWaitCheckTests.RULE}`,
        `src/shell/runtime/tests/services/host.test.ts:1${TestWaitCheckTests.RULE}`,
        `src/shell/runtime/tests/services/host.test.ts:2${TestWaitCheckTests.RULE}`,
        `src/shell/runtime/tests/services/host.test.ts:3${TestWaitCheckTests.RULE}`,
        "docs/TESTING.md: lists src/shell/ui/tests/fixtures/calm.fixture.ts, which no longer pauses for a fixed time; remove it from the list.",
        "Checked 4 test files for fixed pauses; 1 may pause.",
        ""
      ].join("\n"));
    });

    test("without the testing contract or its list, no test file may pause", async t => {
      for (const contract of [null, "# Testing\n"]) {
        const repository = await RepositoryFixture.createAsync();
        t.after(() => repository.disposeAsync());
        await repository.writeAsync({
          ...contract === null ? {} : { "docs/TESTING.md": contract },
          "src/shell/desktop/tests/fixtures/condition.fixture.ts": TestWaitCheckTests.DELAY_IMPORT
        });
        const output = new TextOutputFixture();

        assert.equal(await TestWaitCheckTests.createCheck(repository).runAsync(output), false);
        assert.equal(output.text, `src/shell/desktop/tests/fixtures/condition.fixture.ts:1${TestWaitCheckTests.RULE}\nChecked 1 test files for fixed pauses; 0 may pause.\n`);
      }
    });
  }

  private static createCheck(repository: RepositoryFixture): TestWaitCheck {
    const directory = repository.directory;
    return new TestWaitCheck(directory, new RepositoryFiles(directory, new Git(directory, new ProcessRunner())));
  }
}

TestWaitCheckTests.register();
