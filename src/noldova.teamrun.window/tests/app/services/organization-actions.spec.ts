/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { OrganizationActions } from "../../../src/app/services/organization-actions";
import { Resources } from "../../../src/resources";
import { FakeWindowPartContext } from "../../fixtures/fake-window-part-context.fixture";

describe("OrganizationActions", () => {
  it("logs a change whose parameters it can't build and sends nothing", async () => {
    const context = new FakeWindowPartContext();

    await OrganizationActions.create(context, " ");
    await OrganizationActions.rename(context, " ", "Studio");
    await OrganizationActions.setFolder(context, " ", null);
    await OrganizationActions.remove(context, " ");

    expect(context.requests).toEqual([]);
    expect(context.lines.map(t => t.startsWith(Resources.formatOrganizationActionFailed("")))).toEqual([true, true, true, true]);
  });
});
