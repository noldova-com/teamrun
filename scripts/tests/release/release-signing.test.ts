/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";

import ProductIdentity from "../../packages/product-identity.ts";
import ReleaseException from "../../release/release.exception.ts";
import ReleaseSigning from "../../release/release-signing.ts";
import ProductIdentityFixture from "../fixtures/product-identity.fixture.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class ReleaseSigningTests {
  private static readonly PRODUCT: ProductIdentity = ProductIdentity.fromManifest(ProductIdentityFixture.manifest());
  private static readonly INVALID: ReleaseException = new ReleaseException("The root package.json's teamrun.signedPlatforms must list distinct platforms among windows, macos.");

  public static register(): void {
    test("a release to the update feed signs the declared platforms in the target matrix's order, and a release to any other repository signs none", async t => {
      const repository = await ReleaseSigningTests.createAsync(t);
      await repository.writeAsync({ "package.json": JSON.stringify({ teamrun: { signedPlatforms: ["macos", "windows"] } }) });

      const signing = await ReleaseSigning.readAsync(repository.directory);

      assert.deepEqual(signing.listSignedPlatforms(ReleaseSigningTests.PRODUCT, "FixtureWorks/Studio"), ["windows", "macos"]);
      assert.deepEqual(signing.listSignedPlatforms(ReleaseSigningTests.PRODUCT, "fixtureworks/studio-trial"), []);
    });

    test("the update feed is refused while the declaration leaves Windows or macOS unsigned, which a missing declaration does, and a test repository is not", async t => {
      const repository = await ReleaseSigningTests.createAsync(t);
      await repository.writeAsync({ "package.json": JSON.stringify({ teamrun: {} }) });
      const absent = await ReleaseSigning.readAsync(repository.directory);
      await repository.writeAsync({ "package.json": JSON.stringify({ teamrun: { signedPlatforms: ["macos"] } }) });
      const partial = await ReleaseSigning.readAsync(repository.directory);

      assert.throws(() => absent.listSignedPlatforms(ReleaseSigningTests.PRODUCT, "fixtureworks/studio"), new ReleaseException(
        "fixtureworks/studio is Fixture Studio's update feed, which gets only signed windows and macos packages, but teamrun.signedPlatforms leaves out windows and macos."));
      assert.throws(() => partial.listSignedPlatforms(ReleaseSigningTests.PRODUCT, "fixtureworks/studio"), new ReleaseException(
        "fixtureworks/studio is Fixture Studio's update feed, which gets only signed windows and macos packages, but teamrun.signedPlatforms leaves out windows."));
      assert.deepEqual(partial.listSignedPlatforms(ReleaseSigningTests.PRODUCT, "fixtureworks/studio-trial"), []);
    });

    test("an unreadable manifest, or a declaration that is not distinct platforms packaging can sign, is refused", async t => {
      const repository = await ReleaseSigningTests.createAsync(t);

      await assert.rejects(ReleaseSigning.readAsync(repository.directory), ReleaseSigningTests.INVALID);
      for (const signedPlatforms of [null, "windows", ["windows", "windows"], ["linux"], ["win32"], [7]]) {
        await repository.writeAsync({ "package.json": JSON.stringify({ teamrun: { signedPlatforms } }) });
        await assert.rejects(ReleaseSigning.readAsync(repository.directory), ReleaseSigningTests.INVALID, JSON.stringify(signedPlatforms));
      }
    });
  }

  private static async createAsync(t: TestContext): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    return repository;
  }
}

ReleaseSigningTests.register();
