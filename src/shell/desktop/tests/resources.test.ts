/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ProductInfo } from "@noldova/teamrun-shell-runtime";

import { DesktopStartFixture } from "./fixtures/desktop-start.fixture.js";
import { FakeDesktopProcess } from "./fixtures/fake-desktop-process.fixture.js";
import { FakeElectron } from "./fixtures/fake-electron.fixture.js";

@TestClass
export class ResourcesTests {
  @TestMethod
  public async namesItselfItsWindowAndItsTaskbarEntryAfterTheProduct(): Promise<void> {
    const product = ProductInfo.current;
    const packaged = new FakeElectron(true, true);
    DesktopStartFixture.start(packaged, new FakeDesktopProcess("win32"));
    const development = new FakeElectron();
    DesktopStartFixture.start(development, new FakeDesktopProcess("win32"));
    await Promise.all([packaged.app.becomeReadyAsync(), development.app.becomeReadyAsync()]);
    const window = DesktopStartFixture.firstWindow(packaged);

    Assert.isTrue(packaged.app.calls.includes(`setName ${product.name}`), packaged.app.calls.join(", "));
    Assert.areEqual(product.name, window.options.title);
    Assert.areEqual(product.applicationId, window.appDetails?.appId);
    Assert.isTrue(DesktopStartFixture.firstWindow(development).appDetails?.appId?.startsWith(`${product.developmentApplicationId}.`) === true);
    Assert.areEqual(join(DesktopStartFixture.checkoutRoot(), ...product.icons.split("/"), "icon-dark.ico"), window.options.icon);
  }
}
