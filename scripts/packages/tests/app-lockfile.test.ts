/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { AppLockfile } from "../app-lockfile.ts";

const folders: string[] = [];

const OWN = "@noldova/teamrun.core";
const ARCHIVES_START = "file:../_packages/";
const OWN_LOCATION = `node_modules/${OWN}`;

const entry = (name: string, version: string = "1.0.0", integrity: string = `sha512-${name}`): Readonly<Record<string, string>> =>
  ({ version, resolved: `https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`, integrity });

const ownEntry = (dependencies: Readonly<Record<string, string>>, name: string = OWN): Readonly<Record<string, unknown>> =>
  ({ version: "0.0.1", resolved: `${ARCHIVES_START}${name.replace("@", "").replace("/", "-")}-0.0.1.tgz`, dependencies });

const lockedPackages: Readonly<Record<string, unknown>> = { "node_modules/a": entry("a"), "node_modules/b": entry("b") };

const write = (file: string, value: unknown): void => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(value));
};

const findUnlockedAsync = async (sample: {
  readonly locked?: Readonly<Record<string, unknown>>;
  readonly installed?: Readonly<Record<string, unknown>>;
  readonly archives?: Readonly<Record<string, unknown>>;
}): Promise<string> => {
  const app = mkdtempSync(path.join(tmpdir(), "app-lockfile-"));
  folders.push(app);
  const locked = path.join(app, "package-lock.json");
  const installed = path.join(app, "node_modules", ".package-lock.json");
  write(locked, { packages: { "": {}, ...sample.locked ?? lockedPackages } });
  write(installed, { packages: sample.installed ?? lockedPackages });
  for (const [location, manifest] of Object.entries(sample.archives ?? {}))
    write(path.join(app, location, "package.json"), manifest);
  return (await new AppLockfile(new Set([OWN]), ARCHIVES_START).findUnlockedAsync(locked, installed)).join(", ");
};

describe("AppLockfile", () => {
  afterEach(() => {
    for (const folder of folders.splice(0))
      rmSync(folder, { recursive: true, force: true });
  });

  it("leaves nothing unlocked after an install of exactly what the app's lockfile locks", async () => {
    assert.equal(await findUnlockedAsync({}), "");
  });

  it("finds a package the app's lockfile doesn't hold", async () => {
    assert.equal(await findUnlockedAsync({ installed: { ...lockedPackages, "node_modules/c": entry("c") } }), "node_modules/c");
  });

  it("finds a package installed at another version than the app's lockfile's", async () => {
    assert.equal(await findUnlockedAsync({ installed: { ...lockedPackages, "node_modules/a": { ...entry("a"), version: "1.0.1" } } }), "node_modules/a");
  });

  it("finds a package of the same version and integrity installed from another source than the app's lockfile's", async () => {
    assert.equal(await findUnlockedAsync({ installed: { ...lockedPackages, "node_modules/a": { ...entry("a"), resolved: "git+https://example.com/a.git#0123456" } } }),
      "node_modules/a");
  });

  it("finds a package installed with another integrity than the app's lockfile's", async () => {
    assert.equal(await findUnlockedAsync({ installed: { ...lockedPackages, "node_modules/b": entry("b", "1.0.0", "sha512-other") } }), "node_modules/b");
  });

  it("doesn't compare a TeamRun package's archive entry, whose checksum the lockfile leaves out, but compares the packages installed inside it", async () => {
    const own = ownEntry({ a: "1.0.0" });
    const nested = `${OWN_LOCATION}/node_modules/c`;

    assert.equal(await findUnlockedAsync({
      locked: { ...lockedPackages, [OWN_LOCATION]: own },
      installed: { ...lockedPackages, [OWN_LOCATION]: { ...own, integrity: "sha512-built" }, [nested]: entry("c") },
      archives: { [OWN_LOCATION]: { name: OWN, version: "0.0.1", dependencies: { a: "1.0.0" } } }
    }), nested);
  });

  it("compares a package whose name only starts with a TeamRun package's", async () => {
    assert.equal(await findUnlockedAsync({ installed: { ...lockedPackages, [`${OWN_LOCATION}-other`]: entry("other") } }), `${OWN_LOCATION}-other`);
  });

  it("finds a TeamRun package whose archive depends on a package its lockfile entry doesn't", async () => {
    const own = ownEntry({ a: "1.0.0" });

    assert.equal(await findUnlockedAsync({
      locked: { ...lockedPackages, [OWN_LOCATION]: own },
      installed: { ...lockedPackages, [OWN_LOCATION]: own },
      archives: { [OWN_LOCATION]: { name: OWN, version: "0.0.1", dependencies: { a: "1.0.0", c: "1.0.0" } } }
    }), OWN_LOCATION);
  });

  it("finds a TeamRun package whose archive takes a peer at another range than its lockfile entry's", async () => {
    const own = { ...ownEntry({ a: "1.0.0" }), peerDependencies: { b: ">=1.0.0 <2.0.0" } };

    assert.equal(await findUnlockedAsync({
      locked: { ...lockedPackages, [OWN_LOCATION]: own },
      installed: { ...lockedPackages, [OWN_LOCATION]: own },
      archives: { [OWN_LOCATION]: { name: OWN, version: "0.0.1", dependencies: { a: "1.0.0" }, peerDependencies: { b: ">=1.0.0 <3.0.0" } } }
    }), OWN_LOCATION);
  });

  it("finds a TeamRun package the app's lockfile locks but the install didn't put in place", async () => {
    assert.equal(await findUnlockedAsync({ locked: { ...lockedPackages, [OWN_LOCATION]: ownEntry({ a: "1.0.0" }) } }), OWN_LOCATION);
  });

  it("finds, once, a lockfile entry that still resolves to the archive of a package this checkout no longer has", async () => {
    const removed = "@noldova/teamrun.removed";
    const location = `node_modules/${removed}`;

    assert.equal(await findUnlockedAsync({
      locked: { ...lockedPackages, [location]: ownEntry({}, removed) },
      installed: { ...lockedPackages, [location]: { ...ownEntry({}, removed), integrity: "sha512-built" } }
    }), location);
  });
});
