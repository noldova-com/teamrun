/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { TabLabel } from "../../../../src/app/models/layout/tab-label";

describe("TabLabel", () => {
  it("carries a title and an icon and rejects blank ones", () => {
    const label = new TabLabel("Files", "folder");

    expect([label.title, label.icon]).toEqual(["Files", "folder"]);
    expect(() => new TabLabel(" ", "folder")).toThrow(ArgumentException);
    expect(() => new TabLabel("Files", "")).toThrow(ArgumentException);
  });
});
