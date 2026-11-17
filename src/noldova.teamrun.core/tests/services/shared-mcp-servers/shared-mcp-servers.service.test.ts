/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { inspect } from "node:util";

import "@noldova/context.core";
import { ChangeOperation } from "@noldova/context.data";
import { SqlQuery } from "@noldova/context.data.sql";
import { ServiceException } from "@noldova/teamrun.services";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ChangeEntity, Resources, SharedMcpAccess, SharedMcpRefusal, type SharedMcpSelection } from "@noldova/teamrun.core";
import {
  ErrorCode, EventName, Harness, type Provider, ProviderIdParams, SharedMcpAccount, SharedMcpHeader, SharedMcpProviderSetParams, SharedMcpSecretSetParams, SharedMcpServerDefinition,
  SharedMcpServerIdParams, SharedMcpServerUpdateParams, SharedMcpSetting, SharedMcpTeammateSetParams, SharedMcpTransport, SharedMcpVariableSource,
  TeammateCreateParams, TeammateIdParams
} from "@noldova/teamrun.protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";
import { FakeProviderAdapter } from "../../fixtures/fake-provider-adapter.fixture.js";

@TestClass
export class SharedMcpServersServiceTests {
  private static readonly reference = "teamrun.mcpSecret0123456789abcdef0123456789abcdef";
  private static readonly value = "saved-value-7f3c9a1e";

  @TestMethod
  public async refusesSavingANameThatStartsLikeTeamRunsToolsAndStillReadsAndRenamesOneAlreadySaved(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const search = await host.sharedServers.createAsync(SharedMcpServersServiceTests.http("search"));
    await host.sharedServers.createAsync(SharedMcpServersServiceTests.http("teamrun-docs"));

    for (const name of ["teamrun_teamrun", "teamrun_search"]) {
      const refused = await Assert.throwsAsync(() => host.sharedServers.createAsync(SharedMcpServersServiceTests.http(name)), ServiceException);
      Assert.areEqual(JSON.stringify([ErrorCode.InvalidParams, Resources.sharedMcpServerNameReserved]), JSON.stringify([refused.info.name, refused.message]), name);
      Assert.areEqual(ErrorCode.InvalidParams, (await Assert.throwsAsync(() => host.sharedServers.updateAsync(
        new SharedMcpServerUpdateParams(search.id, SharedMcpServersServiceTests.http(name))), ServiceException)).info.name, name);
    }
    Assert.areEqual("search,teamrun-docs", (await host.sharedServers.listAsync()).map(t => t.server.definition.name).join(","));

    await host.context.database.connection.executeAsync(new SqlQuery("UPDATE sharedMcpServers SET name = ?, json = ? WHERE id = ?", ["teamrun_search",
      JSON.stringify(search.toJson()).replace(`"name":"search"`, `"name":"teamrun_search"`), search.id]));
    Assert.areEqual("teamrun-docs,teamrun_search", (await host.sharedServers.listAsync()).map(t => t.server.definition.name).sort().join(","));
    Assert.areEqual(ErrorCode.InvalidParams, (await Assert.throwsAsync(() => host.sharedServers.updateAsync(
      new SharedMcpServerUpdateParams(search.id, SharedMcpServersServiceTests.http("teamrun_search"))), ServiceException)).info.name);
    Assert.areEqual("web", (await host.sharedServers.updateAsync(new SharedMcpServerUpdateParams(search.id, SharedMcpServersServiceTests.http("web")))).definition.name);
  }

  @TestMethod
  public async addsChangesAndRemovesServersOffForEveryProviderWithUniqueNames(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const search = await host.sharedServers.createAsync(SharedMcpServersServiceTests.stdio("search", ["SEARCH_KEY"]));
    const docs = await host.sharedServers.createAsync(SharedMcpServersServiceTests.http("docs"));

    Assert.areEqual(JSON.stringify([[], []]), JSON.stringify([search.providerIds, search.teammates]));
    Assert.areEqual("docs,search", (await host.sharedServers.listAsync()).map(t => t.server.definition.name).join(","));
    Assert.areEqual(ErrorCode.Conflict, (await Assert.throwsAsync(() => host.sharedServers.createAsync(SharedMcpServersServiceTests.http("search")), ServiceException)).info.name);
    const renamed = await host.sharedServers.updateAsync(new SharedMcpServerUpdateParams(search.id, SharedMcpServersServiceTests.stdio("web", [])));
    Assert.areEqual(JSON.stringify([search.id, "web", search.createdAt]), JSON.stringify([renamed.id, renamed.definition.name, renamed.createdAt]));
    Assert.areEqual("web", (await host.sharedServers.updateAsync(new SharedMcpServerUpdateParams(search.id, SharedMcpServersServiceTests.stdio("web", ["A"])))).definition.name);
    Assert.areEqual(ErrorCode.Conflict, (await Assert.throwsAsync(() => host.sharedServers.updateAsync(
      new SharedMcpServerUpdateParams(search.id, SharedMcpServersServiceTests.http("docs"))), ServiceException)).info.name);
    await host.sharedServers.deleteAsync(new SharedMcpServerIdParams(docs.id));
    Assert.areEqual("web", (await host.sharedServers.listAsync()).map(t => t.server.definition.name).join(","));
    for (const action of [() => host.sharedServers.deleteAsync(new SharedMcpServerIdParams(docs.id)),
      () => host.sharedServers.updateAsync(new SharedMcpServerUpdateParams("missing", SharedMcpServersServiceTests.http("x"))),
      () => host.sharedServers.setProviderAsync(new SharedMcpProviderSetParams("missing", "p1", true)),
      () => host.sharedServers.setTeammateAsync(new SharedMcpTeammateSetParams("missing", "t1", SharedMcpSetting.On))])
      Assert.areEqual(ErrorCode.NotFound, (await Assert.throwsAsync(action, ServiceException)).info.name);
    const changes = (await host.context.database.changeFeed.readAfterAsync(0)).filter(t => t.entity === ChangeEntity.SharedMcpServer).map(t => t.operation);
    Assert.areEqual(JSON.stringify([ChangeOperation.Insert, ChangeOperation.Insert, ChangeOperation.Update, ChangeOperation.Update, ChangeOperation.Delete]),
      JSON.stringify(changes));
  }

