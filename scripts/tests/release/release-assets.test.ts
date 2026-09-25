/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { cp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import ReleaseAssets from "../../release/release-assets.ts";
import ReleaseFixture from "./fixtures/release.fixture.ts";

class ReleaseAssetsTests {
  public static register(): void {
    test("verifies all six targets and creates collision-free update metadata and checksums", async t => {
      for (const version of ["0.0.1", "0.0.2"]) {
        const fixture = await ReleaseFixture.create(version);
        t.after(() => fixture.close());
        await fixture.seed();
        const files = await new ReleaseAssets(fixture.candidate).prepare(fixture.input, fixture.output);
        assert.equal(files.length, 25);
        assert.equal(new Set(files.map(t => t.name)).size, files.length);
        const checksums = await readFile(path.join(fixture.output, "SHA256SUMS"), "utf8");
        for (const file of files.filter(t => t.name !== "SHA256SUMS"))
          assert.ok(checksums.includes(`${file.sha256}  ${file.name}\n`));
        const entry = (suffix: string): object => {
          const file = files.find(t => t.name === `TeamRun-${version}-${suffix}`);
          assert.ok(file);
          return { url: `https://github.com/noldova-com/teamrun/releases/download/v${version}/${file.name}`, sha512: file.sha512, size: file.size };
        };
        const updateInfo = new Map([
          ["latest.yml", ["windows-arm64-setup.exe", "windows-x64-setup.exe"]],
          ["latest-mac.yml", ["mac-arm64.zip", "mac-x64.zip"]],
          ["latest-linux.yml", ["linux-x64.AppImage"]],
          ["latest-linux-arm64.yml", ["linux-arm64.AppImage"]]
        ]);
        assert.deepEqual(files.filter(t => t.name.endsWith(".yml")).map(t => t.name), [...updateInfo.keys()].sort());
        for (const [name, suffixes] of updateInfo)
          assert.deepEqual(JSON.parse(await readFile(path.join(fixture.output, name), "utf8")), { version, files: suffixes.map(entry) });
        await assert.rejects(new ReleaseAssets(fixture.candidate).prepare(fixture.input, fixture.output), /staging must be empty/);
      }
    });

    test("rejects mismatched reports, targets, corrupt bytes, unexpected files and unsafe paths", async t => {
      const fixture = await ReleaseFixture.create();
      t.after(() => fixture.close());
      const prepare = (): Promise<unknown> => new ReleaseAssets(fixture.candidate).prepare(fixture.input, fixture.output);
      await fixture.seed();
      const valid = await fixture.readReport();
      const malformed: unknown[] = [null, 1];
      for (const key of ["version", "sourceRevision", "targetPlatform", "targetArchitecture", "hostPlatform", "hostArchitecture", "signingRequested", "files"]) {
        const missing = { ...valid };
        delete missing[key];
        malformed.push(missing);
      }
      for (const [key, value] of [["version", "wrong"], ["sourceRevision", "wrong"], ["targetPlatform", 2], ["targetPlatform", "invalid"],
        ["targetArchitecture", 2], ["targetArchitecture", "ia32"], ["hostPlatform", "linux"], ["hostArchitecture", "arm64"],
        ["signingRequested", true], ["files", {}]] as const)
        malformed.push({ ...valid, [key]: value });
      for (const report of malformed) {
        await fixture.seed();
        await fixture.writeReport(report);
        await assert.rejects(prepare(), /report does not match/);
      }
      assert.ok(Array.isArray(valid["files"]));
      const entries: unknown[] = valid["files"];
      const first = entries[0];
      assert.ok(typeof first === "object" && first !== null);
      for (const entry of [null, 1, {}, { ...first, name: 1 }, { ...first, name: "../../secret" },
        { ...first, size: -1 }, { ...first, sha256: "wrong" }]) {
        await fixture.seed();
        await fixture.writeReport({ ...valid, files: [entry] });
        await assert.rejects(prepare(), /payload/);
      }
      for (const key of ["size", "sha256"]) {
        await fixture.seed();
        const entry: Record<string, unknown> = { ...first };
        delete entry[key];
        await fixture.writeReport({ ...valid, files: [entry] });
        await assert.rejects(prepare(), /payload/);
      }
      await fixture.seed();
      await fixture.writeReport({ ...valid, files: [first, first] });
      await assert.rejects(prepare(), /duplicated/);
      for (const files of [[], entries.slice(1), [first]]) {
        await fixture.seed();
        await fixture.writeReport({ ...valid, files });
        await assert.rejects(prepare(), /Missing/);
      }
      await fixture.seed();
      await writeFile(path.join(fixture.input, "windows-x64/extra"), "extra");
      await assert.rejects(prepare(), /unexpected files/);
      await fixture.seed();
      await writeFile(path.join(fixture.input, "windows-x64", `TeamRun-${fixture.candidate.version.value}-windows-x64-setup.exe`), "corrupt");
      await assert.rejects(prepare(), /does not match/);
      await fixture.seed();
      await rm(path.join(fixture.input, "windows-arm64"), { recursive: true });
      await assert.rejects(prepare(), /six build artifacts/);
      await writeFile(path.join(fixture.input, "not-directory"), "wrong");
      await assert.rejects(prepare(), /artifact directories/);
      await fixture.seed();
      await rename(path.join(fixture.input, "windows-x64/package-report-windows-x64.json"), path.join(fixture.input, "windows-x64/renamed.json"));
      await assert.rejects(prepare(), /one package report/);
      await fixture.seed();
      await cp(path.join(fixture.input, "windows-x64/package-report-windows-x64.json"), path.join(fixture.input, "windows-x64/package-report-windows-arm64.json"));
      await assert.rejects(prepare(), /one package report/);
      await fixture.seed();
      await rename(path.join(fixture.input, "windows-x64/package-report-windows-x64.json"), path.join(fixture.input, "windows-x64/package-report-windows-arm64.json"));
      await assert.rejects(prepare(), /mismatched package report name/);
      await fixture.seed();
      await rm(path.join(fixture.input, "windows-arm64"), { recursive: true });
      await cp(path.join(fixture.input, "windows-x64"), path.join(fixture.input, "duplicate"), { recursive: true });
      await assert.rejects(prepare(), /Duplicate target/);
      await fixture.seed();
      await mkdir(fixture.output);
      await writeFile(path.join(fixture.output, "keep"), "do not overwrite");
      await assert.rejects(prepare(), /staging must be empty/);
    });
  }
}

ReleaseAssetsTests.register();
