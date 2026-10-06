/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";

import PackageTarget from "../../packaging/package-target.ts";
import ReleaseException from "../../release/release.exception.ts";
import ReleaseReports from "../../release/release-reports.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class ReleaseReportsTests {
  private static readonly SIGNED: readonly string[] = ["windows", "macos"];
  private static readonly FAILED: string = "The package reports do not match the release's signing, so nothing was published:\n";

  public static register(): void {
    test("one report per target whose signing matches the release passes, signed or not", async t => {
      const signed = await ReleaseReportsTests.createAsync(t, ReleaseReportsTests.SIGNED);
      const unsigned = await ReleaseReportsTests.createAsync(t, []);

      assert.equal(await new ReleaseReports(ReleaseReportsTests.SIGNED).verifyAsync(signed),
        "Every target has one package report, and the signed ones were signed and checked: windows, macos.");
      assert.equal(await new ReleaseReports([]).verifyAsync(unsigned), "Every target has one package report, and the signed ones were signed and checked: none.");
    });

    test("a missing report, an extra one and one for an unknown target are each named", async t => {
      const folder = await ReleaseReportsTests.createAsync(t, []);
      await ReleaseReportsTests.writeAsync(folder, {
        "reports/report-linux-x64/package-report.json": null,
        "reports/report-windows-x64-again/package-report.json": ReleaseReportsTests.format("windows-x64", false, false),
        "reports/report-freebsd-x64/package-report.json": ReleaseReportsTests.format("freebsd-x64", false, false)
      });

      await assert.rejects(new ReleaseReports([]).verifyAsync(folder), new ReleaseException(`${ReleaseReportsTests.FAILED}report-linux-x64 holds no package report.\n`
        + "A package report covers freebsd-x64, which is not a target.\n2 package reports cover windows-x64.\nNo package report covers linux-x64."));
    });

    test("a report signed where the release does not sign, unsigned where it signs, signed but not checked, or marked checked while unsigned is named", async t => {
      const folder = await ReleaseReportsTests.createAsync(t, ["windows"]);
      await ReleaseReportsTests.writeAsync(folder, {
        "reports/report-windows-arm64/package-report.json": ReleaseReportsTests.format("windows-arm64", true, false),
        "reports/report-linux-x64/package-report.json": ReleaseReportsTests.format("linux-x64", false, true)
      });

      await assert.rejects(new ReleaseReports(["macos"]).verifyAsync(folder), new ReleaseException(`${ReleaseReportsTests.FAILED}`
        + "The windows-x64 package was signed and checked, but the release does not sign windows packages.\n"
        + "The windows-arm64 package was signed but not checked, but the release does not sign windows packages.\n"
        + "The macos-x64 package was unsigned, but the release signs macos packages.\n"
        + "The macos-arm64 package was unsigned, but the release signs macos packages.\n"
        + "The linux-x64 package was unsigned but marked checked, but the release does not sign linux packages."));
    });

    test("a file in place of a report folder, a report that is not JSON, not a report or cannot be read, and a folder that cannot be read are refused", async t => {
      const folder = await ReleaseReportsTests.createAsync(t, []);
      await ReleaseReportsTests.writeAsync(folder, {
        "reports/notes.txt": "notes",
        "reports/report-linux-x64/package-report.json": "{",
        "reports/report-linux-arm64/package-report.json": "[]",
        "reports/report-macos-x64/package-report.json": null
      });
      await mkdir(path.join(folder, "report-macos-x64", "package-report.json"));

      await assert.rejects(new ReleaseReports([]).verifyAsync(folder), new ReleaseException(`${ReleaseReportsTests.FAILED}notes.txt holds no package report.\n`
        + "report-linux-arm64 holds no package report.\nreport-linux-x64 holds no package report.\nreport-macos-x64's package report cannot be read.\n"
        + "No package report covers macos-x64.\nNo package report covers linux-x64.\nNo package report covers linux-arm64."));
      await assert.rejects(new ReleaseReports([]).verifyAsync(path.join(folder, "missing")), new ReleaseException(`The package reports in ${path.join(folder, "missing")} cannot be read.`));
    });
  }

  private static format(target: string, isSigned: boolean, isChecked: boolean): string {
    return JSON.stringify({ target, signed: isSigned, checked: isChecked });
  }

  private static async createAsync(t: TestContext, signed: readonly string[]): Promise<string> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    await repository.writeAsync(Object.fromEntries(PackageTarget.listAll().map(t => [`reports/report-${t.id}/package-report.json`,
      ReleaseReportsTests.format(t.id, signed.includes(t.platform), signed.includes(t.platform))])));
    return path.join(repository.directory, "reports");
  }

  private static async writeAsync(folder: string, files: Readonly<Record<string, string | null>>): Promise<void> {
    for (const [name, text] of Object.entries(files)) {
      const file = path.join(path.dirname(folder), name);
      if (text === null) {
        await rm(file);
        continue;
      }
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, text);
    }
  }
}

ReleaseReportsTests.register();
