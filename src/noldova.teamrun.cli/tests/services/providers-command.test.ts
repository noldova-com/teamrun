/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { JsonValue } from "@noldova/context.json";
import { AuthStatus, PlanUsage, PlanWindow, PlanWindowName, Provider } from "@noldova/teamrun.protocol";

import { RecordingCliContext } from "../fixtures/recording-cli-context.fixture.js";
import { SampleData } from "../fixtures/sample-data.fixture.js";

@TestClass
export class ProvidersCommandTests {
  private static readonly home: Provider = new Provider("a2", "claude", "Home", "/profiles/a2", AuthStatus.LoggedOut, null, null, null, null,
    SampleData.time);

  @TestMethod
  public async listsEachProvidersIdProviderLabelAndSignInWithHowMuchOfItsPlanIsUsedAndADisabledOneAsDisabled(): Promise<void> {
    const context = await ProvidersCommandTests.activateAsync();

    const result = await context.runAsync("teamrun.listProviders");

    Assert.areEqual(["a1  codex  Work  LoggedIn", "  plan: FiveHour 40% used, Weekly", "a2  claude  Home  LoggedOut", "a3  codex  Old  Disabled"].join("\n"), result.text);
  }

  @TestMethod
  public async givesEachProvidersPlanWindowsInItsJsonLeavingOutWhatTheProviderDoesNotReport(): Promise<void> {
    const context = await ProvidersCommandTests.activateAsync();

    const rows = (await context.runAsync("teamrun.listProviders")).value as Record<string, JsonValue>[];

    Assert.areEqual(JSON.stringify({
      ...SampleData.provider.toJson(),
      planWindows: [{ name: "FiveHour", usedPercent: 40, unlimited: false }, { name: "Weekly", used: 2, allowance: 10, unlimited: false }]
    }), JSON.stringify(rows[0]));
    Assert.areEqual(JSON.stringify({ ...ProvidersCommandTests.home.toJson(), planWindows: [] }), JSON.stringify(rows[1]));
  }

  private static async activateAsync(): Promise<RecordingCliContext> {
    const windows = [new PlanWindow(PlanWindowName.FiveHour, 40, null), new PlanWindow(PlanWindowName.Weekly, null, null, 2, 10)];
    const context = await RecordingCliContext.activateAsync();
    context.answer("teamrun.providerList", () => [SampleData.provider.toJson(), ProvidersCommandTests.home.toJson(),
      { ...SampleData.provider.toJson(), id: "a3", label: "Old", enabled: false }])
      .answer("teamrun.planUsageList", () => [new PlanUsage("codex", "a1", windows, SampleData.time).toJson(),
        new PlanUsage("claude", "a1", [new PlanWindow(PlanWindowName.WeeklyOpus, 90, null)], SampleData.time).toJson()]);
    return context;
  }
}
