/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { OrganizationEdits } from "../../../src/app/models/organization-edits";

describe("OrganizationEdits", () => {
  it("reads a field's name trimmed from its event, and no name from another element's", () => {
    const nameFrom = (target: HTMLElement): string => {
      let name = "unread";
      target.addEventListener("change", event => {
        name = OrganizationEdits.nameOf(event);
      });
      target.dispatchEvent(new Event("change"));
      return name;
    };
    const field = document.createElement("input");
    field.value = "  Ops  ";

    expect([nameFrom(field), nameFrom(document.createElement("div"))]).toEqual(["Ops", ""]);
  });
});
