/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { GrokAccountReader, Resources } from "@noldova/teamrun.providers";

@TestClass
export class GrokAccountReaderTests {
  @TestMethod
  public readsTheEmailAndSignInMethodFromAuthInfo(): void {
    const reader = new GrokAccountReader();
    const full = reader.read({ methodId: "cached_token", email: "person@example.com", firstName: "Test", lastName: null, teamName: "Team",
      teamBlockedReasons: [], codingDataRetentionOptOut: false });
    const keyed = reader.read({ methodId: "api_key", email: null });

    Assert.areEqual("_x.ai/auth/info,x.ai/auth/info", reader.methods.join(","));
    Assert.areEqual(Resources.xaiAuthInfoMethods, reader.methods);
    Assert.areEqual("person@example.com cached_token", [full?.email, full?.authMethod].join(" "));
    Assert.areEqual("none api_key", [keyed?.email ?? "none", keyed?.authMethod].join(" "));
    Assert.isUndefined(full?.userName);
  }

  @TestMethod
  public readsTheOrganizationOrElseTheTeamFromAuthInfoAndThePlanFromTheBilling(): void {
    const reader = new GrokAccountReader();
    const organizations = [{ email: "person@example.com", teamName: "Lab", organizationName: "Acme" }, { email: "person@example.com", teamName: "Lab" },
      { email: "person@example.com", teamName: " ", organizationName: null }, { teamName: "Lab" }].map(t => reader.read(t)?.organization ?? "none");
    const plans = [{ config: {}, subscription_tier: "SuperGrok Heavy" }, { subscription_tier: " " }, { subscriptionTier: "SuperGrok" }, { config: {} }, null]
      .map(t => reader.readPlan(t) ?? "none");

    Assert.areEqual("Acme,Lab,none,Lab", organizations.join(","));
    Assert.areEqual("SuperGrok Heavy,none,none,none,none", plans.join(","));
    Assert.areEqual(Resources.xaiBillingMethods, reader.planMethods);
  }

  @TestMethod
  public readsNoAccountFromAnAnswerThatNamesNone(): void {
    const reader = new GrokAccountReader();
    const answers = [{ methodId: null, email: null, teamBlockedReasons: [], codingDataRetentionOptOut: true }, { email: " ", methodId: "" }, { email: 7 },
      { result: { email: "person@example.com" } }, null, []];

    Assert.areEqual(answers.length, answers.filter(t => Object.isNull(reader.read(t))).length);
  }
}
