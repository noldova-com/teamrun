/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import DependencyPinCheck from "../../checks/dependency-pin-check.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import Git from "../../repository/git.ts";
import RepositoryFiles from "../../repository/repository-files.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class DependencyPinCheckTests {
  private static readonly SAVE_EXACT: string = "save-exact=true\n";
  private static readonly NOT_EXACT: string = "which is not an exact version; an external dependency takes an exact version from the registry, such as 1.2.3, never a range, tag, alias, path, Git or URL source.";

  public static register(): void {
    test("exact external versions, TeamRun's own packages at the build's version and save-exact beside each lockfile pass", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "package.json": DependencyPinCheckTests.manifest({
          devDependencies: { typescript: "7.0.2", "@types/node": "26.2.0-beta.1+build.5" },
          overrides: { glob: "11.0.3", vite: { ".": "7.1.2", esbuild: "0.25.9" } }
        }),
        "package-lock.json": "{}\n",
        ".npmrc": `registry=https://registry.npmjs.org/\n  ${DependencyPinCheckTests.SAVE_EXACT}`,
        "src/package.json": DependencyPinCheckTests.manifest({ dependencies: { rxjs: "7.8.2" }, scripts: { build: "ng build" } }),
        "src/package-lock.json": "{}\n",
        "src/.npmrc": DependencyPinCheckTests.SAVE_EXACT,
        "src/shell/desktop/package.json": DependencyPinCheckTests.manifest({
          dependencies: { "@noldova/teamrun-foundation-core": "__VERSION__" },
          peerDependencies: { electron: "44.5.1" }
        }),
        "src/shell/desktop/tests/e2e/fixtures/modules/clock/runtime/package.json": DependencyPinCheckTests.manifest({
          dependencies: { "@noldova/teamrun-fixture-clock-protocol": "__VERSION__" }
        }),
        "docs/package.md": "Not a manifest.\n"
      });
      const output = new TextOutputFixture();

      const check = DependencyPinCheckTests.createCheck(repository);

      assert.equal(await check.runAsync(output), true);
      assert.equal(output.text, "Checked the dependency versions of 4 manifests and the npm configuration of 2 lockfiles.\n");
      assert.equal(check.title, "Dependency pins");
    });

    test("ranges, tags, aliases, paths, Git and URL sources, unstamped own packages and malformed sections fail with their manifest and name", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "package.json": DependencyPinCheckTests.manifest({
          dependencies: {
            caret: "^1.2.3",
            tilde: "~1.2.3",
            star: "*",
            tag: "latest",
            partial: "1.2",
            leading: "01.2.3",
            alias: "npm:other@1.2.3",
            local: "file:../local",
            git: "git+https://github.com/owner/name.git#v1.2.3",
            url: "https://example.com/name-1.2.3.tgz",
            shorthand: "owner/name",
            "@noldova/teamrun-foundation-core": "1.0.0",
            number: 1
          },
          devDependencies: ["typescript"],
          overrides: { vite: { ".": "^7.1.2", esbuild: "0.25.x" }, "@noldova/teamrun-shell-protocol": { ".": "workspace:*" } }
        })
      });
      const output = new TextOutputFixture();

      assert.equal(await DependencyPinCheckTests.createCheck(repository).runAsync(output), false);
      assert.equal(output.text, [
        ...[
          ["caret", "^1.2.3"], ["tilde", "~1.2.3"], ["star", "*"], ["tag", "latest"], ["partial", "1.2"], ["leading", "01.2.3"], ["alias", "npm:other@1.2.3"],
          ["local", "file:../local"], ["git", "git+https://github.com/owner/name.git#v1.2.3"], ["url", "https://example.com/name-1.2.3.tgz"], ["shorthand", "owner/name"]
        ].map(t => `package.json: dependencies ${t[0]} is "${t[1]}", ${DependencyPinCheckTests.NOT_EXACT}`),
        "package.json: dependencies @noldova/teamrun-foundation-core is \"1.0.0\"; TeamRun's own packages take \"__VERSION__\", which the build stamps.",
        "package.json: dependencies number has no version string.",
        "package.json: devDependencies is not an object of names and versions.",
        `package.json: overrides vite . is "^7.1.2", ${DependencyPinCheckTests.NOT_EXACT}`,
        `package.json: overrides vite esbuild is "0.25.x", ${DependencyPinCheckTests.NOT_EXACT}`,
        "package.json: overrides @noldova/teamrun-shell-protocol . is \"workspace:*\"; TeamRun's own packages take \"__VERSION__\", which the build stamps.",
        "Checked the dependency versions of 1 manifests and the npm configuration of 0 lockfiles.",
        ""
      ].join("\n"));
    });

    test("a manifest that is not a JSON object fails with its file", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ "package.json": "{ \"name\": \n", "src/package.json": "[]\n" });
      const output = new TextOutputFixture();

      assert.equal(await DependencyPinCheckTests.createCheck(repository).runAsync(output), false);
      assert.equal(output.text, [
        "package.json: could not be read as JSON.",
        "src/package.json: is not a JSON object.",
        "Checked the dependency versions of 2 manifests and the npm configuration of 0 lockfiles.",
        ""
      ].join("\n"));
    });

    test("a lockfile without npm configuration beside it, or with configuration that does not save exact versions, fails", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "package-lock.json": "{}\n",
        "src/package-lock.json": "{}\n",
        "src/.npmrc": "save-exact=false\n# save-exact=true\n"
      });
      const output = new TextOutputFixture();

      assert.equal(await DependencyPinCheckTests.createCheck(repository).runAsync(output), false);
      assert.equal(output.text, [
        ".npmrc: is missing; a folder with a lockfile keeps \"save-exact=true\" there, so npm saves exact versions.",
        "src/.npmrc: lacks the line \"save-exact=true\", which makes npm save exact versions.",
        "Checked the dependency versions of 0 manifests and the npm configuration of 2 lockfiles.",
        ""
      ].join("\n"));
    });
  }

  private static manifest(fields: Readonly<Record<string, unknown>>): string {
    return `${JSON.stringify({ name: "fixture", version: "__VERSION__", ...fields }, null, 2)}\n`;
  }

  private static createCheck(repository: RepositoryFixture): DependencyPinCheck {
    const directory = repository.directory;
    return new DependencyPinCheck(directory, new RepositoryFiles(directory, new Git(directory, new ProcessRunner())));
  }
}

DependencyPinCheckTests.register();
