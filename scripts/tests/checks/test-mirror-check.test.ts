/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import TestMirrorCheck from "../../checks/test-mirror-check.ts";
import PackageException from "../../packages/package.exception.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import Git from "../../repository/git.ts";
import RepositoryFiles from "../../repository/repository-files.ts";
import SourceTree from "../../structure/source-tree.ts";
import TypeStripper from "../../structure/type-stripper.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class TestMirrorCheckTests {
  private static readonly CLASS: string = "export class Clock {\n  public tick(): number {\n    return 1;\n  }\n}\n";
  private static readonly RULE: string = "CODING-STANDARDS.md section 13";

  public static register(): void {
    test("mirrored executable files pass, and declarations, enums, exclusions, fixtures, workflows and files outside a package's src need no mirror", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "src/foundation/clock/package.json": JSON.stringify({
          name: "@noldova/teamrun-foundation-clock",
          version: "__VERSION__",
          teamrun: { coverageExclusions: [{ file: "main.ts", reason: "Runs only inside Electron." }, "entry.ts"] }
        }),
        "src/foundation/clock/src/services/clock.ts": TestMirrorCheckTests.CLASS,
        "src/foundation/clock/tests/services/clock.test.ts": TestMirrorCheckTests.CLASS,
        "src/foundation/clock/src/legacy.cts": "export const tick = (): number => 1;\n",
        "src/foundation/clock/tests/legacy.test.ts": TestMirrorCheckTests.CLASS,
        "src/foundation/clock/src/interfaces/i-clock.ts": "export interface IClock {\n  tick: () => number;\n  read(): { value: number };\n}\n",
        "src/foundation/clock/src/enums/side.ts": "export enum Side {\n  Left = \"Left\",\n  Right = \"Right\"\n}\n",
        "src/foundation/clock/src/api/index.d.ts": "export declare function tick(): number;\n",
        "src/foundation/clock/src/main.ts": TestMirrorCheckTests.CLASS,
        "src/foundation/clock/src/entry.ts": "export const value = 1;\n",
        "src/foundation/clock/tests/fixtures/clock.fixture.test.ts": TestMirrorCheckTests.CLASS,
        "src/foundation/clock/tests/test-setup.ts": TestMirrorCheckTests.CLASS,
        "src/shell/ui/src/app/button.component.ts": TestMirrorCheckTests.CLASS,
        "src/shell/ui/tests/app/button.component.spec.ts": TestMirrorCheckTests.CLASS,
        "src/shell/ui/src/styles/kit.scss": ".tr-button {\n  color: red;\n}\n",
        "src/shell/ui/tests/styles/kit.spec.ts": TestMirrorCheckTests.CLASS,
        "src/shell/desktop/src/app.ts": "export const name = \"TeamRun\";\n",
        "src/shell/desktop/electron.config.ts": TestMirrorCheckTests.CLASS,
        "src/shell/desktop/tests/e2e/launch.spec.ts": TestMirrorCheckTests.CLASS,
        "src/shell/desktop/tests/e2e/fixtures/modules/clock/window/src/face.ts": TestMirrorCheckTests.CLASS,
        "src/eslint.config.js": "export default () => [];\n"
      });
      const output = new TextOutputFixture();

      const check = TestMirrorCheckTests.createCheck(repository);

      assert.equal(await check.runAsync(output), true);
      assert.equal(output.text, "Checked 7 production files and 4 tests in 3 packages.\n");
      assert.equal(check.title, "Test mirrors");
    });

    test("an executable file without its mirror, and a test or spec that mirrors no file, fail with what was expected", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "src/foundation/clock/src/services/clock.ts": TestMirrorCheckTests.CLASS,
        "src/foundation/clock/tests/services/timer.test.ts": TestMirrorCheckTests.CLASS,
        "src/shell/window/src/app/models/row.ts": "export class Row {\n  public constructor(title: string) {\n    console.log(title);\n  }\n}\n",
        "src/shell/window/tests/app/models/old-row.spec.ts": TestMirrorCheckTests.CLASS,
        "src/modules/notes/window/src/view.ts": "export const show = function (): void {};\n"
      });
      const output = new TextOutputFixture();

      assert.equal(await TestMirrorCheckTests.createCheck(repository).runAsync(output), false);
      assert.equal(output.text, [
        `src/foundation/clock/src/services/clock.ts: has a function body but no mirrored test src/foundation/clock/tests/services/clock.test.ts; ${TestMirrorCheckTests.RULE} gives every executable production file one.`,
        "src/foundation/clock/tests/services/timer.test.ts: mirrors no production file; "
        + `${TestMirrorCheckTests.RULE} has each test mirror one of src/foundation/clock/src/services/timer.ts, src/foundation/clock/src/services/timer.mts, src/foundation/clock/src/services/timer.cts.`,
        `src/modules/notes/window/src/view.ts: has a function body but no mirrored test src/modules/notes/window/tests/view.spec.ts; ${TestMirrorCheckTests.RULE} gives every executable production file one.`,
        `src/shell/window/src/app/models/row.ts: has a function body but no mirrored test src/shell/window/tests/app/models/row.spec.ts; ${TestMirrorCheckTests.RULE} gives every executable production file one.`,
        "src/shell/window/tests/app/models/old-row.spec.ts: mirrors no production file; "
        + `${TestMirrorCheckTests.RULE} has each test mirror one of src/shell/window/src/app/models/old-row.ts, src/shell/window/src/app/models/old-row.mts, `
        + "src/shell/window/src/app/models/old-row.cts, src/shell/window/src/app/models/old-row.scss.",
        "Checked 3 production files and 2 tests in 3 packages.",
        ""
      ].join("\n"));
    });

    test("a file whose types cannot be stripped, or a Node.js without the strip API, fails the check with the reason", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "src/foundation/clock/src/clock.ts": "export class Clock {\n  public constructor(private name: string) {\n  }\n}\n"
      });
      const stripFailure = new TextOutputFixture();
      const missingApi = new TextOutputFixture();

      const stripped = await TestMirrorCheckTests.createCheck(repository).runAsync(stripFailure);
      const unavailable = await TestMirrorCheckTests.createCheck(repository, new TypeStripper({})).runAsync(missingApi);

      assert.deepEqual([stripped, unavailable], [false, false]);
      assert.equal(stripFailure.text, "src/foundation/clock/src/clock.ts: module.stripTypeScriptTypes could not strip its types.\n");
      assert.equal(missingApi.text.startsWith("src/foundation/clock/src/clock.ts: this Node.js has no module.stripTypeScriptTypes"), true);
    });

    test("a package manifest that cannot be read stops the check", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "src/foundation/clock/package.json": "{",
        "src/foundation/clock/src/clock.ts": TestMirrorCheckTests.CLASS
      });

      await assert.rejects(TestMirrorCheckTests.createCheck(repository).runAsync(new TextOutputFixture()), PackageException);
    });
  }

  private static createCheck(repository: RepositoryFixture, stripper?: TypeStripper): TestMirrorCheck {
    const files = new RepositoryFiles(repository.directory, new Git(repository.directory, new ProcessRunner()));
    return new TestMirrorCheck(repository.directory, new SourceTree(repository.directory, files), stripper);
  }
}

TestMirrorCheckTests.register();
