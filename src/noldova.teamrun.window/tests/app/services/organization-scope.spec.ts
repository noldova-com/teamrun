/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injector, signal } from "@angular/core";

import { WindowPartTokens } from "@noldova/desktop.window";
import { MethodName } from "@noldova/teamrun.protocol";

import { OrganizationLayoutService } from "../../../src/app/services/organization-layout.service";
import { OrganizationScope } from "../../../src/app/services/organization-scope";
import { OrganizationStoreService } from "../../../src/app/services/organization-store.service";
import { FakeWindowPartContext } from "../../fixtures/fake-window-part-context.fixture";

describe("OrganizationScope", () => {
  let context: FakeWindowPartContext;

  afterEach(() => {
    OrganizationStoreService.release(context);
    OrganizationLayoutService.release(context);
  });

  it("names My organization until it follows a document instance, and reads the old instance as My organization", () => {
    const scope = new OrganizationScope();
    const instance = signal("organization");
    const before = scope.id();
    scope.follow(instance);
    const old = scope.id();
    instance.set("o2");

    expect([before, old, scope.id()]).toEqual(["my-organization", "my-organization", "o2"]);
  });

  it("gives a view's children its scope, store and layout rather than their own", () => {
    context = new FakeWindowPartContext().answer(MethodName.OrganizationList, () => []).answer(MethodName.OrganizationLayoutRead, () => null);
    const providers = [OrganizationScope.provider, OrganizationStoreService.provider, OrganizationLayoutService.provider];
    const view = Injector.create({ providers: [{ provide: WindowPartTokens.context, useValue: context }, ...providers] });
    const child = Injector.create({ providers, parent: view });
    const alone = Injector.create({ providers: [{ provide: WindowPartTokens.context, useValue: context }, OrganizationStoreService.provider, OrganizationLayoutService.provider] });

    expect([child.get(OrganizationScope) === view.get(OrganizationScope), child.get(OrganizationStoreService) === view.get(OrganizationStoreService),
      child.get(OrganizationLayoutService) === view.get(OrganizationLayoutService)]).toEqual([true, true, true]);
    expect([alone.get(OrganizationStoreService).id(), alone.get(OrganizationStoreService) === view.get(OrganizationStoreService)]).toEqual(["my-organization", false]);
  });
});
