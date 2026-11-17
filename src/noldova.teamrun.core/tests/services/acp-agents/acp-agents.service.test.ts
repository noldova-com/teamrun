/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ChangeOperation } from "@noldova/context.data";
import { SqlQuery } from "@noldova/context.data.sql";
import { ServiceException } from "@noldova/teamrun.services";
import { AcpAgentOffer, AcpAgentsService, AcpStoredAgent, ChangeEntity, type IAcpAgentCatalog, type IProviderAdapter, Resources } from "@noldova/teamrun.core";
import { AcpAgentIdParams, AcpAgentListing, AcpLocalCommandAddParams, ErrorCode, EventName, ProviderKindParams } from "@noldova/teamrun.protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";
import { FakeProviderAdapter } from "../../fixtures/fake-provider-adapter.fixture.js";
import { FakeProviderKindInstallation } from "../../fixtures/fake-provider-kind-installation.fixture.js";

const REFERENCE = "teamrun.mcpSecret0123456789abcdef0123456789abcdef";

class FakeAcpAgentCatalog implements IAcpAgentCatalog {
  public readonly offers: Map<string, AcpAgentOffer> = new Map();
  public readonly opened: Map<string, FakeProviderAdapter> = new Map();
  public readonly saves: Map<string, (json: JsonObject) => Promise<void>> = new Map();
  public readonly removed: string[] = [];
  public readonly listed: (readonly AcpStoredAgent[])[] = [];
  public refusals: ReadonlyMap<string, unknown> = new Map();
  public installation: FakeProviderKindInstallation | null = null;

  public listAsync(stored: readonly AcpStoredAgent[]): Promise<AcpAgentListing> {
    this.listed.push(stored);
    return Promise.resolve(new AcpAgentListing([], [], "listed", null));
  }

  public readIconAsync(id: string): Promise<string | null> {
    return Promise.resolve(`icon of ${id}`);
  }

  public readOfferAsync(id: string): Promise<AcpAgentOffer | null> {
    return Promise.resolve(this.offers.get(id) ?? null);
  }

  public localOf(params: AcpLocalCommandAddParams, isTaken: (kind: string) => boolean): AcpStoredAgent {
    return new AcpStoredAgent(isTaken("local-mine") ? "local-mine-2" : "local-mine", params.name, { secrets: params.secrets.map(t => t.reference) });
  }

  public openAsync(stored: AcpStoredAgent, save: (json: JsonObject) => Promise<void>): Promise<IProviderAdapter> {
    if (this.refusals.has(stored.kind))
      return Promise.reject(this.refusals.get(stored.kind));
    const adapter = new FakeProviderAdapter(stored.kind);
    if (!Object.isNull(this.installation))
      adapter.installation = this.installation;
    this.opened.set(stored.kind, adapter);
    this.saves.set(stored.kind, save);
    return Promise.resolve(adapter);
  }

  public referencesOf(stored: AcpStoredAgent): readonly string[] {
    return (stored.json["secrets"] ?? []) as readonly string[];
  }

  public removeFilesAsync(stored: AcpStoredAgent): Promise<void> {
    this.removed.push(stored.kind);
    return Promise.resolve();
  }
}

@TestClass
export class AcpAgentsServiceTests {
  private static service(host: CoreHost, catalog: IAcpAgentCatalog, log: CoreHost["log"] | null = host.log): AcpAgentsService {
    return new AcpAgentsService(host.context, host.registry, host.kinds, host.providers, catalog, host.secrets, host.events, log);
  }

  private static offer(kind: string, unavailable: string | null = null): AcpAgentOffer {
    return new AcpAgentOffer(new AcpStoredAgent(kind, `Agent ${kind}`, { version: "1.0.0" }), unavailable);
  }

  private static async rowsAsync(host: CoreHost): Promise<string> {
    return (await host.context.database.connection.queryAsync(new SqlQuery(Resources.selectAcpAgents))).map(t => `${t.readString("kind")}:${t.readString("name")}:${t.readString("json")}`).join(",");
  }

