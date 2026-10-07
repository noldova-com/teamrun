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
      const data = TarballFixture.packFiles({ "package.json": ThirdPartyPackageTests.manifest("@scope/fixture", "1.0.0", "(MIT OR Apache-2.0)"), "LICENSE-MIT": "MIT text\n", "COPYING": " Copying text ",
        "index.js": "" });
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

    test("license files are named LICENSE, LICENCE, COPYING or UNLICENSE, with an -id or _id after or an id- or id_ before, and no extension or .md, .txt or .markdown", async t => {
      const server = ThirdPartyPackageTests.getServer();
      const folder = await ThirdPartyPackageTests.createFolderAsync(t);
      const taken = ["LICENSE", "licence.md", "LICENSE_MIT", "LICENSE-Apache-2.0.txt", "MIT-LICENSE", "BSD_licence.markdown", "UNLICENSE", "COPYING.txt"];
      const left = ["license.js", "license.json", "LICENSE.html", "LICENSE-notes.js", "LICENSES", "README.md", "COPYING.LESSER"];
      const data = TarballFixture.packFiles(Object.fromEntries([["package.json", ThirdPartyPackageTests.manifest("named", "1.0.0", "MIT")], ...[...taken, ...left].map(u => [u, u])]));
      const locked = new LockedPackage("node_modules/named", server.lock("named.tgz", data, { version: "1.0.0" }));

      const prepared = await ThirdPartyPackage.prepareAsync(locked, folder, path.join(folder, "reviewed"));

      assert.deepEqual(prepared.licenseText.split("\n\n").sort(), [...taken].sort());
    });

    test("a kept tarball that matches is used without downloading it again, and one that does not is downloaded again", async t => {
      const server = ThirdPartyPackageTests.getServer();
      const folder = await ThirdPartyPackageTests.createFolderAsync(t);
      const data = ThirdPartyPackageTests.pack("kept", "2.0.0", "MIT");
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
      const locked = new LockedPackage("node_modules/swapped", server.lock("swapped.tgz", ThirdPartyPackageTests.pack("swapped", "1.0.0", "MIT"), { version: "1.0.0" }));
      server.publish("swapped.tgz", ThirdPartyPackageTests.pack("swapped", "1.0.0", "ISC"));

      await assert.rejects(ThirdPartyPackage.prepareAsync(locked, folder, path.join(folder, "reviewed")),
        new PackagingException(`The tarball of swapped@1.0.0 from ${locked.resolved} does not match the SHA-512 integrity in package-lock.json, so it cannot ship.`));
      assert.equal(existsSync(path.join(folder, "swapped-1.0.0.tgz")), false);
    });

    test("a tarball that cannot be downloaded is refused with the URL and the reason", async t => {
      const server = ThirdPartyPackageTests.getServer();
      const folder = await ThirdPartyPackageTests.createFolderAsync(t);
      const missing = new LockedPackage("node_modules/missing", { version: "1.0.0", resolved: server.locate("missing.tgz"), integrity: "sha512-AAAA" });
      const closed = new LockedPackage("node_modules/closed", { version: "1.0.0", resolved: await TarballServerFixture.locateClosedAsync("closed.tgz"), integrity: "sha512-AAAA" });

      await assert.rejects(ThirdPartyPackage.prepareAsync(missing, folder, path.join(folder, "reviewed")), new PackagingException(`missing@1.0.0 could not be downloaded from ${missing.resolved}: HTTP 404.`));
      await assert.rejects(ThirdPartyPackage.prepareAsync(closed, folder, path.join(folder, "reviewed")), (error: unknown) => {
        assert.ok(error instanceof PackagingException);
        assert.ok(error.message.startsWith(`closed@1.0.0 could not be downloaded from ${closed.resolved}: `), error.message);
        return true;
      });
    });

    test("a tarball whose package.json is missing, unreadable, not an object, or names another package or version is refused and named", async t => {
      const server = ThirdPartyPackageTests.getServer();
      const folder = await ThirdPartyPackageTests.createFolderAsync(t);
      const cases: readonly (readonly [string, Buffer, (resolved: string) => string])[] = [
        ["bare", TarballFixture.packFiles({ "LICENSE": "text" }), u => `The tarball of bare@1.0.0 from ${u} has no package.json, so it cannot ship.`],
        ["broken", TarballFixture.packFiles({ "package.json": "{", "LICENSE": "text" }), () => "The package.json in the tarball of broken@1.0.0 could not be read as JSON, so it cannot ship."],
        ["listed", TarballFixture.packFiles({ "package.json": "null", "LICENSE": "text" }), () => "The package.json in the tarball of listed@1.0.0 is not a JSON object, so it cannot ship."],
        ["array", TarballFixture.packFiles({ "package.json": "[]", "LICENSE": "text" }), () => "The package.json in the tarball of array@1.0.0 is not a JSON object, so it cannot ship."],
        ["aliased", ThirdPartyPackageTests.pack("real", "1.0.0", "MIT"), u => `The tarball of aliased@1.0.0 from ${u} holds real@1.0.0 instead, so it cannot ship.`],
        ["stale", ThirdPartyPackageTests.pack("stale", "0.9.0", "MIT"), u => `The tarball of stale@1.0.0 from ${u} holds stale@0.9.0 instead, so it cannot ship.`],
        ["nameless", TarballFixture.packFiles({ "package.json": "{\"license\":\"MIT\"}", "LICENSE": "text" }), u => `The tarball of nameless@1.0.0 from ${u} holds undefined@undefined instead, so it cannot ship.`]
      ];
      for (const [name, data, message] of cases) {
        const locked = new LockedPackage(`node_modules/${name}`, server.lock(`${name}.tgz`, data, { version: "1.0.0" }));
        await assert.rejects(ThirdPartyPackage.prepareAsync(locked, folder, path.join(folder, "reviewed")), new PackagingException(message(locked.resolved)));
      }
    });

    test("a package without a license, with one outside the list or without a license file is refused and named", async t => {
      const server = ThirdPartyPackageTests.getServer();
      const folder = await ThirdPartyPackageTests.createFolderAsync(t);
      const allowed = "one of MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, 0BSD, BlueOak-1.0.0, Python-2.0, or an OR expression with one of them";
      const cases: readonly (readonly [string, Buffer, string])[] = [
        ["unnamed", TarballFixture.packFiles({ "package.json": "{\"name\":\"unnamed\",\"version\":\"1.0.0\"}", "LICENSE": "text" }),
          `unnamed@1.0.0 names no license in its package.json; a third-party runtime package needs ${allowed}.`],
        ["copyleft", ThirdPartyPackageTests.pack("copyleft", "1.0.0", "GPL-3.0-only"), `copyleft@1.0.0 is licensed under "GPL-3.0-only"; a third-party runtime package needs ${allowed}.`],
        ["unlicensed", TarballFixture.pack([{ name: "package/package.json", content: ThirdPartyPackageTests.manifest("unlicensed", "1.0.0", "MIT") }, { name: "package/lib/LICENSE", content: "nested" },
          { name: "package/README.md", content: "" }]),
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
      const pack = (version: string): Buffer => TarballFixture.packFiles({ "package.json": ThirdPartyPackageTests.manifest("@scope/bare", version, "MIT"), "README.md": "" });
      const reviewedVersion = new LockedPackage("node_modules/@scope/bare", server.lock("bare-1.0.5.tgz", pack("1.0.5"), { version: "1.0.5" }));
      const otherVersion = new LockedPackage("node_modules/@scope/bare", server.lock("bare-1.0.6.tgz", pack("1.0.6"), { version: "1.0.6" }));

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

  private static manifest(name: string, version: string, license: string): string {
    return JSON.stringify({ name, version, license });
  }

  private static pack(name: string, version: string, license: string): Buffer {
    return TarballFixture.packFiles({ "package.json": ThirdPartyPackageTests.manifest(name, version, license), "LICENSE": "License text\n" });
  }

  private static async createFolderAsync(t: TestContext): Promise<string> {
    const folder = await mkdtemp(path.join(tmpdir(), "teamrun-third-party-"));
    t.after(() => rm(folder, { recursive: true, force: true }));
    return folder;
  }
}

ThirdPartyPackageTests.register();
