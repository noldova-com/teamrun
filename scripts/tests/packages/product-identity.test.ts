/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { symlink } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import PackageException from "../../packages/package.exception.ts";
import ProductIdentity from "../../packages/product-identity.ts";
import ProductIdentityFixture from "../fixtures/product-identity.fixture.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class ProductIdentityTests {
  private static readonly MISSING: string = "The root package.json must declare teamrun.product.";

  public static register(): void {
    test("the product's identity is read from the root manifest's teamrun.product", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ "package.json": JSON.stringify(ProductIdentityFixture.manifest()) });

      const product = await ProductIdentity.readAsync(repository.directory);

      assert.deepEqual(
        [product.name, product.publisher, product.slug, product.applicationId, product.developmentApplicationId, product.dataFolder,
          product.windowsDeviceFolder, product.macosDeviceFolder, product.linuxDeviceFolder, product.dataDirectoryVariable, product.icons, product.releaseRepository, product.windowsPublisher],
        ["Fixture Studio", "Fixture Works", "fixture-studio", "org.fixtureworks.studio", "org.fixtureworks.studio.development", ".fixtureworks/studio",
          "Fixture Works/Studio", "Fixture Works/Studio Mac", "fixtureworks/studio", "FIXTURE_STUDIO_DATA_DIR", "assets/fixture-icons", "fixtureworks/studio",
          "CN=Fixture Works, O=Fixture Works, L=Fixtureville, C=US"]);
      assert.equal(Reflect.has(product, "windowsSigning"), false);
      assert.deepEqual(product.literals, [
        "Fixture Studio", "org.fixtureworks.studio", "org.fixtureworks.studio.development", ".fixtureworks/studio",
        "Fixture Works/Studio", "Fixture Works/Studio Mac", "fixtureworks/studio", "FIXTURE_STUDIO_DATA_DIR", "assets/fixture-icons"
      ]);
    });

    test("each checkout gets its own stable development application ID, the same when reached through a link", async t => {
      const first = await RepositoryFixture.createAsync();
      const second = await RepositoryFixture.createAsync();
      t.after(() => Promise.all([first.disposeAsync(), second.disposeAsync()]));
      const link = path.join(path.dirname(first.directory), "link");
      await symlink(first.directory, link, "junction");
      const product = ProductIdentity.fromManifest(ProductIdentityFixture.manifest());

      const id = product.formatDevelopmentApplicationId(first.directory);

      assert.match(id, /^org\.fixtureworks\.studio\.development\.[0-9a-f]{8}$/);
      assert.equal(product.formatDevelopmentApplicationId(path.join(first.directory, "..", "repository")), id);
      assert.equal(product.formatDevelopmentApplicationId(link), id);
      assert.notEqual(product.formatDevelopmentApplicationId(second.directory), id);
    });

    test("the release repository is the update feed whatever the case it is written in, and no other repository is", () => {
      const product = ProductIdentity.fromManifest(ProductIdentityFixture.manifest());

      assert.deepEqual(["fixtureworks/studio", "FixtureWorks/Studio", "FIXTUREWORKS/STUDIO", "fixtureworks/studio-trial", "other/studio"].map(t => product.isReleaseRepository(t)),
        [true, true, true, false, false]);
    });

    test("the update feed is the latest release download of the release repository", () => {
      assert.equal(ProductIdentity.fromManifest(ProductIdentityFixture.manifest()).updateFeed, "https://github.com/fixtureworks/studio/releases/latest/download/");
    });

    test("the same device folder on several systems is one literal", () => {
      const product = ProductIdentity.fromManifest(ProductIdentityFixture.manifest({ deviceFolders: { windows: "Works/Studio", macos: "Works/Studio", linux: "works/studio" } }));

      assert.deepEqual(product.literals.filter(t => t.includes("Studio") && t.includes("/")), ["Works/Studio"]);
    });

    test("a missing or unreadable section is refused", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const isMissing = (error: unknown): boolean => error instanceof PackageException && error.message === ProductIdentityTests.MISSING;

      await assert.rejects(ProductIdentity.readAsync(repository.directory), isMissing);
      for (const manifest of [null, [], {}, { teamrun: null }, { teamrun: {} }, { teamrun: { product: "TeamRun" } }, { teamrun: { product: [] } }])
        assert.throws(() => ProductIdentity.fromManifest(manifest), isMissing, JSON.stringify(manifest));
    });

    test("each invalid field is refused by name", () => {
      const cases: readonly [Readonly<Record<string, unknown>>, string][] = [
        [{ name: " " }, "name must be a name without quotes, backslashes or line breaks"],
        [{ name: "Quote\"d" }, "name must be a name without quotes, backslashes or line breaks"],
        [{ publisher: "" }, "publisher must be a name without quotes, backslashes or line breaks"],
        [{ publisher: "Back\\slash" }, "publisher must be a name without quotes, backslashes or line breaks"],
        [{ slug: "Fixture" }, "slug must be lowercase kebab-case"],
        [{ applicationId: "fixture" }, "applicationId must be a lowercase reverse-DNS ID"],
        [{ applicationId: 7 }, "applicationId must be a lowercase reverse-DNS ID"],
        [{ developmentApplicationId: "org.fixtureworks.studio" }, "developmentApplicationId must be a lowercase reverse-DNS ID other than applicationId"],
        [{ developmentApplicationId: "Org.Fixture" }, "developmentApplicationId must be a lowercase reverse-DNS ID other than applicationId"],
        [{ dataFolder: "/absolute" }, "dataFolder must be a relative folder whose segments are separated by /"],
        [{ dataFolder: "up/../out" }, "dataFolder must be a relative folder whose segments are separated by /"],
        [{ deviceFolders: { windows: "C:\\Works", macos: "Works", linux: "works" } }, "deviceFolders.windows must be a relative folder whose segments are separated by /"],
        [{ deviceFolders: { windows: "Works", macos: "./Works", linux: "works" } }, "deviceFolders.macos must be a relative folder whose segments are separated by /"],
        [{ deviceFolders: { windows: "Works", macos: "Works" } }, "deviceFolders.linux must be a relative folder whose segments are separated by /"],
        [{ deviceFolders: null }, "deviceFolders.windows must be a relative folder whose segments are separated by /"],
        [{ dataDirectoryVariable: "fixture_dir" }, "dataDirectoryVariable must be an uppercase environment variable name"],
        [{ icons: "assets/*" }, "icons must be a relative folder whose segments are separated by /"],
        [{ releaseRepository: "studio" }, "releaseRepository must be a GitHub repository written as owner/name"],
        [{ releaseRepository: "-works/studio" }, "releaseRepository must be a GitHub repository written as owner/name"],
        [{ releaseRepository: "works/studio/extra" }, "releaseRepository must be a GitHub repository written as owner/name"],
        ...["O=Fixture Works, CN=Fixture Works", "CN=Fixture Works,O=Fixture Works", "CN=Fixture, Works", "CN=Fixture Works, O=\"Works\""].map((t): [Readonly<Record<string, unknown>>, string] =>
          [{ windowsPublisher: t }, "windowsPublisher must be the distinguished name of the Windows signing certificate's subject, starting with CN= and with its fields separated by \", \""])
      ];

      for (const [overrides, problem] of cases)
        assert.throws(
          () => ProductIdentity.fromManifest(ProductIdentityFixture.manifest(overrides)),
          (error: unknown) => error instanceof PackageException && error.message === `The root package.json's teamrun.product.${problem}.`,
          JSON.stringify(overrides));
    });
  }
}

ProductIdentityTests.register();