  private static async feedAsync(host: CoreHost): Promise<string> {
    return (await host.context.database.changeFeed.readAfterAsync(0)).filter(t => t.entity === ChangeEntity.AcpAgent).map(t => t.operation).join(",");
  }

  @TestMethod
  public addsAnAgentByKeepingWhatTheListSaysAndRegisteringItsKindSoItStaysAcrossAStart(): Promise<void> {
    return AcpAgentsServiceTests.withHost(async (host, catalog, service) => {
      catalog.offers.set("droid", AcpAgentsServiceTests.offer("droid"));
      const changes = host.listener.count(EventName.ProviderKindsChanged);

      const kind = await service.addAsync(new AcpAgentIdParams("droid"));

      Assert.areEqual("droid", kind.id);
      Assert.isTrue(host.registry.has("droid"));
      Assert.areEqual("droid:Agent droid:{\"version\":\"1.0.0\"}", await AcpAgentsServiceTests.rowsAsync(host));
      Assert.areEqual(ChangeOperation.Insert, await AcpAgentsServiceTests.feedAsync(host));
      Assert.areEqual(changes + 1, host.listener.count(EventName.ProviderKindsChanged));

      host.registry.unregister("droid");
      await service.startAsync();
      Assert.isTrue(host.registry.has("droid"));
    });
  }

  @TestMethod
  public refusesAKindAlreadyThereAnAgentTheListDoesntNameAndOneThatCantInstall(): Promise<void> {
    return AcpAgentsServiceTests.withHost(async (host, catalog, service) => {
      catalog.offers.set("fake", AcpAgentsServiceTests.offer("fake"));
      catalog.offers.set("droid", AcpAgentsServiceTests.offer("droid", "npm isn't on this computer."));
      const cases: readonly [string, ErrorCode, string][] = [
        ["fake", ErrorCode.Conflict, Resources.formatAcpAgentAlreadyAdded("fake")],
        ["missing", ErrorCode.NotFound, Resources.formatAcpAgentNotListed("missing")],
        ["droid", ErrorCode.Unavailable, "npm isn't on this computer."]
      ];

      for (const [id, code, message] of cases) {
        const failure = await Assert.throwsAsync(() => service.addAsync(new AcpAgentIdParams(id)), ServiceException);

        Assert.areEqual(code, failure.info.name, id);
        Assert.areEqual(message, failure.message, id);
      }
      Assert.areEqual(String.empty, await AcpAgentsServiceTests.rowsAsync(host));
    });
  }

  @TestMethod
  public keepsNoRowWhenAnAgentWontOpen(): Promise<void> {
    return AcpAgentsServiceTests.withHost(async (host, catalog, service) => {
      catalog.offers.set("droid", AcpAgentsServiceTests.offer("droid"));
      catalog.refusals = new Map([["droid", new Error("It won't open.")]]);

      const failure = await Assert.throwsAsync(() => service.addAsync(new AcpAgentIdParams("droid")), Error);

      Assert.areEqual("It won't open.", failure.message);
      Assert.areEqual(String.empty, await AcpAgentsServiceTests.rowsAsync(host));
      Assert.isFalse(host.registry.has("droid"));
    });
  }

  @TestMethod
  public addsALocalCommandUnderAKindNotTaken(): Promise<void> {
    return AcpAgentsServiceTests.withHost(async (host, _, service) => {
      const params = new AcpLocalCommandAddParams("Mine", "node", [], []);

      const first = await service.addLocalAsync(params);
      const second = await service.addLocalAsync(params);

      Assert.areEqual("local-mine,local-mine-2", [first.id, second.id].join(","));
      Assert.isTrue(host.registry.has("local-mine-2"));
    });
  }