  @TestMethod
  public async switchesAServerPerProviderAndPerTeammateAndDropsTheDeletedOnesAtTheNextChange(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const [work, home] = [await host.createProviderAsync("fake", "Work"), await host.createProviderAsync("fake", "Home")];
    const alice = await host.teammates.createAsync(new TeammateCreateParams("Alice", null, work.id, Harness.Provider, null, null));
    const bob = await host.teammates.createAsync(new TeammateCreateParams("Bob", null, home.id, Harness.Provider, null, null));
    const server = await host.sharedServers.createAsync(SharedMcpServersServiceTests.stdio("search", []));

    await host.sharedServers.setProviderAsync(new SharedMcpProviderSetParams(server.id, work.id, true));
    await host.sharedServers.setProviderAsync(new SharedMcpProviderSetParams(server.id, home.id, true));
    await host.sharedServers.setProviderAsync(new SharedMcpProviderSetParams(server.id, work.id, true));
    await host.sharedServers.setTeammateAsync(new SharedMcpTeammateSetParams(server.id, alice.id, SharedMcpSetting.Off));
    const set = await host.sharedServers.setTeammateAsync(new SharedMcpTeammateSetParams(server.id, bob.id, SharedMcpSetting.On));
    Assert.areEqual(JSON.stringify([home.id, work.id]), JSON.stringify(set.providerIds));
    Assert.areEqual(JSON.stringify([[alice.id, "Off"], [bob.id, "On"]]), JSON.stringify(set.teammates.map(t => [t.teammateId, t.setting])));
    Assert.areEqual(ErrorCode.NotFound, (await Assert.throwsAsync(() => host.sharedServers.setProviderAsync(new SharedMcpProviderSetParams(server.id, "missing", true)),
      ServiceException)).info.name);
    Assert.areEqual(ErrorCode.NotFound, (await Assert.throwsAsync(() => host.sharedServers.setTeammateAsync(
      new SharedMcpTeammateSetParams(server.id, "missing", SharedMcpSetting.On)), ServiceException)).info.name);

    await host.providers.deleteAsync(new ProviderIdParams(home.id));
    await host.teammates.deleteAsync(new TeammateIdParams(bob.id));
    const listed = (await host.sharedServers.listAsync())[0]!.server;
    Assert.areEqual(JSON.stringify([[work.id], [alice.id]]), JSON.stringify([listed.providerIds, listed.teammates.map(t => t.teammateId)]));
    const off = await host.sharedServers.setProviderAsync(new SharedMcpProviderSetParams(server.id, work.id, false));
    const follows = await host.sharedServers.setTeammateAsync(new SharedMcpTeammateSetParams(server.id, alice.id, SharedMcpSetting.AsProvider));
    Assert.areEqual(JSON.stringify([[], []]), JSON.stringify([off.providerIds, follows.teammates]));
  }

  @TestMethod
  public async listsEachProviderThatCantTakeAServerWithWhy(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const other = new FakeProviderAdapter("other");
    host.registry.register(other);
    other.sharedServerUnavailable = server => server.transport === SharedMcpTransport.Http ? new SharedMcpRefusal("Other takes no HTTP servers.", "HTTP not taken") : null;
    const [fake, taking, gone] = [await host.createProviderAsync("fake", "Fake"), await host.createProviderAsync("other", "Other"), await host.createProviderAsync("other", "Gone")];
    await SharedMcpServersServiceTests.renameKindAsync(host, gone, "removed");
    await host.sharedServers.createAsync(SharedMcpServersServiceTests.http("docs"));
    await host.sharedServers.createAsync(SharedMcpServersServiceTests.stdio("search", []));

    const listed = (await host.sharedServers.listAsync()).map(t => [t.server.definition.name, t.unavailable.map(u => [u.providerId, u.reason, u.short])]);

    const fakeReason = Resources.formatSharedMcpServersUnsupported(host.adapter.descriptor.displayName);
    const goneReason = Resources.formatSharedMcpServersUnsupported("removed");
    const short = Resources.sharedMcpServersUnsupportedShort;
    Assert.areEqual(JSON.stringify([
      ["docs", [[fake.id, fakeReason, short], [taking.id, "Other takes no HTTP servers.", "HTTP not taken"], [gone.id, goneReason, short]]],
      ["search", [[fake.id, fakeReason, short], [gone.id, goneReason, short]]]
    ]), JSON.stringify(listed));
  }

  @TestMethod
  public async listsAServerWhoseHeaderOrBearerVariableIsntSetAsUnavailableForEveryProviderThatTakesItByTheEnvironmentReadForEachList(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const other = new FakeProviderAdapter("other");
    host.registry.register(other);
    other.sharedServerUnavailable = () => null;
    const [fake, taking] = [await host.createProviderAsync("fake", "Fake"), await host.createProviderAsync("other", "Other")];
    await host.sharedServers.createAsync(SharedMcpServersServiceTests.http("docs"));
    await host.sharedServers.createAsync(new SharedMcpServerDefinition("team", SharedMcpTransport.Http, null, [], [], "https://team.example.com/mcp",
      [new SharedMcpHeader("X-Team", "TEAM_HEADER")], null));
    await host.sharedServers.createAsync(SharedMcpServersServiceTests.stdio("search", ["SEARCH_KEY"]));
    host.environment["DOCS_TEAM"] = "";
    host.environment["SEARCH_KEY"] = "";
    const reasonsOf = async (): Promise<string> => JSON.stringify((await host.sharedServers.listAsync())
      .map(t => [t.server.definition.name, t.unavailable.filter(u => u.providerId === taking.id).map(u => [u.reason, u.short])]));

    const unset = await reasonsOf();
    host.environment["DOCS_TOKEN"] = "";
    host.environment["TEAM_HEADER"] = "";
    const set = await reasonsOf();

    const unsetOf = (variable: string): string[] => [Resources.formatSharedMcpVariableUnset(variable), Resources.formatSharedMcpVariableUnsetShort(variable)];
    Assert.areEqual(JSON.stringify([["docs", [unsetOf("DOCS_TOKEN")]], ["search", []], ["team", [unsetOf("TEAM_HEADER")]]]), unset);
    Assert.areEqual("DOCS_TOKEN not set", Resources.formatSharedMcpVariableUnsetShort("DOCS_TOKEN"));
    Assert.areEqual(JSON.stringify([["docs", []], ["search", []], ["team", []]]), set);
    Assert.isTrue((await host.sharedServers.listAsync()).every(t => t.unavailable.some(u => u.providerId === fake.id
      && u.reason === Resources.formatSharedMcpServersUnsupported(host.adapter.descriptor.displayName))));
  }

  @TestMethod
  public async selectsTheServersThatReachATeammateAndNotesThoseLeftOutByTheEnvironmentReadForEachSelection(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folders = new Set<string | null>();
    host.adapter.sharedServerUnavailable = (server, _provider, folder) => {
      folders.add(folder);
      return server.transport === SharedMcpTransport.Http ? new SharedMcpRefusal("Fake takes no HTTP servers.", "HTTP not taken") : null;
    };
    const provider = await host.createProviderAsync();
    const alice = await host.teammates.createAsync(new TeammateCreateParams("Alice", null, provider.id, Harness.Provider, null, null));
    const ids: string[] = [];
    for (const name of ["search", "unset", "docs", "own"])
      ids.push((await host.sharedServers.createAsync(name === "docs" ? SharedMcpServersServiceTests.http(name)
        : SharedMcpServersServiceTests.stdio(name, name === "unset" ? ["SET_KEY", "UNSET_KEY"] : ["SET_KEY"]))).id);
    for (const id of ids.slice(0, 3))
      await host.sharedServers.setProviderAsync(new SharedMcpProviderSetParams(id, provider.id, true));
    await host.sharedServers.setTeammateAsync(new SharedMcpTeammateSetParams(ids[3]!, alice.id, SharedMcpSetting.On));
    host.environment["SET_KEY"] = "";

    const forAlice = await host.sharedServers.selectAsync(provider, alice.id, "/projects/app");
    const forDefault = await host.sharedServers.selectAsync(provider, null, "/projects/app");
    Assert.areEqual("/projects/app", [...folders].join(","));
    await host.sharedServers.listAsync();
    Assert.areEqual("/projects/app,null", [...folders].map(t => `${t}`).join(","));

    Assert.areEqual("own,search", forAlice.servers.map(t => t.name).join(","));
    Assert.areEqual(JSON.stringify([
      Resources.formatSharedMcpServerLeftOut("docs", "Fake takes no HTTP servers."),
      Resources.formatSharedMcpServerLeftOut("unset", Resources.formatSharedMcpVariableUnset("UNSET_KEY"))
    ]), JSON.stringify(forAlice.notes));
    Assert.areEqual("search", forDefault.servers.map(t => t.name).join(","));
    Assert.areEqual(2, forDefault.notes.length);
    const none = await host.sharedServers.selectAsync(null, alice.id, "/projects/app");
    Assert.areEqual(JSON.stringify([[], []]), JSON.stringify([none.servers, none.notes]));
    host.environment["UNSET_KEY"] = "set since";
    const later = await host.sharedServers.selectAsync(provider, alice.id, "/projects/app");
    Assert.isTrue(later.servers.some(t => t.name === "unset"));
    Assert.areEqual(1, later.notes.length);
  }

