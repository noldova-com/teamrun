/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Resources, WindowState, WindowStateStore } from "@noldova/teamrun-desktop";

import { TemporaryDirectory } from "../fixtures/temporary-directory.fixture.js";

@TestClass
export class WindowStateStoreTests {
  @TestMethod
  public readsTheDefaultWithoutAFileAndKeepsWhatItWrites(): void {
    using directory = new TemporaryDirectory();
    const store = new WindowStateStore(directory.resolve("state", Resources.windowStateFileName));

    Assert.isFalse(existsSync(store.path));
    Assert.areEqual(Resources.windowWidth, store.read().width);

    store.write(new WindowState(30, 40, 1200, 800, true));
    Assert.isTrue(existsSync(store.path));
    Assert.areEqual(30, store.read().x);
    Assert.isTrue(store.read().maximized);
    Assert.areEqual("{\"x\":30,\"y\":40,\"width\":1200,\"height\":800,\"maximized\":true}", readFileSync(store.path, "utf8"));

    writeFileSync(store.path, "{not json");
    Assert.areEqual(Resources.windowHeight, store.read().height);
    Assert.isNull(store.read().x);

    // A path that cannot be written (a file where the directory should be) is swallowed.
    const blocked = new WindowStateStore(directory.resolve("file", "inner.json"));
    writeFileSync(directory.resolve("file"), "x");
    Assert.doesNotThrow(() => blocked.write(WindowState.createDefault()));
  }
}