  @TestMethod
  public savesTheVersionAnInstallMovedTo(): Promise<void> {
    return AcpAgentsServiceTests.withHost(async (host, catalog, service) => {
      catalog.offers.set("droid", AcpAgentsServiceTests.offer("droid"));
      await service.addAsync(new AcpAgentIdParams("droid"));

      await catalog.saves.get("droid")!({ version: "2.0.0" });

      Assert.areEqual("droid:Agent droid:{\"version\":\"2.0.0\"}", await AcpAgentsServiceTests.rowsAsync(host));
      Assert.areEqual(`${ChangeOperation.Insert},${ChangeOperation.Update}`, await AcpAgentsServiceTests.feedAsync(host));
    });
  }

  @TestMethod
  public startsWithTheRowsThatOpenAndLogsTheOnesThatDont(): Promise<void> {
    return AcpAgentsServiceTests.withHost(async (host, catalog, service) => {
      for (const kind of ["bad", "good", "worse"]) {
        catalog.offers.set(kind, AcpAgentsServiceTests.offer(kind));
        await service.addAsync(new AcpAgentIdParams(kind));
        host.registry.unregister(kind);
      }
      catalog.refusals = new Map<string, unknown>([["bad", new Error("It won't open.")], ["worse", "It stopped."]]);

      await service.startAsync();
      await AcpAgentsServiceTests.service(host, catalog, null).startAsync();
      await catalog.saves.get("good")!({ version: "3.0.0" });

      Assert.isTrue((await AcpAgentsServiceTests.rowsAsync(host)).includes("good:Agent good:{\"version\":\"3.0.0\"}"));
      Assert.isTrue(host.registry.has("good"));
      Assert.isFalse(host.registry.has("bad"));
      Assert.isFalse(host.registry.has("worse"));
      Assert.isTrue(host.log.lines.includes(Resources.formatAcpAgentNotOpened("bad", "It won't open.")));
      Assert.isTrue(host.log.lines.includes(Resources.formatAcpAgentNotOpened("worse", "It stopped.")));
    });
  }

  @TestMethod
  public listsWithTheRowsAndReadsAnIconFromTheCatalog(): Promise<void> {
    return AcpAgentsServiceTests.withHost(async (_, catalog, service) => {
      catalog.offers.set("droid", AcpAgentsServiceTests.offer("droid"));
      await service.addAsync(new AcpAgentIdParams("droid"));

      const listing = await service.listAsync();

      Assert.areEqual("listed", listing.failure);
      Assert.areEqual("droid", catalog.listed[0]!.map(t => t.kind).join(","));
      Assert.areEqual("icon of droid", await service.readIconAsync(new AcpAgentIdParams("droid")));
    });
  }

  @TestMethod
  public removesAnAgentItsRowItsValuesAndItsFilesAndStopsIt(): Promise<void> {
    return AcpAgentsServiceTests.withHost(async (host, catalog, service) => {
      catalog.offers.set("droid", new AcpAgentOffer(new AcpStoredAgent("droid", "Droid", { secrets: [REFERENCE] }), null));
      await service.addAsync(new AcpAgentIdParams("droid"));
      const adapter = catalog.opened.get("droid")!;
      const changes = host.listener.count(EventName.ProviderKindsChanged);

      await service.removeAsync(new AcpAgentIdParams("droid"));
      await host.until("the removed secret", () => host.secrets.removed.length === 1);

      Assert.isFalse(host.registry.has("droid"));
      Assert.areEqual(1, adapter.shutdowns);
      Assert.areEqual(String.empty, await AcpAgentsServiceTests.rowsAsync(host));
      Assert.areEqual(`${ChangeOperation.Insert},${ChangeOperation.Delete}`, await AcpAgentsServiceTests.feedAsync(host));
      Assert.areEqual(REFERENCE, host.secrets.removed.join(","));
      Assert.areEqual("droid", catalog.removed.join(","));
      Assert.areEqual(changes + 1, host.listener.count(EventName.ProviderKindsChanged));
    });
  }