  @TestMethod
  public async takesTheFirstOfTheServersItsProviderReadsByOneNameAndNotesTheOthersLeftOut(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.sharedServerUnavailable = server => server.name === "off" ? new SharedMcpRefusal("Fake takes no off server.", "off") : null;
    host.adapter.sharedServerNamespaceOf = name => name.replaceAll("-", "_");
    const provider = await host.createProviderAsync();
    for (const name of ["my_api", "off", "my-api", "o-ff", "docs"])
      await host.sharedServers.setProviderAsync(new SharedMcpProviderSetParams((await host.sharedServers.createAsync(SharedMcpServersServiceTests.stdio(name, []))).id, provider.id, true));

    const selected = await host.sharedServers.selectAsync(provider, null, "/projects/app");

    Assert.areEqual("docs,my-api,o-ff", selected.servers.map(t => t.name).join(","));
    Assert.areEqual(JSON.stringify([
      Resources.formatSharedMcpServerLeftOut("my_api", Resources.formatSharedMcpNameClash(host.adapter.descriptor.displayName, "my-api")),
      Resources.formatSharedMcpServerLeftOut("off", "Fake takes no off server.")
    ]), JSON.stringify(selected.notes));
  }

  @TestMethod
  public async listsEachVariableWithItsSourceAndWhetherItIsSetAndASavedSecretNotOnThisMachineAsUnavailable(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const [, taking] = await SharedMcpServersServiceTests.takingAsync(host);
    const server = await host.sharedServers.createAsync(SharedMcpServersServiceTests.stdio("search", ["GITHUB_TOKEN", "SEARCH_KEY"]));
    host.environment["SEARCH_KEY"] = "";
    const updatedAt = (await host.sharedServers.setSecretAsync(new SharedMcpSecretSetParams(server.id, "GITHUB_TOKEN", SharedMcpServersServiceTests.reference))).secrets[0]?.updatedAt;
    const listedAs = async (): Promise<string> => JSON.stringify((await host.sharedServers.listAsync()).map(t => [t.variables.map(v => v.toJson()),
      t.unavailable.filter(u => u.providerId === taking.id).map(u => [u.reason, u.short])]));

    const missing = await listedAs();
    host.secrets.values.set(SharedMcpServersServiceTests.reference, SharedMcpServersServiceTests.value);
    const saved = await listedAs();
    host.secrets.refusal = "Open the app to use saved secrets.";
    const refused = await listedAs();
    host.secrets.refusesWithText = true;
    const refusedWithText = await listedAs();

    const variables = (set: boolean): object[] => [{ variable: "GITHUB_TOKEN", source: SharedMcpVariableSource.Saved, set, updatedAt },
      { variable: "SEARCH_KEY", source: SharedMcpVariableSource.Environment, set: true, updatedAt: null }];
    Assert.areEqual(JSON.stringify([[variables(false), [[Resources.formatSharedMcpSecretMissing("GITHUB_TOKEN"), "GITHUB_TOKEN's saved secret missing"]]]]),
      missing);
    Assert.areEqual(JSON.stringify([[variables(true), []]]), saved);
    Assert.areEqual(JSON.stringify([[variables(false), [[Resources.formatSharedMcpSecretUnreadable("GITHUB_TOKEN", "Open the app to use saved secrets."),
      "GITHUB_TOKEN's saved secret unreadable"]]]]), refused);
    Assert.areEqual(refused, refusedWithText);
    Assert.areEqual(0, host.secrets.reads.length);
  }

  @TestMethod
  public async listsAServerWithASavedSecretOrASignInAsUnavailableForAProviderThatTakesNoSavedSecretsWithWhy(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const [takingAdapter, taking] = await SharedMcpServersServiceTests.takingAsync(host);
    takingAdapter.savedSecretsUnavailable = server => server.transport === SharedMcpTransport.Http ? new SharedMcpRefusal("Taking takes no saved headers.") : null;
    const plainAdapter = new FakeProviderAdapter("plain");
    host.registry.register(plainAdapter);
    plainAdapter.sharedServerUnavailable = () => null;
    const plain = await host.createProviderAsync("plain", "Plain");
    const docs = await host.sharedServers.createAsync(SharedMcpServersServiceTests.http("docs"));
    await host.sharedServers.createAsync(SharedMcpServersServiceTests.stdio("search", ["GITHUB_TOKEN"]));
    await host.sharedServers.createAsync(SharedMcpServersServiceTests.signingIn("wiki"));
    host.environment["DOCS_TEAM"] = "";
    host.environment["GITHUB_TOKEN"] = "";
    host.secrets.values.set(SharedMcpServersServiceTests.reference, SharedMcpServersServiceTests.value);
    await host.sharedServers.setSecretAsync(new SharedMcpSecretSetParams(docs.id, "DOCS_TOKEN", SharedMcpServersServiceTests.reference));

    const listed = (await host.sharedServers.listAsync()).map(t => [t.server.definition.name,
      t.unavailable.filter(u => u.providerId === taking.id || u.providerId === plain.id).map(u => [u.providerId, u.reason, u.short]).sort()]);

    const signIn = Resources.sharedMcpSignInUnsupportedShort;
    Assert.areEqual(JSON.stringify([
      ["docs", [[taking.id, "Taking takes no saved headers.", null],
        [plain.id, Resources.formatSharedMcpSecretsUnsupported(plainAdapter.descriptor.displayName), Resources.sharedMcpSecretsUnsupportedShort]].sort()],
      ["search", []],
      ["wiki", [[taking.id, Resources.formatSharedMcpSignInUnsupported(takingAdapter.descriptor.displayName), signIn],
        [plain.id, Resources.formatSharedMcpSignInUnsupported(plainAdapter.descriptor.displayName), signIn]].sort()]
    ]), JSON.stringify(listed));
  }

