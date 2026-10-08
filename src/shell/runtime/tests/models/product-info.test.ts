/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ProductFileException, ProductInfo, RuntimeBuild } from "@noldova/teamrun-shell-runtime";

import { TemporaryFolderFixture } from "../fixtures/temporary-folder.fixture.js";

@TestClass
export class ProductInfoTests {
  private static readonly PRODUCT: Readonly<Record<string, unknown>> = {
    name: "Fixture Studio",
    slug: "fixture-studio",
    applicationId: "org.fixtureworks.studio",
    developmentApplicationId: "org.fixtureworks.studio.development",
    dataFolder: ".fixtureworks/studio",
    deviceFolders: { windows: "Fixture Works/Studio", macos: "Fixture Works/Studio Mac", linux: "fixtureworks/studio" },
    dataDirectoryVariable: "FIXTURE_STUDIO_DATA_DIR",
    icons: "assets/fixture-icons",
    windowsPublisher: "CN=Fixture Works, O=Fixture Works, C=US",
    updateFeed: "https://example.com/feed/",
    version: "1.2.3",
    build: "abc123"
  };

  @TestMethod
  public readsEveryFieldOfAProductFile(): Promise<void> {
    return ProductInfoTests.runAsync(async file => {
      await writeFile(file, JSON.stringify(ProductInfoTests.PRODUCT));

      const product = ProductInfo.read(file);

      Assert.areEqual(
        "Fixture Studio|fixture-studio|org.fixtureworks.studio|org.fixtureworks.studio.development|.fixtureworks/studio|Fixture Works/Studio|Fixture Works/Studio Mac|" +
          "fixtureworks/studio|FIXTURE_STUDIO_DATA_DIR|FIXTURE_STUDIO_CHECKOUT|assets/fixture-icons|CN=Fixture Works, O=Fixture Works, C=US|https://example.com/feed/|1.2.3|abc123",
        [product.name, product.slug, product.applicationId, product.developmentApplicationId, product.dataFolder, product.windowsDeviceFolder,
          product.macosDeviceFolder, product.linuxDeviceFolder, product.dataDirectoryVariable, product.checkoutVariable, product.icons, product.windowsPublisher, product.updateFeed, product.version,
          product.build].join("|"));
      await writeFile(file, JSON.stringify({ ...ProductInfoTests.PRODUCT, updateFeed: null }));
      Assert.isNull(ProductInfo.read(file).updateFeed);
    });
  }

  @TestMethod
  public theCurrentProductIsTheBuildsFileBesideTheInstalledRuntimeAndGivesTheRuntimeItsIdentity(): void {
    const current = ProductInfo.current;
    const read = ProductInfo.read(ProductInfo.file);

    Assert.isTrue(ProductInfo.file.endsWith(path.join("_build", "product.json")), ProductInfo.file);
    Assert.areEqual(current, ProductInfo.current);
    Assert.areEqual(`${read.name} ${read.version} ${read.build}`, `${current.name} ${current.version} ${current.build}`);
    Assert.areEqual(`${current.version} ${current.build}`, `${RuntimeBuild.identity.productVersion} ${RuntimeBuild.identity.fingerprint}`);
  }

  @TestMethod
  public refusesAMissingOrMalformedFileAndNamesIt(): Promise<void> {
    return ProductInfoTests.runAsync(async file => {
      const missing = Assert.throws(() => ProductInfo.read(file), ProductFileException);
      const withoutBuild = Object.fromEntries(Object.entries(ProductInfoTests.PRODUCT).filter(([key]) => key !== "build"));
      const cases: readonly (readonly [string, string])[] = [
        ["{", "The text is not valid JSON."],
        [JSON.stringify(withoutBuild), "build"],
        [JSON.stringify({ ...ProductInfoTests.PRODUCT, version: " " }), "version"],
        [JSON.stringify({ ...ProductInfoTests.PRODUCT, deviceFolders: { windows: "Studio" } }), "macos"],
        [JSON.stringify(Object.fromEntries(Object.entries(ProductInfoTests.PRODUCT).filter(([key]) => key !== "updateFeed"))), "updateFeed"]
      ];

      Assert.isTrue(missing.message.startsWith(`The build's product file ${file} is not valid: Error: ENOENT`), missing.message);
      Assert.isDefined(missing.cause);
      for (const [text, reason] of cases) {
        await writeFile(file, text);
        const exception = Assert.throws(() => ProductInfo.read(file), ProductFileException);
        Assert.isTrue(exception.message.startsWith(`The build's product file ${file} is not valid: `), exception.message);
        Assert.isTrue(exception.message.includes(reason), exception.message);
      }
    });
  }

  private static async runAsync(action: (file: string) => Promise<void>): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    await action(path.join(folder.path, "product.json"));
  }
}
