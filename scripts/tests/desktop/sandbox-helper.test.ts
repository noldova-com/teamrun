/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import SandboxHelper from "../../desktop/sandbox-helper.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class SandboxHelperTests {
  private static readonly EXECUTABLE: string = path.resolve("development app", "fixture-studio");
  private static readonly HELPER: string = path.join(path.dirname(SandboxHelperTests.EXECUTABLE), "chrome-sandbox");
  private static readonly ROOT: number = 0;
  private static readonly PERSON: number = 1000;
  private static readonly CONFIGURED: number = 0o104755;
  private static readonly INSTALLED: number = 0o100755;

  public static register(): void {
    test("each kind of restricted user namespaces asks for the helper's setup", async () => {
      const restrictions: readonly (readonly [string, string])[] = [
        ["/proc/sys/kernel/apparmor_restrict_unprivileged_userns", "1\n"],
        ["/proc/sys/kernel/unprivileged_userns_clone", "0\n"],
        ["/proc/sys/user/max_user_namespaces", "0\n"]
      ];

      for (const [file, value] of restrictions) {
        const problem = await SandboxHelperTests.create("linux", { [file]: value }, SandboxHelperTests.PERSON, SandboxHelperTests.INSTALLED)
          .findProblemAsync(SandboxHelperTests.EXECUTABLE);

        assert.equal(problem, [
          "This system restricts unprivileged user namespaces, so Chromium's sandbox needs its helper owned by root with the setuid bit. Set it up once:",
          `  sudo chown root:root '${SandboxHelperTests.HELPER}' && sudo chmod 4755 '${SandboxHelperTests.HELPER}'`,
          "Then run npm start again. Preparing the development app again, after a change to Electron, the version or the icons, needs the step again.",
          ""
        ].join("\n"), file);
      }
    });

    test("a helper owned by root without the setuid bit, or with it but another owner, still needs the setup", async () => {
      const restricted = { "/proc/sys/kernel/apparmor_restrict_unprivileged_userns": "1" };

      for (const [uid, mode] of [[SandboxHelperTests.ROOT, SandboxHelperTests.INSTALLED], [SandboxHelperTests.PERSON, SandboxHelperTests.CONFIGURED]] as const)
        assert.notEqual(await SandboxHelperTests.create("linux", restricted, uid, mode).findProblemAsync(SandboxHelperTests.EXECUTABLE), null, `${uid} ${mode}`);
    });

    test("a configured helper, an open system, a missing helper and other systems start without a word", async () => {
      const restricted = { "/proc/sys/kernel/apparmor_restrict_unprivileged_userns": "1" };
      const open = {
        "/proc/sys/kernel/apparmor_restrict_unprivileged_userns": "0",
        "/proc/sys/kernel/unprivileged_userns_clone": "1",
        "/proc/sys/user/max_user_namespaces": "63000"
      };
      const cases: readonly [string, SandboxHelper][] = [
        ["configured", SandboxHelperTests.create("linux", restricted, SandboxHelperTests.ROOT, SandboxHelperTests.CONFIGURED)],
        ["open", SandboxHelperTests.create("linux", open, SandboxHelperTests.PERSON, SandboxHelperTests.INSTALLED)],
        ["nothing to read", SandboxHelperTests.create("linux", {}, SandboxHelperTests.PERSON, SandboxHelperTests.INSTALLED)],
        ["missing helper", new SandboxHelper("linux", async () => "1", async () => null)],
        ["Windows", SandboxHelperTests.create("win32", restricted, SandboxHelperTests.PERSON, SandboxHelperTests.INSTALLED)],
        ["macOS", SandboxHelperTests.create("darwin", restricted, SandboxHelperTests.PERSON, SandboxHelperTests.INSTALLED)]
      ];

      for (const [name, sandbox] of cases)
        assert.equal(await sandbox.findProblemAsync(SandboxHelperTests.EXECUTABLE), null, name);
    });

    test("a helper's path with a quote stays one shell word", async () => {
      const executable = path.resolve("it's here", "fixture-studio");
      const restricted = { "/proc/sys/kernel/apparmor_restrict_unprivileged_userns": "1" };

      const problem = await SandboxHelperTests.create("linux", restricted, SandboxHelperTests.PERSON, SandboxHelperTests.INSTALLED).findProblemAsync(executable);

      const helper = path.join(path.dirname(executable), "chrome-sandbox");
      assert.ok(problem?.includes(`sudo chmod 4755 '${helper.replaceAll("'", "'\\''")}'`), problem ?? "");
    });

    test("the system's own files are read when present and read as absent otherwise", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ "restriction": "1\n" });
      const present = path.join(repository.directory, "restriction");
      const missing = path.join(repository.directory, "missing");

      assert.equal(await SandboxHelper.readOptionalTextAsync(present), "1\n");
      assert.equal(await SandboxHelper.readOptionalTextAsync(missing), null);
      assert.equal((await SandboxHelper.statOptionalAsync(present))?.isFile(), true);
      assert.equal(await SandboxHelper.statOptionalAsync(missing), null);
    });
  }

  private static create(platform: string, files: Readonly<Record<string, string>>, uid: number, mode: number): SandboxHelper {
    return new SandboxHelper(platform, async t => files[t] ?? null, async () => ({ uid, mode }));
  }
}

SandboxHelperTests.register();