  @TestMethod
  public async setsAVariableToASavedSecretAndBackRemovingItsValueAndRefusesAVariableTheServerDoesntName(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const server = await host.sharedServers.createAsync(SharedMcpServersServiceTests.stdio("search", ["GITHUB_TOKEN"]));
    host.secrets.values.set(SharedMcpServersServiceTests.reference, SharedMcpServersServiceTests.value);

    const saved = await host.sharedServers.setSecretAsync(new SharedMcpSecretSetParams(server.id, "GITHUB_TOKEN", SharedMcpServersServiceTests.reference));
    Assert.isNotNull(saved.secrets[0]!.updatedAt);
    Assert.areEqual(saved.updatedAt, saved.secrets[0]!.updatedAt);
    Assert.areEqual(saved.secrets[0]!.updatedAt, (await host.sharedServers.listAsync()).find(t => t.server.id === saved.id)!.variables.find(t => t.source === SharedMcpVariableSource.Saved)!.updatedAt);
    const again = await host.sharedServers.setSecretAsync(new SharedMcpSecretSetParams(server.id, "GITHUB_TOKEN", SharedMcpServersServiceTests.reference));
    await SharedMcpServersServiceTests.settleAsync();
    const removedBefore = host.secrets.removed.length;
    const environment = await host.sharedServers.setSecretAsync(new SharedMcpSecretSetParams(server.id, "GITHUB_TOKEN", null));
    await SharedMcpServersServiceTests.settleAsync();

    Assert.areEqual(SharedMcpServersServiceTests.reference, saved.referenceOf("GITHUB_TOKEN"));
    Assert.areEqual(SharedMcpServersServiceTests.reference, again.referenceOf("GITHUB_TOKEN"));
    Assert.areEqual(0, removedBefore);
    Assert.isNull(environment.referenceOf("GITHUB_TOKEN"));
    Assert.areEqual(JSON.stringify([SharedMcpServersServiceTests.reference]), JSON.stringify(host.secrets.removed));
    Assert.isFalse(host.secrets.values.has(SharedMcpServersServiceTests.reference));
    Assert.areEqual(ErrorCode.InvalidParams, (await Assert.throwsAsync(() => host.sharedServers.setSecretAsync(
      new SharedMcpSecretSetParams(server.id, "OTHER_KEY", SharedMcpServersServiceTests.reference)), ServiceException)).info.name);
    Assert.areEqual(ErrorCode.NotFound, (await Assert.throwsAsync(() => host.sharedServers.setSecretAsync(
      new SharedMcpSecretSetParams("missing", "GITHUB_TOKEN", null)), ServiceException)).info.name);
  }

  @TestMethod
  public async keepsTheNewReferenceBeforeRemovingTheReplacedValueSoATurnStartingBetweenStillReadsAValue(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.sharedServerUnavailable = () => null;
    host.adapter.savedSecretsUnavailable = () => null;
    const provider = await host.createProviderAsync();
    const other = "teamrun.mcpSecretfedcba9876543210fedcba9876543210";
    const server = await host.sharedServers.createAsync(SharedMcpServersServiceTests.stdio("search", ["GITHUB_TOKEN"]));
    await host.sharedServers.setProviderAsync(new SharedMcpProviderSetParams(server.id, provider.id, true));
    host.secrets.values.set(SharedMcpServersServiceTests.reference, "old-value-2d9e");
    host.secrets.values.set(other, SharedMcpServersServiceTests.value);
    await host.sharedServers.setSecretAsync(new SharedMcpSecretSetParams(server.id, "GITHUB_TOKEN", SharedMcpServersServiceTests.reference));
    let release = (): void => undefined;
    host.secrets.hold = new Promise(resolve => {
      release = () => resolve();
    });

    const saved = await host.sharedServers.setSecretAsync(new SharedMcpSecretSetParams(server.id, "GITHUB_TOKEN", other));
    const between = await host.sharedServers.selectAsync(provider, null, "/projects/app");
    const removedBetween = host.secrets.removed.length;
    release();
    await SharedMcpServersServiceTests.settleAsync();

    Assert.areEqual(other, saved.referenceOf("GITHUB_TOKEN"));
    Assert.areEqual(0, removedBetween);
    Assert.areEqual(SharedMcpServersServiceTests.value, between.values.valueOf("search", "GITHUB_TOKEN"));
    Assert.areEqual(JSON.stringify([SharedMcpServersServiceTests.reference]), JSON.stringify(host.secrets.removed));
  }

  @TestMethod
  public async refusesAReferenceAnotherVariableAlreadyKeeps(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const search = await host.sharedServers.createAsync(SharedMcpServersServiceTests.stdio("search", ["GITHUB_TOKEN", "SEARCH_KEY"]));
    const docs = await host.sharedServers.createAsync(SharedMcpServersServiceTests.stdio("docs", ["DOCS_KEY"]));
    await host.sharedServers.setSecretAsync(new SharedMcpSecretSetParams(search.id, "GITHUB_TOKEN", SharedMcpServersServiceTests.reference));

    const refusals: ServiceException[] = [];
    for (const t of [new SharedMcpSecretSetParams(docs.id, "DOCS_KEY", SharedMcpServersServiceTests.reference),
      new SharedMcpSecretSetParams(search.id, "SEARCH_KEY", SharedMcpServersServiceTests.reference)])
      refusals.push(await Assert.throwsAsync(() => host.sharedServers.setSecretAsync(t), ServiceException));
    const again = await host.sharedServers.setSecretAsync(new SharedMcpSecretSetParams(search.id, "GITHUB_TOKEN", SharedMcpServersServiceTests.reference));

    Assert.areEqual(JSON.stringify([[ErrorCode.Conflict, Resources.formatSharedMcpSecretTaken("DOCS_KEY")],
      [ErrorCode.Conflict, Resources.formatSharedMcpSecretTaken("SEARCH_KEY")]]), JSON.stringify(refusals.map(t => [t.info.name, t.message])));
    Assert.areEqual(SharedMcpServersServiceTests.reference, again.referenceOf("GITHUB_TOKEN"));
  }

  @TestMethod
  public async clearsAReferenceAndLogsByNameOnlyWhenTheStoreRefusesToRemoveItsValue(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const server = await host.sharedServers.createAsync(SharedMcpServersServiceTests.stdio("search", ["GITHUB_TOKEN"]));
    host.secrets.values.set(SharedMcpServersServiceTests.reference, SharedMcpServersServiceTests.value);
    await host.sharedServers.setSecretAsync(new SharedMcpSecretSetParams(server.id, "GITHUB_TOKEN", SharedMcpServersServiceTests.reference));
    host.secrets.refusal = "Open the app to use saved secrets.";

    const cleared = await host.sharedServers.setSecretAsync(new SharedMcpSecretSetParams(server.id, "GITHUB_TOKEN", null));
    await SharedMcpServersServiceTests.settleAsync();

    Assert.isNull(cleared.referenceOf("GITHUB_TOKEN"));
    Assert.isTrue(host.log.lines.some(t => t.includes(Resources.formatSharedMcpSecretKept("GITHUB_TOKEN", "Open the app to use saved secrets."))));
    Assert.isFalse(host.log.lines.some(t => t.includes(SharedMcpServersServiceTests.reference) || t.includes(SharedMcpServersServiceTests.value)));
  }

