/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { ServiceException } from "@noldova/teamrun.services";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { PlanReading, ProviderKindRegistry, ProviderKindsService, ProviderKindVersions, Resources } from "@noldova/teamrun.core";
import { DefaultTeammate, DefaultTeammateSetParams, ErrorCode, EventName, Harness, PlanUsageParams, PlanWindow, PlanWindowName, type Provider, ProviderEnabledParams,
  ProviderContextWindows, ProviderKindInstallation, ProviderKindInstallState, ProviderKindParams, ProviderListModelsParams, ProviderTool, RequestedSettings,
  TeammateCreateParams, TeammateFallback, TeammateUpdateParams } from "@noldova/teamrun.protocol";

import { BoundingWork } from "../../fixtures/bounding-work.fixture.js";
import { ChangeSignal } from "../../fixtures/change-signal.fixture.js";
import { CoreHost } from "../../fixtures/core-host.fixture.js";
import { FakeProviderAdapter } from "../../fixtures/fake-provider-adapter.fixture.js";
import { FakeProviderKindInstallation } from "../../fixtures/fake-provider-kind-installation.fixture.js";
import { FakeToolUpdateChecks } from "../../fixtures/fake-tool-update-checks.fixture.js";

const params = new ProviderKindParams("agy");

@TestClass
export class ProviderKindsServiceTests {
  @TestMethod
  public async listsTheRegisteredProviders(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const other = new FakeProviderAdapter("other");
    other.askIsolated = () => Promise.resolve(null);
    host.registry.register(other);

    Assert.areEqual("fake,other", host.kinds.list().map(t => t.id).join(","));
    Assert.areEqual("Fake provider", host.kinds.list()[0]?.displayName);
    Assert.areEqual("false,true", host.kinds.list().map(t => t.namesChats).join(","));
  }

  @TestMethod
  public async clearsTheSpeedOfEachOfTheProvidersTeammatesUnlessTheCatalogListsTheModelWithIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const other = await host.createProviderAsync("fake", "Other");
    host.adapter.speeds = { "fake-small": ["priority"] };
    const teammate = async (name: string, providerId: string, model: string | null, speed: string): Promise<string> =>
      (await host.teammates.createAsync(new TeammateCreateParams(name, null, providerId, Harness.Provider, model, null, speed))).id;
    const ids = [await teammate("Ada", provider.id, "fake-small", "priority"), await teammate("Bo", provider.id, "fake-small", "flex"),
      await teammate("Cy", provider.id, "fake-large", "priority"), await teammate("Di", provider.id, null, "flex"), await teammate("Ed", provider.id, "unlisted", "priority"),
      await teammate("Flo", other.id, "fake-large", "priority")];

    await host.kinds.modelCatalogAsync(new ProviderListModelsParams("fake", provider.id));

