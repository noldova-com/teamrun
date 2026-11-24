/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injector } from "@angular/core";

import { OrganizationUnitSelection } from "../../../src/app/services/organization-unit-selection";

describe("OrganizationUnitSelection", () => {
  it("chooses no unit until one is selected, follows each selection and clears it", () => {
    const selection = new OrganizationUnitSelection();
    const shown = [selection.unitId()];

    selection.select("design");
    shown.push(selection.unitId());
    selection.select("build");
    shown.push(selection.unitId());
    selection.select(null);

    expect([...shown, selection.unitId()]).toEqual([null, "design", "build", null]);
  });

  it("gives a view's children the view's selection, and a view of its own a selection of its own", () => {
    const view = Injector.create({ providers: [OrganizationUnitSelection.provider] });
    const child = Injector.create({ providers: [OrganizationUnitSelection.provider], parent: view });
    const other = Injector.create({ providers: [OrganizationUnitSelection.provider] });

    child.get(OrganizationUnitSelection).select("design");

    expect([child.get(OrganizationUnitSelection) === view.get(OrganizationUnitSelection), view.get(OrganizationUnitSelection).unitId(),
      other.get(OrganizationUnitSelection).unitId()]).toEqual([true, "design", null]);
  });
});
