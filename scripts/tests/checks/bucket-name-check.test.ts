/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import BucketNameCheck from "../../checks/bucket-name-check.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import Git from "../../repository/git.ts";
import RepositoryFiles from "../../repository/repository-files.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class BucketNameCheckTests {
  public static register(): void {
    test("named concepts pass, including domain terms that only contain a bucket word", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "src/foundation/core/src/services/common-ancestor.reader.ts": "export default class CommonAncestorReader {}\n",
        "src/shell/ui/src/app/components/utility-bar/utility-bar.component.ts": "export class UtilityBarComponent {}\n",
        "scripts/shared-memory.ts": "export type SharedMemory = string;\n",
        "README.md": "# TeamRun\n"
      });
      const output = new TextOutputFixture();

      const check = BucketNameCheckTests.createCheck(repository);

      assert.equal(await check.runAsync(output), true);
      assert.equal(output.text, "Checked the paths of 4 files and the types of 3 scripts for bucket names.\n");
      assert.equal(check.title, "Bucket names");
    });

    test("a folder, a file, a part of a file name or a type that ends in a bucket word fails with where it is", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "src/shell/runtime/src/common/clock.ts": "export default class Clock {}\n",
        "scripts/string-utils.ts": "export default class Strings {}\n",
        "scripts/Misc.ts": "export {};\n",
        "scripts/text.helper.ts": "export {};\n",
        "scripts/types.ts": [
          "export default class SandboxHelper {}",
          "  export interface IStringUtils {}",
          "declare abstract class FormatUtility {}",
          "export type utility = string;",
          "enum Kind { A = \"A\" }",
          ""
        ].join("\n")
      });
      const output = new TextOutputFixture();

      assert.equal(await BucketNameCheckTests.createCheck(repository).runAsync(output), false);
      const rule = "; CODING-STANDARDS.md section 1 asks for a named concept instead of a helper, util, utility, common, shared or misc bucket.";
      assert.equal(output.text, [
        `scripts/Misc.ts: the name "Misc.ts" ends in a bucket word${rule}`,
        `scripts/string-utils.ts: the name "string-utils.ts" ends in a bucket word${rule}`,
        `scripts/text.helper.ts: the name "text.helper.ts" ends in a bucket word${rule}`,
        `src/shell/runtime/src/common/clock.ts: the name "common" ends in a bucket word${rule}`,
        `scripts/types.ts:1: the type SandboxHelper ends in a bucket word${rule}`,
        `scripts/types.ts:2: the type IStringUtils ends in a bucket word${rule}`,
        `scripts/types.ts:3: the type FormatUtility ends in a bucket word${rule}`,
        `scripts/types.ts:4: the type utility ends in a bucket word${rule}`,
        "Checked the paths of 5 files and the types of 5 scripts for bucket names.",
        ""
      ].join("\n"));
    });
  }

  private static createCheck(repository: RepositoryFixture): BucketNameCheck {
    const directory = repository.directory;
    return new BucketNameCheck(directory, new RepositoryFiles(directory, new Git(directory, new ProcessRunner())));
  }
}

BucketNameCheckTests.register();
