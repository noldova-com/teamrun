/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ChangeOperation } from "@noldova/context.data";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ChangeEntity } from "@noldova/teamrun.core";
import {
  type Department, DepartmentCreateParams, DepartmentIdParams, DepartmentMemberSetParams, DepartmentMoveParams, DepartmentUpdateParams, ErrorCode, Harness,
  type Organization, OrganizationLayoutSaveParams, OrganizationNodeKind, OrganizationParent, type Teammate, TeammateCreateParams, TeammatePlaceParams
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
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => host.organization.createAsync(new DepartmentCreateParams("Lost", OrganizationParent.department("gone"))));
  }

  @TestMethod
  public async renamesADepartmentAndSetsOrClearsALeaderPlacingALeaderFromOutsideInIt(): Promise<void> {
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
    await host.organization.updateAsync(new DepartmentUpdateParams(design.id, undefined, bob.id));
    Assert.areEqual(`${design.id}:0,${design.id}:1`, OrganizationServiceTests.places(await host.organization.listAsync(), ada, bob));
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

    await host.organization.moveAsync(new DepartmentMoveParams(b.id, OrganizationParent.person, 1));
    const kept = OrganizationServiceTests.children(await host.organization.listAsync(), null);
    await host.organization.moveAsync(new DepartmentMoveParams(d.id, OrganizationParent.person, 0));
    const first = OrganizationServiceTests.children(await host.organization.listAsync(), null);
    const moved = await host.organization.moveAsync(new DepartmentMoveParams(a.id, OrganizationParent.person, 99));
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

    const moved = await host.organization.moveAsync(new DepartmentMoveParams(first.id, OrganizationParent.department(c.id), 0));
    const organization = await host.organization.listAsync();
    await host.organization.moveAsync(new DepartmentMoveParams(first.id, OrganizationParent.person, 1));

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

    await OrganizationServiceTests.failsAsync(ErrorCode.InvalidParams, () => host.organization.moveAsync(new DepartmentMoveParams(top.id, OrganizationParent.department(bottom.id), 0)));
    await OrganizationServiceTests.failsAsync(ErrorCode.InvalidParams, () => host.organization.moveAsync(new DepartmentMoveParams(top.id, OrganizationParent.department(middle.id), 0)));
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => host.organization.moveAsync(new DepartmentMoveParams(top.id, OrganizationParent.department("gone"), 0)));
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => host.organization.moveAsync(new DepartmentMoveParams("gone", OrganizationParent.person, 0)));
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
  public async deletesATopDepartmentMovingItsTeammatesAndDepartmentsUnderThePerson(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const ada = await OrganizationServiceTests.teammateAsync(host, "Ada");
    const top = await OrganizationServiceTests.createAsync(host, "Top");
    await OrganizationServiceTests.createAsync(host, "Inner", top.id);
    await host.organization.setMemberAsync(new DepartmentMemberSetParams(ada.id, top.id));

    await host.organization.deleteAsync(new DepartmentIdParams(top.id));
    const organization = await host.organization.listAsync();

    Assert.isNull(organization.departmentOf(ada.id));
    Assert.areEqual(0, organization.members.length);
    Assert.areEqual(":0", OrganizationServiceTests.places(organization, ada));
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
  public async keepsATeammateInOneDepartmentAtATimeAndPutsOneLeavingItsDepartmentUnderThePersonEndingItsLeadership(): Promise<void> {
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
    Assert.areEqual("Person:0", OrganizationServiceTests.parentOf(await host.organization.listAsync(), ada));
    Assert.areEqual("Insert,Update,Update,Update", await OrganizationServiceTests.feedAsync(host, ChangeEntity.TeammatePlacement));
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
  public async createsADepartmentWithItsLeaderInOneStepMovingTheLeaderIntoItFirst(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const ada = await OrganizationServiceTests.teammateAsync(host, "Ada");
    const bob = await OrganizationServiceTests.teammateAsync(host, "Bob");
    const cy = await OrganizationServiceTests.teammateAsync(host, "Cy");
    const ops = await OrganizationServiceTests.createAsync(host, "Ops");
    for (const teammate of [ada, bob])
      await host.organization.setMemberAsync(new DepartmentMemberSetParams(teammate.id, ops.id));
    await host.organization.updateAsync(new DepartmentUpdateParams(ops.id, undefined, ada.id));

    const design = await host.organization.createAsync(new DepartmentCreateParams("Design", OrganizationParent.person, ada.id));
    const under = await host.organization.createAsync(new DepartmentCreateParams("Under Bob", OrganizationParent.teammate(bob.id)));
    const organization = await host.organization.listAsync();

    Assert.areEqual(`${ada.id},${design.id}:0,${ops.id}:0`, `${design.leaderId},${OrganizationServiceTests.places(organization, ada, bob)}`);
    Assert.isNull(organization.departments.find(t => t.id === ops.id)?.leaderId);
    Assert.areEqual(`${OrganizationNodeKind.Teammate}:${bob.id}`, `${under.parent.kind}:${under.parent.id}`);
    Assert.areEqual("Under Bob:0", OrganizationServiceTests.children(organization, OrganizationParent.teammate(bob.id)));
    await OrganizationServiceTests.failsAsync(ErrorCode.InvalidParams,
      () => host.organization.createAsync(new DepartmentCreateParams("Bob's", OrganizationParent.department(under.id), bob.id)));
    await OrganizationServiceTests.failsAsync(ErrorCode.InvalidParams,
      () => host.organization.createAsync(new DepartmentCreateParams("Bob's", OrganizationParent.teammate(bob.id), bob.id)));
    await OrganizationServiceTests.failsAsync(ErrorCode.InvalidParams, () => host.organization.updateAsync(new DepartmentUpdateParams(under.id, undefined, bob.id)));
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => host.organization.createAsync(new DepartmentCreateParams("X", OrganizationParent.person, "gone")));
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => host.organization.createAsync(new DepartmentCreateParams("X", OrganizationParent.teammate(cy.id))));
    Assert.areEqual(3, (await host.organization.listAsync()).departments.length);
  }

  @TestMethod
  public async placesATeammateUnderThePersonATeammateOrADepartmentAtAnOrderNumberingItsSiblingsAgain(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const boss = await OrganizationServiceTests.teammateAsync(host, "Boss");
    const ann = await OrganizationServiceTests.teammateAsync(host, "Ann");
    const kid = await OrganizationServiceTests.teammateAsync(host, "Kid");
    const cy = await OrganizationServiceTests.teammateAsync(host, "Cy");
    const dee = await OrganizationServiceTests.teammateAsync(host, "Dee");
    const place = (teammate: Teammate, parent: OrganizationParent | null, order: number): Promise<void> =>
      host.organization.placeAsync(new TeammatePlaceParams(teammate.id, parent, order));
    const underBoss = OrganizationParent.teammate(boss.id);

    await place(boss, OrganizationParent.person, 0);
    await place(ann, underBoss, 0);
    await place(kid, underBoss, 0);
    await place(cy, underBoss, 9);
    const placed = await host.organization.listAsync();
    await place(ann, OrganizationParent.person, 0);
    await place(cy, underBoss, 0);
    const moved = await host.organization.listAsync();

    Assert.areEqual(`${boss.id}:0,${boss.id}:1,${boss.id}:2`, OrganizationServiceTests.places(placed, kid, ann, cy));
    Assert.areEqual(`:0,:1,${boss.id}:1,${boss.id}:0`, OrganizationServiceTests.places(moved, ann, boss, kid, cy));
    Assert.areEqual(boss.id, moved.leaders.join(","));
    Assert.areEqual(boss.id, moved.managerOf(kid.id));
    await OrganizationServiceTests.failsAsync(ErrorCode.InvalidParams, () => place(boss, OrganizationParent.teammate(kid.id), 0));
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => place(boss, OrganizationParent.department("gone"), 0));
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => place(boss, OrganizationParent.teammate(dee.id), 0));
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => host.organization.placeAsync(new TeammatePlaceParams("gone", OrganizationParent.person, 0)));
    Assert.areEqual(JSON.stringify(moved.toJson()), JSON.stringify((await host.organization.listAsync()).toJson()));
  }

  @TestMethod
  public async takesATeammateOutOfTheOrganizationMovingWhatSatUnderItToItsParentAndEndingItsLeadership(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const boss = await OrganizationServiceTests.teammateAsync(host, "Boss");
    const ann = await OrganizationServiceTests.teammateAsync(host, "Ann");
    const kid = await OrganizationServiceTests.teammateAsync(host, "Kid");
    const cy = await OrganizationServiceTests.teammateAsync(host, "Cy");
    const ops = await OrganizationServiceTests.createAsync(host, "Ops");
    await host.organization.placeAsync(new TeammatePlaceParams(boss.id, OrganizationParent.department(ops.id), 0));
    await host.organization.placeAsync(new TeammatePlaceParams(kid.id, OrganizationParent.department(ops.id), 1));
    await host.organization.placeAsync(new TeammatePlaceParams(ann.id, OrganizationParent.teammate(boss.id), 0));
    const design = await host.organization.createAsync(new DepartmentCreateParams("Design", OrganizationParent.teammate(boss.id), cy.id));
    await host.organization.updateAsync(new DepartmentUpdateParams(ops.id, undefined, boss.id));

    await host.organization.placeAsync(new TeammatePlaceParams(boss.id, null, 0));
    await host.organization.placeAsync(new TeammatePlaceParams(boss.id, null, 0));
    const organization = await host.organization.listAsync();

    Assert.areEqual(`:,${ops.id}:0,${ops.id}:1,${design.id}:0`, OrganizationServiceTests.places(organization, boss, kid, ann, cy));
    Assert.areEqual(`Design:0`, OrganizationServiceTests.children(organization, OrganizationParent.department(ops.id)));
    Assert.isNull(organization.departments.find(t => t.id === ops.id)?.leaderId);
    Assert.areEqual(cy.id, organization.departments.find(t => t.id === design.id)?.leaderId);
    Assert.areEqual("Delete", (await OrganizationServiceTests.feedAsync(host, ChangeEntity.TeammatePlacement)).split(",").at(-1));
  }

  @TestMethod
  public async movesADepartmentUnderATeammateButNotUnderOneInsideIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const boss = await OrganizationServiceTests.teammateAsync(host, "Boss");
    const kid = await OrganizationServiceTests.teammateAsync(host, "Kid");
    const dee = await OrganizationServiceTests.teammateAsync(host, "Dee");
    const design = await OrganizationServiceTests.createAsync(host, "Design");
    await host.organization.placeAsync(new TeammatePlaceParams(boss.id, OrganizationParent.person, 0));
    await host.organization.setMemberAsync(new DepartmentMemberSetParams(kid.id, design.id));

    const moved = await host.organization.moveAsync(new DepartmentMoveParams(design.id, OrganizationParent.teammate(boss.id), 0));
    const organization = await host.organization.listAsync();

    Assert.areEqual(`${boss.id},`, `${moved.parent.id},${moved.parentId ?? ""}`);
    Assert.areEqual("Design:0", OrganizationServiceTests.children(organization, OrganizationParent.teammate(boss.id)));
    Assert.areEqual(boss.id, organization.managerOf(kid.id));
    await OrganizationServiceTests.failsAsync(ErrorCode.InvalidParams, () => host.organization.moveAsync(new DepartmentMoveParams(design.id, OrganizationParent.teammate(kid.id), 0)));
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => host.organization.moveAsync(new DepartmentMoveParams(design.id, OrganizationParent.teammate(dee.id), 0)));
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
    return await host.organization.createAsync(new DepartmentCreateParams(name, OrganizationParent.departmentOrPerson(parentId)));
  }

  private static parentOf(organization: Organization, teammate: Teammate): string {
    const placement = organization.placements.find(t => t.teammateId === teammate.id);
    return Object.isUndefined(placement) ? String.empty : `${placement.parent.kind}:${placement.order}`;
  }

  private static places(organization: Organization, ...teammates: readonly Teammate[]): string {
    return teammates.map(t => organization.placements.find(u => u.teammateId === t.id)).map(t => `${t?.parent.id ?? ""}:${t?.order ?? ""}`).join(",");
  }

  private static async teammateAsync(host: CoreHost, name: string): Promise<Teammate> {
    const provider = await host.providerOfAsync();
    return await host.teammates.createAsync(new TeammateCreateParams(name, null, provider.id, Harness.Provider, null, null));
  }

  private static children(organization: Organization, parent: string | OrganizationParent | null): string {
    const node = Object.isString(parent) || Object.isNull(parent) ? OrganizationParent.departmentOrPerson(parent) : parent;
    return organization.departmentsUnder(node).map(t => `${t.name}:${t.order}`).join(",");
  }

  private static async feedAsync(host: CoreHost, entity: ChangeEntity): Promise<string> {
    return (await host.context.database.changeFeed.readAfterAsync(0)).filter(t => t.entity === entity).map(t => t.operation).join(",");
  }

  private static async failsAsync(code: ErrorCode, action: () => Promise<unknown>): Promise<void> {
    Assert.areEqual(code, (await Assert.throwsAsync(action, ServiceException)).info.name);
  }
}
