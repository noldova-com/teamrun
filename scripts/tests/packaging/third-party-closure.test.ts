/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import PackageManifest from "../../packages/package-manifest.ts";
import PackageTarget from "../../packaging/package-target.ts";
import PackagingException from "../../packaging/packaging.exception.ts";
import ThirdPartyClosure from "../../packaging/third-party-closure.ts";

class ThirdPartyClosureTests {
  private static readonly INTEGRITY: string = `sha512-${"A".repeat(86)}==`;
  private static readonly LINUX: PackageTarget = new PackageTarget(PackageTarget.LINUX, "x64");
  private static readonly DESKTOP: PackageManifest = ThirdPartyClosureTests.createManifest("src/shell/desktop", { alpha: "1.0.0" });
  private static readonly CLI: PackageManifest = ThirdPartyClosureTests.createManifest("src/shell/cli", { alpha: "1.0.0", gamma: "1.0.0" });
  private static readonly PACKAGES: Readonly<Record<string, unknown>> = {
    "": { name: "fixture", dependencies: { alpha: "1.0.0", gamma: "1.0.0" }, devDependencies: { electron: "1.0.0" } },
    "node_modules/alpha": ThirdPartyClosureTests.lock("alpha", "1.0.0", {
      dependencies: { beta: "^2.0.0", gamma: "1.0.0", "native-linux": "1.0.0" },
      optionalDependencies: { "native-linux": "1.0.0", "native-musl": "1.0.0", "native-windows": "1.0.0", "native-unix": "1.0.0", "not-there": "1.0.0" },
      peerDependencies: { electron: "1.0.0" }
    }),
    "node_modules/alpha/node_modules/beta": ThirdPartyClosureTests.lock("beta", "2.0.0", { dependencies: { delta: "1.0.0" } }),
    "node_modules/beta": ThirdPartyClosureTests.lock("beta", "1.0.0", { dev: true }),
    "node_modules/gamma": ThirdPartyClosureTests.lock("gamma", "1.0.0", {
      dependencies: { alpha: "1.0.0", delta: "1.0.0" }, peerDependencies: { alpha: "^1.0.0", theme: "1.0.0" }, peerDependenciesMeta: { theme: { optional: true } }
    }),
    "node_modules/gamma/node_modules/delta": ThirdPartyClosureTests.lock("delta", "1.0.0", { cpu: ["x64", "arm64"] }),
    "node_modules/delta": ThirdPartyClosureTests.lock("delta", "1.0.0", { cpu: ["x64", "arm64"] }),
    "node_modules/native-linux": ThirdPartyClosureTests.lock("native-linux", "1.0.0", { os: ["linux"], cpu: ["x64"], libc: ["glibc"] }),
    "node_modules/native-musl": ThirdPartyClosureTests.lock("native-musl", "1.0.0", { os: ["linux"], libc: ["musl"] }),
    "node_modules/native-windows": ThirdPartyClosureTests.lock("native-windows", "1.0.0", { os: ["win32"], cpu: ["arm64"] }),
    "node_modules/native-unix": ThirdPartyClosureTests.lock("native-unix", "1.0.0", { os: ["!win32"] }),
    "node_modules/electron": ThirdPartyClosureTests.lock("electron", "1.0.0", { dev: true })
  };