  @TestMethod
  public async removesTheSavedValueOfAVariableAnEditDropsOrOfADeletedServerAndLogsARefusalByNameOnly(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const other = "teamrun.mcpSecretfedcba9876543210fedcba9876543210";
    const search = await host.sharedServers.createAsync(SharedMcpServersServiceTests.stdio("search", ["GITHUB_TOKEN", "SEARCH_KEY"]));
    const docs = await host.sharedServers.createAsync(SharedMcpServersServiceTests.stdio("docs", ["DOCS_KEY"]));
    await host.sharedServers.setSecretAsync(new SharedMcpSecretSetParams(search.id, "GITHUB_TOKEN", SharedMcpServersServiceTests.reference));
    await host.sharedServers.setSecretAsync(new SharedMcpSecretSetParams(search.id, "SEARCH_KEY", other));

    const edited = await host.sharedServers.updateAsync(new SharedMcpServerUpdateParams(search.id, SharedMcpServersServiceTests.stdio("search", ["SEARCH_KEY"])));
    await SharedMcpServersServiceTests.settleAsync();
    const afterEdit = [...host.secrets.removed];
    await host.sharedServers.setSecretAsync(new SharedMcpSecretSetParams(docs.id, "DOCS_KEY", SharedMcpServersServiceTests.reference));
    host.secrets.refusal = "Open the app to use saved secrets.";
    await host.sharedServers.deleteAsync(new SharedMcpServerIdParams(docs.id));
    await SharedMcpServersServiceTests.settleAsync();

    Assert.areEqual(JSON.stringify([{ variable: "SEARCH_KEY", reference: other }]), JSON.stringify(edited.secrets.map(t => ({ variable: t.variable, reference: t.reference }))));
    Assert.areEqual(JSON.stringify([SharedMcpServersServiceTests.reference]), JSON.stringify(afterEdit));
    Assert.areEqual("search", (await host.sharedServers.listAsync()).map(t => t.server.definition.name).join(","));
    Assert.isTrue(host.log.lines.includes(Resources.formatSharedMcpSecretKept("DOCS_KEY", "Open the app to use saved secrets.")));
  }

  @TestMethod
  public async selectsAServerWithItsSavedValuesWhereNoSerializingOrInspectingShowsThem(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.sharedServerUnavailable = () => null;
    host.adapter.savedSecretsUnavailable = () => null;
    const provider = await host.createProviderAsync();
    const server = await host.sharedServers.createAsync(SharedMcpServersServiceTests.stdio("search", ["GITHUB_TOKEN", "SEARCH_KEY"]));
    await host.sharedServers.setProviderAsync(new SharedMcpProviderSetParams(server.id, provider.id, true));
    host.environment["SEARCH_KEY"] = "from the environment";
    host.secrets.values.set(SharedMcpServersServiceTests.reference, SharedMcpServersServiceTests.value);
    await host.sharedServers.setSecretAsync(new SharedMcpSecretSetParams(server.id, "GITHUB_TOKEN", SharedMcpServersServiceTests.reference));

    const selection = await host.sharedServers.selectAsync(provider, null, "/projects/app");

    Assert.areEqual("search", selection.servers.map(t => t.name).join(","));
    Assert.areEqual(0, selection.notes.length);
    Assert.areEqual(SharedMcpServersServiceTests.value, selection.values.valueOf("search", "GITHUB_TOKEN"));
    Assert.isUndefined(selection.values.valueOf("search", "SEARCH_KEY"));
    for (const shown of [JSON.stringify(selection), inspect(selection, { depth: null, showHidden: true }), String(selection.values)])
      Assert.isFalse(shown.includes(SharedMcpServersServiceTests.value));
  }

  @TestMethod
  public async leavesOutAServerWhoseSavedSecretIsMissingOrUnreadableOrWhoseProviderTakesNoneWithWhy(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.sharedServerUnavailable = () => null;
    const provider = await host.createProviderAsync();
    const server = await host.sharedServers.createAsync(SharedMcpServersServiceTests.stdio("search", ["GITHUB_TOKEN"]));
    await host.sharedServers.setProviderAsync(new SharedMcpProviderSetParams(server.id, provider.id, true));
    await host.sharedServers.setSecretAsync(new SharedMcpSecretSetParams(server.id, "GITHUB_TOKEN", SharedMcpServersServiceTests.reference));
    const notesOf = async (): Promise<readonly string[]> => (await host.sharedServers.selectAsync(provider, null, "/projects/app")).notes;

    const takesNone = await notesOf();
    host.adapter.savedSecretsUnavailable = () => null;
    const missing = await notesOf();
    host.secrets.refusal = "The keyring can't decrypt it.";
    const unreadable = await notesOf();

    Assert.areEqual(JSON.stringify([
      [Resources.formatSharedMcpServerLeftOut("search", Resources.formatSharedMcpSecretsUnsupported(host.adapter.descriptor.displayName))],
      [Resources.formatSharedMcpServerLeftOut("search", Resources.formatSharedMcpSecretMissing("GITHUB_TOKEN"))],
      [Resources.formatSharedMcpServerLeftOut("search", Resources.formatSharedMcpSecretUnreadable("GITHUB_TOKEN", "The keyring can't decrypt it."))]
    ]), JSON.stringify([takesNone, missing, unreadable]));
  }

  @TestMethod
  public async keepsNoSavedValueInTheDatabaseOrItsChangeFeed(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.sharedServerUnavailable = () => null;
    host.adapter.savedSecretsUnavailable = () => null;
    const provider = await host.createProviderAsync();
    const server = await host.sharedServers.createAsync(SharedMcpServersServiceTests.stdio("search", ["GITHUB_TOKEN"]));
    await host.sharedServers.setProviderAsync(new SharedMcpProviderSetParams(server.id, provider.id, true));
    host.secrets.values.set(SharedMcpServersServiceTests.reference, SharedMcpServersServiceTests.value);
    await host.sharedServers.setSecretAsync(new SharedMcpSecretSetParams(server.id, "GITHUB_TOKEN", SharedMcpServersServiceTests.reference));
    await host.sharedServers.listAsync();
    await host.sharedServers.selectAsync(provider, null, "/projects/app");

    const files = readdirSync(host.directory.path, { recursive: true, encoding: "utf8" }).map(t => join(host.directory.path, t))
      .filter(t => statSync(t).isFile());

    Assert.isTrue(files.length > 0);
    Assert.isTrue((await host.context.database.changeFeed.readAfterAsync(0)).some(t => t.payload.includes(SharedMcpServersServiceTests.reference)));
    Assert.isFalse((await host.context.database.changeFeed.readAfterAsync(0)).some(t => t.payload.includes(SharedMcpServersServiceTests.value)));
    for (const file of files)
      Assert.isFalse(readFileSync(file).includes(Buffer.from(SharedMcpServersServiceTests.value)));
    Assert.isFalse(host.log.lines.some(t => t.includes(SharedMcpServersServiceTests.value)));
  }

