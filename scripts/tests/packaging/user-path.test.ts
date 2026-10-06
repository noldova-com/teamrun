/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import PackagingException from "../../packaging/packaging.exception.ts";
import UserPath from "../../packaging/user-path.ts";
import ProcessResult from "../../processes/process-result.ts";
import ProcessRunner from "../../processes/process-runner.ts";

class RegistryRunnerFixture extends ProcessRunner {
  private readonly result: ProcessResult;

  public readonly calls: (readonly string[])[] = [];

  public constructor(result: ProcessResult) {
    super();

    this.result = result;
  }

  public override async captureAsync(command: string, commandArguments: readonly string[], directory: string, timeout: number): Promise<ProcessResult> {
    this.calls.push([command, ...commandArguments, directory, String(timeout)]);
    return this.result;
  }
}

class UserPathTests {
  public static register(): void {
    test("the user's Path is read from the registry as it is stored, empty or not", async () => {
      const stored = new RegistryRunnerFixture(new ProcessResult(0, "\r\nHKEY_CURRENT_USER\\Environment\r\n    Path    REG_EXPAND_SZ    %USERPROFILE%\\bin;C:\\Tools\r\n\r\n", ""));
      const plain = new RegistryRunnerFixture(new ProcessResult(0, "\r\nHKEY_CURRENT_USER\\Environment\r\n    PATH    REG_SZ    \r\n\r\n", ""));

      assert.equal(await new UserPath(stored, "folder").readAsync(), "%USERPROFILE%\\bin;C:\\Tools");
      assert.equal(await new UserPath(plain, "folder").readAsync(), "");
      assert.deepEqual(stored.calls, [["reg.exe", "query", "HKCU\\Environment", "/v", "Path", "folder", "30000"]]);
    });

    test("a user without a Path has none, and a query that fails or answers without the value is refused with its output", async () => {
      const missing = new RegistryRunnerFixture(new ProcessResult(1, "", "ERROR: The system was unable to find the specified registry key or value."));
      const denied = new RegistryRunnerFixture(new ProcessResult(5, "", "ERROR: Access is denied."));
      const other = new RegistryRunnerFixture(new ProcessResult(0, "    Other    REG_SZ    x\r\n", ""));

      assert.equal(await new UserPath(missing, "folder").readAsync(), null);
      await assert.rejects(new UserPath(denied, "folder").readAsync(),
        new PackagingException("reg.exe query HKCU\\Environment /v Path did not answer with the user's Path; it exited with 5:\nERROR: Access is denied."));
      await assert.rejects(new UserPath(other, "folder").readAsync(),
        new PackagingException("reg.exe query HKCU\\Environment /v Path did not answer with the user's Path; it exited with 0:\nOther    REG_SZ    x"));
    });

    test("an entry is counted whatever its case, and a missing Path holds none", () => {
      assert.equal(UserPath.count("C:\\Tools;c:\\programs\\bin;C:\\Programs\\bin;C:\\Programs\\bin\\more", "C:\\Programs\\bin"), 2);
      assert.equal(UserPath.count(null, "C:\\Programs\\bin"), 0);
    });
  }
}

UserPathTests.register();