  @TestMethod
  public removesAnAgentWhoseAdapterIsAlreadyGone(): Promise<void> {
    return AcpAgentsServiceTests.withHost(async (host, catalog, service) => {
      catalog.offers.set("droid", AcpAgentsServiceTests.offer("droid"));
      await service.addAsync(new AcpAgentIdParams("droid"));
      host.registry.unregister("droid");

      await service.removeAsync(new AcpAgentIdParams("droid"));

      Assert.areEqual(String.empty, await AcpAgentsServiceTests.rowsAsync(host));
    });
  }

  @TestMethod
  public logsAValueItCantForgetWithoutFailingTheRemoval(): Promise<void> {
    return AcpAgentsServiceTests.withHost(async (host, catalog, service) => {
      const secrets = (kind: string): AcpAgentOffer => new AcpAgentOffer(new AcpStoredAgent(kind, kind, { secrets: [REFERENCE] }), null);
      catalog.offers.set("one", secrets("one"));
      catalog.offers.set("two", secrets("two"));
      catalog.offers.set("three", secrets("three"));
      for (const kind of ["one", "two", "three"])
        await service.addAsync(new AcpAgentIdParams(kind));
      host.secrets.refusal = "The store is locked.";

      await service.removeAsync(new AcpAgentIdParams("one"));
      await host.until("the first kept-secret line", () => host.log.lines.includes(Resources.formatAcpAgentSecretKept("one", "The store is locked.")));
      host.secrets.refusesWithText = true;
      await service.removeAsync(new AcpAgentIdParams("two"));
      await host.until("the second kept-secret line", () => host.log.lines.includes(Resources.formatAcpAgentSecretKept("two", "The store is locked.")));
      await AcpAgentsServiceTests.service(host, catalog, null).removeAsync(new AcpAgentIdParams("three"));

      Assert.areEqual(String.empty, await AcpAgentsServiceTests.rowsAsync(host));
      Assert.areEqual("one,two,three", catalog.removed.join(","));
    });
  }

  @TestMethod
  public refusesToRemoveAnAgentNotAddedOneAProviderUsesOrOneInstalling(): Promise<void> {
    return AcpAgentsServiceTests.withHost(async (host, catalog, service) => {
      const installation = new FakeProviderKindInstallation();
      catalog.installation = installation;
      for (const kind of ["used", "busy"]) {
        catalog.offers.set(kind, AcpAgentsServiceTests.offer(kind));
        await service.addAsync(new AcpAgentIdParams(kind));
      }
      await host.createProviderAsync("used");
      Assert.isFalse(host.kinds.isInstalling("busy"));
      const installing = host.kinds.install(new ProviderKindParams("busy"));
      Assert.isTrue(host.kinds.isInstalling("busy"));
      const cases: readonly [string, ErrorCode, string][] = [
        ["missing", ErrorCode.NotFound, Resources.formatAcpAgentNotListed("missing")],
        ["used", ErrorCode.Conflict, Resources.formatAcpAgentInUse("Agent used")],
        ["busy", ErrorCode.Conflict, Resources.formatAcpAgentInstalling("Agent busy")]
      ];

      for (const [id, code, message] of cases) {
        const failure = await Assert.throwsAsync(() => service.removeAsync(new AcpAgentIdParams(id)), ServiceException);

        Assert.areEqual(code, failure.info.name, id);
        Assert.areEqual(message, failure.message, id);
      }
      Assert.isTrue(host.registry.has("used"));
      Assert.isTrue(host.registry.has("busy"));
      installation.complete();
      await installing;
      Assert.isFalse(host.kinds.isInstalling("busy"));
    });
  }

  private static async withHost(test: (host: CoreHost, catalog: FakeAcpAgentCatalog, service: AcpAgentsService) => Promise<void>): Promise<void> {
    await using host = await CoreHost.createAsync();
    const catalog = new FakeAcpAgentCatalog();
    await test(host, catalog, AcpAgentsServiceTests.service(host, catalog));
  }
}