  @TestMethod
  public async signsInInTheBrowserKeepingOnlyTheSignInsStateAndNeverLetsARefusedSignInReplaceAGrantedOne(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const [, taking] = await SharedMcpServersServiceTests.takingAsync(host);
    const server = await host.sharedServers.createAsync(SharedMcpServersServiceTests.signingIn("docs"));
    const reasonOf = async (): Promise<string | null> =>
      (await host.sharedServers.listAsync())[0]?.unavailable.find(t => t.providerId === taking.id)?.reason ?? null;
    const shortOf = async (): Promise<string | null> =>
      (await host.sharedServers.listAsync())[0]?.unavailable.find(t => t.providerId === taking.id)?.short ?? null;
    const shortBefore = await shortOf();
    const before = await reasonOf();

    const started = await host.sharedServers.startSignInAsync(new SharedMcpServerIdParams(server.id));
    const [first] = host.signIns.started;
    const pending = (await host.sharedServers.listAsync())[0];
    first?.finished(SharedMcpAccess.refused("The server refused the code."));
    const refused = (await host.sharedServers.listAsync())[0];
    const refusedReason = await reasonOf();
    const refusedShort = await shortOf();
    await host.sharedServers.startSignInAsync(new SharedMcpServerIdParams(server.id));
    host.signIns.started[1]?.finished(SharedMcpAccess.granted("access-token-5b2e8d", "2026-11-02T11:00:00.000Z"));
    const signedIn = (await host.sharedServers.listAsync())[0]?.server.signIn;
    const afterSignIn = await reasonOf();
    await host.sharedServers.startSignInAsync(new SharedMcpServerIdParams(server.id));
    host.signIns.started[2]?.finished(SharedMcpAccess.refused("The browser was closed."));
    const kept = (await host.sharedServers.listAsync())[0];

    Assert.areEqual(JSON.stringify([Resources.sharedMcpSignInNeeded, null]), JSON.stringify([before, afterSignIn]));
    Assert.areEqual("https://auth.example.com/authorize?state=1", started.url);
    Assert.areEqual(server.definition.url, first?.url);
    Assert.isTrue(/^teamrun\.mcpSignIn[0-9a-f]{32}$/.test(first?.reference ?? String.empty));
    Assert.areEqual(JSON.stringify([null, true]), JSON.stringify([pending?.server.signIn, pending?.signingIn]));
    Assert.areEqual(JSON.stringify([first?.reference, null, "The server refused the code.", false]),
      JSON.stringify([refused?.server.signIn?.reference, refused?.server.signIn?.expiresAt, refused?.server.signIn?.needsSignIn, refused?.signingIn]));
    Assert.areEqual(Resources.formatSharedMcpSignInExpired("The server refused the code."), refusedReason);
    Assert.areEqual(JSON.stringify(["needs a sign-in", "needs a new sign-in"]), JSON.stringify([shortBefore, refusedShort]));
    Assert.areEqual(JSON.stringify([first?.reference, "2026-11-02T11:00:00.000Z", null]),
      JSON.stringify([signedIn?.reference, signedIn?.expiresAt, signedIn?.needsSignIn]));
    Assert.areEqual(JSON.stringify([first?.reference, first?.reference]), JSON.stringify(host.signIns.started.slice(1).map(t => t.reference)));
    Assert.areEqual(JSON.stringify([signedIn?.toJson(), false]), JSON.stringify([kept?.server.signIn?.toJson(), kept?.signingIn]));
    Assert.isNull(await reasonOf());
    Assert.areEqual(6, host.listener.count(EventName.StateInvalidated));
    Assert.isFalse((await host.context.database.changeFeed.readAfterAsync(0)).some(t => t.payload.includes("access-token-5b2e8d")));
  }

  @TestMethod
  public async startsASecondSignInOfAServerUnderTheFirstsReferenceLetsARefusalReplaceARefusalAndStopsListingItAsSigningInOnceSignedOut(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const server = await host.sharedServers.createAsync(SharedMcpServersServiceTests.signingIn("docs"));

    await host.sharedServers.startSignInAsync(new SharedMcpServerIdParams(server.id));
    await host.sharedServers.startSignInAsync(new SharedMcpServerIdParams(server.id));
    host.signIns.started[0]?.finished(SharedMcpAccess.refused("The server refused the code."));
    host.signIns.started[1]?.finished(SharedMcpAccess.refused("The browser was closed."));
    const refused = (await host.sharedServers.listAsync())[0]?.server.signIn?.needsSignIn;
    await host.sharedServers.startSignInAsync(new SharedMcpServerIdParams(server.id));
    const signingIn = (await host.sharedServers.listAsync())[0]?.signingIn;
    await host.sharedServers.signOutOfAsync(new SharedMcpServerIdParams(server.id));
    await SharedMcpServersServiceTests.settleAsync();
    const listed = (await host.sharedServers.listAsync())[0];

    const [first] = host.signIns.started;
    Assert.areEqual(JSON.stringify([first?.reference, first?.reference]), JSON.stringify(host.signIns.started.slice(1).map(t => t.reference)));
    Assert.areEqual("The browser was closed.", refused);
    Assert.isTrue(signingIn ?? false);
    Assert.areEqual(JSON.stringify([null, false]), JSON.stringify([listed?.server.signIn, listed?.signingIn]));
    Assert.areEqual(JSON.stringify([first?.reference]), JSON.stringify(host.signIns.signedOut));
  }

  @TestMethod
  public async refusesToStartASignInForAServerThatDoesntSignInOrIsUnknown(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const server = await host.sharedServers.createAsync(SharedMcpServersServiceTests.http("docs"));

    const refused = await Assert.throwsAsync(() => host.sharedServers.startSignInAsync(new SharedMcpServerIdParams(server.id)), ServiceException);
    const unknown = await Assert.throwsAsync(() => host.sharedServers.startSignInAsync(new SharedMcpServerIdParams("missing")), ServiceException);

    Assert.areEqual(JSON.stringify([ErrorCode.InvalidParams, Resources.formatSharedMcpServerDoesntSignIn("docs")]), JSON.stringify([refused.info.name, refused.message]));
    Assert.areEqual(ErrorCode.NotFound, unknown.info.name);
    Assert.areEqual(0, host.signIns.started.length);
  }

  @TestMethod
  public async passesTheAccessTokenAsATurnsBearerTokenAndLeavesOutAServerWithoutASignInOrWhoseTokensCantBeReadOrRefreshed(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const [, taking] = await SharedMcpServersServiceTests.takingAsync(host);
    const server = await host.sharedServers.createAsync(SharedMcpServersServiceTests.signingIn("docs"));
    await host.sharedServers.setProviderAsync(new SharedMcpProviderSetParams(server.id, taking.id, true));
    const select = (): Promise<SharedMcpSelection> => host.sharedServers.selectAsync(taking, null, "/projects/app");
    const unsigned = await select();
    await host.sharedServers.startSignInAsync(new SharedMcpServerIdParams(server.id));
    const [started] = host.signIns.started;
    started?.finished(SharedMcpAccess.granted("access-token-5b2e8d", "2026-11-02T11:00:00.000Z"));
    const feed = async (): Promise<number> => (await host.context.database.changeFeed.readAfterAsync(0)).length;

    const before = await feed();
    const selected = await select();
    const unchanged = await feed();
    host.signIns.access = SharedMcpAccess.granted("access-token-9c4f1a", "2026-11-02T12:00:00.000Z");
    const refreshed = await select();
    const afterRefresh = (await host.sharedServers.listAsync())[0]?.server.signIn?.expiresAt;
    host.signIns.access = SharedMcpAccess.refused("The server refused the refresh.");
    const expired = await select();
    const needs = (await host.sharedServers.listAsync())[0]?.server.signIn?.needsSignIn;
    host.signIns.refusal = "The keyring can't decrypt it.";
    const unreadable = await select();

    Assert.areEqual(JSON.stringify([Resources.formatSharedMcpServerLeftOut("docs", Resources.sharedMcpSignInNeeded)]), JSON.stringify(unsigned.notes));
    const [definition] = selected.servers;
    Assert.areEqual(JSON.stringify([Resources.sharedMcpAccessVariable, false, server.definition.url]),
      JSON.stringify([definition?.bearerVariable, definition?.signsIn, definition?.url]));
    Assert.areEqual("access-token-5b2e8d", selected.values.valueOf("docs", Resources.sharedMcpAccessVariable));
    Assert.areEqual(`${server.definition.url} ${started?.reference}`, host.signIns.reads[0]);
    Assert.areEqual(before, unchanged);
    Assert.areEqual("access-token-9c4f1a", refreshed.values.valueOf("docs", Resources.sharedMcpAccessVariable));
    Assert.areEqual("2026-11-02T12:00:00.000Z", afterRefresh);
    Assert.areEqual(JSON.stringify([[], [Resources.formatSharedMcpServerLeftOut("docs", Resources.formatSharedMcpSignInExpired("The server refused the refresh."))]]),
      JSON.stringify([expired.servers, expired.notes]));
    Assert.areEqual("The server refused the refresh.", needs);
    Assert.areEqual(JSON.stringify([Resources.formatSharedMcpServerLeftOut("docs", Resources.formatSharedMcpSignInUnreadable("The keyring can't decrypt it."))]),
      JSON.stringify(unreadable.notes));
    for (const selection of [selected, refreshed])
      Assert.isFalse(JSON.stringify(selection).includes("access-token"));
  }

