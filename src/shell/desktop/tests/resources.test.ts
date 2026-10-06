/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ProductInfo } from "@noldova/teamrun-shell-runtime";

import { DesktopStartFixture } from "./fixtures/desktop-start.fixture.js";
import { FakeDesktopProcess } from "./fixtures/fake-desktop-process.fixture.js";
import { FakeElectron } from "./fixtures/fake-electron.fixture.js";

@TestClass
export class ResourcesTests {
  @TestMethod
  public async namesItselfAndItsDevelopmentTaskbarEntryAfterTheProduct(): Promise<void> {
    const product = ProductInfo.current;
    const electron = new FakeElectron();
    DesktopStartFixture.start(electron, new FakeDesktopProcess("win32"));
    await DesktopStartFixture.openAsync(electron);

    Assert.isTrue(electron.app.calls.includes(`setName ${product.name}`), electron.app.calls.join(", "));
    Assert.isTrue(DesktopStartFixture.firstWindow(electron).appDetails?.appId?.startsWith(`${product.developmentApplicationId}.`) === true);
  }
}
