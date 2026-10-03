/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { ViewBadge } from "../../../src/app/models/view-badge";

describe("ViewBadge", () => {
  it("is a count from 1 or a dot, with a description", () => {
    const count = new ViewBadge(120, "120 unread");
    const dot = new ViewBadge(null, "Changed");

    expect([count.count, count.description, dot.count, dot.description]).toEqual([120, "120 unread", null, "Changed"]);
  });

  it("refuses a count below 1 or not whole, and a blank description", () => {
    for (const count of [0, -2, 1.5, Number.NaN])
      expect(() => new ViewBadge(count, "Unread")).toThrowError(new ArgumentException("A badge's count must be a whole number from 1, or null for a dot.", "count"));
    expect(() => new ViewBadge(1, " ")).toThrowError(ArgumentException);
  });
});
