/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";

import ReleaseException from "../../release/release.exception.ts";
import SupportedTargets from "../../release/supported-targets.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class SupportedTargetsTests {
  private static readonly INVALID: ReleaseException = new ReleaseException(
    "The root package.json's teamrun.supportedTargets must list distinct targets among windows-x64, windows-arm64, macos-x64, macos-arm64, linux-x64, linux-arm64.");

  public static register(): void {
    test("the supported targets are the ones the root manifest lists, in the target matrix's order, and none when it lists none", async t => {
      const repository = await SupportedTargetsTests.createAsync(t);

      await repository.writeAsync({ "package.json": JSON.stringify({ teamrun: { supportedTargets: ["linux-x64", "windows-arm64"] } }) });
      const listed = await SupportedTargets.readAsync(repository.directory);
      await repository.writeAsync({ "package.json": JSON.stringify({ teamrun: {} }) });
      const absent = await SupportedTargets.readAsync(repository.directory);

      assert.deepEqual(listed.map(t => t.id), ["windows-arm64", "linux-x64"]);
      assert.deepEqual(absent, []);
    });

    test("an unreadable manifest, or a list that is not distinct known targets, is refused", async t => {
      const repository = await SupportedTargetsTests.createAsync(t);

      await assert.rejects(SupportedTargets.readAsync(repository.directory), SupportedTargetsTests.INVALID);
      for (const text of ["{", "null", "{}", "{ \"teamrun\": null }"]) {
        await repository.writeAsync({ "package.json": text });
        await assert.rejects(SupportedTargets.readAsync(repository.directory), SupportedTargetsTests.INVALID, text);
      }
      for (const supportedTargets of [null, "linux-x64", ["linux-x64", "linux-x64"], ["linux-ia32"], [7]]) {
        await repository.writeAsync({ "package.json": JSON.stringify({ teamrun: { supportedTargets } }) });
        await assert.rejects(SupportedTargets.readAsync(repository.directory), SupportedTargetsTests.INVALID, JSON.stringify(supportedTargets));
      }
    });
  }

  private static async createAsync(t: TestContext): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    return repository;
  }
}

SupportedTargetsTests.register();
