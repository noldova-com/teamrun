/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import PackageManifest from "../../packages/package-manifest.ts";
import PackageException from "../../packages/package.exception.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class PackageManifestTests {
  public static register(): void {
    test("a manifest named for its path lists its own dependencies, sorted, and keeps external ones out", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "src/modules/terminal/window/package.json": JSON.stringify({
          name: "@noldova/teamrun-modules-terminal-window",
          version: "__VERSION__",
          dependencies: { "@noldova/teamrun-shell-ui": "__VERSION__", "@noldova/teamrun-foundation-core": "__VERSION__", "@xterm/headless": "6.0.0" }
        }),
        "src/foundation/core/package.json": JSON.stringify({ name: "@noldova/teamrun-foundation-core", version: "__VERSION__" })
      });

      const window = await PackageManifest.readAsync(repository.directory, "src/modules/terminal/window");
      const core = await PackageManifest.readAsync(repository.directory, "src/foundation/core");

      assert.equal(window.directory, "src/modules/terminal/window");
      assert.equal(window.name, "@noldova/teamrun-modules-terminal-window");
      assert.equal(window.id, "modules-terminal-window");
      assert.deepEqual(window.dependencies, ["@noldova/teamrun-foundation-core", "@noldova/teamrun-shell-ui"]);
      assert.deepEqual(core.dependencies, []);
    });

    test("a name that does not follow the package's path is refused", () => {
      assert.throws(
        () => new PackageManifest("src/shell/ui", "@noldova/teamrun-ui", []),
        new PackageException("src/shell/ui/package.json must be named \"@noldova/teamrun-shell-ui\", the package's path below src/ joined with hyphens."));
    });

    test("unreadable, nameless, unstamped or malformed manifests are refused with the reason", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const name = "\"name\": \"@noldova/teamrun-shell-ui\"";
      const cases: readonly (readonly [string | null, string])[] = [
        [null, "src/shell/ui/package.json could not be read as JSON."],
        ["{", "src/shell/ui/package.json could not be read as JSON."],
        ["null", "src/shell/ui/package.json must have a name."],
        ["{}", "src/shell/ui/package.json must have a name."],
        ["{ \"name\": 1 }", "src/shell/ui/package.json must have a name."],
        [`{ ${name} }`, "src/shell/ui/package.json must have the version \"__VERSION__\"; the build stamps the product version."],
        [`{ ${name}, "version": "0.0.1" }`, "src/shell/ui/package.json must have the version \"__VERSION__\"; the build stamps the product version."],
        [`{ ${name}, "version": "__VERSION__", "dependencies": null }`, "src/shell/ui/package.json must list its dependencies as an object."],
        [`{ ${name}, "version": "__VERSION__", "dependencies": "none" }`, "src/shell/ui/package.json must list its dependencies as an object."],
        [
          `{ ${name}, "version": "__VERSION__", "dependencies": { "@noldova/teamrun-foundation-core": "0.0.1", "@noldova/teamrun-foundation-json": "__VERSION__" } }`,
          "src/shell/ui/package.json must depend on @noldova/teamrun-foundation-core at version \"__VERSION__\"."
        ]
      ];
      for (const [text, message] of cases) {
        if (text !== null)
          await repository.writeAsync({ "src/shell/ui/package.json": text });

        await assert.rejects(PackageManifest.readAsync(repository.directory, "src/shell/ui"), new PackageException(message), String(text));
      }
    });
  }
}

PackageManifestTests.register();