    Assert.areEqual("priority|null|null|null|null|priority", (await Promise.all(ids.map(async t => String((await host.teammates.findAsync(t))?.speed)))).join("|"));
  }

  @TestMethod
  public async clearsTheContextWindowOfEachOfTheProvidersTeammatesUnlessTheCatalogsModelOffersIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const other = await host.createProviderAsync("fake", "Other");
    host.adapter.contextWindows = { "fake-small": new ProviderContextWindows([200_000], 100_000, 200_000, true) };
    const teammate = async (name: string, providerId: string, model: string | null, window: number | null): Promise<string> =>
      (await host.teammates.createAsync(new TeammateCreateParams(name, null, providerId, Harness.Provider, model, null, null, null, window))).id;
    const bo = await teammate("Bo", provider.id, "fake-small", 400_000);
    const gus = await teammate("Gus", other.id, "fake-large", 200_000);
    const ids = [await teammate("Ada", provider.id, "fake-small", 200_000), bo,
      await teammate("Cy", provider.id, "fake-large", 200_000), await teammate("Di", provider.id, null, 100_000), await teammate("Ed", provider.id, "unlisted", 200_000),
      await teammate("Flo", provider.id, "fake-large", null), gus];
    await host.teammates.updateAsync(TeammateUpdateParams.of(bo, { usageHandOffs: [gus] }));

    const changed = await host.teammates.clearUnlistedAsync(provider.id, await host.adapter.listModels(provider));

    Assert.areEqual("200000|null|null|100000|null|null|200000", (await Promise.all(ids.map(async t => String((await host.teammates.findAsync(t))?.contextWindow)))).join("|"));
    Assert.areEqual("Bo,Cy,Ed", changed.map(t => t.name).join(","));
    Assert.areEqual(gus, (await host.teammates.findAsync(bo))?.usageHandOffs.join("|"));
  }

  @TestMethod
  public async keepsATeammatesSustainSettingsWhenItClearsAnUnlistedChoice(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const other = await host.createProviderAsync("fake", "Other");
    const ada = await host.teammates.createAsync(new TeammateCreateParams("Ada", null, provider.id, Harness.Provider, "fake-small", null, "unlisted", null, null, [], true,
      [new TeammateFallback(other.id, "fake-large")], false));

    const [changed] = await host.teammates.clearUnlistedAsync(provider.id, await host.adapter.listModels(provider));

    Assert.areEqual(`null true ${other.id}:fake-large false`, [String(changed?.speed), String(changed?.sustain), changed?.fallbacks.map(t => `${t.providerId}:${t.model}`).join(),
      String((await host.teammates.findAsync(ada.id))?.resetsSoonestFirst)].join(" "));
  }

  @TestMethod
  public async keepsATeammatesChoicesOverAFoldersListOrAPartialOne(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    host.adapter.speeds = { "fake-small": ["priority"] };
    const id = (await host.teammates.createAsync(new TeammateCreateParams("Ada", null, provider.id, Harness.Provider, "fake-small", null, "priority"))).id;
    host.adapter.speeds = {};

    await host.kinds.modelCatalogAsync(new ProviderListModelsParams("fake", provider.id, false, "/work"));
    const afterFolder = (await host.teammates.findAsync(id))?.speed;
    host.adapter.listModelsPartial = true;
    await host.kinds.modelCatalogAsync(new ProviderListModelsParams("fake", provider.id));
    const afterPartial = (await host.teammates.findAsync(id))?.speed;
    host.adapter.listModelsPartial = false;
    await host.kinds.modelCatalogAsync(new ProviderListModelsParams("fake", provider.id));

    Assert.areEqual("priority,priority,null", [afterFolder, afterPartial, (await host.teammates.findAsync(id))?.speed].map(String).join(","));
    Assert.areEqual("/work,null,null", host.adapter.listedFolders.map(String).join(","));
  }

  @TestMethod
  public async clearsTheModeOfEachOfTheProvidersTeammatesUnlessTheCatalogListsIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const other = await host.createProviderAsync("fake", "Other");
    host.adapter.speeds = { "fake-small": ["priority"] };
    host.adapter.modeIds = ["acceptEdits", "plan"];
    const teammate = async (name: string, providerId: string, speed: string | null, mode: string | null): Promise<string> =>
      (await host.teammates.createAsync(new TeammateCreateParams(name, null, providerId, Harness.Provider, "fake-small", null, speed, mode))).id;
    const ids = [await teammate("Ada", provider.id, "priority", "plan"), await teammate("Bo", provider.id, "priority", "auto"), await teammate("Cy", provider.id, "flex", "auto"),
      await teammate("Di", provider.id, null, null), await teammate("Flo", other.id, null, "auto")];

    await host.kinds.modelCatalogAsync(new ProviderListModelsParams("fake", provider.id));

    Assert.areEqual("priority,plan|priority,null|null,null|null,null|null,auto",
      (await Promise.all(ids.map(async t => [String((await host.teammates.findAsync(t))?.speed), String((await host.teammates.findAsync(t))?.mode)].join(",")))).join("|"));
  }

  @TestMethod
  public async namesTheAdaptersPlanModeInTheCatalogOnlyWhenTheCatalogListsIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    host.adapter.planMode = "plan";
    const read = async (): Promise<string | null> => (await host.kinds.modelCatalogAsync(new ProviderListModelsParams("fake", provider.id))).planMode;

    const unlisted = await read();
    host.adapter.modeIds = ["acceptEdits", "plan"];
    const listed = await read();
    host.adapter.planMode = null;
    const none = await read();

    Assert.areEqual(JSON.stringify([null, "plan", null]), JSON.stringify([unlisted, listed, none]));
  }

  @TestMethod
  public async keepsEveryTeammatesModeWhenTheCatalogNamesNoModes(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const id = (await host.teammates.createAsync(new TeammateCreateParams("Ada", null, provider.id, Harness.Provider, "fake-small", null, null, "plan"))).id;
    await host.teammates.setDefaultAsync(new DefaultTeammateSetParams(new DefaultTeammate(new RequestedSettings("fake", "fake-small", null, null, "plan"), provider.id)));

    await host.kinds.modelCatalogAsync(new ProviderListModelsParams("fake", provider.id));

    Assert.areEqual("plan|plan", [(await host.teammates.findAsync(id))?.mode, (await host.teammates.readDefaultAsync())?.requested.mode].join("|"));
  }

  @TestMethod
  public async clearsTheDefaultTeammatesModeOnTheProviderUnlessTheCatalogListsIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    host.adapter.speeds = { "fake-small": ["priority"] };
    host.adapter.modeIds = ["acceptEdits", "plan"];
    const after = async (speed: string | null, mode: string | null): Promise<string> => {
      await host.teammates.setDefaultAsync(new DefaultTeammateSetParams(new DefaultTeammate(new RequestedSettings("fake", "fake-small", "high", speed, mode), provider.id)));
      await host.kinds.modelCatalogAsync(new ProviderListModelsParams("fake", provider.id));
      const chosen = await host.teammates.readDefaultAsync();
      return [chosen?.requested.effort, chosen?.requested.speed, chosen?.requested.mode].join(",");
    };

    Assert.areEqual("high,priority,plan|high,priority,|high,,", [await after("priority", "plan"), await after("priority", "auto"), await after("flex", "auto")].join("|"));
  }

  @TestMethod
  public async clearsTheDefaultTeammatesSpeedOnTheProviderUnlessTheCatalogListsTheModelWithIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const other = await host.createProviderAsync("fake", "Other");
    host.adapter.speeds = { "fake-small": ["priority"] };
    const speedAfter = async (model: string, speed: string | null, providerId: string): Promise<string> => {
      await host.teammates.setDefaultAsync(new DefaultTeammateSetParams(new DefaultTeammate(new RequestedSettings("fake", model, "high", speed), providerId)));
      await host.kinds.modelCatalogAsync(new ProviderListModelsParams("fake", provider.id));
      const chosen = await host.teammates.readDefaultAsync();
      return [chosen?.requested.model, chosen?.requested.effort, chosen?.requested.speed, chosen?.providerId === providerId].join(",");
    };

    Assert.areEqual("fake-small,high,priority,true|fake-small,high,,true|fake-large,high,,true|unlisted,high,,true|unlisted,high,priority,true",
      [await speedAfter("fake-small", "priority", provider.id), await speedAfter("fake-small", "flex", provider.id),
        await speedAfter("fake-large", "priority", provider.id), await speedAfter("unlisted", "priority", provider.id),
        await speedAfter("unlisted", "priority", other.id)].join("|"));
  }

  @TestMethod
  public async listsModelsDirectlyOrThroughAProvider(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.registry.register(new FakeProviderAdapter("other"));
    const provider = await host.createProviderAsync();
    const otherProvider = await host.createProviderAsync("other", "Other");

    Assert.areEqual("fake-small,fake-large", (await host.kinds.listModelsAsync(new ProviderListModelsParams("fake", null))).join(","));
    Assert.areEqual("fake-small,fake-large", (await host.kinds.listModelsAsync(new ProviderListModelsParams("fake", provider.id))).join(","));
    Assert.areEqual(2, (await host.kinds.modelCatalogAsync(new ProviderListModelsParams("fake", provider.id, true))).models.length);
    Assert.areEqual("false,false,true", host.adapter.refreshes.join(","));
    Assert.areEqual(ErrorCode.NotFound, (await Assert.throwsAsync(() => host.kinds.listModelsAsync(new ProviderListModelsParams("nope", null)), ServiceException)).info.name);
    Assert.areEqual(ErrorCode.NotFound, (await Assert.throwsAsync(() => host.kinds.listModelsAsync(new ProviderListModelsParams("fake", "acc-nope")), ServiceException)).info.name);
    Assert.areEqual(ErrorCode.InvalidParams, (await Assert.throwsAsync(() => host.kinds.listModelsAsync(new ProviderListModelsParams("fake", otherProvider.id)), ServiceException)).info.name);
  }

  @TestMethod
  public async readsAProvidersPlanUseAndThePlanItNamesThroughItsAdapterAndKeepsThem(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const read: (Provider | null)[] = [];
    const none = await host.kinds.readPlanUsageAsync(new PlanUsageParams("fake", null));
    host.adapter.readPlanUsage = given => {
      read.push(given);
      return Promise.resolve(read.length === 1 ? null : new PlanReading([new PlanWindow(PlanWindowName.MonthlyPremiumRequests, 12.5, "2026-11-01T00:00:00.000Z")], "pro"));
    };

    const failed = await host.kinds.readPlanUsageAsync(new PlanUsageParams("fake", provider.id));
    const usage = await host.kinds.readPlanUsageAsync(new PlanUsageParams("fake", provider.id));
    const unowned = await new ProviderKindsService(host.registry, host.providers, host.events, new FakeToolUpdateChecks(true)).readPlanUsageAsync(new PlanUsageParams("fake", null));

    Assert.isNull(none);
    Assert.isNull(failed);
    Assert.areEqual(`${provider.id},${provider.id},null`, read.map(t => t?.id ?? "null").join(","));
    Assert.areEqual(JSON.stringify([usage?.toJson()]), JSON.stringify(host.planUsage.list().map(t => t.toJson())));
    Assert.areEqual(PlanWindowName.MonthlyPremiumRequests, unowned?.windows[0]?.name);
    Assert.areEqual("pro,pro", [usage?.plan, unowned?.plan].join());
    Assert.areEqual(2, host.listener.count(EventName.PlanUsageUpdated));
    const missing = await Assert.throwsAsync(() => host.kinds.readPlanUsageAsync(new PlanUsageParams("fake", "missing")), ServiceException);
    Assert.areEqual(ErrorCode.NotFound, missing.info.name);
  }

  @TestMethod
  public async keepsTheWindowsOfAReplyReadDuringASlowPlanReadAndThePlanTheSlowReadNames(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    let answer: (reading: PlanReading) => void = () => undefined;
    let asked = false;
    host.adapter.readPlanUsage = () => new Promise(resolve => {
      answer = resolve;
      asked = true;
      ChangeSignal.notify();
    });

    const pending = host.kinds.readPlanUsageAsync(new PlanUsageParams("fake", provider.id));
    const replied = host.planUsage.record("fake", provider.id, [new PlanWindow(PlanWindowName.FiveHour, 40, null)], new Date(Date.now() + 60_000).toISOString());
    await host.until("the slow plan read", () => asked, new BoundingWork("the slow plan read", pending));
    answer(new PlanReading([new PlanWindow(PlanWindowName.FiveHour, 10, null)], "pro"));
    const usage = await pending;

    Assert.areEqual("FiveHour 40", (usage?.windows ?? []).map(t => `${t.name} ${t.usedPercent}`).join());
    Assert.areEqual(replied.readAt, usage?.readAt);
    Assert.areEqual("pro", usage?.plan);
    Assert.areEqual(JSON.stringify([usage?.toJson()]), JSON.stringify(host.planUsage.list().map(t => t.toJson())));
    Assert.areEqual(2, host.listener.count(EventName.PlanUsageUpdated));
  }

  @TestMethod
  public async refusesTheModelCatalogOfADisabledProvider(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    await host.providers.setEnabledAsync(new ProviderEnabledParams(provider.id, false));

    const refused = await Assert.throwsAsync(() => host.kinds.modelCatalogAsync(new ProviderListModelsParams("fake", provider.id, true)), ServiceException);
    await host.providers.setEnabledAsync(new ProviderEnabledParams(provider.id, true));
    const listed = await host.kinds.modelCatalogAsync(new ProviderListModelsParams("fake", provider.id, true));

    Assert.areEqual(ErrorCode.Unavailable, refused.info.name);
    Assert.areEqual(Resources.formatProviderDisabled("Work"), refused.info.message);
    Assert.areEqual(provider.id, refused.info.arguments.join());
    Assert.areEqual(2, listed.models.length);
    Assert.areEqual("true", host.adapter.refreshes.join());
  }

  @TestMethod
  public async readsNothingForADisabledProvider(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const read: (Provider | null)[] = [];
    host.adapter.readPlanUsage = given => {
      read.push(given);
      return Promise.resolve(new PlanReading([new PlanWindow(PlanWindowName.FiveHour, 40, null)]));
    };
    await host.providers.setEnabledAsync(new ProviderEnabledParams(provider.id, false));

    const disabled = await host.kinds.readPlanUsageAsync(new PlanUsageParams("fake", provider.id));
    await host.providers.setEnabledAsync(new ProviderEnabledParams(provider.id, true));
    const enabled = await host.kinds.readPlanUsageAsync(new PlanUsageParams("fake", provider.id));

    Assert.isNull(disabled);
    Assert.areEqual(provider.id, read.map(t => t?.id).join(","));
    Assert.areEqual("40", enabled?.windows.map(t => t.usedPercent).join());
    Assert.areEqual(1, host.listener.count(EventName.PlanUsageUpdated));
  }

  @TestMethod
  public async keepsTheLaterReadOfAProvidersPlanWhenAnOlderReadAnswersLast(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const answers: ((read: PlanReading) => void)[] = [];
    host.adapter.readPlanUsage = () => new Promise(resolve => {
      answers.push(resolve);
      ChangeSignal.notify();
    });

    const older = host.kinds.readPlanUsageAsync(new PlanUsageParams("fake", provider.id));
    const started = Date.now();
    while (Date.now() <= started)
      await new Promise(resolve => setImmediate(resolve));
    const later = host.kinds.readPlanUsageAsync(new PlanUsageParams("fake", provider.id));
    await host.until("both plan reads", () => answers.length === 2, new BoundingWork("the later read", later));
    answers[1]?.(new PlanReading([new PlanWindow(PlanWindowName.FiveHour, 82, null)]));
    const kept = await later;
    answers[0]?.(new PlanReading([new PlanWindow(PlanWindowName.FiveHour, 79, null)]));

    Assert.isTrue(kept === await older);
    Assert.areEqual("82", host.planUsage.list().map(t => t.windows.map(w => w.usedPercent).join()).join(";"));
    Assert.areEqual(1, host.listener.count(EventName.PlanUsageUpdated));
  }

  @TestMethod
  public registryForgetsAKindItUnregistersAndHasNothingForOneItDoesntKnow(): void {
    const registry = new ProviderKindRegistry();
    const adapter = new FakeProviderAdapter();
    registry.register(adapter);

    Assert.areEqual(adapter, registry.unregister("fake"));
    Assert.isFalse(registry.has("fake"));
    Assert.isNull(registry.unregister("fake"));
    registry.register(new FakeProviderAdapter());
    Assert.isTrue(registry.has("fake"));
  }

  @TestMethod
  public registryRejectsDuplicatesAndUnknownProviders(): void {
    const registry = new ProviderKindRegistry();
    const adapter = new FakeProviderAdapter();
    registry.register(adapter);

    Assert.isTrue(registry.has("fake"));
    Assert.isFalse(registry.has("nope"));
    Assert.areEqual(adapter, registry.get("fake"));
    Assert.areEqual(1, registry.all().length);
    Assert.areEqual("adapter", Assert.throws(() => registry.register(new FakeProviderAdapter()), ArgumentException).parameterName);
    Assert.areEqual(ErrorCode.NotFound, Assert.throws(() => registry.get("nope"), ServiceException).info.name);
  }

  @TestMethod
  public async listsOnlyTheProvidersTeamRunInstallsWithWhereEachStands(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const installation = ProviderKindsServiceTests.register(host);

    Assert.areEqual("agy NotInstalled null", ProviderKindsServiceTests.describeInstallations(await host.kinds.listInstallations()));
    installation.unavailable = "No build for this computer.";
    Assert.areEqual("agy Unavailable No build for this computer.", ProviderKindsServiceTests.describeInstallations(await host.kinds.listInstallations()));
    installation.isInstalled = true;
    Assert.areEqual("agy Installed null", ProviderKindsServiceTests.describeInstallations(await host.kinds.listInstallations()));
  }

  @TestMethod
  public async namesAServerFoundOutsideItsInstallWhileInstalledAndWhyAFoundOneDoesntCount(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const installation = ProviderKindsServiceTests.register(host);
    const found = async (): Promise<string> => (await host.kinds.listInstallations()).map(t => `${t.state} ${t.foundPath} ${t.reason}`).join(",");
    installation.notInstalledReason = "The server on PATH is 1.4.0.";

    Assert.areEqual("NotInstalled null The server on PATH is 1.4.0.", await found());
    installation.notInstalledReason = null;
    installation.foundPath = "/usr/local/bin/agy";
    installation.isInstalled = true;
    Assert.areEqual("Installed /usr/local/bin/agy null", await found());
  }

  @TestMethod
  public async namesTheToolAnInstallLacksOnlyWhileItCantInstall(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const installation = ProviderKindsServiceTests.register(host);
    installation.missingTool = "unzip";
    const tools = async (): Promise<string> => (await host.kinds.listInstallations()).map(t => `${t.state} ${t.missingTool}`).join(",");

    Assert.areEqual("NotInstalled null", await tools());
    installation.unavailable = "Installing needs unzip.";
    Assert.areEqual("Unavailable unzip", await tools());
    installation.isInstalled = true;
    Assert.areEqual("Installed null", await tools());
  }

  @TestMethod
  public async namesACopyFoundOutsideTeamRunsOwnInstallOnlyWhileInstalled(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const installation = ProviderKindsServiceTests.register(host);
    const found = async (): Promise<string> => (await host.kinds.listInstallations()).map(t => `${t.state} ${t.foundPath}`).join(",");

    installation.isInstalled = true;
    Assert.areEqual("Installed null", await found());
    installation.foundPath = "/opt/homebrew/bin/agy";
    Assert.areEqual("Installed /opt/homebrew/bin/agy", await found());
    installation.isInstalled = false;
    Assert.areEqual("NotInstalled null", await found());
  }

  @TestMethod
  public async listsTheVersionsItReadWithAnUpdateOnlyWhenTheVersionAnInstallBringsIsNewerOrTheInstalledOneIsUnknown(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const installation = ProviderKindsServiceTests.register(host);
    installation.isInstalled = true;
    const versions = async (installed: string | null, latest: string | null): Promise<string> => {
      installation.versions = new ProviderKindVersions(installed, latest);
      await host.kinds.listInstallations();
      await installation.read;
      return ProviderKindsServiceTests.versionsOf(await host.kinds.listInstallations());
    };

    Assert.areEqual("Installed 2.1.211 2.1.212", await versions("2.1.211", "2.1.212"));
    Assert.areEqual("Installed 1.0.70 null", await versions("1.0.70", "1.0.62"));
    Assert.areEqual("Installed 2.1.212 null", await versions("2.1.212", "2.1.212"));
    Assert.areEqual("Installed 2.1.211 null", await versions("2.1.211", null));
    Assert.areEqual("Installed null 2.1.212", await versions(null, "2.1.212"));
    Assert.areEqual(10, installation.reads);
  }

  @TestMethod
  public async readsNoLatestVersionWhileUpdateChecksDontAllowItAndKeepsTheLatestItKnows(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const installation = ProviderKindsServiceTests.register(host);
    installation.isInstalled = true;
    installation.versions = new ProviderKindVersions("2.1.211", "2.1.212");
    const checks = new FakeToolUpdateChecks(false);
    const kinds = new ProviderKindsService(host.registry, host.providers, host.events, checks);
    const versions = async (): Promise<string> => {
      await kinds.listInstallations();
      await installation.read;
      const listed = ProviderKindsServiceTests.versionsOf(await kinds.listInstallations());
      await installation.read;
      return listed;
    };

    Assert.areEqual("Installed 2.1.211 null", await versions());
    checks.allows = true;
    Assert.areEqual("Installed 2.1.211 2.1.212", await versions());
    checks.allows = false;
    Assert.areEqual("Installed 2.1.211 2.1.212", await versions());
    Assert.areEqual("false,false,true,true,false,false", installation.checks.join(","));
  }

  @TestMethod
  public async listsTheNoticeTheInstallationReadsWhileInstalledWhetherOrNotUpdateChecksAllowALatestRead(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const installation = ProviderKindsServiceTests.register(host);
    installation.isInstalled = true;
    installation.versions = new ProviderKindVersions("0.171.0", "0.171.0", "Codex chats show in the Codex app.");
    const checks = new FakeToolUpdateChecks(false);
    const kinds = new ProviderKindsService(host.registry, host.providers, host.events, checks);
    const notices = async (): Promise<string> => {
      await kinds.listInstallations();
      await installation.read;
      const listed = (await kinds.listInstallations()).map(t => `${t.state} ${t.notice}`).join(",");
      await installation.read;
      return listed;
    };

    const unchecked = await notices();
    checks.allows = true;
    const checked = await notices();
    installation.isInstalled = false;
    const removed = await notices();

    Assert.areEqual("Installed Codex chats show in the Codex app.|Installed Codex chats show in the Codex app.|NotInstalled null", [unchecked, checked, removed].join("|"));
    Assert.areEqual("false,false,true,true", installation.checks.slice(0, 4).join(","));
  }

  @TestMethod
  public async readsTheListedInstallationsLatestVersionsOnceUpdateChecksAllowItAndNothingBeforeAnyListing(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const installation = ProviderKindsServiceTests.register(host);
    installation.isInstalled = true;
    installation.versions = new ProviderKindVersions("2.1.211", "2.1.212");
    const checks = new FakeToolUpdateChecks(false);
    const kinds = new ProviderKindsService(host.registry, host.providers, host.events, checks);
    checks.allow();
    const before = installation.checks.join(",");
    checks.allows = false;
    await kinds.listInstallations();
    await installation.read;

    checks.allow();
    await installation.read;

    Assert.areEqual(String.empty, before);
    Assert.areEqual("false,true", installation.checks.join(","));
    Assert.areEqual("Installed 2.1.211 2.1.212", ProviderKindsServiceTests.versionsOf(await kinds.listInstallations()));
  }

  @TestMethod
  public async checksTheLatestVersionWhenAskedOvertakingARunningReadThatDoesntAndWaitsForIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const installation = ProviderKindsServiceTests.register(host);
    installation.isInstalled = true;
    installation.holdReads = true;
    installation.versions = new ProviderKindVersions("2.1.211", "2.1.212");
    const kinds = new ProviderKindsService(host.registry, host.providers, host.events, new FakeToolUpdateChecks(false));
    await kinds.listInstallations();
    let ended = false;

    const checked = kinds.checkInstallationsAsync().then(t => {
      ended = true;
      return t;
    });
    const again = kinds.checkInstallationsAsync();
    await installation.answerRead();
    await kinds.listInstallations();

    Assert.isFalse(ended);
    Assert.areEqual("false,true", installation.checks.join(","));
    await installation.answerRead();
    Assert.areEqual("Installed 2.1.211 2.1.212", ProviderKindsServiceTests.versionsOf(await checked));
    Assert.areEqual("Installed 2.1.211 2.1.212", ProviderKindsServiceTests.versionsOf(await again));
    Assert.areEqual("Installed 2.1.211", ProviderKindsServiceTests.versionsPublished(host));
  }

  @TestMethod
  public async listsAtOnceWhileAVersionReadDoesntAnswerAndPublishesTheVersionsOnceItDoes(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const installation = ProviderKindsServiceTests.register(host);
    installation.isInstalled = true;
    installation.holdReads = true;
    installation.versions = new ProviderKindVersions("2.1.211", "2.1.212");

    Assert.areEqual("Installed null null", ProviderKindsServiceTests.versionsOf(await host.kinds.listInstallations()));
    Assert.areEqual("Installed null null", ProviderKindsServiceTests.versionsOf(await host.kinds.listInstallations()));
    Assert.areEqual(1, installation.reads);
    Assert.areEqual("", ProviderKindsServiceTests.versionsPublished(host));
    await installation.answerRead();

    Assert.areEqual("Installed 2.1.211", ProviderKindsServiceTests.versionsPublished(host));
    Assert.areEqual("Installed 2.1.211 2.1.212", ProviderKindsServiceTests.versionsOf(await host.kinds.listInstallations()));
    Assert.areEqual(2, installation.reads);
  }

  @TestMethod
  public async keepsTheVersionsItHadWhenAVersionReadFails(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const installation = ProviderKindsServiceTests.register(host);
    installation.isInstalled = true;
    installation.holdReads = true;
    installation.versions = new ProviderKindVersions("2.1.211", "2.1.212");
    await host.kinds.listInstallations();
    await installation.failRead();
    Assert.areEqual("Installed null null", ProviderKindsServiceTests.versionsOf(await host.kinds.listInstallations()));
    await installation.answerRead();

    await host.kinds.listInstallations();
    await installation.failRead();

    Assert.areEqual("Installed 2.1.211 2.1.212", ProviderKindsServiceTests.versionsOf(await host.kinds.listInstallations()));
    Assert.areEqual("Installed null,Installed 2.1.211,Installed 2.1.211", ProviderKindsServiceTests.versionsPublished(host));
  }

  @TestMethod
  public async updatesAnInstalledProviderThatHasAnUpdateAndPublishesTheVersionsReadOnceItEndsIgnoringAReadItOvertook(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const installation = ProviderKindsServiceTests.register(host);
    installation.isInstalled = true;
    installation.holdReads = true;
    installation.versions = new ProviderKindVersions("2.1.211", "2.1.212");
    await host.kinds.listInstallations();
    await installation.answerRead();
    await host.kinds.listInstallations();

    const updating = host.kinds.install(params);
    Assert.areEqual("Installing 2.1.211 null", ProviderKindsServiceTests.versionsOf(await host.kinds.listInstallations()));
    installation.complete();
    const updated = await updating;
    Assert.areEqual("Installed 2.1.211 null", ProviderKindsServiceTests.versionsOf([updated]));
    await installation.answerRead();
    Assert.areEqual("Installed 2.1.211 null", ProviderKindsServiceTests.versionsOf(await host.kinds.listInstallations()));
    installation.versions = new ProviderKindVersions("2.1.212", "2.1.212");
    await installation.answerRead();

    Assert.areEqual("Installed 2.1.212 null", ProviderKindsServiceTests.versionsOf(await host.kinds.listInstallations()));
    Assert.areEqual("Installed 2.1.211,Installing 2.1.211,Installed 2.1.211,Installed 2.1.212", ProviderKindsServiceTests.versionsPublished(host));
    Assert.areEqual(ProviderKindInstallState.Installed, (await host.kinds.install(params)).state);
    Assert.areEqual("1 4", `${installation.installs} ${installation.reads}`);
  }

  @TestMethod
  public async keepsAnInstalledProviderAsItWasWithTheReasonWhenItsUpdateFailsOrIsCancelled(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const installation = ProviderKindsServiceTests.register(host);
    installation.isInstalled = true;
    installation.versions = new ProviderKindVersions("2.1.211", "2.1.212");
    await host.kinds.listInstallations();
    await installation.read;

    const updating = host.kinds.install(params);
    installation.fail(new Error("The download failed its size or SHA-256 check."));
    Assert.areEqual("The download failed its size or SHA-256 check.", (await Assert.throwsAsync(() => updating, ServiceException)).message);
    const listed = (await host.kinds.listInstallations()).map(t => `${t.state} ${t.reason} ${t.version} ${t.update}`).join(",");
    Assert.areEqual("Installed The download failed its size or SHA-256 check. 2.1.211 2.1.212", listed);

    const cancelled = host.kinds.install(params);
    host.kinds.cancelInstall(params);
    Assert.areEqual("Installed 2.1.211 2.1.212", `${(await cancelled).state} ${(await cancelled).version} ${(await cancelled).update}`);
    Assert.areEqual(2, installation.installs);
  }

  @TestMethod
  public async clearsAFailedUpdatesReasonOnlyOnceTheVersionsReadShowItUpToDate(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const installation = ProviderKindsServiceTests.register(host);
    installation.isInstalled = true;
    installation.versions = new ProviderKindVersions("2.1.211", "2.1.212");
    await host.kinds.listInstallations();
    await installation.read;
    const updating = host.kinds.install(params);
    installation.fail(new Error("The download failed."));
    await Assert.throwsAsync(() => updating, ServiceException);
    const reason = async (installed: string, latest: string | null): Promise<string | null> => {
      installation.versions = new ProviderKindVersions(installed, latest);
      await host.kinds.listInstallations();
      await installation.read;
      const listed = await host.kinds.listInstallations();
      Assert.areEqual(1, listed.length);
      return listed[0]?.reason ?? null;
    };

    Assert.areEqual("The download failed.", await reason("2.1.211", "2.1.212"));
    Assert.areEqual("The download failed.", await reason("2.1.212", null));
    Assert.isNull(await reason("2.1.212", "2.1.212"));
  }

  @TestMethod
  public async letsNoCancelStopAnInstallOnceItCanNoLongerBeStoppedAndReportsItsOwnOutcome(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const installation = ProviderKindsServiceTests.register(host);

    const installing = host.kinds.install(params);
    installation.progress(1000, 1000);
    installation.commit();
    host.kinds.cancelInstall(params);

    Assert.isFalse(installation.signal?.aborted ?? true);
    Assert.isFalse((await host.kinds.listInstallations())[0]?.cancellable ?? true);
    installation.fail(new Error("Setting up Claude Code 2.1.212 failed with exit code 3."));
    Assert.areEqual("Setting up Claude Code 2.1.212 failed with exit code 3.", (await Assert.throwsAsync(() => installing, ServiceException)).message);
    Assert.areEqual("Installing true,Installing true,Installing false,NotInstalled true,NotInstalled true", host.listener.events
      .filter(t => t.name === EventName.ProviderKindInstallationChanged).map(t => ProviderKindInstallation.fromJson(t.payload))
      .map(t => `${t.state} ${t.cancellable}`).join(","));
  }

  @TestMethod
  public async installsAndPublishesItsStartEachWholePercentAndItsEnd(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const installation = ProviderKindsServiceTests.register(host);

    const installing = host.kinds.install(params);
    installation.progress(4, 1000);
    installation.progress(10, 1000);
    installation.progress(19, 1000);
    Assert.areEqual("agy Installing null 19/1000", ProviderKindsServiceTests.describeInstallations(await host.kinds.listInstallations(), true));
    installation.complete();

    Assert.areEqual(ProviderKindInstallState.Installed, (await installing).state);
    Assert.areEqual("Installing 0/0,Installing 10/1000,Installed 0/0,Installed 0/0", ProviderKindsServiceTests.published(host));
    Assert.areEqual(ProviderKindInstallState.Installed, (await host.kinds.install(params)).state);
    Assert.areEqual(1, installation.installs);
  }

  @TestMethod
  public async joinsAnInstallThatRunsAndStopsItForEveryRequestOnCancel(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const installation = ProviderKindsServiceTests.register(host);

    const first = host.kinds.install(params);
    const second = host.kinds.install(params);
    Assert.areEqual(first, second);
    host.kinds.cancelInstall(params);

    Assert.areEqual(1, installation.installs);
    Assert.isTrue(installation.signal?.aborted ?? false);
    for (const installed of [await first, await second])
      Assert.areEqual("NotInstalled null", `${installed.state} ${installed.reason}`);
    Assert.areEqual("Installing 0/0,NotInstalled 0/0,NotInstalled 0/0", ProviderKindsServiceTests.published(host));
    host.kinds.cancelInstall(params);
  }

  @TestMethod
  public async failsEveryJoinedRequestAndKeepsTheReasonUntilAnInstallSucceeds(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const installation = ProviderKindsServiceTests.register(host);

    const first = host.kinds.install(params);
    const second = host.kinds.install(params);
    installation.fail(new Error("The download failed its size or SHA-256 check."));
    for (const installing of [first, second]) {
      const failure = await Assert.throwsAsync(() => installing, ServiceException);
      Assert.areEqual(`${ErrorCode.Unavailable} The download failed its size or SHA-256 check.`, `${failure.info.name} ${failure.message}`);
    }
    Assert.areEqual("agy NotInstalled The download failed its size or SHA-256 check.", ProviderKindsServiceTests.describeInstallations(await host.kinds.listInstallations()));

    const again = host.kinds.install(params);
    installation.fail("unzip ended");
    Assert.areEqual("unzip ended", (await Assert.throwsAsync(() => again, ServiceException)).message);
    const blank = host.kinds.install(params);
    installation.fail(new Error(""));
    Assert.areEqual(Resources.installFailed, (await Assert.throwsAsync(() => blank, ServiceException)).message);
    const last = host.kinds.install(params);
    installation.complete();
    Assert.areEqual("Installed null", `${(await last).state} ${(await last).reason}`);
  }

  @TestMethod
  public async refusesAProviderItDoesntInstallOrThatCantBeInstalledHere(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const installation = ProviderKindsServiceTests.register(host);
    const fake = new ProviderKindParams("fake");

    for (const call of [() => host.kinds.install(fake), () => host.kinds.cancelInstall(fake)]) {
      const failure = Assert.throws(call, ServiceException);
      Assert.areEqual(`${ErrorCode.Unavailable} ${Resources.formatInstallUnavailable("Fake provider")}`, `${failure.info.name} ${failure.message}`);
    }
    Assert.areEqual(ErrorCode.NotFound, Assert.throws(() => host.kinds.install(new ProviderKindParams("nope")), ServiceException).info.name);
    installation.unavailable = "Installing needs unzip.";
    Assert.areEqual("Installing needs unzip.", Assert.throws(() => host.kinds.install(params), ServiceException).message);
    Assert.areEqual(0, installation.installs);
  }

  @TestMethod
  public async listsEachKindWithAToolCheckedAfreshAndAllAtOnce(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const claude = new FakeProviderAdapter("claude");
    const codex = new FakeProviderAdapter("codex");
    const checks: string[] = [];
    const claudeChecked = Promise.withResolvers<void>();
    let codexFound = false;
    const claudeTool = {
      check: async (): Promise<ProviderTool> => {
        checks.push(claude.descriptor.id);
        await claudeChecked.promise;
        return new ProviderTool("claude", true, "2.1.211", "curl -fsSL https://claude.ai/install.sh | bash", "https://claude.com/pricing");
      }
    };
    const codexTool = {
      check: (): Promise<ProviderTool> => {
        checks.push(codex.descriptor.id);
        return Promise.resolve(new ProviderTool("codex", codexFound, codexFound ? "0.98.0" : null));
      }
    };
    host.registry.register(claude, claudeTool);
    host.registry.register(new FakeProviderAdapter("agy"));
    host.registry.register(codex, codexTool);

    const first = host.kinds.listTools();
    Assert.areEqual("claude codex", checks.join(" "));
    claudeChecked.resolve();
    Assert.areEqual("claude true 2.1.211 https://claude.com/pricing, codex false null null", ProviderKindsServiceTests.describeTools(await first));
    codexFound = true;
    Assert.areEqual("claude true 2.1.211 https://claude.com/pricing, codex true 0.98.0 null", ProviderKindsServiceTests.describeTools(await host.kinds.listTools()));
    Assert.areEqual("claude codex claude codex", checks.join(" "));
  }

  @TestMethod
  public async listsNothingWhenNoKindHasATool(): Promise<void> {
    await using host = await CoreHost.createAsync();

    Assert.areEqual(0, (await host.kinds.listTools()).length);
  }

  private static register(host: CoreHost): FakeProviderKindInstallation {
    const adapter = new FakeProviderAdapter("agy");
    const installation = new FakeProviderKindInstallation();
    adapter.installation = installation;
    host.registry.register(adapter);
    return installation;
  }

  private static describeInstallations(installations: readonly ProviderKindInstallation[], withBytes: boolean = false): string {
    return installations.map(t => `${t.kind} ${t.state} ${t.reason}${withBytes ? ` ${t.received}/${t.total}` : ""}`).join(",");
  }

  private static versionsOf(installations: readonly ProviderKindInstallation[]): string {
    return installations.map(t => `${t.state} ${t.version} ${t.update}`).join(",");
  }

  private static versionsPublished(host: CoreHost): string {
    return host.listener.events.filter(t => t.name === EventName.ProviderKindInstallationChanged)
      .map(t => ProviderKindInstallation.fromJson(t.payload)).map(t => `${t.state} ${t.version}`).join(",");
  }

  private static published(host: CoreHost): string {
    return host.listener.events.filter(t => t.name === EventName.ProviderKindInstallationChanged)
      .map(t => ProviderKindInstallation.fromJson(t.payload)).map(t => `${t.state} ${t.received}/${t.total}`).join(",");
  }

  private static describeTools(tools: readonly ProviderTool[]): string {
    return tools.map(t => `${t.kind} ${t.found} ${t.version} ${t.subscribeUrl}`).join(", ");
  }
}
