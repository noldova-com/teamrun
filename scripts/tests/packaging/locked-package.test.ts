/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import LockedPackage from "../../packaging/locked-package.ts";
import PackagingException from "../../packaging/packaging.exception.ts";

class LockedPackageTests {
  private static readonly DATA: Buffer = Buffer.from("fixture tarball");
  private static readonly SHA512: string = createHash("sha512").update(LockedPackageTests.DATA).digest("base64");
  private static readonly RESOLVED: string = "https://registry.npmjs.org/fixture/-/fixture-1.2.3.tgz";

  public static register(): void {
    test("a lockfile entry gives the package's name from its folder, its version, its tarball's URL and its SHA-512, and checks data against it", () => {
      const nested = new LockedPackage("node_modules/outer/node_modules/@scope/inner", {
        version: "1.2.3-beta.1", resolved: LockedPackageTests.RESOLVED, integrity: `sha1-AAAA sha512-${LockedPackageTests.SHA512}`
      });
      const plain = new LockedPackage("node_modules/fixture", { version: "1.2.3", resolved: "http://127.0.0.1:9/fixture.tgz", integrity: `sha512-${LockedPackageTests.SHA512}` });

      assert.equal(nested.location, "node_modules/outer/node_modules/@scope/inner");
      assert.equal(nested.name, "@scope/inner");
      assert.equal(nested.version, "1.2.3-beta.1");
      assert.equal(nested.resolved, LockedPackageTests.RESOLVED);
      assert.equal(nested.sha512, LockedPackageTests.SHA512);
      assert.equal(nested.id, "@scope/inner@1.2.3-beta.1");
      assert.equal(nested.fileName, "@scope+inner-1.2.3-beta.1.tgz");
      assert.equal(plain.fileName, "fixture-1.2.3.tgz");
      assert.equal(plain.matches(LockedPackageTests.DATA), true);
      assert.equal(plain.matches(Buffer.from("other tarball")), false);
    });

    test("an entry without a valid name and version is refused, so nothing is written outside the tarballs' folder", () => {
      for (const [location, version] of [["node_modules/../escape", "1.0.0"], ["node_modules/.hidden", "1.0.0"], ["node_modules/fixture", "../1.0.0"], ["node_modules/fixture", "^1.0.0"],
        ["node_modules/fixture", 1]])
        assert.throws(() => new LockedPackage(String(location), { version, resolved: LockedPackageTests.RESOLVED, integrity: `sha512-${LockedPackageTests.SHA512}` }),
          new PackagingException(`${String(location)} in package-lock.json has no valid package name and version.`));
    });

    test("an entry that is not resolved to an HTTP or HTTPS tarball is refused", () => {
      for (const resolved of [undefined, "not a URL", "file:../fixture-1.2.3.tgz", "git+ssh://git@example.invalid/fixture.git"])
        assert.throws(() => new LockedPackage("node_modules/fixture", { version: "1.2.3", resolved, integrity: `sha512-${LockedPackageTests.SHA512}` }),
          new PackagingException("fixture@1.2.3 at node_modules/fixture in package-lock.json is not resolved to a registry tarball, so it cannot ship."));
    });

    test("an entry without a SHA-512 integrity is refused", () => {
      for (const integrity of [undefined, "sha1-AAAA", ""])
        assert.throws(() => new LockedPackage("node_modules/fixture", { version: "1.2.3", resolved: LockedPackageTests.RESOLVED, integrity }),
          new PackagingException("fixture@1.2.3 at node_modules/fixture in package-lock.json has no SHA-512 integrity, so its tarball cannot be verified."));
    });
  }
}

LockedPackageTests.register();
