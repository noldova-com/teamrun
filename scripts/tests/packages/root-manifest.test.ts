/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import PackageException from "../../packages/package.exception.ts";
import RootManifest from "../../packages/root-manifest.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class RootManifestTests {
  private static readonly INVALID: string = "The root package.json must declare a numbered version and a positive whole teamrun.protocolVersion.";

  public static register(): void {
    test("the product and protocol versions come from the root manifest", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ "package.json": "{ \"version\": \"1.2.3\", \"teamrun\": { \"protocolVersion\": 4 } }\n" });

      const manifest = await RootManifest.readAsync(repository.directory);

      assert.equal(manifest.productVersion, "1.2.3");
      assert.equal(manifest.protocolVersion, 4);
    });

    test("a missing, malformed or incomplete root manifest is refused", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const isInvalid = (t: unknown): boolean => t instanceof PackageException && t.message === RootManifestTests.INVALID;

      await assert.rejects(RootManifest.readAsync(repository.directory), isInvalid);
      for (const text of [
        "{",
        "[]",
        "null",
        "{ \"version\": \"1.0.0\" }",
        "{ \"teamrun\": { \"protocolVersion\": 1 } }",
        "{ \"version\": 1, \"teamrun\": { \"protocolVersion\": 1 } }",
        "{ \"version\": \"1.0.0\", \"teamrun\": null }",
        "{ \"version\": \"1.0.0\", \"teamrun\": {} }",
        "{ \"version\": \"1.0.0\", \"teamrun\": { \"protocolVersion\": \"1\" } }",
        "{ \"version\": \"1.0.0-beta\", \"teamrun\": { \"protocolVersion\": 1 } }",
        "{ \"version\": \"1.0.0\", \"teamrun\": { \"protocolVersion\": 0 } }",
        "{ \"version\": \"1.0.0\", \"teamrun\": { \"protocolVersion\": 1.5 } }"
      ]) {
        await repository.writeAsync({ "package.json": text });
        await assert.rejects(RootManifest.readAsync(repository.directory), isInvalid, text);
      }
    });
  }
}

RootManifestTests.register();
