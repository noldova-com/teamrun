/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import configuration from "../../../electron-builder.json" with { type: "json" };
import AppImageLauncherFixture from "./fixtures/app-image-launcher.fixture.ts";

class AppImageLauncherTests {
  public static register(): void {
    test("Linux packaging pins the static runtime, compression and sandbox-preserving launcher", () => {
      assert.equal(configuration.toolsets.appimage, "1.0.3");
      assert.equal(configuration.appImage.compression, "gzip");
      assert.deepEqual(configuration.linux.executableArgs, []);
      assert.deepEqual(configuration.linux.extraFiles, [{ from: "_build/appimage/${arch}/AppRun", to: "AppRun" }]);
      assert.equal(configuration.linux.executableName, "teamrun");
    });

    test("launcher preserves arguments and inherited library paths from a different working directory", async () => {
      await using fixture = await AppImageLauncherFixture.create();
      const args = ["a path with spaces", "", "'quoted'", "$(do-not-execute)", "--flag=value"];
      const result = await fixture.run(args, 0, "/inherited/path");
      assert.equal(result.status, 0, result.stderr);
      const [count, directory, libraries, data, schemas, ...received] = await fixture.readRecord();
      assert.equal(count, String(args.length));
      assert.ok(directory?.endsWith("/application with spaces"));
      assert.equal(libraries, directory + "/usr/lib:/inherited/path");
      assert.equal(data, directory + "/usr/share/:/inherited/path:/usr/share/gnome:/usr/local/share/:/usr/share/");
      assert.equal(schemas, directory + "/usr/share/glib-2.0/schemas:/inherited/path");
      assert.deepEqual(received, args);
      await assert.rejects(fixture.readProbe(), { code: "ENOENT" });
    });

    test("launcher adds no arguments when namespaces are unavailable and preserves an application failure", async () => {
      await using fixture = await AppImageLauncherFixture.create();
      const result = await fixture.run([], 73, "");
      assert.equal(result.status, 73, result.stderr);
      const [count, directory, libraries, data, schemas, ...received] = await fixture.readRecord();
      assert.equal(count, "0");
      assert.equal(libraries, directory + "/usr/lib");
      assert.equal(data, directory + "/usr/share/:/usr/share/gnome:/usr/local/share/:/usr/share/");
      assert.equal(schemas, directory + "/usr/share/glib-2.0/schemas");
      assert.deepEqual(received, []);
      await assert.rejects(fixture.readProbe(), { code: "ENOENT" });
      assert.doesNotMatch(await readFile(fixture.launcherPath, "utf8"), /--no-sandbox|--disable.*sandbox/);
    });
  }
}

AppImageLauncherTests.register();
