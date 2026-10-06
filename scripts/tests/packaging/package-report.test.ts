/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import PackageReport from "../../packaging/package-report.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class PackageReportTests {
  public static register(): void {
    test("a report holds the target and whether its packages were signed and their signatures checked, and reads back as written", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const file = path.join(repository.directory, "package-report.json");

      await new PackageReport("macos-arm64", true, true).writeAsync(file);

      const text = await readFile(file, "utf8");
      assert.equal(text, "{\n  \"target\": \"macos-arm64\",\n  \"signed\": true,\n  \"checked\": true\n}\n");
      assert.deepEqual(PackageReport.parse(JSON.parse(text)), new PackageReport("macos-arm64", true, true));
    });

    test("anything but an object with exactly a text target and boolean signed and checked fields is no report", () => {
      const values: readonly unknown[] = [
        null, "report", 7, [], ["linux-x64", false, false],
        { target: "linux-x64", signed: false },
        { target: "linux-x64", signed: false, checked: false, extra: true },
        { target: 7, signed: false, checked: false },
        { target: "linux-x64", signed: "false", checked: false },
        { target: "linux-x64", signed: false, checked: null },
        { target: "linux-x64", signed: false, other: false }
      ];

      assert.deepEqual(values.map(t => PackageReport.parse(t)), values.map(() => null));
    });
  }
}

PackageReportTests.register();
