/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test, type TestContext } from "node:test";

import LockedPackage from "../../packaging/locked-package.ts";
import PackagingException from "../../packaging/packaging.exception.ts";
import ThirdPartyPackage from "../../packaging/third-party-package.ts";
import TarballServerFixture from "../fixtures/tarball-server.fixture.ts";
import TarballFixture from "../fixtures/tarball.fixture.ts";

class ThirdPartyPackageTests {
  private static server: TarballServerFixture | null = null;

  public static register(): void {
    before(async () => {
      ThirdPartyPackageTests.server = await TarballServerFixture.startAsync();
    });
    after(() => ThirdPartyPackageTests.server?.disposeAsync());

    test("a package's tarball is downloaded from its locked URL, checked against its SHA-512, kept, and gives its license and license files", async t => {
      const server = ThirdPartyPackageTests.getServer();
      const folder = await ThirdPartyPackageTests.createFolderAsync(t);
      const data = TarballFixture.packFiles({ "package.json": "{\"name\":\"@scope/fixture\",\"license\":\"(MIT OR Apache-2.0)\"}", "LICENSE-MIT": "MIT text\n", "COPYING": " Copying text ", "index.js": "" });
      const locked = new LockedPackage("node_modules/@scope/fixture", server.lock("scoped.tgz", data, { version: "1.0.0" }));

      const prepared = await ThirdPartyPackage.prepareAsync(locked, path.join(folder, "third-party"), path.join(folder, "reviewed"));

      assert.equal(prepared.locked, locked);
      assert.equal(prepared.file, path.join(folder, "third-party", "@scope+fixture-1.0.0.tgz"));
      assert.deepEqual(await readFile(prepared.file), data);
      assert.equal(prepared.license.chosen, "MIT");
      assert.equal(prepared.licenseText, "Copying text\n\nMIT text");
      assert.equal(prepared.formatNotice(), "@scope/fixture@1.0.0\nLicense: MIT, chosen from \"(MIT OR Apache-2.0)\"\n\nCopying text\n\nMIT text\n");
      assert.deepEqual(server.requests.filter(u => u === "/scoped.tgz"), ["/scoped.tgz"]);
    });

    test("a kept tarball that matches is used without downloading it again, and one that does not is downloaded again", async t => {
      const server = ThirdPartyPackageTests.getServer();
      const folder = await ThirdPartyPackageTests.createFolderAsync(t);
      const data = ThirdPartyPackageTests.pack("MIT");
      const locked = new LockedPackage("node_modules/kept", server.lock("kept.tgz", data, { version: "2.0.0" }));
      await writeFile(path.join(folder, "kept-2.0.0.tgz"), data);

      const kept = await ThirdPartyPackage.prepareAsync(locked, folder, path.join(folder, "reviewed"));
      await writeFile(kept.file, "changed");
      const replaced = await ThirdPartyPackage.prepareAsync(locked, folder, path.join(folder, "reviewed"));

      assert.equal(kept.formatNotice(), "kept@2.0.0\nLicense: MIT\n\nLicense text\n");
      assert.deepEqual(await readFile(replaced.file), data);
      assert.deepEqual(server.requests.filter(u => u === "/kept.tgz"), ["/kept.tgz"]);
    });

    test("a tarball whose SHA-512 differs from the lockfile's is refused and not kept", async t => {
      const server = ThirdPartyPackageTests.getServer();
      const folder = await ThirdPartyPackageTests.createFolderAsync(t);
      const locked = new LockedPackage("node_modules/swapped", server.lock("swapped.tgz", ThirdPartyPackageTests.pack("MIT"), { version: "1.0.0" }));
      server.publish("swapped.tgz", ThirdPartyPackageTests.pack("ISC"));

      await assert.rejects(ThirdPartyPackage.prepareAsync(locked, folder, path.join(folder, "reviewed")),
        new PackagingException(`The tarball of swapped@1.0.0 from ${locked.resolved} does not match the SHA-512 integrity in package-lock.json, so it cannot ship.`));
      assert.equal(existsSync(path.join(folder, "swapped-1.0.0.tgz")), false);
    });

    test("a tarball that cannot be downloaded is refused with the URL and the reason", async t => {
      const server = ThirdPartyPackageTests.getServer();
      const folder = await ThirdPartyPackageTests.createFolderAsync(t);
      const missing = new LockedPackage("node_modules/missing", { version: "1.0.0", resolved: server.locate("missing.tgz"), integrity: "sha512-AAAA" });
      const closed = new LockedPackage("node_modules/closed", { version: "1.0.0", resolved: "http://127.0.0.1:9/closed.tgz", integrity: "sha512-AAAA" });

      await assert.rejects(ThirdPartyPackage.prepareAsync(missing, folder, path.join(folder, "reviewed")), new PackagingException(`missing@1.0.0 could not be downloaded from ${missing.resolved}: HTTP 404.`));
      await assert.rejects(ThirdPartyPackage.prepareAsync(closed, folder, path.join(folder, "reviewed")), (error: unknown) => {
        assert.ok(error instanceof PackagingException);
        assert.match(error.message, /^closed@1\.0\.0 could not be downloaded from http:\/\/127\.0\.0\.1:9\/closed\.tgz: /);
        return true;
      });
    });

    test("a package without a license, with one outside the list or without a license file is refused and named", async t => {
      const server = ThirdPartyPackageTests.getServer();
      const folder = await ThirdPartyPackageTests.createFolderAsync(t);
      const allowed = "one of MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, 0BSD, BlueOak-1.0.0, Python-2.0, or an OR expression with one of them";
      const cases: readonly (readonly [string, Buffer, string])[] = [
        ["unnamed", TarballFixture.packFiles({ "package.json": "{\"name\":\"unnamed\"}", "LICENSE": "text" }), `unnamed@1.0.0 names no license in its package.json; a third-party runtime package needs ${allowed}.`],
        ["bare", TarballFixture.packFiles({ "LICENSE": "text" }), `bare@1.0.0 names no license in its package.json; a third-party runtime package needs ${allowed}.`],
        ["listed", TarballFixture.packFiles({ "package.json": "null", "LICENSE": "text" }), `listed@1.0.0 names no license in its package.json; a third-party runtime package needs ${allowed}.`],
        ["copyleft", ThirdPartyPackageTests.pack("GPL-3.0-only"), `copyleft@1.0.0 is licensed under "GPL-3.0-only"; a third-party runtime package needs ${allowed}.`],
        ["unlicensed", TarballFixture.pack([{ name: "package/package.json", content: "{\"license\":\"MIT\"}" }, { name: "package/lib/LICENSE", content: "nested" }, { name: "package/README.md", content: "" }]),
          `unlicensed@1.0.0 has no license file in its tarball, such as LICENSE, LICENCE or COPYING, and ${path.join(folder, "reviewed", "unlicensed-1.0.0.txt")} holds no reviewed `
          + "license text for it, so its license cannot ship."]
      ];
      for (const [name, data, message] of cases)
        await assert.rejects(ThirdPartyPackage.prepareAsync(new LockedPackage(`node_modules/${name}`, server.lock(`${name}.tgz`, data, { version: "1.0.0" })), folder, path.join(folder, "reviewed")),
          new PackagingException(message));
    });

    test("a package whose tarball has no license file ships the reviewed text kept for its exact version, and another version of it is refused", async t => {
      const server = ThirdPartyPackageTests.getServer();
      const folder = await ThirdPartyPackageTests.createFolderAsync(t);
      const reviewed = path.join(folder, "reviewed");
      await mkdir(reviewed);
      await writeFile(path.join(reviewed, "@scope+bare-1.0.5.txt"), "\nMIT License\n\nCopyright (c) Fixture Author\n\n");
      const data = TarballFixture.packFiles({ "package.json": "{\"license\":\"MIT\"}", "README.md": "" });
      const reviewedVersion = new LockedPackage("node_modules/@scope/bare", server.lock("bare-1.0.5.tgz", data, { version: "1.0.5" }));
      const otherVersion = new LockedPackage("node_modules/@scope/bare", server.lock("bare-1.0.6.tgz", data, { version: "1.0.6" }));

      const prepared = await ThirdPartyPackage.prepareAsync(reviewedVersion, folder, reviewed);

      assert.equal(prepared.formatNotice(), "@scope/bare@1.0.5\nLicense: MIT\n\nMIT License\n\nCopyright (c) Fixture Author\n");
      await assert.rejects(ThirdPartyPackage.prepareAsync(otherVersion, folder, reviewed),
        new PackagingException(`@scope/bare@1.0.6 has no license file in its tarball, such as LICENSE, LICENCE or COPYING, and ${path.join(reviewed, "@scope+bare-1.0.6.txt")} holds no `
          + "reviewed license text for it, so its license cannot ship."));
    });
  }

  private static getServer(): TarballServerFixture {
    assert.ok(ThirdPartyPackageTests.server !== null);
    return ThirdPartyPackageTests.server;
  }

  private static pack(license: string): Buffer {
    return TarballFixture.packFiles({ "package.json": JSON.stringify({ license }), "LICENSE": "License text\n" });
  }

  private static async createFolderAsync(t: TestContext): Promise<string> {
    const folder = await mkdtemp(path.join(tmpdir(), "teamrun-third-party-"));
    t.after(() => rm(folder, { recursive: true, force: true }));
    return folder;
  }
}

ThirdPartyPackageTests.register();