  @TestMethod
  public async leavesOutAServerThatSignsInForAProviderThatTakesNoSavedSecrets(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.sharedServerUnavailable = () => null;
    const provider = await host.createProviderAsync();
    const server = await host.sharedServers.createAsync(SharedMcpServersServiceTests.signingIn("docs"));
    await host.sharedServers.setProviderAsync(new SharedMcpProviderSetParams(server.id, provider.id, true));

    const selection = await host.sharedServers.selectAsync(provider, null, "/projects/app");

    Assert.areEqual(JSON.stringify([Resources.formatSharedMcpServerLeftOut("docs", Resources.formatSharedMcpSignInUnsupported(host.adapter.descriptor.displayName))]),
      JSON.stringify(selection.notes));
    Assert.areEqual(0, host.signIns.reads.length);
  }

  @TestMethod
  public async signsOutOnRequestOnDeleteOrWhenAnEditStopsSigningInOrMovesAndLogsARefusalByNameOnly(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const signedIn = async (name: string): Promise<string> => {
      const server = await host.sharedServers.createAsync(SharedMcpServersServiceTests.signingIn(name));
      await host.sharedServers.startSignInAsync(new SharedMcpServerIdParams(server.id));
      host.signIns.started.at(-1)?.finished(SharedMcpAccess.granted("access-token-5b2e8d", null));
      return server.id;
    };
    const [docs, wiki, notes, team] = [await signedIn("docs"), await signedIn("wiki"), await signedIn("notes"), await signedIn("team")];
    const references = host.signIns.started.map(t => t.reference);

    const out = await host.sharedServers.signOutOfAsync(new SharedMcpServerIdParams(docs));
    const again = await host.sharedServers.signOutOfAsync(new SharedMcpServerIdParams(docs));
    const kept = await host.sharedServers.updateAsync(new SharedMcpServerUpdateParams(wiki, SharedMcpServersServiceTests.signingIn("wiki")));
    const moved = await host.sharedServers.updateAsync(new SharedMcpServerUpdateParams(wiki,
      new SharedMcpServerDefinition("wiki", SharedMcpTransport.Http, null, [], [], "https://wiki.example.org/mcp", [], null, true)));
    const stopped = await host.sharedServers.updateAsync(new SharedMcpServerUpdateParams(notes, SharedMcpServersServiceTests.http("notes")));
    await SharedMcpServersServiceTests.settleAsync();
    const signedOut = [...host.signIns.signedOut];
    host.signIns.refusal = "Open the app to use saved secrets.";
    await host.sharedServers.deleteAsync(new SharedMcpServerIdParams(team));
    await SharedMcpServersServiceTests.settleAsync();

    Assert.areEqual(JSON.stringify([null, null, references[1], null, null]),
      JSON.stringify([out.signIn, again.signIn, kept.signIn?.reference, moved.signIn, stopped.signIn]));
    Assert.areEqual(JSON.stringify(references.slice(0, 3)), JSON.stringify(signedOut));
    Assert.areEqual(ErrorCode.NotFound, (await Assert.throwsAsync(() => host.sharedServers.signOutOfAsync(new SharedMcpServerIdParams(team)), ServiceException)).info.name);
    Assert.isTrue(host.log.lines.includes(Resources.formatSharedMcpSignInKept("team", "Open the app to use saved secrets.")));
    Assert.isFalse(host.log.lines.some(t => references.some(u => t.includes(u))));
  }

  @TestMethod
  public async startsTwoSignInsOfAServerTogetherUnderOneReferenceAndKeepsItWaitingWhileOneThatStartedRuns(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const server = await host.sharedServers.createAsync(SharedMcpServersServiceTests.signingIn("docs"));
    const other = await host.sharedServers.createAsync(SharedMcpServersServiceTests.signingIn("wiki"));

    await Promise.all([host.sharedServers.startSignInAsync(new SharedMcpServerIdParams(server.id)),
      host.sharedServers.startSignInAsync(new SharedMcpServerIdParams(server.id))]);
    host.signIns.startRefusal = "The server can't be reached.";
    const refused = await Assert.throwsAsync(() => host.sharedServers.startSignInAsync(new SharedMcpServerIdParams(server.id)), Error);
    await Assert.throwsAsync(() => host.sharedServers.startSignInAsync(new SharedMcpServerIdParams(other.id)), Error);
    const listed = await host.sharedServers.listAsync();

    const [first, second] = host.signIns.started;
    Assert.areEqual(first?.reference, second?.reference);
    Assert.areEqual("The server can't be reached.", refused.message);
    Assert.areEqual(JSON.stringify([["docs", true], ["wiki", false]]), JSON.stringify(listed.map(t => [t.server.definition.name, t.signingIn])));
  }

  @TestMethod
  public async endsAFirstSignInStillRunningWhenItsServerIsDeleted(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const server = await host.sharedServers.createAsync(SharedMcpServersServiceTests.signingIn("docs"));
    await host.sharedServers.startSignInAsync(new SharedMcpServerIdParams(server.id));

    await host.sharedServers.deleteAsync(new SharedMcpServerIdParams(server.id));
    await SharedMcpServersServiceTests.settleAsync();

    Assert.areEqual(JSON.stringify([host.signIns.started[0]?.reference]), JSON.stringify(host.signIns.signedOut));
  }

