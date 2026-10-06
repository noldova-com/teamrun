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
import BucketNameCheck from "../../checks/bucket-name-check.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import Git from "../../repository/git.ts";
import RepositoryFiles from "../../repository/repository-files.ts";
import SyntaxTreeReader from "../../structure/syntax-tree.reader.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class BucketNameCheckTests {
  private static readonly TIMEOUT: number = 120_000;
  private static readonly RULE: string = "; CODING-STANDARDS.md section 1 asks for a named concept instead of a helper, util, utility, common, shared or misc bucket.";

  public static register(): void {
    test("named concepts and anonymous classes pass, including domain terms that only contain a bucket word and bucket words inside strings", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "src/foundation/core/src/services/common-ancestor.reader.ts": "export default class CommonAncestorReader {}\n",
        "src/shell/ui/src/app/components/utility-bar/utility-bar.component.ts": "export class UtilityBarComponent {}\n",
        "scripts/shared-memory.ts": [
          "export type SharedMemory = string;",
          "export const fixture = \"class SandboxHelper {}\";",
          "export const template = `",
          "interface IStringUtils {}",
          "`;",
          ""
        ].join("\n"),
        "scripts/anonymous.ts": "export default class {}\n",
        "README.md": "# TeamRun\n"
      });
      const output = new TextOutputFixture();

      const check = BucketNameCheckTests.createCheck(repository);

      assert.equal(await check.runAsync(output), true, output.text);
      assert.equal(output.text, "Checked the paths of 5 files and the types of 4 scripts for bucket names.\n");
      assert.equal(check.title, "Bucket names");
    });

    test("a folder, a file, a part of a file name, a type or an exported name that ends in a bucket word fails with where it is", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "src/shell/runtime/src/common/clock.ts": "export default class Clock {}\n",
        "scripts/string-utils.ts": "export default class Strings {}\n",
        "scripts/Misc.ts": "export {};\n",
        "scripts/text.helper.ts": "export {};\n",
        "scripts/types.ts": [
          "export default class SandboxHelper {}",
          "namespace Text {",
          "  export interface IStringUtils {}",
          "}",
          "declare abstract class FormatUtility {}",
          "export type utility = string;",
          "enum Kind { A = \"A\" }",
          "const Named = class TextHelpers {};",
          "class Reader {}",
          "export { Reader as ReaderCommon, Named };",
          ""
        ].join("\n")
      });
      const output = new TextOutputFixture();

      assert.equal(await BucketNameCheckTests.createCheck(repository).runAsync(output), false);
      const rule = BucketNameCheckTests.RULE;
      assert.equal(output.text, [
        `scripts/Misc.ts: the name "Misc.ts" ends in a bucket word${rule}`,
        `scripts/string-utils.ts: the name "string-utils.ts" ends in a bucket word${rule}`,
        `scripts/text.helper.ts: the name "text.helper.ts" ends in a bucket word${rule}`,
        `src/shell/runtime/src/common/clock.ts: the name "common" ends in a bucket word${rule}`,
        `scripts/types.ts:1: the name SandboxHelper ends in a bucket word${rule}`,
        `scripts/types.ts:3: the name IStringUtils ends in a bucket word${rule}`,
        `scripts/types.ts:5: the name FormatUtility ends in a bucket word${rule}`,
        `scripts/types.ts:6: the name utility ends in a bucket word${rule}`,
        `scripts/types.ts:8: the name TextHelpers ends in a bucket word${rule}`,
        `scripts/types.ts:10: the name ReaderCommon ends in a bucket word${rule}`,
        "Checked the paths of 5 files and the types of 5 scripts for bucket names.",
        ""
      ].join("\n"));
    });

    test("a TypeScript API that cannot start fails the check with its reason, and any other error reaches the caller", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ "scripts/clock.ts": "export default class Clock {}\n" });
      const output = new TextOutputFixture();
      const files = new RepositoryFiles(repository.directory, new Git(repository.directory, new ProcessRunner()));
      const stopping = new SyntaxTreeReader(repository.directory, [process.execPath, "-e", "process.exit(3)", "--"], BucketNameCheckTests.TIMEOUT);

      assert.equal(await new BucketNameCheck(files, stopping).runAsync(output), false);
      assert.match(output.text, /^The TypeScript API server could not open .+; after \d+ ms it had stopped\.\n(?:.*\n)*Checked the paths of 1 files and the types of 1 scripts for bucket names\.\n$/);

      const other = await RepositoryFixture.createAsync();
      t.after(() => other.disposeAsync());
      await other.writeAsync({ "scripts/clock.ts": "export default class Clock {}\n", "_build": "a file where the build folder belongs\n" });
      const blocked = BucketNameCheckTests.createCheck(other);
      await assert.rejects(blocked.runAsync(new TextOutputFixture()), { code: "ENOTDIR" });
    });
  }

  private static createCheck(repository: RepositoryFixture): BucketNameCheck {
    const directory = repository.directory;
    return new BucketNameCheck(new RepositoryFiles(directory, new Git(directory, new ProcessRunner())), new SyntaxTreeReader(directory, [ApiServer.locateCompiler()], BucketNameCheckTests.TIMEOUT));
  }
}

BucketNameCheckTests.register();
