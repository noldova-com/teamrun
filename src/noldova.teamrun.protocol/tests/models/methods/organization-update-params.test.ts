/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Department, Organization, OrganizationParent, OrganizationUpdateParams, TeammatePlacement } from "@noldova/teamrun.protocol";

@TestClass
export class OrganizationUpdateParamsTests {
  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    const json = new OrganizationUpdateParams("o1", "Studio", null).toJson();

    Assert.areEqual('{"organizationId":"o1","name":"Studio","folder":null}', JSON.stringify(OrganizationUpdateParams.fromJson(json).toJson()));
    Assert.areEqual("$.input.organizationId", Assert.throws(() => OrganizationUpdateParams.fromJson({ ...json, organizationId: 1 }, "$.input"), JsonException).path);
    Assert.areEqual("$.input.name", Assert.throws(() => OrganizationUpdateParams.fromJson({ ...json, name: " " }, "$.input"), JsonException).path);
    Assert.areEqual("$.input.folder", Assert.throws(() => OrganizationUpdateParams.fromJson({ ...json, folder: "" }, "$.input"), JsonException).path);
    Assert.areEqual('{"organizationId":"o1","name":"Studio"}', JSON.stringify(OrganizationUpdateParams.fromJson({ organizationId: "o1", name: "Studio" }).toJson()));
    Assert.areEqual('{"organizationId":"o1","folder":null}', JSON.stringify(OrganizationUpdateParams.fromJson({ organizationId: "o1", folder: null }).toJson()));
    Assert.areEqual("organizationId", Assert.throws(() => OrganizationUpdateParams.fromJson({ organizationId: "o1" }), ArgumentException).parameterName);
  }

  @TestMethod
  public keepsTheFieldItIsNotGiven(): void {
    const organization = new Organization("o1", "My organization", "/work/mine", 2, "c", "u", [], []);
    const renamed = new OrganizationUpdateParams("o1", "Studio", undefined).applyTo(organization, "later");
    const cleared = new OrganizationUpdateParams("o1", undefined, null).applyTo(organization, "later");

    Assert.areEqual("Studio|/work/mine|My organization|null", [renamed.name, renamed.folder, cleared.name, String(cleared.folder)].join("|"));
  }

  @TestMethod
  public appliesItsNameAndFolderAndKeepsTheRest(): void {
    const department = new Department("d1", "Design", OrganizationParent.person, null, 0, "c", "u");
    const organization = new Organization("o1", "My organization", null, 2, "c", "u", [department], [new TeammatePlacement("t1", OrganizationParent.person, 0)]);
    const updated = new OrganizationUpdateParams("o1", "Studio", "/work/studio").applyTo(organization, "later");

    Assert.areEqual("o1|Studio|/work/studio|2|c|later|d1|t1", [updated.id, updated.name, updated.folder, updated.order, updated.createdAt, updated.updatedAt,
      updated.departments[0]?.id, updated.placements[0]?.teammateId].join("|"));
  }

  @TestMethod
  public validatesConstructorArguments(): void {
    Assert.areEqual("organizationId", Assert.throws(() => new OrganizationUpdateParams("", "Studio", null), ArgumentException).parameterName);
    Assert.areEqual("name", Assert.throws(() => new OrganizationUpdateParams("o1", "a\nb", null), ArgumentException).parameterName);
    Assert.areEqual("folder", Assert.throws(() => new OrganizationUpdateParams("o1", "Studio", " "), ArgumentException).parameterName);
    Assert.areEqual("organizationId", Assert.throws(() => new OrganizationUpdateParams("o1", undefined, undefined), ArgumentException).parameterName);
  }
}
