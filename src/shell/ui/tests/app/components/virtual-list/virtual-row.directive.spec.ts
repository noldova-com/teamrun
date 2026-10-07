/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { VirtualRowDirective } from "../../../../src/app/components/virtual-list/virtual-row.directive";

describe("VirtualRowDirective", () => {
  it("tells the template checker that a row's context is the item, its place and its height", () => {
    expect(VirtualRowDirective.ngTemplateContextGuard({} as VirtualRowDirective<string>, { $implicit: "item", index: 0, height: 30 })).toBe(true);
  });
});
