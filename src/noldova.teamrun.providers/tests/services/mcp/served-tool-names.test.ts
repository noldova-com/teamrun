/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { TurnTools } from "@noldova/teamrun.core";
import { ServedToolNames } from "@noldova/teamrun.providers";

@TestClass
export class ServedToolNamesTests {
  @TestMethod
  public async listsTheServedToolsNamesSortedAndNoneForATurnWithoutToolsOrWhoseListingFails(): Promise<void> {
    const listed = new TurnTools({ listToolsAsync: () => Promise.resolve([{ name: "terminal_run" }, { name: "computer_click" }]), callToolAsync: () => Promise.resolve({}) }, []);
    const failing = new TurnTools({ listToolsAsync: () => Promise.reject(new Error("No turn is running.")), callToolAsync: () => Promise.resolve({}) }, []);
    const signal = new AbortController().signal;

    const names = await Promise.all([listed, null, failing].map(t => ServedToolNames.listAsync(t, signal)));

    Assert.areEqual(JSON.stringify([["computer_click", "terminal_run"], null, null]), JSON.stringify(names));
  }
}
