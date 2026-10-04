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
  private static readonly ATOMICS_WAIT: string = "Atomics.wait";
  private static readonly PAGE_WAIT: string = "page.waitForTimeout";
  private static readonly DELAY_IMPORT: string = `import { ${TestWaitCheckTests.TIMER} as delay } from "${TestWaitCheckTests.TIMERS}";\n`;
  private static readonly RULE: string = ": pauses for a fixed time; wait for the condition with Wait.untilAsync from @noldova/teamrun-foundation-testing, or list the file with its reason in TESTING.md section 3.";

  public static register(): void {
    test("listed test files may pause, and deadlines, waits for conditions, strings and other files are not pauses", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "docs/TESTING.md": [
          "# Testing",
          "",
          "| Test file | Why it pauses |",
          "|---|---|",
          "| `src/shell/desktop/tests/fixtures/condition.fixture.ts` | The poll interval of its bounded wait. |",
          "| not a file | A row that names no file is not an entry. |",
          "| `scripts/tests/fixtures/repository.fixture.ts` | Between bounded attempts to remove a folder. |"
        ].join("\n"),
        "src/shell/desktop/tests/fixtures/condition.fixture.ts": TestWaitCheckTests.DELAY_IMPORT,
        "scripts/tests/fixtures/repository.fixture.ts": `await new Promise(resolve => ${TestWaitCheckTests.TIMER}(resolve, 50));\n`,
        "src/shell/runtime/tests/services/host.test.ts": [
          `const limit = ${TestWaitCheckTests.TIMER}(() => arrival.resolve(), HostTests.ANSWER_TIMEOUT);`,
          "test.setTimeout(90_000);",
          "this.testInfo.setTimeout(this.testInfo.timeout + 10);",
          "await page.waitForFunction(() => ready);",
          `const script = "say \\"hi\\"; ${TestWaitCheckTests.TIMER}(() => {}, 300)";`,
          `const quoted = 'it\\'s'; const template = \`${TestWaitCheckTests.TIMER}(() => {}, 300)\`;`,
          `import { setImmediate } from "${TestWaitCheckTests.TIMERS}";`,
          ""
        ].join("\n"),
        "src/shell/runtime/src/services/host.ts": TestWaitCheckTests.DELAY_IMPORT,
        "scripts/build.ts": TestWaitCheckTests.DELAY_IMPORT,
        "src/shell/desktop/tests/e2e/notes.md": `await ${TestWaitCheckTests.PAGE_WAIT}(100);\n`
      });
      const output = new TextOutputFixture();

      const check = TestWaitCheckTests.createCheck(repository);

      assert.equal(await check.runAsync(output), true);
      assert.equal(output.text, "Checked 3 test files for fixed pauses; 2 may pause.\n");
      assert.equal(check.title, "Test waits");
    });

    test("each form of fixed pause in an unlisted test file fails with its line, and so does a listed file that no longer pauses", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "docs/TESTING.md": "# Testing\n\n| Test file | Why it pauses |\n|---|---|\n| `src/shell/ui/tests/fixtures/calm.fixture.ts` | It used to pause. |\n\nMore text.\n",
        "src/shell/ui/tests/fixtures/calm.fixture.ts": "export const calm = true;\n",
        "src/shell/runtime/tests/services/host.test.ts": [
          "import {",
          "  setImmediate,",
          `  ${TestWaitCheckTests.TIMER} as delay`,
          "} from \"timers/promises\";",
          `import * as timers from "${TestWaitCheckTests.TIMERS}";`,
          `await ${TestWaitCheckTests.SCHEDULER_WAIT}(100);`,
          `${TestWaitCheckTests.ATOMICS_WAIT}(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 15_000);`,
          `await new Promise<void>(t => ${TestWaitCheckTests.TIMER}(t, 60_000));`,
          `await new Promise(resolve => ${TestWaitCheckTests.TIMER}(() => resolve(), HostTests.DELAY));`,
          `const release = ${TestWaitCheckTests.TIMER}(() => lock.release(), 200);`,
          ""
        ].join("\n"),
        "src/modules/notes/e2e/notes.spec.ts": `await ${TestWaitCheckTests.PAGE_WAIT}(100);\n`,
        "scripts/tests/build.test.ts": `import { ${TestWaitCheckTests.TIMER} } from '${TestWaitCheckTests.TIMERS}';\n`
      });
      const output = new TextOutputFixture();

      assert.equal(await TestWaitCheckTests.createCheck(repository).runAsync(output), false);
      assert.equal(output.text, [
        ...["scripts/tests/build.test.ts:1", "src/modules/notes/e2e/notes.spec.ts:1"].map(t => `${t}${TestWaitCheckTests.RULE}`),
        ...[1, 5, 6, 7, 8, 9, 10].map(t => `src/shell/runtime/tests/services/host.test.ts:${t}${TestWaitCheckTests.RULE}`),
        "docs/TESTING.md:5: lists src/shell/ui/tests/fixtures/calm.fixture.ts, which no longer pauses for a fixed time; remove its row.",
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