  public static register(): void {
    test("the closure follows npm's resolution from each pinned package, nested copies first, takes optional packages only where they run and leaves dev and peer dependencies out", async t => {
      const linux = await ThirdPartyClosureTests.collectAsync(t, ThirdPartyClosureTests.PACKAGES, [ThirdPartyClosureTests.DESKTOP, ThirdPartyClosureTests.CLI]);
      const windows = await ThirdPartyClosureTests.collectAsync(t, ThirdPartyClosureTests.PACKAGES, [ThirdPartyClosureTests.DESKTOP], new PackageTarget(PackageTarget.WINDOWS, "arm64"));
      const macos = await ThirdPartyClosureTests.collectAsync(t, ThirdPartyClosureTests.PACKAGES, [ThirdPartyClosureTests.DESKTOP], new PackageTarget(PackageTarget.MACOS, "x64"));

      assert.deepEqual(linux.map(u => [u.location, u.id]), [
        ["node_modules/alpha", "alpha@1.0.0"],
        ["node_modules/alpha/node_modules/beta", "beta@2.0.0"],
        ["node_modules/delta", "delta@1.0.0"],
        ["node_modules/gamma", "gamma@1.0.0"],
        ["node_modules/native-linux", "native-linux@1.0.0"],
        ["node_modules/native-unix", "native-unix@1.0.0"]
      ]);
      assert.deepEqual(windows.map(u => u.id), ["alpha@1.0.0", "beta@2.0.0", "delta@1.0.0", "gamma@1.0.0", "native-windows@1.0.0"]);
      assert.deepEqual(macos.map(u => u.id), ["alpha@1.0.0", "beta@2.0.0", "delta@1.0.0", "gamma@1.0.0", "native-unix@1.0.0"]);
      assert.deepEqual(await ThirdPartyClosureTests.collectAsync(t, { "": {} }, [ThirdPartyClosureTests.createManifest("src/shell/desktop", {})]), []);
    });

    test("a pinned package that the root lockfile does not lock is refused and its manifest named", async t => {
      await assert.rejects(ThirdPartyClosureTests.collectAsync(t, ThirdPartyClosureTests.PACKAGES, [ThirdPartyClosureTests.createManifest("src/shell/cli", { ghost: "1.0.0" })]),
        new PackagingException("src/shell/cli/package.json needs ghost, which the root package-lock.json does not lock; pin it in the root package.json and run npm install."));
    });

    test("a shipped package whose required peer dependency neither a shipped package nor Electron provides is refused", async t => {
      const packages = { ...ThirdPartyClosureTests.PACKAGES, "node_modules/delta": ThirdPartyClosureTests.lock("delta", "1.0.0", { peerDependencies: { electron: "1.0.0", react: "19.0.0" } }) };

      await assert.rejects(ThirdPartyClosureTests.collectAsync(t, packages, [ThirdPartyClosureTests.DESKTOP]),
        new PackagingException("delta@1.0.0 at node_modules/delta needs the peer dependency react, which no shipped package brings and Electron does not provide, so it would fail at runtime."));
    });

    test("a needed package that is not locked or does not run on the target, or two versions of one name, is refused", async t => {
      const root = { "": { dependencies: { alpha: "1.0.0" } } };
      const cases: readonly (readonly [Readonly<Record<string, unknown>>, string])[] = [
        [{ ...root, "node_modules/alpha": ThirdPartyClosureTests.lock("alpha", "1.0.0", { dependencies: { ghost: "1.0.0" } }) },
          "node_modules/alpha needs ghost, which package-lock.json does not lock."],
        [{ ...root, "node_modules/alpha": ThirdPartyClosureTests.lock("alpha", "1.0.0", { dependencies: { mac: "1.0.0" } }), "node_modules/mac": ThirdPartyClosureTests.lock("mac", "1.0.0", { os: ["darwin"] }) },
          "node_modules/mac in package-lock.json does not run on linux-x64, yet a shipped package needs it."],
        [{ ...root, "node_modules/alpha": ThirdPartyClosureTests.lock("alpha", "1.0.0", { cpu: ["!x64"] }) }, "node_modules/alpha in package-lock.json does not run on linux-x64, yet a shipped package needs it."],
        [{
          ...root,
          "node_modules/alpha": ThirdPartyClosureTests.lock("alpha", "1.0.0", { dependencies: { beta: "2.0.0", gamma: "1.0.0" } }),
          "node_modules/alpha/node_modules/beta": ThirdPartyClosureTests.lock("beta", "2.0.0", {}),
          "node_modules/gamma": ThirdPartyClosureTests.lock("gamma", "1.0.0", { dependencies: { beta: "1.0.0" } }),
          "node_modules/beta": ThirdPartyClosureTests.lock("beta", "1.0.0", {})
        }, "The stage installs one version of each third-party package, but the shipped packages need beta@2.0.0 at node_modules/alpha/node_modules/beta and beta@1.0.0 at node_modules/beta."],
        [{ ...root, "node_modules/alpha": { version: "1.0.0", resolved: "src/alpha", link: true } }, "alpha@1.0.0 at node_modules/alpha in package-lock.json is not resolved to a registry tarball, so it cannot ship."]
      ];
      for (const [packages, message] of cases)
        await assert.rejects(ThirdPartyClosureTests.collectAsync(t, packages, [ThirdPartyClosureTests.DESKTOP]), new PackagingException(message));
    });

    test("a root lockfile that is missing, not JSON, of another version or without packages is refused", async t => {
      const folder = await ThirdPartyClosureTests.createFolderAsync(t);
      const unreadable = "The root package-lock.json could not be read as JSON.";
      const invalid = "The root package-lock.json must be a lockfile of version 3 with its packages.";

      await assert.rejects(ThirdPartyClosure.readAsync(folder, ThirdPartyClosureTests.LINUX), new PackagingException(unreadable));
      for (const [text, message] of [["{", unreadable], ["[]", invalid], ["{\"lockfileVersion\":2,\"packages\":{}}", invalid], ["{\"lockfileVersion\":3}", invalid],
        ["{\"lockfileVersion\":3,\"packages\":[]}", invalid]]) {
        await writeFile(path.join(folder, "package-lock.json"), String(text));
        await assert.rejects(ThirdPartyClosure.readAsync(folder, ThirdPartyClosureTests.LINUX), new PackagingException(String(message)), text);
      }
    });
  }

  private static createManifest(directory: string, external: Readonly<Record<string, string>>): PackageManifest {
    return new PackageManifest(directory, PackageManifest.formatName(directory), [], "[]", [], new Map(Object.entries(external)));
  }

  private static lock(name: string, version: string, fields: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
    return { version, resolved: `https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`, integrity: ThirdPartyClosureTests.INTEGRITY, license: "MIT", ...fields };
  }

  private static async createFolderAsync(t: TestContext): Promise<string> {
    const folder = await mkdtemp(path.join(tmpdir(), "teamrun-closure-"));
    t.after(() => rm(folder, { recursive: true, force: true }));
    return folder;
  }

  private static async collectAsync(t: TestContext, packages: Readonly<Record<string, unknown>>, manifests: readonly PackageManifest[],
    target: PackageTarget = ThirdPartyClosureTests.LINUX): Promise<readonly { readonly location: string; readonly id: string }[]> {
    const folder = await ThirdPartyClosureTests.createFolderAsync(t);
    await writeFile(path.join(folder, "package-lock.json"), JSON.stringify({ name: "fixture", lockfileVersion: 3, requires: true, packages }));
    return (await ThirdPartyClosure.readAsync(folder, target)).collect(manifests);
  }
}

ThirdPartyClosureTests.register();
