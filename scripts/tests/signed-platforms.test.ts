/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { Writable } from "node:stream";
import { test, type TestContext } from "node:test";

import SignedPlatforms from "../signed-platforms.ts";
import ProductIdentityFixture from "./fixtures/product-identity.fixture.ts";
import RepositoryFixture from "./fixtures/repository.fixture.ts";
import SourceTreeFixture from "./fixtures/source-tree.fixture.ts";
import TextOutputFixture from "./fixtures/text-output.fixture.ts";

class BrokenOutput extends Writable {
  public override write(): boolean {
    throw new RangeError("The output broke.");
  }
}

class SignedPlatformsTests {
  private static readonly USAGE: string = "Usage: node scripts/signed-platforms.ts\n";

  public static register(): void {
    test("the platforms a release to the update feed signs are printed for the workflows, from the one rule releases follow", async t => {
      const repository = await SignedPlatformsTests.createAsync(t, { signedPlatforms: ["macos", "windows"] });
      const output = new TextOutputFixture();

      assert.equal(await new SignedPlatforms(repository.directory, output).runAsync([]), 0);
      assert.equal(output.text, "windows macos\n");
    });

    test("a declaration that leaves Windows or macOS out, misspells a platform or has no product fails with the reason", async t => {
      const partial = await SignedPlatformsTests.createAsync(t, { signedPlatforms: ["windows"] });
      const misspelled = await SignedPlatformsTests.createAsync(t, { signedPlatforms: ["windows", "macOS"] });
      const productless = await RepositoryFixture.createAsync();
      t.after(() => productless.disposeAsync());
      await productless.writeAsync({ "package.json": JSON.stringify({ teamrun: { signedPlatforms: ["windows", "macos"] } }) });
      const outputs = [new TextOutputFixture(), new TextOutputFixture(), new TextOutputFixture()] as const;

      const exitCodes = [
        await new SignedPlatforms(partial.directory, outputs[0]).runAsync([]),
        await new SignedPlatforms(misspelled.directory, outputs[1]).runAsync([]),
        await new SignedPlatforms(productless.directory, outputs[2]).runAsync([])
      ];

      assert.deepEqual(exitCodes, [1, 1, 1]);
      assert.equal(outputs[0].text, "fixtureworks/studio is Fixture Studio's update feed, which gets only signed windows and macos packages, but teamrun.signedPlatforms leaves out macos.\n");
      assert.equal(outputs[1].text, "The root package.json's teamrun.signedPlatforms must list distinct platforms among windows, macos.\n");
      assert.match(outputs[2].text, /teamrun\.product/u);
    });

    test("an unexpected error reaches the caller", async t => {
      const repository = await SignedPlatformsTests.createAsync(t, { signedPlatforms: ["windows", "macos"] });

      await assert.rejects(new SignedPlatforms(repository.directory, new BrokenOutput()).runAsync([]), new RangeError("The output broke."));
    });

    test("any argument is refused with the usage, also from the command line", async t => {
      const repository = await SignedPlatformsTests.createAsync(t, { signedPlatforms: ["windows", "macos"] });
      const output = new TextOutputFixture();

      assert.equal(await new SignedPlatforms(repository.directory, output).runAsync(["--repository", "fixtureworks/studio"]), 2);
      const command = spawnSync(process.execPath, [SourceTreeFixture.locateScript("signed-platforms.ts"), "--help"], { cwd: repository.directory, encoding: "utf8", timeout: 10_000 });

      assert.equal(output.text, SignedPlatformsTests.USAGE);
      assert.deepEqual([command.status, command.stdout], [2, SignedPlatformsTests.USAGE]);
    });
  }

  private static async createAsync(t: TestContext, settings: Readonly<Record<string, unknown>>): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    await repository.writeAsync({ "package.json": JSON.stringify(ProductIdentityFixture.manifest({}, [], settings)) });
    return repository;
  }
}

SignedPlatformsTests.register();
