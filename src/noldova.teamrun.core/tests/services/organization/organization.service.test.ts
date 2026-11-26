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
import { ChangeEntity, OrganizationService } from "@noldova/teamrun.core";
import {
  ConversationCreateParams, type Department, DepartmentCreateParams, DepartmentIdParams, DepartmentMemberSetParams, DepartmentMoveParams, DepartmentUpdateParams, ErrorCode, Harness,
  NodeTypeCreateParams, NodeTypeIdParams, NodeTypeUpdateParams, type Organization, OrganizationChat, OrganizationCreateParams, OrganizationIdParams, OrganizationLayoutSaveParams, OrganizationNodeKind, OrganizationParent,
  OrganizationUpdateParams, Resources, type Teammate, TeammateCreateParams, TeammatePlaceParams
} from "@noldova/teamrun.protocol";
import { ServiceException } from "@noldova/teamrun.services";

import { CoreHost } from "../../fixtures/core-host.fixture.js";
import { TestDatabase } from "../../fixtures/test-database.fixture.js";

@TestClass
export class OrganizationServiceTests {
  private static readonly mine: string = Resources.defaultOrganizationId;

  @TestMethod
  public async createsEachDepartmentLastAmongItsSiblingsUnderThePersonOrAParent(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const type = await host.typeAsync();
    const a = await OrganizationServiceTests.createAsync(host, "A");
    const b = await OrganizationServiceTests.createAsync(host, "B");
    const child = await OrganizationServiceTests.createAsync(host, "Child", a.id);
    const organization = await OrganizationServiceTests.mineAsync(host);

    Assert.areEqual("A:0,B:1", OrganizationServiceTests.children(organization, null));
    Assert.areEqual("Child:0", OrganizationServiceTests.children(organization, a.id));
    Assert.areEqual(a.id, child.parentId);
    Assert.isNull(b.leaderId);
    Assert.areEqual("Insert,Insert,Insert", await OrganizationServiceTests.feedAsync(host, ChangeEntity.Department));
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => host.organization.createAsync(new DepartmentCreateParams(OrganizationServiceTests.mine, "Lost", type, OrganizationParent.department("gone"))));
  }

  @TestMethod
  public async renamesADepartmentAndSetsOrClearsALeaderPlacingALeaderFromOutsideInIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const ada = await OrganizationServiceTests.teammateAsync(host, "Ada");
    const bob = await OrganizationServiceTests.teammateAsync(host, "Bob");
    const design = await OrganizationServiceTests.createAsync(host, "Design");
    await host.organization.setMemberAsync(new DepartmentMemberSetParams(OrganizationServiceTests.mine, ada.id, design.id));

    const led = await host.organization.updateAsync(new DepartmentUpdateParams(OrganizationServiceTests.mine, design.id, undefined, ada.id));
    const renamed = await host.organization.updateAsync(new DepartmentUpdateParams(OrganizationServiceTests.mine, design.id, "Product", undefined));
    const cleared = await host.organization.updateAsync(new DepartmentUpdateParams(OrganizationServiceTests.mine, design.id, undefined, null));

    Assert.areEqual(ada.id, led.leaderId);
    Assert.areEqual(`Product,${ada.id}`, `${renamed.name},${renamed.leaderId}`);
    Assert.isNull(cleared.leaderId);
    Assert.isNull((await OrganizationServiceTests.mineAsync(host)).departments[0]?.leaderId);
    await host.organization.updateAsync(new DepartmentUpdateParams(OrganizationServiceTests.mine, design.id, undefined, bob.id));
    Assert.areEqual(`${design.id}:0,${design.id}:1`, OrganizationServiceTests.places(await OrganizationServiceTests.mineAsync(host), ada, bob));
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => host.organization.updateAsync(new DepartmentUpdateParams(OrganizationServiceTests.mine, design.id, undefined, "gone")));
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => host.organization.updateAsync(new DepartmentUpdateParams(OrganizationServiceTests.mine, "gone", "X", undefined)));
  }

  @TestMethod
  public async reordersADepartmentAmongItsSiblingsAndPutsAPlacePastTheLastLast(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const a = await OrganizationServiceTests.createAsync(host, "A");
    const b = await OrganizationServiceTests.createAsync(host, "B");
    await OrganizationServiceTests.createAsync(host, "C");
    const d = await OrganizationServiceTests.createAsync(host, "D");

    await host.organization.moveAsync(new DepartmentMoveParams(OrganizationServiceTests.mine, b.id, OrganizationParent.person, 1));
    const kept = OrganizationServiceTests.children(await OrganizationServiceTests.mineAsync(host), null);
    await host.organization.moveAsync(new DepartmentMoveParams(OrganizationServiceTests.mine, d.id, OrganizationParent.person, 0));
    const first = OrganizationServiceTests.children(await OrganizationServiceTests.mineAsync(host), null);
    const moved = await host.organization.moveAsync(new DepartmentMoveParams(OrganizationServiceTests.mine, a.id, OrganizationParent.person, 99));
    const last = OrganizationServiceTests.children(await OrganizationServiceTests.mineAsync(host), null);

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

    const moved = await host.organization.moveAsync(new DepartmentMoveParams(OrganizationServiceTests.mine, first.id, OrganizationParent.department(c.id), 0));
    const organization = await OrganizationServiceTests.mineAsync(host);
    await host.organization.moveAsync(new DepartmentMoveParams(OrganizationServiceTests.mine, first.id, OrganizationParent.person, 1));

    Assert.areEqual(`${c.id}:0`, `${moved.parentId}:${moved.order}`);
    Assert.areEqual("Second:0", OrganizationServiceTests.children(organization, a.id));
    Assert.areEqual("First:0,Kept:1", OrganizationServiceTests.children(organization, c.id));
    Assert.areEqual("A:0,First:1,C:2", OrganizationServiceTests.children(await OrganizationServiceTests.mineAsync(host), null));
  }

  @TestMethod
  public async refusesToMoveADepartmentUnderItselfOrOneOfItsOwnDepartmentsOrAnUnknownOne(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const top = await OrganizationServiceTests.createAsync(host, "Top");
    const middle = await OrganizationServiceTests.createAsync(host, "Middle", top.id);
    const bottom = await OrganizationServiceTests.createAsync(host, "Bottom", middle.id);

    await OrganizationServiceTests.failsAsync(ErrorCode.InvalidParams, () => host.organization.moveAsync(new DepartmentMoveParams(OrganizationServiceTests.mine, top.id, OrganizationParent.department(bottom.id), 0)));
    await OrganizationServiceTests.failsAsync(ErrorCode.InvalidParams, () => host.organization.moveAsync(new DepartmentMoveParams(OrganizationServiceTests.mine, top.id, OrganizationParent.department(middle.id), 0)));
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => host.organization.moveAsync(new DepartmentMoveParams(OrganizationServiceTests.mine, top.id, OrganizationParent.department("gone"), 0)));
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => host.organization.moveAsync(new DepartmentMoveParams(OrganizationServiceTests.mine, "gone", OrganizationParent.person, 0)));
    Assert.areEqual("Top:0", OrganizationServiceTests.children(await OrganizationServiceTests.mineAsync(host), null));
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
    await host.organization.setMemberAsync(new DepartmentMemberSetParams(OrganizationServiceTests.mine, cy.id, root.id));
    await host.organization.updateAsync(new DepartmentUpdateParams(OrganizationServiceTests.mine, root.id, undefined, cy.id));
    for (const teammate of [ada, bob])
      await host.organization.setMemberAsync(new DepartmentMemberSetParams(OrganizationServiceTests.mine, teammate.id, gone.id));
    await host.organization.updateAsync(new DepartmentUpdateParams(OrganizationServiceTests.mine, gone.id, undefined, ada.id));

    await host.organization.deleteAsync(new DepartmentIdParams(OrganizationServiceTests.mine, gone.id));
    const organization = await OrganizationServiceTests.mineAsync(host);

    Assert.areEqual("X:0,Y:1,After:2", OrganizationServiceTests.children(organization, root.id));
    Assert.areEqual([root.id, root.id, root.id].join(","), [ada, bob, cy].map(t => organization.departmentOf(t.id)).join(","));
    Assert.areEqual(cy.id, organization.departments.find(t => t.id === root.id)?.leaderId);
    Assert.isFalse(organization.departments.some(t => t.id === gone.id));
    Assert.areEqual(ChangeOperation.Delete, (await host.context.database.changeFeed.readAfterAsync(0)).filter(t => t.entityId === gone.id).at(-1)?.operation);
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => host.organization.deleteAsync(new DepartmentIdParams(OrganizationServiceTests.mine, gone.id)));
  }

  @TestMethod
  public async deletesATopDepartmentMovingItsTeammatesAndDepartmentsUnderThePerson(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const ada = await OrganizationServiceTests.teammateAsync(host, "Ada");
    const top = await OrganizationServiceTests.createAsync(host, "Top");
    await OrganizationServiceTests.createAsync(host, "Inner", top.id);
    await host.organization.setMemberAsync(new DepartmentMemberSetParams(OrganizationServiceTests.mine, ada.id, top.id));

    await host.organization.deleteAsync(new DepartmentIdParams(OrganizationServiceTests.mine, top.id));
    const organization = await OrganizationServiceTests.mineAsync(host);

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
    await host.organization.setMemberAsync(new DepartmentMemberSetParams(OrganizationServiceTests.mine, ada.id, inner.id));
    const before = await OrganizationServiceTests.mineAsync(host);

    const listing = OrganizationServiceTests.mineAsync(host);
    const deleting = host.organization.deleteAsync(new DepartmentIdParams(OrganizationServiceTests.mine, inner.id));
    const listed = await listing;
    await deleting;

    Assert.areEqual(JSON.stringify(before.toJson()), JSON.stringify(listed.toJson()));
    Assert.areEqual(parent.id, (await OrganizationServiceTests.mineAsync(host)).departmentOf(ada.id));
  }

  @TestMethod
  public async keepsATeammateInOneDepartmentAtATimeAndPutsOneLeavingItsDepartmentUnderThePersonEndingItsLeadership(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const ada = await OrganizationServiceTests.teammateAsync(host, "Ada");
    const a = await OrganizationServiceTests.createAsync(host, "A");
    const b = await OrganizationServiceTests.createAsync(host, "B");
    await host.organization.setMemberAsync(new DepartmentMemberSetParams(OrganizationServiceTests.mine, ada.id, null));
    await host.organization.setMemberAsync(new DepartmentMemberSetParams(OrganizationServiceTests.mine, ada.id, a.id));
    await host.organization.updateAsync(new DepartmentUpdateParams(OrganizationServiceTests.mine, a.id, undefined, ada.id));

    await host.organization.setMemberAsync(new DepartmentMemberSetParams(OrganizationServiceTests.mine, ada.id, b.id));
    await host.organization.setMemberAsync(new DepartmentMemberSetParams(OrganizationServiceTests.mine, ada.id, b.id));
    const moved = await OrganizationServiceTests.mineAsync(host);
    await host.organization.setMemberAsync(new DepartmentMemberSetParams(OrganizationServiceTests.mine, ada.id, null));
    const left = await OrganizationServiceTests.mineAsync(host);

    Assert.areEqual(b.id, moved.departmentOf(ada.id));
    Assert.isNull(moved.departments.find(t => t.id === a.id)?.leaderId);
    Assert.isNull(left.departmentOf(ada.id));
    Assert.areEqual("Person:0", OrganizationServiceTests.parentOf(left, ada));
    Assert.areEqual("Insert,Update,Update,Update", await OrganizationServiceTests.feedAsync(host, ChangeEntity.TeammatePlacement));
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => host.organization.setMemberAsync(new DepartmentMemberSetParams(OrganizationServiceTests.mine, "gone", a.id)));
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => host.organization.setMemberAsync(new DepartmentMemberSetParams(OrganizationServiceTests.mine, ada.id, "gone")));
  }

  @TestMethod
  public async takesATeammateBeingDeletedOutOfItsDepartmentAndItsLeadership(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const ada = await OrganizationServiceTests.teammateAsync(host, "Ada");
    const bob = await OrganizationServiceTests.teammateAsync(host, "Bob");
    const a = await OrganizationServiceTests.createAsync(host, "A");
    await host.organization.setMemberAsync(new DepartmentMemberSetParams(OrganizationServiceTests.mine, ada.id, a.id));
    await host.organization.updateAsync(new DepartmentUpdateParams(OrganizationServiceTests.mine, a.id, undefined, ada.id));

    const removed = await host.context.database.connection.runInTransactionAsync(t => host.organization.removeTeammateAsync(ada.id, t));
    const outside = await host.context.database.connection.runInTransactionAsync(t => host.organization.removeTeammateAsync(bob.id, t));
    const organization = await OrganizationServiceTests.mineAsync(host);

    Assert.areEqual(OrganizationServiceTests.mine, removed.join(","));
    Assert.areEqual(0, outside.length);
    Assert.areEqual(0, organization.members.length);
    Assert.isNull(organization.departments[0]?.leaderId);
  }

  @TestMethod
  public async createsADepartmentWithItsLeaderInOneStepMovingTheLeaderIntoItFirst(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const type = await host.typeAsync();
    const ada = await OrganizationServiceTests.teammateAsync(host, "Ada");
    const bob = await OrganizationServiceTests.teammateAsync(host, "Bob");
    const cy = await OrganizationServiceTests.teammateAsync(host, "Cy");
    const ops = await OrganizationServiceTests.createAsync(host, "Ops");
    for (const teammate of [ada, bob])
      await host.organization.setMemberAsync(new DepartmentMemberSetParams(OrganizationServiceTests.mine, teammate.id, ops.id));
    await host.organization.updateAsync(new DepartmentUpdateParams(OrganizationServiceTests.mine, ops.id, undefined, ada.id));

    const design = await host.organization.createAsync(new DepartmentCreateParams(OrganizationServiceTests.mine, "Design", type, OrganizationParent.person, ada.id));
    const under = await host.organization.createAsync(new DepartmentCreateParams(OrganizationServiceTests.mine, "Under Bob", type, OrganizationParent.teammate(bob.id)));
    const organization = await OrganizationServiceTests.mineAsync(host);

    Assert.areEqual(`${ada.id},${design.id}:0,${ops.id}:0`, `${design.leaderId},${OrganizationServiceTests.places(organization, ada, bob)}`);
    Assert.isNull(organization.departments.find(t => t.id === ops.id)?.leaderId);
    Assert.areEqual(`${OrganizationNodeKind.Teammate}:${bob.id}`, `${under.parent.kind}:${under.parent.id}`);
    Assert.areEqual("Under Bob:0", OrganizationServiceTests.children(organization, OrganizationParent.teammate(bob.id)));
    await OrganizationServiceTests.failsAsync(ErrorCode.InvalidParams,
      () => host.organization.createAsync(new DepartmentCreateParams(OrganizationServiceTests.mine, "Bob's", type, OrganizationParent.department(under.id), bob.id)));
    await OrganizationServiceTests.failsAsync(ErrorCode.InvalidParams,
      () => host.organization.createAsync(new DepartmentCreateParams(OrganizationServiceTests.mine, "Bob's", type, OrganizationParent.teammate(bob.id), bob.id)));
    await OrganizationServiceTests.failsAsync(ErrorCode.InvalidParams, () => host.organization.updateAsync(new DepartmentUpdateParams(OrganizationServiceTests.mine, under.id, undefined, bob.id)));
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => host.organization.createAsync(new DepartmentCreateParams(OrganizationServiceTests.mine, "X", type, OrganizationParent.person, "gone")));
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => host.organization.createAsync(new DepartmentCreateParams(OrganizationServiceTests.mine, "X", type, OrganizationParent.teammate(cy.id))));
    Assert.areEqual(3, (await OrganizationServiceTests.mineAsync(host)).departments.length);
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
      host.organization.placeAsync(new TeammatePlaceParams(OrganizationServiceTests.mine, teammate.id, parent, order));
    const underBoss = OrganizationParent.teammate(boss.id);

    await place(boss, OrganizationParent.person, 0);
    await place(ann, underBoss, 0);
    await place(kid, underBoss, 0);
    await place(cy, underBoss, 9);
    const placed = await OrganizationServiceTests.mineAsync(host);
    await place(ann, OrganizationParent.person, 0);
    await place(cy, underBoss, 0);
    const moved = await OrganizationServiceTests.mineAsync(host);

    Assert.areEqual(`${boss.id}:0,${boss.id}:1,${boss.id}:2`, OrganizationServiceTests.places(placed, kid, ann, cy));
    Assert.areEqual(`:0,:1,${boss.id}:1,${boss.id}:0`, OrganizationServiceTests.places(moved, ann, boss, kid, cy));
    Assert.areEqual(boss.id, moved.leaders.join(","));
    Assert.areEqual(boss.id, moved.managerOf(kid.id));
    await OrganizationServiceTests.failsAsync(ErrorCode.InvalidParams, () => place(boss, OrganizationParent.teammate(kid.id), 0));
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => place(boss, OrganizationParent.department("gone"), 0));
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => place(boss, OrganizationParent.teammate(dee.id), 0));
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => host.organization.placeAsync(new TeammatePlaceParams(OrganizationServiceTests.mine, "gone", OrganizationParent.person, 0)));
    Assert.areEqual(JSON.stringify(moved.toJson()), JSON.stringify((await OrganizationServiceTests.mineAsync(host)).toJson()));
  }

  @TestMethod
  public async takesATeammateOutOfTheOrganizationMovingWhatSatUnderItToItsParentAndEndingItsLeadership(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const type = await host.typeAsync();
    const boss = await OrganizationServiceTests.teammateAsync(host, "Boss");
    const ann = await OrganizationServiceTests.teammateAsync(host, "Ann");
    const kid = await OrganizationServiceTests.teammateAsync(host, "Kid");
    const cy = await OrganizationServiceTests.teammateAsync(host, "Cy");
    const ops = await OrganizationServiceTests.createAsync(host, "Ops");
    await host.organization.placeAsync(new TeammatePlaceParams(OrganizationServiceTests.mine, boss.id, OrganizationParent.department(ops.id), 0));
    await host.organization.placeAsync(new TeammatePlaceParams(OrganizationServiceTests.mine, kid.id, OrganizationParent.department(ops.id), 1));
    await host.organization.placeAsync(new TeammatePlaceParams(OrganizationServiceTests.mine, ann.id, OrganizationParent.teammate(boss.id), 0));
    const design = await host.organization.createAsync(new DepartmentCreateParams(OrganizationServiceTests.mine, "Design", type, OrganizationParent.teammate(boss.id), cy.id));
    await host.organization.updateAsync(new DepartmentUpdateParams(OrganizationServiceTests.mine, ops.id, undefined, boss.id));

    await host.organization.placeAsync(new TeammatePlaceParams(OrganizationServiceTests.mine, boss.id, null, 0));
    await host.organization.placeAsync(new TeammatePlaceParams(OrganizationServiceTests.mine, boss.id, null, 0));
    const organization = await OrganizationServiceTests.mineAsync(host);

    Assert.areEqual(`:,${ops.id}:0,${ops.id}:1,${design.id}:0`, OrganizationServiceTests.places(organization, boss, kid, ann, cy));
    Assert.areEqual(`Design:0`, OrganizationServiceTests.children(organization, OrganizationParent.department(ops.id)));
    Assert.isNull(organization.departments.find(t => t.id === ops.id)?.leaderId);
    Assert.areEqual(cy.id, organization.departments.find(t => t.id === design.id)?.leaderId);
    Assert.areEqual("Delete", (await OrganizationServiceTests.feedAsync(host, ChangeEntity.TeammatePlacement)).split(",").at(-1));
  }

  @TestMethod
  public async takesADirectReportOutAndMovesAnotherTeammatesReportsUpToItsParentInTheirOrder(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const boss = await OrganizationServiceTests.teammateAsync(host, "Boss");
    const dee = await OrganizationServiceTests.teammateAsync(host, "Dee");
    const ann = await OrganizationServiceTests.teammateAsync(host, "Ann");
    const bo = await OrganizationServiceTests.teammateAsync(host, "Bo");
    const cy = await OrganizationServiceTests.teammateAsync(host, "Cy");
    await host.organization.placeAsync(new TeammatePlaceParams(OrganizationServiceTests.mine, boss.id, OrganizationParent.person, 0));
    await host.organization.placeAsync(new TeammatePlaceParams(OrganizationServiceTests.mine, dee.id, OrganizationParent.person, 1));
    for (const [order, report] of [ann, bo, cy].entries())
      await host.organization.placeAsync(new TeammatePlaceParams(OrganizationServiceTests.mine, report.id, OrganizationParent.teammate(boss.id), order));

    await host.organization.placeAsync(new TeammatePlaceParams(OrganizationServiceTests.mine, dee.id, null, 0));
    const direct = await OrganizationServiceTests.mineAsync(host);
    await host.organization.placeAsync(new TeammatePlaceParams(OrganizationServiceTests.mine, boss.id, null, 0));
    const organization = await OrganizationServiceTests.mineAsync(host);

    Assert.areEqual("Person:0,,Teammate:0,Teammate:1,Teammate:2", [boss, dee, ann, bo, cy].map(t => OrganizationServiceTests.parentOf(direct, t)).join(","));
    Assert.areEqual(",,Person:0,Person:1,Person:2", [boss, dee, ann, bo, cy].map(t => OrganizationServiceTests.parentOf(organization, t)).join(","));
    Assert.areEqual(2, (await OrganizationServiceTests.feedAsync(host, ChangeEntity.TeammatePlacement)).split(",").filter(t => t === "Delete").length);
  }

  @TestMethod
  public async placesNoOneInANewOrganizationOrForANewTeammate(): Promise<void> {
    await using host = await CoreHost.createAsync();
    await OrganizationServiceTests.teammateAsync(host, "Ada");

    const studio = await host.organization.createOrganizationAsync(new OrganizationCreateParams("Studio", null));
    await OrganizationServiceTests.teammateAsync(host, "Bea");

    Assert.areEqual("My organization:0,Studio:0", (await host.organization.listAsync()).map(t => `${t.name}:${t.placements.length}`).join(","));
    Assert.areEqual(0, studio.placements.length);
  }

  @TestMethod
  public async movesADepartmentUnderATeammateButNotUnderOneInsideIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const boss = await OrganizationServiceTests.teammateAsync(host, "Boss");
    const kid = await OrganizationServiceTests.teammateAsync(host, "Kid");
    const dee = await OrganizationServiceTests.teammateAsync(host, "Dee");
    const design = await OrganizationServiceTests.createAsync(host, "Design");
    await host.organization.placeAsync(new TeammatePlaceParams(OrganizationServiceTests.mine, boss.id, OrganizationParent.person, 0));
    await host.organization.setMemberAsync(new DepartmentMemberSetParams(OrganizationServiceTests.mine, kid.id, design.id));

    const moved = await host.organization.moveAsync(new DepartmentMoveParams(OrganizationServiceTests.mine, design.id, OrganizationParent.teammate(boss.id), 0));
    const organization = await OrganizationServiceTests.mineAsync(host);

    Assert.areEqual(`${boss.id},`, `${moved.parent.id},${moved.parentId ?? ""}`);
    Assert.areEqual("Design:0", OrganizationServiceTests.children(organization, OrganizationParent.teammate(boss.id)));
    Assert.areEqual(boss.id, organization.managerOf(kid.id));
    await OrganizationServiceTests.failsAsync(ErrorCode.InvalidParams, () => host.organization.moveAsync(new DepartmentMoveParams(OrganizationServiceTests.mine, design.id, OrganizationParent.teammate(kid.id), 0)));
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => host.organization.moveAsync(new DepartmentMoveParams(OrganizationServiceTests.mine, design.id, OrganizationParent.teammate(dee.id), 0)));
  }

  @TestMethod
  public async keepsTheOrganizationLayoutAsItIsAndRecordsEachSave(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const first = { collapsed: ["d1"], cardsShow: { status: true } };
    const second = { collapsed: [], cards: { t1: { usage: true } } };

    Assert.isNull(await host.organization.readLayoutAsync(new OrganizationIdParams(OrganizationServiceTests.mine)));
    Assert.areEqual(JSON.stringify(first), JSON.stringify(await host.organization.saveLayoutAsync(new OrganizationLayoutSaveParams(OrganizationServiceTests.mine, first))));
    await host.organization.saveLayoutAsync(new OrganizationLayoutSaveParams(OrganizationServiceTests.mine, second));

    Assert.areEqual(JSON.stringify(second), JSON.stringify(await host.organization.readLayoutAsync(new OrganizationIdParams(OrganizationServiceTests.mine))));
    Assert.areEqual("Insert,Update", await OrganizationServiceTests.feedAsync(host, ChangeEntity.Preference));
  }

  @TestMethod
  public async listsMyOrganizationFirstAndCreatesRenamesAndDeletesOthers(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const studio = await host.organization.createOrganizationAsync(new OrganizationCreateParams("Studio", "/work/studio"));
    const lab = await host.organization.createOrganizationAsync(new OrganizationCreateParams("Lab", null));
    const renamed = await host.organization.updateOrganizationAsync(new OrganizationUpdateParams(studio.id, "Design studio", null));

    Assert.areEqual("My organization:0,Design studio:1,Lab:2", (await host.organization.listAsync()).map(t => `${t.name}:${t.order}`).join(","));
    Assert.areEqual("Design studio|null|0|0", [renamed.name, String(renamed.folder), renamed.departments.length, renamed.placements.length].join("|"));
    Assert.areEqual("/work/studio", studio.folder);
    await host.organization.deleteOrganizationAsync(new OrganizationIdParams(lab.id));
    await host.organization.deleteOrganizationAsync(new OrganizationIdParams(OrganizationServiceTests.mine));
    Assert.areEqual("Design studio", (await host.organization.listAsync()).map(t => t.name).join(","));
    Assert.isNull(await host.organization.findAsync(lab.id));
    Assert.areEqual("Insert,Insert,Update,Delete,Delete", await OrganizationServiceTests.feedAsync(host, ChangeEntity.Organization));
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => host.organization.deleteOrganizationAsync(new OrganizationIdParams(lab.id)));
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => host.organization.updateOrganizationAsync(new OrganizationUpdateParams(lab.id, "Lab", null)));
  }

  @TestMethod
  public async keepsEachOrganizationsTreeApartAndPlacesATeammateOnceInEach(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const ada = await OrganizationServiceTests.teammateAsync(host, "Ada");
    const studio = await host.organization.createOrganizationAsync(new OrganizationCreateParams("Studio", null));
    const studioType = await host.typeAsync(studio.id);
    const design = await OrganizationServiceTests.createAsync(host, "Design");
    const art = await host.organization.createAsync(new DepartmentCreateParams(studio.id, "Art", studioType, OrganizationParent.person));
    await host.organization.setMemberAsync(new DepartmentMemberSetParams(OrganizationServiceTests.mine, ada.id, design.id));
    await host.organization.setMemberAsync(new DepartmentMemberSetParams(studio.id, ada.id, art.id));
    const mine = await OrganizationServiceTests.mineAsync(host);
    const other = await host.organization.findAsync(studio.id);

    Assert.areEqual(`Design|${design.id}`, `${mine.departments.map(t => t.name).join(",")}|${mine.departmentOf(ada.id) ?? ""}`);
    Assert.areEqual(`Art|${art.id}`, `${other?.departments.map(t => t.name).join(",") ?? ""}|${other?.departmentOf(ada.id) ?? ""}`);
    for (const action of [
      () => host.organization.setMemberAsync(new DepartmentMemberSetParams(studio.id, ada.id, design.id)),
      () => host.organization.updateAsync(new DepartmentUpdateParams(studio.id, design.id, "X", undefined)),
      () => host.organization.moveAsync(new DepartmentMoveParams(studio.id, design.id, OrganizationParent.person, 0)),
      () => host.organization.deleteAsync(new DepartmentIdParams(studio.id, design.id)),
      () => host.organization.createAsync(new DepartmentCreateParams(studio.id, "Lost", studioType, OrganizationParent.department(design.id))),
      () => host.organization.placeAsync(new TeammatePlaceParams("gone", ada.id, OrganizationParent.person, 0))])
      await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, action);
    const removed = await host.context.database.connection.runInTransactionAsync(t => host.organization.removeTeammateAsync(ada.id, t));
    Assert.areEqual(`${OrganizationServiceTests.mine},${studio.id}`, removed.join(","));
    Assert.areEqual(0, (await host.organization.listAsync()).reduce((count, t) => count + t.placements.length, 0));
  }

  @TestMethod
  public async deletesAnOrganizationWithItsTreeAndLayoutAndKeepsItsTeammates(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const ada = await OrganizationServiceTests.teammateAsync(host, "Ada");
    const studio = await host.organization.createOrganizationAsync(new OrganizationCreateParams("Studio", null));
    const studioType = await host.typeAsync(studio.id);
    const art = await host.organization.createAsync(new DepartmentCreateParams(studio.id, "Art", studioType, OrganizationParent.person, ada.id));
    await host.organization.saveLayoutAsync(new OrganizationLayoutSaveParams(studio.id, { collapsed: [art.id] }));
    await host.organization.saveLayoutAsync(new OrganizationLayoutSaveParams(OrganizationServiceTests.mine, { collapsed: [] }));
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, "Organization · Ada", ada.id), undefined, new OrganizationChat(studio.id, ada.id));
    const kept = await host.conversations.createAsync(new ConversationCreateParams(null, "Organization · Ada", ada.id), undefined,
      new OrganizationChat(OrganizationServiceTests.mine, ada.id));

    await host.organization.deleteOrganizationAsync(new OrganizationIdParams(studio.id));

    Assert.areEqual("Ada", (await host.teammates.listAsync()).map(t => t.name).join(","));
    Assert.areEqual('{"collapsed":[]}', JSON.stringify(await host.organization.readLayoutAsync(new OrganizationIdParams(OrganizationServiceTests.mine))));
    Assert.areEqual("Insert,Delete", await OrganizationServiceTests.feedAsync(host, ChangeEntity.Department));
    Assert.areEqual("Insert,Delete", await OrganizationServiceTests.feedAsync(host, ChangeEntity.TeammatePlacement));
    Assert.areEqual("Insert,Insert,Delete", await OrganizationServiceTests.feedAsync(host, ChangeEntity.Preference));
    Assert.areEqual("Insert,Insert,Update", await OrganizationServiceTests.feedAsync(host, ChangeEntity.Chat));
    Assert.isNull((await host.conversations.findAsync(chat.id))?.organizationChat);
    Assert.areEqual("Organization · Ada", (await host.conversations.findAsync(chat.id))?.title);
    Assert.areEqual(OrganizationServiceTests.mine, (await host.conversations.findAsync(kept.id))?.organizationChat?.organizationId);
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => host.organization.readLayoutAsync(new OrganizationIdParams(studio.id)));
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => host.organization.saveLayoutAsync(new OrganizationLayoutSaveParams(studio.id, {})));
  }

  @TestMethod
  public async deletesTheLastOrganizationWithItsTreeAndStartsWithNoneUntilOneIsCreated(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const ada = await OrganizationServiceTests.teammateAsync(host, "Ada");
    const design = await OrganizationServiceTests.createAsync(host, "Design");
    await host.organization.setMemberAsync(new DepartmentMemberSetParams(OrganizationServiceTests.mine, ada.id, design.id));
    await host.organization.saveLayoutAsync(new OrganizationLayoutSaveParams(OrganizationServiceTests.mine, { collapsed: [design.id] }));
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, "Organization · Ada", ada.id), undefined,
      new OrganizationChat(OrganizationServiceTests.mine, ada.id));

    await host.organization.deleteOrganizationAsync(new OrganizationIdParams(OrganizationServiceTests.mine));
    const left = (await host.organization.listAsync()).length;
    await using restarted = await TestDatabase.openAsync(host.directory.path);
    const organizations = new OrganizationService(restarted);
    const atStart = (await organizations.listAsync()).length;
    const studio = await organizations.createOrganizationAsync(new OrganizationCreateParams("Studio", null));

    Assert.areEqual("0|0|Studio:0", [left, atStart, (await organizations.listAsync()).map(t => `${t.name}:${t.order}`).join(",")].join("|"));
    Assert.areEqual(studio.id, (await organizations.findAsync(studio.id))?.id);
    Assert.areEqual("Ada", (await host.teammates.listAsync()).map(t => t.name).join(","));
    Assert.isNull((await host.conversations.findAsync(chat.id))?.organizationChat);
    Assert.areEqual("Insert,Delete", await OrganizationServiceTests.feedAsync(host, ChangeEntity.Department));
    Assert.areEqual("Insert,Delete", await OrganizationServiceTests.feedAsync(host, ChangeEntity.TeammatePlacement));
    Assert.areEqual("Insert,Delete", await OrganizationServiceTests.feedAsync(host, ChangeEntity.Preference));
    Assert.areEqual("Update,Delete,Insert", await OrganizationServiceTests.feedAsync(host, ChangeEntity.Organization));
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => host.organization.readLayoutAsync(new OrganizationIdParams(OrganizationServiceTests.mine)));
  }

  @TestMethod
  public async deletesAnOrganizationWithNoLayoutKept(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const studio = await host.organization.createOrganizationAsync(new OrganizationCreateParams("Studio", null));

    await host.organization.deleteOrganizationAsync(new OrganizationIdParams(studio.id));

    Assert.areEqual("", await OrganizationServiceTests.feedAsync(host, ChangeEntity.Preference));
  }

  @TestMethod
  public async startsEachOrganizationWithNoTypeAndAddsRenamesAndDeletesTypes(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const studio = await host.organization.createOrganizationAsync(new OrganizationCreateParams("Studio", null));
    const mine = await OrganizationServiceTests.mineAsync(host);
    const team = await host.organization.createNodeTypeAsync(new NodeTypeCreateParams(studio.id, "Team", "groups", "teal"));
    const squad = await host.organization.updateNodeTypeAsync(new NodeTypeUpdateParams(studio.id, team.id, "Squad", undefined, null));
    const kept = await host.organization.updateNodeTypeAsync(new NodeTypeUpdateParams(studio.id, team.id, "squad", undefined, undefined));
    const before = (await host.organization.findAsync(studio.id))?.nodeTypes.map(t => `${t.name}:${String(t.icon)}:${String(t.color)}`).join(",");
    await OrganizationServiceTests.failsAsync(ErrorCode.Conflict, () => host.organization.createNodeTypeAsync(new NodeTypeCreateParams(studio.id, "SQUAD")));
    await host.organization.deleteNodeTypeAsync(new NodeTypeIdParams(studio.id, team.id));

    Assert.areEqual("0|0", `${studio.nodeTypes.length}|${mine.nodeTypes.length}`);
    Assert.areEqual("squad:groups:null", before);
    Assert.areEqual("squad", kept.name);
    Assert.areEqual(team.createdAt, squad.createdAt);
    Assert.areEqual(0, (await host.organization.findAsync(studio.id))?.nodeTypes.length);
    Assert.areEqual("Insert,Update,Update,Update,Update", await OrganizationServiceTests.feedAsync(host, ChangeEntity.Organization));
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => host.organization.createNodeTypeAsync(new NodeTypeCreateParams("gone", "Team")));
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => host.organization.updateNodeTypeAsync(new NodeTypeUpdateParams(studio.id, team.id, "Team", undefined, undefined)));
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => host.organization.deleteNodeTypeAsync(new NodeTypeIdParams(studio.id, team.id)));
  }

  @TestMethod
  public async refusesATypeNameTakenAnUnknownTypeForADepartmentAndDeletingATypeADepartmentHas(): Promise<void> {
    await using host = await CoreHost.createAsync();
    await host.typeAsync();
    const team = await host.organization.createNodeTypeAsync(new NodeTypeCreateParams(OrganizationServiceTests.mine, "Team"));
    const design = await OrganizationServiceTests.createAsync(host, "Design");
    const retyped = await host.organization.updateAsync(new DepartmentUpdateParams(OrganizationServiceTests.mine, design.id, undefined, undefined, team.id));

    Assert.areEqual(`${team.id}|Design`, `${retyped.typeId}|${retyped.name}`);
    Assert.areEqual("Team", (await OrganizationServiceTests.mineAsync(host)).typeOf(design.id)?.name);
    await OrganizationServiceTests.failsAsync(ErrorCode.Conflict, () => host.organization.updateNodeTypeAsync(
      new NodeTypeUpdateParams(OrganizationServiceTests.mine, team.id, "department", undefined, undefined)));
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => host.organization.createAsync(
      new DepartmentCreateParams(OrganizationServiceTests.mine, "Lost", "gone", OrganizationParent.person)));
    await OrganizationServiceTests.failsAsync(ErrorCode.NotFound, () => host.organization.updateAsync(
      new DepartmentUpdateParams(OrganizationServiceTests.mine, design.id, undefined, undefined, "gone")));
    const used = await Assert.throwsAsync(() => host.organization.deleteNodeTypeAsync(new NodeTypeIdParams(OrganizationServiceTests.mine, team.id)), ServiceException);
    await host.organization.createAsync(new DepartmentCreateParams(OrganizationServiceTests.mine, "Art", team.id, OrganizationParent.person));
    const squad = await host.organization.updateNodeTypeAsync(new NodeTypeUpdateParams(OrganizationServiceTests.mine, team.id, "Squad", undefined, undefined));
    const both = await Assert.throwsAsync(() => host.organization.deleteNodeTypeAsync(new NodeTypeIdParams(OrganizationServiceTests.mine, team.id)), ServiceException);
    Assert.areEqual(`${ErrorCode.Conflict}|1 unit has the type Team; give it another type before deleting Team.`, `${used.info.name}|${used.message}`);
    Assert.areEqual("2 units have the type Squad; give them another type before deleting Squad.", both.message);
    Assert.areEqual(`Department,Squad|${team.id}`, `${(await OrganizationServiceTests.mineAsync(host)).nodeTypes.map(t => t.name).join(",")}|${squad.id}`);
  }

  private static async mineAsync(host: CoreHost): Promise<Organization> {
    const organization = await host.organization.findAsync(OrganizationServiceTests.mine);
    if (Object.isNull(organization))
      throw new Error(OrganizationServiceTests.mine);
    return organization;
  }

  private static async createAsync(host: CoreHost, name: string, parentId: string | null = null): Promise<Department> {
    return await host.organization.createAsync(new DepartmentCreateParams(OrganizationServiceTests.mine, name, await host.typeAsync(), OrganizationParent.departmentOrPerson(parentId)));
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
