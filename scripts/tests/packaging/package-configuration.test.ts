/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import ProductIdentity from "../../packages/product-identity.ts";
import RootManifest from "../../packages/root-manifest.ts";
import PackageConfiguration from "../../packaging/package-configuration.ts";
import PackageTarget from "../../packaging/package-target.ts";
import ProductIdentityFixture from "../fixtures/product-identity.fixture.ts";

class PackageConfigurationTests {
  private static readonly ROOT: string = path.resolve("/fixture/root");
  private static readonly STAGE: string = path.resolve("/fixture/root/_build/package/app");
  private static readonly OUTPUT: string = path.resolve("/fixture/root/_build/package/out");
  private static readonly DISTRIBUTION: string = path.resolve("/fixture/root/node_modules/electron/dist");
  private static readonly MANIFEST: RootManifest = new RootManifest("0.0.7", 3, ProductIdentity.fromManifest(ProductIdentityFixture.manifest()));

  public static register(): void {
    test("the configuration takes the name, publisher, IDs, icons and version only from the product's identity, and packs one target into ASAR with nothing unpacked", () => {
      const configuration = PackageConfigurationTests.create("windows", "x64");
      const icons = path.join(PackageConfigurationTests.ROOT, "assets", "fixture-icons");

      assert.deepEqual(configuration.fileNames, ["Fixture Studio-windows-x64.exe"]);
      assert.deepEqual(configuration.toJson(), {
        appId: "org.fixtureworks.studio",
        productName: "Fixture Studio",
        copyright: "Copyright (c) Fixture Works",
        directories: { app: PackageConfigurationTests.STAGE, output: PackageConfigurationTests.OUTPUT },
        electronDist: PackageConfigurationTests.DISTRIBUTION,
        electronVersion: "44.5.1",
        asar: { smartUnpack: false },
        npmRebuild: false,
        nodeGypRebuild: false,
        buildDependenciesFromSource: false,
        electronFuses: {
          runAsNode: true,
          enableCookieEncryption: false,
          enableNodeOptionsEnvironmentVariable: false,
          enableNodeCliInspectArguments: false,
          enableEmbeddedAsarIntegrityValidation: true,
          onlyLoadAppFromAsar: true,
          loadBrowserProcessSpecificV8Snapshot: false,
          grantFileProtocolExtraPrivileges: true
        },
        extraResources: [
          { from: path.join(PackageConfigurationTests.ROOT, "LICENSE"), to: "licenses/LICENSE" },
          { from: path.join(PackageConfigurationTests.ROOT, "assets", "fonts"), to: "licenses", filter: ["*.txt"] },
          { from: path.join(PackageConfigurationTests.STAGE, "_build", "window", "3rdpartylicenses.txt"), to: "licenses/window-third-party.txt" }
        ],
        publish: null,
        win: {
          target: [{ target: "nsis", arch: ["x64"] }],
          icon: path.join(icons, "icon-dark.ico"),
          artifactName: "Fixture Studio-windows-x64.${ext}",
          extraFiles: [{ from: path.join(PackageConfigurationTests.ROOT, "_build", "package", "command", "fixture-studio.cmd"), to: "bin/fixture-studio.cmd" }]
        },
        nsis: {
          oneClick: true,
          perMachine: false,
          deleteAppDataOnUninstall: false,
          shortcutName: "Fixture Studio",
          uninstallDisplayName: "Fixture Studio",
          artifactName: "Fixture Studio-windows-x64.${ext}",
          include: path.join(PackageConfigurationTests.ROOT, "assets", "installer", "command-path.nsh")
        }
      });
    });

    test("a macOS target makes a DMG and the ZIP its updater downloads, and a Linux target an AppImage on the runtime that needs no libfuse2, each with only its own platform's section", () => {
      const mac = PackageConfigurationTests.create("macos", "arm64");
      const linux = PackageConfigurationTests.create("linux", "arm64");
      const icons = path.join(PackageConfigurationTests.ROOT, "assets", "fixture-icons");

      assert.deepEqual(mac.fileNames, ["Fixture Studio-macos-arm64.dmg", "Fixture Studio-macos-arm64.zip"]);
      assert.deepEqual(PackageConfigurationTests.platformOf(mac), {
        mac: {
          target: [{ target: "dmg", arch: ["arm64"] }, { target: "zip", arch: ["arm64"] }],
          icon: path.join(icons, "icon-dock-512.png"),
          category: "public.app-category.developer-tools",
          artifactName: "Fixture Studio-macos-arm64.${ext}"
        }
      });
      assert.deepEqual(linux.fileNames, ["Fixture Studio-linux-arm64.AppImage"]);
      assert.deepEqual(PackageConfigurationTests.platformOf(linux), {
        toolsets: { appimage: "1.0.3" },
        linux: {
          target: [{ target: "AppImage", arch: ["arm64"] }],
          icon: path.join(icons, "icon-dark-512.png"),
          executableName: "fixture-studio",
          syncDesktopName: true,
          category: "Development",
          artifactName: "Fixture Studio-linux-arm64.${ext}",
          desktop: { entry: { Name: "Fixture Studio", StartupWMClass: "org.fixtureworks.studio" } }
        }
      });
    });

    test("only a macOS target signs the program ad hoc again after its fuses are flipped, so that Apple silicon still starts it", () => {
      const fuses = ["macos", "windows", "linux"].map(t => PackageConfigurationTests.create(t, "arm64").toJson()["electronFuses"]);
      const windowsFuses = PackageConfigurationTests.create("windows", "x64").toJson()["electronFuses"];

      assert.deepEqual(fuses, [{ ...Object(windowsFuses), resetAdHocDarwinSignature: true }, windowsFuses, windowsFuses]);
      assert.equal(Object.hasOwn(Object(windowsFuses), "resetAdHocDarwinSignature"), false);
    });

    test("the configuration is written as JSON, creating its folder, and a target other than Windows writes no command", async t => {
      const folder = await mkdtemp(path.join(tmpdir(), "teamrun-package-configuration-"));
      t.after(() => rm(folder, { recursive: true, force: true }));
      const configuration = PackageConfigurationTests.create("linux", "x64", folder);
      const file = path.join(folder, "_build", "package", "electron-builder.json");

      await configuration.writeAsync(file);

      assert.deepEqual(JSON.parse(await readFile(file, "utf8")), JSON.parse(JSON.stringify(configuration.toJson())));
      assert.ok((await readFile(file, "utf8")).endsWith("}\n"));
      assert.equal(existsSync(path.join(folder, "_build", "package", "command")), false);
    });

    test("a Windows target also writes the command the installer puts in its bin folder, which runs the installed program as Node with the command line's entry", async t => {
      const root = await mkdtemp(path.join(tmpdir(), "teamrun-package-configuration-"));
      t.after(() => rm(root, { recursive: true, force: true }));
      const configuration = PackageConfigurationTests.create("windows", "arm64", root);

      await configuration.writeAsync(path.join(root, "_build", "package", "electron-builder.json"));

      assert.equal(await readFile(path.join(root, "_build", "package", "command", "fixture-studio.cmd"), "utf8"), [
        "@echo off",
        "setlocal",
        "set ELECTRON_RUN_AS_NODE=1",
        "\"%~dp0..\\Fixture Studio.exe\" \"%~dp0..\\resources\\app.asar\\node_modules\\@noldova\\teamrun-shell-cli\\services\\cli-entry.js\" %*",
        "exit /b %ERRORLEVEL%",
        ""
      ].join("\r\n"));
    });
  }

  private static platformOf(configuration: PackageConfiguration): Record<string, unknown> {
    return Object.fromEntries(Object.entries(configuration.toJson()).filter(([key]) => ["win", "nsis", "mac", "linux", "toolsets"].includes(key)));
  }

  private static create(platform: string, architecture: string, root: string = PackageConfigurationTests.ROOT): PackageConfiguration {
    return new PackageConfiguration(
      root,
      PackageConfigurationTests.MANIFEST,
      new PackageTarget(platform, architecture),
      PackageConfigurationTests.STAGE,
      PackageConfigurationTests.OUTPUT,
      PackageConfigurationTests.DISTRIBUTION,
      "44.5.1");
  }
}

PackageConfigurationTests.register();
