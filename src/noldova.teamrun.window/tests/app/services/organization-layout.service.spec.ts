/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";

import { MethodName, OrganizationIdParams, OrganizationLayoutSaveParams } from "@noldova/teamrun.protocol";

import { OrganizationCardField } from "../../../src/app/enums/organization-card-field";
import { OrganizationLayout } from "../../../src/app/models/organization-layout";
import { OrganizationLayoutService } from "../../../src/app/services/organization-layout.service";
import { OrganizationScope } from "../../../src/app/services/organization-scope";
import { FakeWindowPartContext } from "../../fixtures/fake-window-part-context.fixture";
import { Wait } from "../../fixtures/wait.fixture";

describe("OrganizationLayoutService", () => {
  let context: FakeWindowPartContext;

  afterEach(() => {
    OrganizationLayoutService.release(context);
  });

  it("shows and changes the layout of the organization its scope names, and follows the scope to another", async () => {
    const saves: string[] = [];
    context = new FakeWindowPartContext()
      .answer(MethodName.OrganizationLayoutRead, t => new OrganizationLayout([OrganizationIdParams.fromJson(t).organizationId === "o2" ? "d2" : "d0"]).toJson())
      .answer(MethodName.OrganizationLayoutSave, t => {
        const params = OrganizationLayoutSaveParams.fromJson(t);
        const layout = OrganizationLayout.fromJson(params.layout);
        saves.push(`${params.organizationId} ${layout.collapsedDepartments.join("+")} ${String(layout.cardsShow.has(OrganizationCardField.Usage))} ${[...layout.cards.keys()].join("+")}`);
        return params.layout;
      });
    const instance = signal("my-organization");
    const scope = new OrganizationScope();
    scope.follow(instance);
    const layout = new OrganizationLayoutService(context, scope);
    const before = layout.layout().collapsedDepartments;
    await Wait.until(() => expect(layout.layout().collapsedDepartments).toEqual(["d0"]));

    layout.toggleDepartment("d1");
    layout.showOnEveryCard(OrganizationCardField.Usage, true);
    layout.showOnCard("t1", OrganizationCardField.Last, true);
    layout.clearCard("t1");
    layout.showOnCard("t2", OrganizationCardField.Model, true);
    layout.clearEveryCard();
    await Wait.until(() => expect(saves).toHaveLength(6));
    instance.set("o2");

    await Wait.until(() => expect(layout.layout().collapsedDepartments).toEqual(["d2"]));
    expect(before).toEqual([]);
    expect(saves).toEqual(["my-organization d0+d1 false ", "my-organization d0+d1 true ", "my-organization d0+d1 true t1", "my-organization d0+d1 true ",
      "my-organization d0+d1 true t2", "my-organization d0+d1 true "]);
  });
});