  @TestMethod
  public async removesASignInThatEndsAfterItsServerWasDeletedAndLogsOneThatCantBeSaved(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const server = await host.sharedServers.createAsync(SharedMcpServersServiceTests.signingIn("docs"));
    const other = await host.sharedServers.createAsync(SharedMcpServersServiceTests.signingIn("wiki"));
    await host.sharedServers.startSignInAsync(new SharedMcpServerIdParams(server.id));
    await host.sharedServers.startSignInAsync(new SharedMcpServerIdParams(other.id));
    const [late, unsaved] = host.signIns.started;
    await host.sharedServers.deleteAsync(new SharedMcpServerIdParams(server.id));

    late?.finished(SharedMcpAccess.granted("access-token-5b2e8d", null));
    await SharedMcpServersServiceTests.settleAsync();
    await host.context.database.connection.executeAsync(new SqlQuery("DROP TABLE sharedMcpServers"));
    unsaved?.finished(SharedMcpAccess.granted("access-token-5b2e8d", null));
    await host.until("the unsaved sign-in's end", () => host.listener.count(EventName.StateInvalidated) >= 4);

    Assert.areEqual(JSON.stringify([late?.reference, late?.reference]), JSON.stringify(host.signIns.signedOut));
    Assert.areEqual(4, host.listener.count(EventName.StateInvalidated));
    Assert.isTrue(host.log.lines.some(t => t.startsWith(Resources.formatSharedMcpSignInUnsaved("wiki", String.empty))));
    Assert.isFalse(host.log.lines.some(t => t.includes("access-token")));
  }

  @TestMethod
  public async addsGitHubsServerOffForEveryProviderAndOnceTurnedOnPassesTheAccountsTokenAsATurnsBearerTokenOnly(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const [, taking] = await SharedMcpServersServiceTests.takingAsync(host);
    const server = await host.sharedServers.createAsync(SharedMcpServerDefinition.gitHub);
    const select = (): Promise<SharedMcpSelection> => host.sharedServers.selectAsync(taking, null, "/projects/app");

    const off = await select();
    const readsWhileOff = host.accounts.reads.length;
    await host.sharedServers.setProviderAsync(new SharedMcpProviderSetParams(server.id, taking.id, true));
    const on = await select();
    const listed = (await host.sharedServers.listAsync())[0]?.unavailable.filter(t => t.providerId === taking.id);

    Assert.areEqual(JSON.stringify(["github", "https://api.githubcopilot.com/mcp/", SharedMcpAccount.GitHub, []]),
      JSON.stringify([server.definition.name, server.definition.url, server.definition.account, server.providerIds]));
    Assert.areEqual(JSON.stringify([[], []]), JSON.stringify([off.servers, off.notes]));
    Assert.areEqual(0, readsWhileOff);
    const [definition] = on.servers;
    Assert.areEqual(JSON.stringify([Resources.sharedMcpAccessVariable, null, false, server.definition.url, []]),
      JSON.stringify([definition?.bearerVariable, definition?.account, definition?.signsIn, definition?.url, on.notes]));
    Assert.areEqual("github-token-7c41a9", on.values.valueOf("github", Resources.sharedMcpAccessVariable));
    Assert.areEqual(SharedMcpAccount.GitHub, host.accounts.reads[0]);
    Assert.areEqual("[]", JSON.stringify(listed));
    Assert.isFalse(JSON.stringify(on).includes("github-token"));
    Assert.isFalse(JSON.stringify(await host.sharedServers.listAsync()).includes("github-token"));
  }

  @TestMethod
  public async listsGitHubsServerAsUnavailableWithWhyAndLeavesItOutOfATurnWhenItsAccountIsSignedOutOrUnreadable(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const [, taking] = await SharedMcpServersServiceTests.takingAsync(host);
    const server = await host.sharedServers.createAsync(SharedMcpServerDefinition.gitHub);
    await host.sharedServers.setProviderAsync(new SharedMcpProviderSetParams(server.id, taking.id, true));
    const read = async (): Promise<string> => {
      const selection = await host.sharedServers.selectAsync(taking, null, "/projects/app");
      return JSON.stringify([(await host.sharedServers.listAsync())[0]?.unavailable.filter(t => t.providerId === taking.id).map(t => [t.reason, t.short]),
        selection.servers, selection.notes, selection.values.valueOf("github", Resources.sharedMcpAccessVariable) ?? null]);
    };

    host.accounts.access = SharedMcpAccess.refused("Sign in to GitHub in Settings.");
    const signedOut = await read();
    host.accounts.refusal = "The keyring can't decrypt it.";
    const unreadable = await read();

    const unreadableReason = Resources.formatSharedMcpAccountUnreadable(SharedMcpAccount.GitHub, "The keyring can't decrypt it.");
    Assert.areEqual(JSON.stringify([[["Sign in to GitHub in Settings.", Resources.sharedMcpSignInNeededShort]],
      [], [Resources.formatSharedMcpServerLeftOut("github", "Sign in to GitHub in Settings.")], null]), signedOut);
    Assert.areEqual(JSON.stringify([[[unreadableReason, Resources.sharedMcpSignInNeededShort]],
      [], [Resources.formatSharedMcpServerLeftOut("github", unreadableReason)], null]), unreadable);
  }

  @TestMethod
  public async leavesOutGitHubsServerWithoutReadingItsAccountForAProviderThatTakesNoSavedSecrets(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.sharedServerUnavailable = () => null;
    const provider = await host.createProviderAsync();
    const server = await host.sharedServers.createAsync(SharedMcpServerDefinition.gitHub);
    await host.sharedServers.setProviderAsync(new SharedMcpProviderSetParams(server.id, provider.id, true));

    const selection = await host.sharedServers.selectAsync(provider, null, "/projects/app");

    Assert.areEqual(JSON.stringify([Resources.formatSharedMcpServerLeftOut("github",
      Resources.formatSharedMcpSecretsUnsupported(host.adapter.descriptor.displayName))]), JSON.stringify(selection.notes));
    Assert.areEqual(0, host.accounts.reads.length);
  }

  private static async takingAsync(host: CoreHost): Promise<[FakeProviderAdapter, Provider]> {
    const adapter = new FakeProviderAdapter("taking");
    host.registry.register(adapter);
    adapter.sharedServerUnavailable = () => null;
    adapter.savedSecretsUnavailable = () => null;
    return [adapter, await host.createProviderAsync("taking", "Taking")];
  }

  private static settleAsync(): Promise<void> {
    return new Promise(resolve => setImmediate(resolve));
  }

  private static stdio(name: string, variables: string[]): SharedMcpServerDefinition {
    return new SharedMcpServerDefinition(name, SharedMcpTransport.Stdio, "npx", ["-y", name], variables, null, [], null);
  }

  private static http(name: string): SharedMcpServerDefinition {
    return new SharedMcpServerDefinition(name, SharedMcpTransport.Http, null, [], [], "https://docs.example.com/mcp", [new SharedMcpHeader("X-Team", "DOCS_TEAM")],
      "DOCS_TOKEN");
  }

  private static signingIn(name: string): SharedMcpServerDefinition {
    return new SharedMcpServerDefinition(name, SharedMcpTransport.Http, null, [], [], `https://${name}.example.com/mcp`, [], null, true);
  }

  private static async renameKindAsync(host: CoreHost, provider: Provider, kind: string): Promise<void> {
    const json = { ...provider.toJson(), kind };
    await host.context.database.connection.executeAsync(new SqlQuery("UPDATE providers SET kind = ?, json = ? WHERE id = ?", [kind, JSON.stringify(json), provider.id]));
  }
}
