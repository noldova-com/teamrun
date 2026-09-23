/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import WindowsInstallerPolicy from "../../packaging/windows-installer-policy.ts";

class WindowsInstallerPolicyTests {
  public static register(): void {
    test("writes the NSIS customization hooks for installation scope and updates", async t => {
      const directory = await mkdtemp(join(tmpdir(), "teamrun-installer-policy-"));
      t.after(() => rm(directory, { recursive: true, force: true }));
      const file = join(directory, "nested", "policy.nsh");
      await WindowsInstallerPolicy.write(file);
      const policy = await readFile(file, "utf8");
      assert.match(policy, /!macro customInit/);
      assert.match(policy, /!macro customInstallMode/);
      assert.match(policy, /\$hasPerMachineInstallation/);
      assert.match(policy, /\$hasPerUserInstallation/);
      assert.match(policy, /SetErrorLevel 2/);
      assert.match(policy, /SetSilent silent/);
      assert.match(policy, /StrCpy \$isForceCurrentInstall "1"/);
    });
  }
}

WindowsInstallerPolicyTests.register();
