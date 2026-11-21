/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeOperation } from "@noldova/context.data";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ChangeEntity } from "@noldova/teamrun.core";
import {
  type Department, DepartmentCreateParams, DepartmentIdParams, DepartmentMemberSetParams, DepartmentMoveParams, DepartmentUpdateParams, ErrorCode, Harness,
  type Organization, OrganizationLayoutSaveParams, type Teammate, TeammateCreateParams
} from "@noldova/teamrun.protocol";
import { ServiceException } from "@noldova/teamrun.services";

import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class OrganizationServiceTests {
  @TestMethod
  public async createsEachDepartmentLastAmongItsSiblingsUnderThePersonOrAParent(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const a = await OrganizationServiceTests.createAsync(host, "A");
    const b = await OrganizationServiceTests.createAsync(host, "B");
    const child = await OrganizationServiceTests.createAsync(host, "Child", a.id);
    const organization = await host.organization.listAsync();

    Assert.areEqual("A:0,B:1", OrganizationServiceTests.children(organization, null));
    Assert.areEqual("Child:0", OrganizationServiceTests.children(organization, a.id));
    Assert.areEqual(a.id, child.parentId);
    Assert.isNull(b.leaderId);
    Assert.areEqual("Insert,Insert,Insert", await OrganizationServiceTests.feedAsync(host, ChangeEntity.Department));
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => host.organization.createAsync(new DepartmentCreateParams("Lost", "gone")));
  }

  @TestMethod
  public async renamesADepartmentAndSetsOrClearsALeaderOnlyFromItsMembers(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const ada = await OrganizationServiceTests.teammateAsync(host, "Ada");
    const bob = await OrganizationServiceTests.teammateAsync(host, "Bob");
    const design = await OrganizationServiceTests.createAsync(host, "Design");
    await host.organization.setMemberAsync(new DepartmentMemberSetParams(ada.id, design.id));

    const led = await host.organization.updateAsync(new DepartmentUpdateParams(design.id, undefined, ada.id));
    const renamed = await host.organization.updateAsync(new DepartmentUpdateParams(design.id, "Product", undefined));
    const cleared = await host.organization.updateAsync(new DepartmentUpdateParams(design.id, undefined, null));

    Assert.areEqual(ada.id, led.leaderId);
    Assert.areEqual(`Product,${ada.id}`, `${renamed.name},${renamed.leaderId}`);
    Assert.isNull(cleared.leaderId);
    Assert.isNull((await host.organization.listAsync()).departments[0]?.leaderId);
    await OrganizationServiceTests.failsAsync(ErrorCode.InvalidParams, () => host.organization.updateAsync(new DepartmentUpdateParams(design.id, undefined, bob.id)));
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => host.organization.updateAsync(new DepartmentUpdateParams(design.id, undefined, "gone")));
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => host.organization.updateAsync(new DepartmentUpdateParams("gone", "X", undefined)));
  }

  @TestMethod
  public async reordersADepartmentAmongItsSiblingsAndPutsAPlacePastTheLastLast(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const a = await OrganizationServiceTests.createAsync(host, "A");
    const b = await OrganizationServiceTests.createAsync(host, "B");
    await OrganizationServiceTests.createAsync(host, "C");
    const d = await OrganizationServiceTests.createAsync(host, "D");

    await host.organization.moveAsync(new DepartmentMoveParams(b.id, null, 1));
    const kept = OrganizationServiceTests.children(await host.organization.listAsync(), null);
    await host.organization.moveAsync(new DepartmentMoveParams(d.id, null, 0));
    const first = OrganizationServiceTests.children(await host.organization.listAsync(), null);
    const moved = await host.organization.moveAsync(new DepartmentMoveParams(a.id, null, 99));
    const last = OrganizationServiceTests.children(await host.organization.listAsync(), null);

    Assert.areEqual("A:0,B:1,C:2,D:3", kept);
    Assert.areEqual("D:0,A:1,B:2,C:3", first);
    Assert.areEqual("D:0,B:1,C:2,A:3", last);
    Assert.areEqual(3, moved.order);
  }

  @TestMethod
  public async movesADepartmentUnderAnotherParentNumberingBothItsOldAndNewSiblingsAgain(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const a = await OrganizationServiceTests.createAsync(host, "A");
    const first = await OrganizationServiceTests.createAsync(host, "First", a.id);
    await OrganizationServiceTests.createAsync(host, "Second", a.id);
    const c = await OrganizationServiceTests.createAsync(host, "C");
    await OrganizationServiceTests.createAsync(host, "Kept", c.id);

    const moved = await host.organization.moveAsync(new DepartmentMoveParams(first.id, c.id, 0));
    const organization = await host.organization.listAsync();
    await host.organization.moveAsync(new DepartmentMoveParams(first.id, null, 1));

    Assert.areEqual(`${c.id}:0`, `${moved.parentId}:${moved.order}`);
    Assert.areEqual("Second:0", OrganizationServiceTests.children(organization, a.id));
    Assert.areEqual("First:0,Kept:1", OrganizationServiceTests.children(organization, c.id));
    Assert.areEqual("A:0,First:1,C:2", OrganizationServiceTests.children(await host.organization.listAsync(), null));
  }

  @TestMethod
  public async refusesToMoveADepartmentUnderItselfOrOneOfItsOwnDepartmentsOrAnUnknownOne(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const top = await OrganizationServiceTests.createAsync(host, "Top");
    const middle = await OrganizationServiceTests.createAsync(host, "Middle", top.id);
    const bottom = await OrganizationServiceTests.createAsync(host, "Bottom", middle.id);

    await OrganizationServiceTests.failsAsync(ErrorCode.InvalidParams, () => host.organization.moveAsync(new DepartmentMoveParams(top.id, bottom.id, 0)));
    await OrganizationServiceTests.failsAsync(ErrorCode.InvalidParams, () => host.organization.moveAsync(new DepartmentMoveParams(top.id, middle.id, 0)));
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => host.organization.moveAsync(new DepartmentMoveParams(top.id, "gone", 0)));
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => host.organization.moveAsync(new DepartmentMoveParams("gone", null, 0)));
    Assert.areEqual("Top:0", OrganizationServiceTests.children(await host.organization.listAsync(), null));
  }

  @TestMethod
  public async deletesADepartmentMovingItsMembersAndDepartmentsIntoItsPlaceUnderItsParent(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const ada = await OrganizationServiceTests.teammateAsync(host, "Ada");
    const bob = await OrganizationServiceTests.teammateAsync(host, "Bob");
    const cy = await OrganizationServiceTests.teammateAsync(host, "Cy");
    const root = await OrganizationServiceTests.createAsync(host, "Root");
    const gone = await OrganizationServiceTests.createAsync(host, "Gone", root.id);
    await OrganizationServiceTests.createAsync(host, "After", root.id);
    await OrganizationServiceTests.createAsync(host, "X", gone.id);
    await OrganizationServiceTests.createAsync(host, "Y", gone.id);
    await host.organization.setMemberAsync(new DepartmentMemberSetParams(cy.id, root.id));
    await host.organization.updateAsync(new DepartmentUpdateParams(root.id, undefined, cy.id));
    for (const teammate of [ada, bob])
      await host.organization.setMemberAsync(new DepartmentMemberSetParams(teammate.id, gone.id));
    await host.organization.updateAsync(new DepartmentUpdateParams(gone.id, undefined, ada.id));

    await host.organization.deleteAsync(new DepartmentIdParams(gone.id));
    const organization = await host.organization.listAsync();

    Assert.areEqual("X:0,Y:1,After:2", OrganizationServiceTests.children(organization, root.id));
    Assert.areEqual([root.id, root.id, root.id].join(","), [ada, bob, cy].map(t => organization.departmentOf(t.id)).join(","));
    Assert.areEqual(cy.id, organization.departments.find(t => t.id === root.id)?.leaderId);
    Assert.isFalse(organization.departments.some(t => t.id === gone.id));
    Assert.areEqual(ChangeOperation.Delete, (await host.context.database.changeFeed.readAfterAsync(0)).filter(t => t.entityId === gone.id).at(-1)?.operation);
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => host.organization.deleteAsync(new DepartmentIdParams(gone.id)));
  }

  @TestMethod
  public async deletesATopDepartmentLeavingItsMembersInNoDepartmentAndItsDepartmentsUnderThePerson(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const ada = await OrganizationServiceTests.teammateAsync(host, "Ada");
    const top = await OrganizationServiceTests.createAsync(host, "Top");
    await OrganizationServiceTests.createAsync(host, "Inner", top.id);
    await host.organization.setMemberAsync(new DepartmentMemberSetParams(ada.id, top.id));

    await host.organization.deleteAsync(new DepartmentIdParams(top.id));
    const organization = await host.organization.listAsync();

    Assert.isNull(organization.departmentOf(ada.id));
    Assert.areEqual(0, organization.members.length);
    Assert.areEqual("Inner:0", OrganizationServiceTests.children(organization, null));
  }

  @TestMethod
  public async listsTheDepartmentsAndMembersOfOneMomentThoughAMembershipChangeIsQueuedBetweenItsReads(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const ada = await OrganizationServiceTests.teammateAsync(host, "Ada");
    const parent = await OrganizationServiceTests.createAsync(host, "Parent");
    const inner = await OrganizationServiceTests.createAsync(host, "Inner", parent.id);
    await host.organization.setMemberAsync(new DepartmentMemberSetParams(ada.id, inner.id));
    const before = await host.organization.listAsync();

    const listing = host.organization.listAsync();
    const deleting = host.organization.deleteAsync(new DepartmentIdParams(inner.id));
    const listed = await listing;
    await deleting;

    Assert.areEqual(JSON.stringify(before.toJson()), JSON.stringify(listed.toJson()));
    Assert.areEqual(parent.id, (await host.organization.listAsync()).departmentOf(ada.id));
  }

  @TestMethod
  public async keepsATeammateInOneDepartmentAtATimeAndALeaderWhoLeavesStopsLeading(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const ada = await OrganizationServiceTests.teammateAsync(host, "Ada");
    const a = await OrganizationServiceTests.createAsync(host, "A");
    const b = await OrganizationServiceTests.createAsync(host, "B");
    await host.organization.setMemberAsync(new DepartmentMemberSetParams(ada.id, null));
    await host.organization.setMemberAsync(new DepartmentMemberSetParams(ada.id, a.id));
    await host.organization.updateAsync(new DepartmentUpdateParams(a.id, undefined, ada.id));

    await host.organization.setMemberAsync(new DepartmentMemberSetParams(ada.id, b.id));
    await host.organization.setMemberAsync(new DepartmentMemberSetParams(ada.id, b.id));
    const moved = await host.organization.listAsync();
    await host.organization.setMemberAsync(new DepartmentMemberSetParams(ada.id, null));

    Assert.areEqual(b.id, moved.departmentOf(ada.id));
    Assert.isNull(moved.departments.find(t => t.id === a.id)?.leaderId);
    Assert.isNull((await host.organization.listAsync()).departmentOf(ada.id));
    Assert.areEqual("Insert,Delete,Insert,Delete", await OrganizationServiceTests.feedAsync(host, ChangeEntity.DepartmentMember));
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => host.organization.setMemberAsync(new DepartmentMemberSetParams("gone", a.id)));
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => host.organization.setMemberAsync(new DepartmentMemberSetParams(ada.id, "gone")));
  }

  @TestMethod
  public async takesATeammateBeingDeletedOutOfItsDepartmentAndItsLeadership(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const ada = await OrganizationServiceTests.teammateAsync(host, "Ada");
    const bob = await OrganizationServiceTests.teammateAsync(host, "Bob");
    const a = await OrganizationServiceTests.createAsync(host, "A");
    await host.organization.setMemberAsync(new DepartmentMemberSetParams(ada.id, a.id));
    await host.organization.updateAsync(new DepartmentUpdateParams(a.id, undefined, ada.id));

    const removed = await host.context.database.connection.runInTransactionAsync(t => host.organization.removeTeammateAsync(ada.id, t));
    const outside = await host.context.database.connection.runInTransactionAsync(t => host.organization.removeTeammateAsync(bob.id, t));
    const organization = await host.organization.listAsync();

    Assert.isTrue(removed);
    Assert.isFalse(outside);
    Assert.areEqual(0, organization.members.length);
    Assert.isNull(organization.departments[0]?.leaderId);
  }

  @TestMethod
  public async keepsTheOrganizationLayoutAsItIsAndRecordsEachSave(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const first = { collapsed: ["d1"], cardsShow: { status: true } };
    const second = { collapsed: [], cards: { t1: { usage: true } } };

    Assert.isNull(await host.organization.readLayoutAsync());
    Assert.areEqual(JSON.stringify(first), JSON.stringify(await host.organization.saveLayoutAsync(new OrganizationLayoutSaveParams(first))));
    await host.organization.saveLayoutAsync(new OrganizationLayoutSaveParams(second));

    Assert.areEqual(JSON.stringify(second), JSON.stringify(await host.organization.readLayoutAsync()));
    Assert.areEqual("Insert,Update", await OrganizationServiceTests.feedAsync(host, ChangeEntity.Preference));
  }
  private static async createAsync(host: CoreHost, name: string, parentId: string | null = null): Promise<Department> {
    return await host.organization.createAsync(new DepartmentCreateParams(name, parentId));
  }

  private static async teammateAsync(host: CoreHost, name: string): Promise<Teammate> {
    const provider = await host.providerOfAsync();
    return await host.teammates.createAsync(new TeammateCreateParams(name, null, provider.id, Harness.Provider, null, null));
  }

  private static children(organization: Organization, parentId: string | null): string {
    return organization.childrenOf(parentId).map(t => `${t.name}:${t.order}`).join(",");
  }

  private static async feedAsync(host: CoreHost, entity: ChangeEntity): Promise<string> {
    return (await host.context.database.changeFeed.readAfterAsync(0)).filter(t => t.entity === entity).map(t => t.operation).join(",");
  }

  private static async failsAsync(code: ErrorCode, action: () => Promise<unknown>): Promise<void> {
    Assert.areEqual(code, (await Assert.throwsAsync(action, ServiceException)).info.name);
  }
}
