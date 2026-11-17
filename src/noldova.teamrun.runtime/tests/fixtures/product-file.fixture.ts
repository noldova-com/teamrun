/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { ProductInfo } from "@noldova/desktop.runtime";

export class ProductFile implements Disposable {
  private static readonly VERSION: string = "9.8.7";
  private static readonly PRODUCT: Readonly<Record<string, unknown>> = {
    name: "Fixture App",
    slug: "fixture-app",
    applicationId: "org.fixtures.app",
    developmentApplicationId: "org.fixtures.app.development",
    dataFolder: ".fixtures/app",
    deviceFolders: { windows: "Fixtures/App", macos: "Fixtures/App", linux: "fixtures/app" },
    dataDirectoryVariable: "FIXTURE_APP_DATA_DIR",
    icons: "assets/fixture-icons",
    windowsPublisher: "CN=Fixtures, O=Fixtures, C=US",
    updateFeed: null,
    version: ProductFile.VERSION,
    build: "fixture-build"
  };

  public readonly version: string = ProductFile.VERSION;
  public readonly slug: string = ProductFile.PRODUCT["slug"] as string;

  public constructor() {
    mkdirSync(dirname(ProductInfo.file), { recursive: true });
    writeFileSync(ProductInfo.file, JSON.stringify(ProductFile.PRODUCT), { flag: "wx" });
  }

  public [Symbol.dispose](): void {
    rmSync(ProductInfo.file, { force: true });
  }
}
