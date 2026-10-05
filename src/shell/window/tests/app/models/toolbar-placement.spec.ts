/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { ToolbarPlacement } from "../../../src/app/models/toolbar-placement";

describe("ToolbarPlacement", () => {
  it("refuses a toolbar with more than one preferred position", () => {
    expect(() => new ToolbarPlacement(true, "notes.main", "notes.second")).toThrowError(ArgumentException);
    expect(() => new ToolbarPlacement(true, "notes.main", null, true)).toThrowError("A toolbar has at most one of a place after another, a place before another and a row of its own.");
    expect(() => new ToolbarPlacement(true, null, "notes.main", true)).toThrowError(ArgumentException);
  });
});
