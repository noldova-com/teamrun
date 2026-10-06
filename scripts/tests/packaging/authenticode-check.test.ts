/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import AuthenticodeCheck from "../../packaging/authenticode-check.ts";
import PackagingException from "../../packaging/packaging.exception.ts";
import ProcessResult from "../../processes/process-result.ts";
import ProcessRunnerFixture from "../fixtures/process-runner.fixture.ts";

class AuthenticodeCheckTests {
  private static readonly PUBLISHER: string = "CN=Fixture Works, O=Fixture Works, C=US";
  private static readonly FILES: readonly string[] = ["C:\\out\\Fixture Studio-windows-x64.exe", "C:\\out\\win-unpacked\\Fixture Studio.exe"];

  public static register(): void {
    test("every file's Authenticode signature is read by PowerShell 7, which requires it valid, timestamped and from every field of the publisher, and its lines are returned",
      async () => {
        const lines = "C:\\out\\Fixture Studio-windows-x64.exe: Valid, timestamped: True, publisher matches: True, signer: CN=Fixture Works, O=Fixture Works, C=US\r\n";
        const runner = new ProcessRunnerFixture([], [new ProcessResult(0, lines, "")]);

        const report = await new AuthenticodeCheck(runner, "C:\\repository", { PATH: "fixture-path" }).verifyAsync(AuthenticodeCheckTests.FILES, AuthenticodeCheckTests.PUBLISHER);

        const [command, directory, ...options] = runner.captured[0] ?? [];
        const script = Buffer.from(String(options.at(-1)), "base64").toString("utf16le");
        assert.equal(report, lines.trim());
        assert.deepEqual([command, directory, ...options.slice(0, -1)], ["pwsh", "C:\\repository", "-NoProfile", "-NonInteractive", "-EncodedCommand"]);
        assert.deepEqual(runner.captureEnvironments, [{
          PATH: "fixture-path",
          TEAMRUN_SIGNED_FILES: AuthenticodeCheckTests.FILES.join("\n"),
          TEAMRUN_WINDOWS_PUBLISHER: AuthenticodeCheckTests.PUBLISHER
        }]);
        assert.ok(script.includes("$signature = Microsoft.PowerShell.Security\\Get-AuthenticodeSignature -LiteralPath $file\n"));
        assert.ok(script.includes("  if ($signature.Status -ne 'Valid' -or -not $timestamped -or -not $published) { $failed = $true }\n"));
      });

    test("a file that fails the check fails it with every file's line", async () => {
      const lines = "C:\\out\\win-unpacked\\Fixture Studio.exe: NotSigned, timestamped: False, publisher matches: False, signer: ";
      const runner = new ProcessRunnerFixture([], [new ProcessResult(1, lines, "")]);

      await assert.rejects(new AuthenticodeCheck(runner, "C:\\repository", {}).verifyAsync(AuthenticodeCheckTests.FILES, AuthenticodeCheckTests.PUBLISHER),
        new PackagingException(`Not every file is signed by ${AuthenticodeCheckTests.PUBLISHER} with a valid, timestamped signature; pwsh exited with 1:\n${lines.trim()}`));
    });
  }
}

AuthenticodeCheckTests.register();
