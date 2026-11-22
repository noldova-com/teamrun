/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs, { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { dirname, join, resolve, sep } from "node:path";
import { mock } from "node:test";

import { ChangeOperation } from "@noldova/context.data";
import { SqlQuery } from "@noldova/context.data.sql";
import { ServiceException } from "@noldova/teamrun.services";
import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ChangeEntity, ProfileSearch, Resources, SignInCheck } from "@noldova/teamrun.core";
import {
  AuthStatus,
  ConversationMemberParams,
  DefaultTeammate,
  DefaultTeammateSetParams,
  type DiscoveredProfile,
  ErrorCode,
  EventName,
  ForkedSession,
  Harness,
  MessageIdParams,
  MessageSendParams,
  OwnMcpServer,
  OwnMcpServerState,
  Provider,
  ProviderCreateParams,
  ProviderEnabledParams,
  ProviderIdParams,
  ProviderProfileDiscoverParams,
  ProviderSignIns,
  ProviderUpdateParams,
  RequestedSettings,
  SignInLinkPayload,
  TeammateCreateParams,
  TeammateFallback
} from "@noldova/teamrun.protocol";

import { BoundingWork } from "../../fixtures/bounding-work.fixture.js";
import { CoreHost } from "../../fixtures/core-host.fixture.js";
import { FakeProviderAdapter } from "../../fixtures/fake-provider-adapter.fixture.js";

@TestClass
export class ProvidersServiceTests {
  @TestMethod
  public async createsListsAndFindsProviders(): Promise<void> {
    await using host = await CoreHost.createAsync();

    const provider = await host.providers.createAsync(new ProviderCreateParams("fake", "Work", join(host.directory.path, "profiles", "work") + sep));

    Assert.areEqual("fake", provider.kind);
    Assert.areEqual("Work", provider.label);
    Assert.areEqual(join(host.directory.path, "profiles", "work"), provider.profileDir);
    Assert.areEqual(AuthStatus.Unknown, provider.authStatus);
    Assert.areEqual(provider.id, (await host.providers.listAsync())[0]?.id);
    Assert.areEqual(provider.id, (await host.providers.findAsync(provider.id))?.id);
    Assert.isNull(await host.providers.findAsync("nope"));
  }

  @TestMethod
  public async listsTheProvidersByKindThenByLabelIgnoringCaseWithAnAccentedLabelBesideItsLetter(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.registry.register(new FakeProviderAdapter("other"));

    for (const [kind, label] of [["other", "Carl"], ["fake", "zeta"], ["fake", "Émile"], ["other", "beta"], ["fake", "alpha"], ["fake", "edgar"]] as const)
      await host.createProviderAsync(kind, label);

    Assert.areEqual(["fake alpha", "fake edgar", "fake Émile", "fake zeta", "other beta", "other Carl"].join(), (await host.providers.listAsync()).map(t => `${t.kind} ${t.label}`).join());
  }

  @TestMethod
  public async makesANewEmptyPrivateProfileFolderNamedAfterTheLabel(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = (name: string): string => join(host.directory.path, "profiles", "fake", name);
    const labels: readonly (readonly [string, string])[] = [
      ["Work", "Work"], ["a/b\\c:d*e?f\"g<h>i|j\u0001k", "a-b-c-d-e-f-g-h-i-j-k"], ["  ..Team. .", "Team"], ["CON", "_CON"], ["nul.txt", "_nul.txt"],
      ["COM0", "_COM0"], ["LPT³", "_LPT³"], ["COM10", "COM10"], ["x".repeat(70), "x".repeat(60)], ["\u{1F600}".repeat(70), "\u{1F600}".repeat(60)], [`${"a".repeat(59)}. b`, "a".repeat(59)]];

    const created: Provider[] = [];
    for (const [label] of labels)
      created.push(await host.providers.createAsync(new ProviderCreateParams("fake", label, null)));

    Assert.areEqual(labels.map(([, name]) => folder(name)).join("\n"), created.map(t => t.profileDir).join("\n"));
    Assert.areEqual(labels.length, (await host.providers.listAsync()).length);
    for (const provider of created)
      Assert.areEqual(0, readdirSync(provider.profileDir).length);
    if (process.platform !== "win32")
      Assert.areEqual(0o700, statSync(folder("Work")).mode & 0o777);
  }

  @TestMethod
  public async refusesANewProfileFolderThatExistsOrALabelThatLeavesNoNameAndAddsNoProvider(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const work = await host.providers.createAsync(new ProviderCreateParams("fake", "Work", null));
    const home = join(host.directory.path, "profiles", "fake", "Home");
    writeFileSync(home, String.empty);

    const again = await Assert.throwsAsync(() => host.providers.createAsync(new ProviderCreateParams("fake", "Work", null)), ServiceException);
    const file = await Assert.throwsAsync(() => host.providers.createAsync(new ProviderCreateParams("fake", "Home", null)), ServiceException);
    const nameless = await Assert.throwsAsync(() => host.providers.createAsync(new ProviderCreateParams("fake", ". . .", null)), ServiceException);

    Assert.areEqual(ErrorCode.Conflict, again.info.name);
    Assert.areEqual(Resources.formatProfileFolderInUse("Work", work.profileDir), again.info.message);
    Assert.areEqual(ErrorCode.Conflict, file.info.name);
    Assert.areEqual(`${Resources.formatProfileFolderExists("Home", home)} ${home}`, `${file.info.message} ${file.info.arguments.join()}`);
    Assert.areEqual(ErrorCode.InvalidParams, nameless.info.name);
    Assert.areEqual(Resources.formatProfileFolderNameless(". . ."), nameless.info.message);
    Assert.areEqual(work.id, (await host.providers.listAsync()).map(t => t.id).join(","));
    Assert.isTrue(existsSync(work.profileDir));
  }

  @TestMethod
  public async refusesAFolderAnotherProviderUsesHoweverItIsWrittenAndAddsAFreeOne(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = join(host.directory.path, "home", ".fake");
    const home = await host.providers.createAsync(new ProviderCreateParams("fake", "Home", folder));
    const written = [folder, `${folder}${sep}`, ...(process.platform === "win32" ? [folder.toUpperCase()] : [])];

    const refused: ServiceException[] = [];
    for (const t of written)
      refused.push(await Assert.throwsAsync(() => host.providers.createAsync(new ProviderCreateParams("fake", "Again", t)), ServiceException));
    const free = await host.providers.createAsync(new ProviderCreateParams("fake", "Work", `${folder}-work`));

    Assert.areEqual(written.map(t => `${ErrorCode.Conflict} ${Resources.formatProfileFolderInUse("Home", resolve(t))} ${resolve(t)}`).join("\n"),
      refused.map(t => `${t.info.name} ${t.info.message} ${t.info.arguments.join()}`).join("\n"));
    Assert.areEqual([home.id, free.id].join(), (await host.providers.listAsync()).map(t => t.id).join());
  }

  @TestMethod
  public async refusesASecondProviderOfAKindThisComputerTakesOnceWithItsReason(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.registry.register(new FakeProviderAdapter("single", false, false, null, null, false, "One sign-in per computer."));
    const first = await host.providers.createAsync(new ProviderCreateParams("single", "Work", null));

    const refused = await Assert.throwsAsync(() => host.providers.createAsync(new ProviderCreateParams("single", "Home", null)), ServiceException);
    const other = await host.providers.createAsync(new ProviderCreateParams("fake", "Home", null));

    Assert.areEqual(`${ErrorCode.Conflict} One sign-in per computer. single`, `${refused.info.name} ${refused.info.message} ${refused.info.arguments.join()}`);
    Assert.areEqual([first.id, other.id].sort().join(), (await host.providers.listAsync()).map(t => t.id).sort().join());
    Assert.isFalse(existsSync(join(dirname(first.profileDir), "Home")));
  }

  @TestMethod
  public async refusesToMoveAProviderOntoAFolderAnotherUsesHoweverItIsWrittenAndKeepsItsOwnWrittenAnotherWay(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const work = await host.createProviderAsync("fake", "Work");
    const home = await host.createProviderAsync("fake", "Home");
    const written = [work.profileDir, `${work.profileDir}${sep}`, ...(process.platform === "win32" ? [work.profileDir.toUpperCase()] : [])];

    const refused: ServiceException[] = [];
    for (const t of written)
      refused.push(await Assert.throwsAsync(() => host.providers.updateAsync(new ProviderUpdateParams(home.id, "Home", t)), ServiceException));
    const kept = await host.providers.updateAsync(new ProviderUpdateParams(home.id, "Personal", `${home.profileDir}${sep}`));

    Assert.areEqual(written.map(t => `${ErrorCode.Conflict} ${Resources.formatProfileFolderInUse("Work", resolve(t))} ${resolve(t)}`).join("\n"),
      refused.map(t => `${t.info.name} ${t.info.message} ${t.info.arguments.join()}`).join("\n"));
    Assert.areEqual(`Personal ${home.profileDir}`, `${kept.label} ${kept.profileDir}`);
    Assert.areEqual([home.profileDir, work.profileDir].join(), (await host.providers.listAsync()).map(t => t.profileDir).join());
  }

  @TestMethod
  public async passesOnAFailureToMakeTheNewFolderItselfAndAddsNoProvider(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const leaf = join(host.directory.path, "profiles", "fake", "Work");
    const denied = Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" });
    const original = fs.mkdirSync;
    const make = mock.method(fs, "mkdirSync", (...args: Parameters<typeof original>): ReturnType<typeof original> => {
      if (args[0] === leaf)
        throw denied;
      return original(...args);
    });
    syncBuiltinESMExports();
    let thrown: Error;
    try {
      thrown = await Assert.throwsAsync(() => host.providers.createAsync(new ProviderCreateParams("fake", "Work", null)), Error);
    }
    finally {
      make.mock.restore();
      syncBuiltinESMExports();
    }

    Assert.isTrue(thrown === denied);
    Assert.areEqual(0, (await host.providers.listAsync()).length);
    Assert.isTrue(existsSync(join(host.directory.path, "profiles", "fake")));
    Assert.isFalse(existsSync(leaf));
  }

  @TestMethod
  public async addsNoProviderWhenItsNewProfileFolderCannotBeMade(): Promise<void> {
    await using host = await CoreHost.createAsync();
    mkdirSync(join(host.directory.path, "profiles"));
    writeFileSync(join(host.directory.path, "profiles", "fake"), String.empty);

    await Assert.throwsAsync(() => host.providers.createAsync(new ProviderCreateParams("fake", "Work", null)), Error);

    Assert.areEqual(0, (await host.providers.listAsync()).length);
  }

  @TestMethod
  public async letsItsKindReadyANewFolderItMadeOrAnEmptyOneThePersonChoseButNoOtherFolder(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const prepared: string[] = [];
    host.adapter.prepareProfile = provider => {
      prepared.push(`${provider.label} ${readdirSync(provider.profileDir).length}`);
      writeFileSync(join(provider.profileDir, "marker.fixture"), String.empty);
    };
    const empty = join(host.directory.path, "empty");
    const own = join(host.directory.path, "own");
    mkdirSync(empty);
    mkdirSync(own);
    writeFileSync(join(own, "settings.json"), "unchanged");

    const work = await host.providers.createAsync(new ProviderCreateParams("fake", "Work", null));
    await host.providers.createAsync(new ProviderCreateParams("fake", "Empty", empty));
    await host.providers.createAsync(new ProviderCreateParams("fake", "Own", own));
    await host.providers.createAsync(new ProviderCreateParams("fake", "Missing", join(host.directory.path, "missing")));

    Assert.areEqual("Work 0,Empty 0", prepared.join(","));
    Assert.areEqual("marker.fixture", readdirSync(work.profileDir).join(","));
    Assert.areEqual("marker.fixture", readdirSync(empty).join(","));
    Assert.areEqual("settings.json", readdirSync(own).join(","));
    Assert.isFalse(existsSync(join(host.directory.path, "missing")));
  }

  @TestMethod
  public async keepsAnEmptyFolderThePersonChoseAndAddsNoProviderWhenItsKindCannotReadyIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const failure = new Error("Fixture prepare failed");
    host.adapter.prepareProfile = provider => {
      writeFileSync(join(provider.profileDir, "marker.fixture"), String.empty);
      throw failure;
    };
    const chosen = join(host.directory.path, "chosen");
    mkdirSync(chosen);

    const thrown = await Assert.throwsAsync(() => host.providers.createAsync(new ProviderCreateParams("fake", "Chosen", chosen)), Error);

    Assert.isTrue(thrown === failure);
    Assert.areEqual(0, (await host.providers.listAsync()).length);
    Assert.areEqual("marker.fixture", readdirSync(chosen).join(","));
  }

  @TestMethod
  public async letsItsKindReadyAnEmptyFolderAProviderMovesToAndKeepsTheOldFolderWhenItCannot(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const work = await host.providers.createAsync(new ProviderCreateParams("fake", "Work", null));
    const prepared: string[] = [];
    host.adapter.prepareProfile = provider => {
      prepared.push(provider.profileDir);
    };
    const empty = join(host.directory.path, "empty");
    const own = join(host.directory.path, "own");
    const other = join(host.directory.path, "other");
    for (const folder of [empty, own, other])
      mkdirSync(folder);
    writeFileSync(join(own, "settings.json"), "unchanged");

    await host.providers.updateAsync(new ProviderUpdateParams(work.id, "Renamed", work.profileDir));
    await host.providers.updateAsync(new ProviderUpdateParams(work.id, "Work", own));
    await host.providers.updateAsync(new ProviderUpdateParams(work.id, "Work", empty));
    const failure = new Error("Fixture prepare failed");
    host.adapter.prepareProfile = () => {
      throw failure;
    };
    const thrown = await Assert.throwsAsync(() => host.providers.updateAsync(new ProviderUpdateParams(work.id, "Other", other)), Error);

    Assert.areEqual(empty, prepared.join(","));
    Assert.isTrue(thrown === failure);
    Assert.areEqual(`Work ${empty}`, `${(await host.providers.findAsync(work.id))?.label} ${(await host.providers.findAsync(work.id))?.profileDir}`);
    Assert.isTrue(existsSync(other));
  }

  @TestMethod
  public async addsNoProviderAndLeavesNoFolderWhenItsKindCannotReadyTheNewOne(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const failure = new Error("Fixture prepare failed");
    let calls = 0;
    host.adapter.prepareProfile = provider => {
      writeFileSync(join(provider.profileDir, "marker.fixture"), String.empty);
      if (++calls === 1)
        throw failure;
    };
    const leaf = join(host.directory.path, "profiles", "fake", "Work");

    const thrown = await Assert.throwsAsync(() => host.providers.createAsync(new ProviderCreateParams("fake", "Work", null)), Error);
    const listed = (await host.providers.listAsync()).length;
    const left = existsSync(leaf);
    const again = await host.providers.createAsync(new ProviderCreateParams("fake", "Work", null));

    Assert.isTrue(thrown === failure);
    Assert.areEqual(0, listed);
    Assert.isFalse(left);
    Assert.areEqual(leaf, again.profileDir);
    Assert.areEqual(again.id, (await host.providers.listAsync()).map(t => t.id).join(","));
  }

  @TestMethod
  public async logsAFailedSignInCheckByItsProviderAndKindButNeverItsText(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const prompt = "Summarize the plan in secret.md";
    await host.providers.checkAsync(new ProviderIdParams(provider.id));
    host.adapter.signInCheck = new SignInCheck(AuthStatus.Error, null, null, prompt);
    await host.providers.checkAsync(new ProviderIdParams(provider.id));
    host.adapter.signInCheck = Promise.reject(Object.assign(new Error(prompt), { code: "ENOENT" }));
    await Assert.throwsAsync(() => host.providers.checkAsync(new ProviderIdParams(provider.id)), Error);

    const named = `The sign-in check of fake for the provider ending in "${provider.id.slice(-Resources.loggedIdLength)}" failed`;
    Assert.areEqual([`${named}: the provider reported an error.`, `${named}: Error ENOENT.`].join("\n"), host.log.lines.join("\n"));
    Assert.isFalse(host.log.lines.some(t => t.includes(prompt) || t.includes(provider.id)));
  }

  @TestMethod
  public async rejectsUnknownProvidersAndRelativeDirectories(): Promise<void> {
    await using host = await CoreHost.createAsync();

    const unknown = await Assert.throwsAsync(() => host.providers.createAsync(new ProviderCreateParams("nope", "Work", join(host.directory.path, "p"))), ServiceException);
    const relative = await Assert.throwsAsync(() => host.providers.createAsync(new ProviderCreateParams("fake", "Work", "profiles/work")), ServiceException);

    Assert.areEqual(ErrorCode.NotFound, unknown.info.name);
    Assert.areEqual(ErrorCode.InvalidParams, relative.info.name);
  }

  @TestMethod
  public async checksAProviderThroughItsAdapterAndPublishesTheUpdate(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();

    const checked = await host.providers.checkAsync(new ProviderIdParams(provider.id));
    host.adapter.signInCheck = new SignInCheck(AuthStatus.Error, null, null, "codex.exe not found");
    const failed = await host.providers.checkAsync(new ProviderIdParams(provider.id));

    Assert.areEqual(AuthStatus.LoggedIn, checked.authStatus);
    Assert.areEqual("dev@example.com", checked.identity?.email);
    Assert.areEqual("1.0.0", checked.harnessVersion);
    Assert.isFalse(checked.lastCheckedAt === null);
    Assert.areEqual(AuthStatus.Error, failed.authStatus);
    Assert.areEqual("codex.exe not found", failed.lastError);
    Assert.areEqual(AuthStatus.Error, (await host.providers.findAsync(provider.id))?.authStatus);
    Assert.areEqual(2, host.adapter.checkedProviders.length);
    Assert.areEqual(2, host.listener.count(EventName.ProviderUpdated));
    Assert.areEqual(ErrorCode.NotFound, (await ProvidersServiceTests.rejection(host.providers.checkAsync(new ProviderIdParams("nope")))).info.name);
  }

  @TestMethod
  public async listsAProvidersOwnMcpServersThroughItsAdapterAndNullForAKindThatOffersNoList(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const sealed = new FakeProviderAdapter("sealed");
    host.registry.register(sealed);
    const asked: (string | null)[] = [];
    host.adapter.listOwnMcpServers = provider => {
      asked.push(provider?.id ?? null);
      return Promise.resolve([new OwnMcpServer("docs", OwnMcpServerState.Enabled), new OwnMcpServer("github", OwnMcpServerState.Disabled)]);
    };
    const provider = await host.createProviderAsync();
    const quiet = await host.providers.createAsync(new ProviderCreateParams("sealed", "Sealed", join(host.directory.path, "profiles", "sealed")));

    const listed = await host.providers.listOwnMcpServersAsync(new ProviderIdParams(provider.id));
    const none = await host.providers.listOwnMcpServersAsync(new ProviderIdParams(quiet.id));
    const missing = await Assert.throwsAsync(() => host.providers.listOwnMcpServersAsync(new ProviderIdParams("missing")), ServiceException);

    Assert.areEqual(JSON.stringify({ providerId: provider.id, servers: [{ name: "docs", state: "Enabled" }, { name: "github", state: "Disabled" }] }),
      JSON.stringify(listed.toJson()));
    Assert.areEqual(JSON.stringify([provider.id]), JSON.stringify(asked));
    Assert.isNull(none.servers);
    Assert.areEqual(ErrorCode.NotFound, missing.info.name);
  }

  @TestMethod
  public async startsANewProvidersOwnMcpServersOnWhereItsKindCanAndSwitchesThemOnlyWhenTheUpdateSaysSoAndTurnsThemOffWhenItsProfileMoves(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.registry.register(new FakeProviderAdapter("sealed", false, false, null, "it reads its servers only with the person's settings"));
    const provider = await host.createProviderAsync();
    const sealed = await host.providers.createAsync(new ProviderCreateParams("sealed", "Sealed", join(host.directory.path, "profiles", "sealed")));

    const switchedOff = await host.providers.updateAsync(new ProviderUpdateParams(provider.id, "Work", provider.profileDir, false));
    const switched = await host.providers.updateAsync(new ProviderUpdateParams(provider.id, "Work", provider.profileDir, true));
    const kept = await host.providers.updateAsync(new ProviderUpdateParams(provider.id, "Personal", provider.profileDir));
    const moved = await host.providers.updateAsync(new ProviderUpdateParams(provider.id, "Personal", join(host.directory.path, "profiles", "moved")));
    const movedOn = await host.providers.updateAsync(new ProviderUpdateParams(provider.id, "Personal", join(host.directory.path, "profiles", "again"), true));
    const off = await host.providers.updateAsync(new ProviderUpdateParams(sealed.id, "Sealed", sealed.profileDir, false));
    const refused = await Assert.throwsAsync(() => host.providers.updateAsync(new ProviderUpdateParams(sealed.id, "Sealed", sealed.profileDir, true)), ServiceException);

    Assert.isTrue(provider.ownMcpServers);
    Assert.isFalse(sealed.ownMcpServers);
    Assert.isFalse(switchedOff.ownMcpServers);
    Assert.isTrue(switched.ownMcpServers);
    Assert.isTrue(kept.ownMcpServers);
    Assert.isFalse(moved.ownMcpServers);
    Assert.isTrue(movedOn.ownMcpServers);
    Assert.isTrue((await host.providers.findAsync(provider.id))!.ownMcpServers);
    Assert.isFalse(off.ownMcpServers);
    Assert.areEqual(ErrorCode.InvalidParams, refused.info.name);
    Assert.areEqual("Fake provider can't switch on its own MCP servers here: it reads its servers only with the person's settings.", refused.info.message);
    Assert.isFalse((await host.providers.findAsync(sealed.id))!.ownMcpServers);
  }

  @TestMethod
  public async setsTheChosenServerOnlyForAKindThatChoosesOneAndClearsItWhenEmpty(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.registry.register(new FakeProviderAdapter("chooser", false, false, null, null, false, null, true));
    const provider = await host.createProviderAsync();
    const chooser = await host.providers.createAsync(new ProviderCreateParams("chooser", "Chooser", join(host.directory.path, "profiles", "chooser")));
    const server = join(host.directory.path, "servers", "agy_acp_server");

    const chosen = await host.providers.updateAsync(new ProviderUpdateParams(chooser.id, "Chooser", chooser.profileDir, null, `  ${server}  `));
    const kept = await host.providers.updateAsync(new ProviderUpdateParams(chooser.id, "Renamed", chooser.profileDir));
    const relative = await Assert.throwsAsync(() => host.providers.updateAsync(new ProviderUpdateParams(chooser.id, "Chooser", chooser.profileDir, null, "agy_acp_server")),
      ServiceException);
    const refused = await Assert.throwsAsync(() => host.providers.updateAsync(new ProviderUpdateParams(provider.id, "Work", provider.profileDir, null, server)), ServiceException);
    const cleared = await host.providers.updateAsync(new ProviderUpdateParams(chooser.id, "Chooser", chooser.profileDir, null, " "));
    const none = await host.providers.updateAsync(new ProviderUpdateParams(provider.id, "Work", provider.profileDir, null, String.empty));

    Assert.isNull(chooser.binaryPath);
    Assert.areEqual(server, chosen.binaryPath);
    Assert.areEqual(server, kept.binaryPath);
    Assert.areEqual(ErrorCode.InvalidParams, relative.info.name);
    Assert.areEqual("The server path \"agy_acp_server\" is not absolute.", relative.info.message);
    Assert.areEqual(ErrorCode.InvalidParams, refused.info.name);
    Assert.areEqual("A provider of \"fake\" runs only the server TeamRun finds, so it takes no server path.", refused.info.message);
    Assert.isNull(cleared.binaryPath);
    Assert.isNull((await host.providers.findAsync(chooser.id))?.binaryPath);
    Assert.isNull(none.binaryPath);
  }

  @TestMethod
  public async updatesAProviderInPlaceAndClearsTheCheckOfAMovedProfile(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const teammate = await host.teammates.createAsync(new TeammateCreateParams("Alice", null, provider.id, Harness.Provider, null, null));
    await host.providers.checkAsync(new ProviderIdParams(provider.id));

    const renamed = await host.providers.updateAsync(new ProviderUpdateParams(provider.id, "Personal", provider.profileDir));
    const moved = await host.providers.updateAsync(new ProviderUpdateParams(provider.id, "Personal", join(host.directory.path, "profiles", "other") + sep));

    Assert.areEqual("Personal", renamed.label);
    Assert.areEqual(AuthStatus.LoggedIn, renamed.authStatus);
    Assert.areEqual(join(host.directory.path, "profiles", "other"), moved.profileDir);
    Assert.areEqual(AuthStatus.Unknown, moved.authStatus);
    Assert.isNull(moved.lastCheckedAt);
    Assert.areEqual(JSON.stringify(moved.toJson()), JSON.stringify((await host.providers.findAsync(provider.id))?.toJson()));
    Assert.areEqual("fake", moved.kind);
    Assert.areEqual(provider.id, (await host.teammates.findAsync(teammate.id))?.providerId);
    Assert.areEqual(3, host.listener.count(EventName.ProviderUpdated));
    const last = (await host.context.database.changeFeed.readAfterAsync(0)).at(-1);
    Assert.areEqual(ChangeEntity.Provider, last?.entity);
    Assert.areEqual(ChangeOperation.Update, last?.operation);
  }

  @TestMethod
  public async disablesAndEnablesAProviderKeepingItsCheckAndRefusesItsSignInWhileDisabled(): Promise<void> {
    await using host = await CoreHost.createAsync(false, true);
    const provider = await host.createProviderAsync();
    const checked = await host.providers.checkAsync(new ProviderIdParams(provider.id));

    const disabled = await host.providers.setEnabledAsync(new ProviderEnabledParams(provider.id, false));
    const check = await ProvidersServiceTests.rejection(host.providers.checkAsync(new ProviderIdParams(provider.id)));
    const signIn = await ProvidersServiceTests.rejection(host.providers.signInAsync(new ProviderIdParams(provider.id)));
    const renamed = await host.providers.updateAsync(new ProviderUpdateParams(provider.id, "Personal", provider.profileDir));
    const last = (await host.context.database.changeFeed.readAfterAsync(0)).at(-2);
    const enabled = await host.providers.setEnabledAsync(new ProviderEnabledParams(provider.id, true));

    Assert.areEqual(JSON.stringify({ ...checked.toJson(), enabled: false }), JSON.stringify(disabled.toJson()));
    Assert.areEqual(JSON.stringify(disabled.toJson()), last?.payload);
    Assert.areEqual(ChangeOperation.Update, last?.operation);
    Assert.isFalse(renamed.enabled);
    for (const refusal of [check, signIn]) {
      Assert.areEqual(ErrorCode.Unavailable, refusal.info.name);
      Assert.areEqual(Resources.formatProviderDisabled("Work"), refusal.info.message);
    }
    Assert.areEqual("The provider \"Work\" is disabled. Enable it on the Providers page first.", check.info.message);
    Assert.areEqual(1, host.adapter.checkedProviders.length);
    Assert.areEqual(0, host.adapter.signedInProviders.length);
    Assert.areEqual(JSON.stringify({ ...renamed.toJson(), enabled: true }), JSON.stringify((await host.providers.findAsync(provider.id))?.toJson()));
    Assert.isTrue(enabled.enabled);
    Assert.areEqual(AuthStatus.LoggedIn, (await host.providers.signInAsync(new ProviderIdParams(provider.id))).authStatus);
    Assert.areEqual(5, host.listener.count(EventName.ProviderUpdated));
    Assert.areEqual(ErrorCode.NotFound, (await Assert.throwsAsync(() => host.providers.setEnabledAsync(new ProviderEnabledParams("nope", false)), ServiceException)).info.name);
  }

  @TestMethod
  public async stopsASignInWhenItsProviderIsDisabled(): Promise<void> {
    await using host = await CoreHost.createAsync(false, true);
    const provider = await host.createProviderAsync();
    host.adapter.holdSignInUntilAbort = true;

    const signing = host.providers.signInAsync(new ProviderIdParams(provider.id));
    await host.providers.setEnabledAsync(new ProviderEnabledParams(provider.id, true));
    await host.until("the sign-in", () => host.adapter.signedInProviders.length === 1, new BoundingWork("the sign-in request", signing));
    Assert.areEqual(provider.id, host.providers.listSignIns().providerIds.join(","));
    await host.providers.setEnabledAsync(new ProviderEnabledParams(provider.id, false));
    const stopped = await signing;

    Assert.areEqual(AuthStatus.Unknown, stopped.authStatus);
    Assert.isFalse(stopped.enabled);
    Assert.areEqual(0, host.adapter.checkedProviders.length);
    Assert.areEqual(0, host.providers.listSignIns().providerIds.length);
  }

  @TestMethod
  public async forgetsTheSessionsOfAMovedProfileAndKeepsThemForARename(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const other = await host.createProviderAsync("fake", "Other");
    const alice = await host.teammates.createAsync(new TeammateCreateParams("Alice", null, provider.id, Harness.Provider, null, null));
    const project = await host.openProjectAsync();
    const conversation = await host.createConversationAsync(project);
    const untouched = await host.createConversationAsync(project);
    const settings = new RequestedSettings("fake", null, null);
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "Hello", settings, provider.id));
    await host.engine.waitForIdle();
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice hello", null, null, [], [alice.id]));
    await host.engine.waitForIdle();
    await host.engine.sendAsync(new MessageSendParams(untouched.id, "Hello", settings, other.id));
    await host.engine.waitForIdle();
    const member = new ConversationMemberParams(conversation.id, alice.id);

    await host.providers.updateAsync(new ProviderUpdateParams(provider.id, "Personal", provider.profileDir));
    const renamedSession = (await host.conversations.findMemberAsync(member))?.nativeSessionId ?? null;
    const renamedReset = (await host.conversations.findAsync(conversation.id))?.sessionReset ?? true;
    await host.providers.updateAsync(new ProviderUpdateParams(provider.id, "Personal", join(host.directory.path, "profiles", "moved")));
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "Again", settings, provider.id));
    await host.engine.waitForIdle();
    const direct = host.adapter.requests.at(-1)!.resumeNativeSessionId;
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice again", null, null, [], [alice.id]));
    await host.engine.waitForIdle();
    const teammate = host.adapter.requests.at(-1)!.resumeNativeSessionId;
    await host.engine.sendAsync(new MessageSendParams(untouched.id, "Again", settings, other.id));
    await host.engine.waitForIdle();

    Assert.isFalse(Object.isNull(renamedSession));
    Assert.isFalse(renamedReset);
    Assert.isNull(direct);
    Assert.isNull(teammate);
    Assert.isFalse(Object.isNull(host.adapter.requests.at(-1)!.resumeNativeSessionId));
  }

  @TestMethod
  public async forgetsAForkedSessionOfAMovedProfile(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const conversation = await host.createConversationAsync();
    await host.conversations.setForkedSessionAsync(conversation.id, new ForkedSession("fake", provider.id, "fork-1"));

    await host.providers.updateAsync(new ProviderUpdateParams(provider.id, "Work", join(host.directory.path, "profiles", "moved")));

    const reset = await host.conversations.findAsync(conversation.id);
    Assert.isFalse(reset?.sessionReset ?? true);
    Assert.isNull(reset?.forkedSession ?? null);
  }

  @TestMethod
  public async forgetsOnlyTheMovedProvidersSessionsInAConversationWithTwoProviders(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const moved = await host.createProviderAsync();
    const kept = await host.createProviderAsync("fake", "Other");
    const conversation = await host.createConversationAsync();
    const settings = new RequestedSettings("fake", null, null);
    const reply = async (providerId: string): Promise<string | null> => {
      await host.engine.sendAsync(new MessageSendParams(conversation.id, "Hello", settings, providerId));
      await host.engine.waitForIdle();
      return host.adapter.requests.at(-1)!.resumeNativeSessionId;
    };
    await reply(moved.id);
    await reply(kept.id);
    const keptSession = await host.messages.findResumableSessionAsync(conversation.id, "fake", kept.id);

    await host.providers.updateAsync(new ProviderUpdateParams(moved.id, "Work", join(host.directory.path, "profiles", "moved")));
    const afterMoveOnKept = await reply(kept.id);
    const afterMoveOnMoved = await reply(moved.id);
    const freshOnMoved = await host.messages.findResumableSessionAsync(conversation.id, "fake", moved.id);
    const againOnMoved = await reply(moved.id);

    Assert.isFalse(Object.isNull(keptSession));
    Assert.areEqual(keptSession, afterMoveOnKept);
    Assert.isNull(afterMoveOnMoved);
    Assert.isFalse(Object.isNull(freshOnMoved));
    Assert.areEqual(freshOnMoved, againOnMoved);
    Assert.isFalse((await host.conversations.findAsync(conversation.id))?.sessionReset ?? true);
  }

  @TestMethod
  public async keepsForgettingTheSessionsOfEarlierMoves(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const conversation = await host.createConversationAsync();
    const settings = new RequestedSettings("fake", null, null);
    const reply = async (): Promise<string | null> => {
      await host.engine.sendAsync(new MessageSendParams(conversation.id, "Hello", settings, provider.id));
      await host.engine.waitForIdle();
      return host.adapter.requests.at(-1)!.resumeNativeSessionId;
    };
    await reply();
    await host.providers.updateAsync(new ProviderUpdateParams(provider.id, "Work", join(host.directory.path, "profiles", "first")));
    await reply();
    await host.providers.updateAsync(new ProviderUpdateParams(provider.id, "Work", join(host.directory.path, "profiles", "second")));

    Assert.isNull(await host.messages.findResumableSessionAsync(conversation.id, "fake", provider.id));
    Assert.isNull(await reply());
  }

  @TestMethod
  public async refusesToMoveAProfileWhileAReplyOnItIsOpen(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const conversation = await host.createConversationAsync();
    host.adapter.holdUntilAbort = true;
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "Wait", new RequestedSettings("fake", null, null), provider.id));
    await host.adapter.requested(1);

    const refused = await Assert.throwsAsync(() => host.providers.updateAsync(new ProviderUpdateParams(provider.id, "Work",
      join(host.directory.path, "profiles", "moved"))), ServiceException);
    const renamed = await host.providers.updateAsync(new ProviderUpdateParams(provider.id, "Personal", provider.profileDir));
    await host.engine.cancelAsync(new MessageIdParams(sent.replies[0]!.id));

    Assert.areEqual(ErrorCode.Conflict, refused.info.name);
    Assert.areEqual(provider.profileDir, (await host.providers.findAsync(provider.id))?.profileDir);
    Assert.areEqual("Personal", renamed.label);
  }

  @TestMethod
  public async keepsAnUpdateSavedWhileACheckRuns(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const held = Promise.withResolvers<SignInCheck>();
    host.adapter.signInCheck = held.promise;

    const checking = host.providers.checkAsync(new ProviderIdParams(provider.id));
    await host.providers.updateAsync(new ProviderUpdateParams(provider.id, "Personal", provider.profileDir));
    held.resolve(new SignInCheck(AuthStatus.LoggedIn, null, "1.0.0", null));
    const checked = await checking;

    Assert.areEqual("Personal", checked.label);
    Assert.areEqual(AuthStatus.LoggedIn, checked.authStatus);
    Assert.areEqual(JSON.stringify(checked.toJson()), JSON.stringify((await host.providers.findAsync(provider.id))?.toJson()));
    Assert.areEqual(2, host.listener.count(EventName.ProviderUpdated));
  }

  @TestMethod
  public async dropsACheckOfAProfileMovedWhileItRan(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const held = Promise.withResolvers<SignInCheck>();
    host.adapter.signInCheck = held.promise;

    const checking = host.providers.checkAsync(new ProviderIdParams(provider.id));
    const moved = await host.providers.updateAsync(new ProviderUpdateParams(provider.id, "Work", join(host.directory.path, "profiles", "other")));
    held.resolve(new SignInCheck(AuthStatus.LoggedIn, null, "1.0.0", null));
    const checked = await checking;

    Assert.areEqual(moved.profileDir, checked.profileDir);
    Assert.areEqual(AuthStatus.Unknown, checked.authStatus);
    Assert.isNull(checked.lastCheckedAt);
    Assert.areEqual(JSON.stringify(moved.toJson()), JSON.stringify((await host.providers.findAsync(provider.id))?.toJson()));
    Assert.areEqual(1, host.listener.count(EventName.ProviderUpdated));
  }

  @TestMethod
  public async refusesACheckOfAProviderDeletedWhileItRan(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const held = Promise.withResolvers<SignInCheck>();
    host.adapter.signInCheck = held.promise;

    const checking = host.providers.checkAsync(new ProviderIdParams(provider.id));
    await host.providers.deleteAsync(new ProviderIdParams(provider.id));
    held.resolve(new SignInCheck(AuthStatus.LoggedIn, null, "1.0.0", null));
    const refused = await ProvidersServiceTests.rejection(checking);

    Assert.areEqual(ErrorCode.NotFound, refused.info.name);
    Assert.areEqual(0, (await host.providers.listAsync()).length);
    Assert.areEqual(ChangeOperation.Delete, (await host.context.database.changeFeed.readAfterAsync(0)).at(-1)?.operation);
    Assert.areEqual(0, host.listener.count(EventName.ProviderUpdated));
  }

  @TestMethod
  public async refusesToUpdateAnUnknownProviderOrToARelativeDirectory(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();

    const unknown = await Assert.throwsAsync(() => host.providers.updateAsync(new ProviderUpdateParams("nope", "Work", provider.profileDir)), ServiceException);
    const relative = await Assert.throwsAsync(() => host.providers.updateAsync(new ProviderUpdateParams(provider.id, "Work", "profiles/work")), ServiceException);

    Assert.areEqual(ErrorCode.NotFound, unknown.info.name);
    Assert.areEqual(ErrorCode.InvalidParams, relative.info.name);
    Assert.areEqual("Work", (await host.providers.findAsync(provider.id))?.label);
    Assert.areEqual(0, host.listener.count(EventName.ProviderUpdated));
  }

  @TestMethod
  public async deletesAProviderAndLogsIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();

    await host.providers.deleteAsync(new ProviderIdParams(provider.id));

    Assert.areEqual(0, (await host.providers.listAsync()).length);
    const last = (await host.context.database.changeFeed.readAfterAsync(0)).at(-1);
    Assert.areEqual(ChangeEntity.Provider, last?.entity);
    Assert.areEqual(ChangeOperation.Delete, last?.operation);
    Assert.areEqual(ErrorCode.NotFound, (await Assert.throwsAsync(() => host.providers.deleteAsync(new ProviderIdParams(provider.id)), ServiceException)).info.name);
  }

  @TestMethod
  public async finishesTheFirstLaunchOnceAndKeepsTheFirstTime(): Promise<void> {
    await using host = await CoreHost.createAsync();

    Assert.isFalse((await host.providers.readFirstLaunchAsync()).isFinished);
    const finished = await host.providers.finishFirstLaunchAsync();
    const changes = (await host.context.database.changeFeed.readAfterAsync(0)).length;
    const again = await host.providers.finishFirstLaunchAsync();

    Assert.isTrue(finished.isFinished);
    Assert.areEqual(finished.finishedAt, again.finishedAt);
    Assert.areEqual(finished.finishedAt, (await host.providers.readFirstLaunchAsync()).finishedAt);
    Assert.areEqual(changes, (await host.context.database.changeFeed.readAfterAsync(0)).length);
    const last = (await host.context.database.changeFeed.readAfterAsync(0)).at(-1);
    Assert.areEqual(`${ChangeEntity.Preference} ${Resources.firstLaunchPreference} ${ChangeOperation.Insert}`, `${last?.entity} ${last?.entityId} ${last?.operation}`);
  }

  @TestMethod
  public async removesADeletedAccountsSustainEntriesFromEveryTeammateAndLeavesTheOthersUnchanged(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const work = await host.createProviderAsync("fake", "Work");
    const home = await host.createProviderAsync("fake", "Home");
    const spare = await host.createProviderAsync("fake", "Spare");
    const create = async (name: string, ...fallbacks: TeammateFallback[]): Promise<string> => (await host.teammates.createAsync(new TeammateCreateParams(name, null, work.id, Harness.Provider,
      null, null, null, null, null, [], true, fallbacks))).id;
    const ids = [await create("Ada", new TeammateFallback(home.id), new TeammateFallback(spare.id), new TeammateFallback(home.id, "fake-large")),
      await create("Bo", new TeammateFallback(spare.id)), await create("Cy")];
    const before = (await host.context.database.changeFeed.readAfterAsync(0)).length;

    await host.providers.deleteAsync(new ProviderIdParams(home.id));
    const changes = (await host.context.database.changeFeed.readAfterAsync(0)).slice(before).filter(t => t.entity === ChangeEntity.Teammate);

    Assert.areEqual(`${spare.id}|${spare.id}|`, (await Promise.all(ids.map(t => host.teammates.findAsync(t)))).map(t => t?.fallbacks.map(u => u.providerId).join()).join("|"));
    Assert.areEqual(`${ids[0]} ${ChangeOperation.Update} ${JSON.stringify((await host.teammates.findAsync(ids[0] ?? ""))?.toJson())}`,
      changes.map(t => `${t.entityId} ${t.operation} ${t.payload}`).join(","));
    Assert.isTrue((await host.teammates.findAsync(ids[0] ?? ""))?.sustain === true);
  }

  @TestMethod
  public async clearsTheDefaultTeammateWithItsProviderAndKeepsADefaultOnAnotherProviderOrNone(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const work = await host.createProviderAsync("fake", "Work");
    const home = await host.createProviderAsync("fake", "Home");
    const chosen = new DefaultTeammate(new RequestedSettings("fake", "fake-b", "high"), work.id);
    const anyProvider = new DefaultTeammate(new RequestedSettings("fake", null, null));
    await host.teammates.setDefaultAsync(new DefaultTeammateSetParams(chosen));

    await host.providers.deleteAsync(new ProviderIdParams(home.id));
    const kept = await host.teammates.readDefaultAsync();
    await host.providers.deleteAsync(new ProviderIdParams(work.id));
    const cleared = await host.teammates.readDefaultAsync();
    const last = (await host.context.database.changeFeed.readAfterAsync(0)).at(-1);
    await host.teammates.setDefaultAsync(new DefaultTeammateSetParams(anyProvider));
    await host.providers.deleteAsync(new ProviderIdParams((await host.createProviderAsync("fake", "Spare")).id));

    Assert.areEqual(JSON.stringify(chosen.toJson()), JSON.stringify(kept?.toJson()));
    Assert.isNull(cleared);
    Assert.areEqual(`${ChangeEntity.Preference} ${Resources.defaultTeammatePreference} ${ChangeOperation.Delete} ${JSON.stringify(chosen.toJson())}`,
      `${last?.entity} ${last?.entityId} ${last?.operation} ${last?.payload}`);
    Assert.areEqual(JSON.stringify(anyProvider.toJson()), JSON.stringify((await host.teammates.readDefaultAsync())?.toJson()));
  }

  @TestMethod
  public async signsInThroughItsAdapterThenChecksTheProvider(): Promise<void> {
    await using host = await CoreHost.createAsync(false, true);
    const provider = await host.createProviderAsync();

    const signedIn = await host.providers.signInAsync(new ProviderIdParams(provider.id));

    Assert.areEqual(provider.id, host.adapter.signedInProviders[0]?.id);
    Assert.areEqual(1, host.adapter.checkedProviders.length);
    Assert.areEqual(AuthStatus.LoggedIn, signedIn.authStatus);
    Assert.areEqual(AuthStatus.LoggedIn, (await host.providers.findAsync(provider.id))?.authStatus);
    Assert.areEqual(1, host.listener.count(EventName.ProviderUpdated));
  }

  @TestMethod
  public async publishesThePageASignInAsksToOpenForItsProvider(): Promise<void> {
    await using host = await CoreHost.createAsync(false, true);
    const provider = await host.createProviderAsync();
    host.adapter.signInLink = "https://auth.example.com/oauth/authorize?state=1";

    await host.providers.signInAsync(new ProviderIdParams(provider.id));

    const links = host.listener.events.filter(t => t.name === EventName.SignInLink).map(t => SignInLinkPayload.fromJson(t.payload));
    Assert.areEqual(1, links.length);
    Assert.areEqual(provider.id, links[0]?.providerId);
    Assert.areEqual("https://auth.example.com/oauth/authorize?state=1", links[0]?.url);
  }

  @TestMethod
  public async refusesASignInItsProviderCantStartOrAProviderThatIsGone(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();

    const unavailable = await ProvidersServiceTests.rejection(host.providers.signInAsync(new ProviderIdParams(provider.id)));
    const missing = await ProvidersServiceTests.rejection(host.providers.signInAsync(new ProviderIdParams("nope")));

    Assert.areEqual(ErrorCode.Unavailable, unavailable.info.name);
    Assert.areEqual("Fake provider can't start its sign-in from TeamRun.", unavailable.info.message);
    Assert.areEqual(ErrorCode.NotFound, missing.info.name);
    Assert.areEqual(0, host.adapter.signedInProviders.length);
  }

  @TestMethod
  public async refusesASecondSignInAndLeavesACancelledOneUnchecked(): Promise<void> {
    await using host = await CoreHost.createAsync(false, true);
    const provider = await host.createProviderAsync();
    host.adapter.holdSignInUntilAbort = true;

    const first = host.providers.signInAsync(new ProviderIdParams(provider.id));
    const second = await ProvidersServiceTests.rejection(host.providers.signInAsync(new ProviderIdParams(provider.id)));
    host.providers.cancelSignIn(new ProviderIdParams(provider.id));
    const cancelled = await first;
    host.adapter.holdSignInUntilAbort = false;
    const again = await host.providers.signInAsync(new ProviderIdParams(provider.id));

    Assert.areEqual(ErrorCode.Conflict, second.info.name);
    Assert.areEqual("\"Work\" is already signing in.", second.info.message);
    Assert.areEqual(AuthStatus.Unknown, cancelled.authStatus);
    Assert.areEqual(AuthStatus.LoggedIn, again.authStatus);
    Assert.areEqual(1, host.adapter.checkedProviders.length);
  }

  @TestMethod
  public async returnsTheDisabledProviderUncheckedWhenASignInFinishesAfterItsProviderIsDisabled(): Promise<void> {
    await using host = await CoreHost.createAsync(false, true);
    const provider = await host.createProviderAsync();
    host.adapter.holdSignInUntilAbort = true;
    host.adapter.resolveSignInOnAbort = true;

    const signing = host.providers.signInAsync(new ProviderIdParams(provider.id));
    await host.providers.setEnabledAsync(new ProviderEnabledParams(provider.id, false));
    const stopped = await signing;

    Assert.isFalse(stopped.enabled);
    Assert.areEqual(AuthStatus.Unknown, stopped.authStatus);
    Assert.areEqual(1, host.adapter.signedInProviders.length);
    Assert.areEqual(0, host.adapter.checkedProviders.length);
    Assert.areEqual(0, host.providers.listSignIns().providerIds.length);
  }

  @TestMethod
  public async checksASignInThatFinishesAfterItsCancel(): Promise<void> {
    await using host = await CoreHost.createAsync(false, true);
    const provider = await host.createProviderAsync();
    host.adapter.holdSignInUntilAbort = true;
    host.adapter.resolveSignInOnAbort = true;

    const signing = host.providers.signInAsync(new ProviderIdParams(provider.id));
    await host.until("the sign-in", () => host.adapter.signedInProviders.length === 1, new BoundingWork("the sign-in request", signing));
    host.providers.cancelSignIn(new ProviderIdParams(provider.id));
    host.providers.cancelSignIn(new ProviderIdParams("nope"));

    Assert.areEqual(AuthStatus.LoggedIn, (await signing).authStatus);
    Assert.areEqual(1, host.adapter.checkedProviders.length);
  }

  @TestMethod
  public async checksASignInThatFinishesAfterItsTimeout(): Promise<void> {
    await using host = await CoreHost.createAsync(false, true, 1);
    const provider = await host.createProviderAsync();
    host.adapter.holdSignInUntilAbort = true;
    host.adapter.resolveSignInOnAbort = true;

    const signedIn = await host.providers.signInAsync(new ProviderIdParams(provider.id));

    Assert.areEqual(AuthStatus.LoggedIn, signedIn.authStatus);
    Assert.areEqual(1, host.adapter.checkedProviders.length);
  }

  @TestMethod
  public async listsAndPublishesTheRunningSignIns(): Promise<void> {
    await using host = await CoreHost.createAsync(false, true);
    const first = await host.createProviderAsync();
    const second = await host.createProviderAsync("fake", "Home");
    host.adapter.holdSignInUntilAbort = true;
    const published = (): string[] => host.listener.events.filter(t => t.name === EventName.ProviderSignInsChanged)
      .map(t => ProviderSignIns.fromJson(t.payload).providerIds.join(","));

    Assert.areEqual(0, host.providers.listSignIns().providerIds.length);
    const firstSigning = host.providers.signInAsync(new ProviderIdParams(first.id));
    const secondSigning = host.providers.signInAsync(new ProviderIdParams(second.id));
    await host.until("both sign-ins", () => host.adapter.signedInProviders.length === 2, new BoundingWork("the sign-in requests", Promise.all([firstSigning, secondSigning])));

    Assert.areEqual(`${first.id},${second.id}`, host.providers.listSignIns().providerIds.join(","));
    host.providers.cancelSignIn(new ProviderIdParams(first.id));
    await firstSigning;
    Assert.areEqual(second.id, host.providers.listSignIns().providerIds.join(","));
    host.providers.cancelSignIn(new ProviderIdParams(second.id));
    await secondSigning;

    Assert.areEqual(0, host.providers.listSignIns().providerIds.length);
    Assert.areEqual(JSON.stringify([first.id, `${first.id},${second.id}`, second.id, ""]), JSON.stringify(published()));
  }

  @TestMethod
  public async keepsASignInRunningUntilItsCheckEnds(): Promise<void> {
    await using host = await CoreHost.createAsync(false, true);
    const provider = await host.createProviderAsync();
    const held = Promise.withResolvers<SignInCheck>();
    host.adapter.signInCheck = held.promise;

    const signing = host.providers.signInAsync(new ProviderIdParams(provider.id));
    await host.until("the sign-in check", () => host.adapter.checkedProviders.length === 1, new BoundingWork("the sign-in request", signing));

    Assert.areEqual(provider.id, host.providers.listSignIns().providerIds.join(","));
    held.resolve(new SignInCheck(AuthStatus.LoggedIn, null, "1.0.0", null));
    const signedIn = await signing;

    Assert.areEqual(AuthStatus.LoggedIn, signedIn.authStatus);
    Assert.areEqual(0, host.providers.listSignIns().providerIds.length);
    Assert.areEqual([EventName.ProviderSignInsChanged, EventName.ProviderUpdated, EventName.ProviderSignInsChanged].join(","),
      host.listener.names().filter(t => t === EventName.ProviderUpdated || t === EventName.ProviderSignInsChanged).join(","));
  }

  @TestMethod
  public async publishesASignInsEndWhenItFails(): Promise<void> {
    await using host = await CoreHost.createAsync(false, true);
    const provider = await host.createProviderAsync();
    host.adapter.signInFailure = new Error("The CLI failed.");

    const failure = await host.providers.signInAsync(new ProviderIdParams(provider.id)).then(() => null, (error: unknown) => error);

    Assert.areEqual("The CLI failed.", failure instanceof Error ? failure.message : null);
    Assert.areEqual(0, host.providers.listSignIns().providerIds.length);
    Assert.areEqual(2, host.listener.count(EventName.ProviderSignInsChanged));
  }

  @TestMethod
  public async stopsASignInWhenItsSignalAborts(): Promise<void> {
    await using host = await CoreHost.createAsync(false, true);
    const provider = await host.createProviderAsync();
    host.adapter.holdSignInUntilAbort = true;
    const controller = new AbortController();

    const signing = host.providers.signInAsync(new ProviderIdParams(provider.id), controller.signal);
    await host.until("the sign-in", () => host.adapter.signedInProviders.length === 1, new BoundingWork("the sign-in request", signing));
    controller.abort();
    const stopped = await signing;
    host.adapter.holdSignInUntilAbort = false;
    const again = await host.providers.signInAsync(new ProviderIdParams(provider.id), controller.signal);

    Assert.areEqual(AuthStatus.Unknown, stopped.authStatus);
    Assert.areEqual(AuthStatus.Unknown, again.authStatus);
    Assert.areEqual(1, host.adapter.signedInProviders.length);
    Assert.areEqual(0, host.adapter.checkedProviders.length);
  }

  @TestMethod
  public async stopsASignInWhenItsProviderIsDeleted(): Promise<void> {
    await using host = await CoreHost.createAsync(false, true);
    const provider = await host.createProviderAsync();
    host.adapter.holdSignInUntilAbort = true;

    const signing = host.providers.signInAsync(new ProviderIdParams(provider.id));
    await host.providers.deleteAsync(new ProviderIdParams(provider.id));
    const gone = await ProvidersServiceTests.rejection(signing);

    Assert.areEqual(ErrorCode.NotFound, gone.info.name);
    Assert.areEqual(1, host.adapter.signedInProviders.length);
    Assert.areEqual(0, host.adapter.checkedProviders.length);
    Assert.areEqual(0, (await host.providers.listAsync()).length);
  }

  @TestMethod
  public async stopsASignInThatOutlastsItsTimeout(): Promise<void> {
    await using host = await CoreHost.createAsync(false, true, 1);
    const provider = await host.createProviderAsync();
    host.adapter.holdSignInUntilAbort = true;

    const timedOut = await ProvidersServiceTests.rejection(host.providers.signInAsync(new ProviderIdParams(provider.id)));
    host.adapter.holdSignInUntilAbort = false;
    const again = await host.providers.signInAsync(new ProviderIdParams(provider.id));

    Assert.areEqual(ErrorCode.Unavailable, timedOut.info.name);
    Assert.areEqual("Signing in to \"Work\" took more than five minutes, so it stopped. Sign in again to retry.", timedOut.info.message);
    Assert.areEqual(AuthStatus.LoggedIn, again.authStatus);
    Assert.areEqual(1, host.adapter.checkedProviders.length);
  }

  @TestMethod
  public async passesOnTheAdaptersSignInFailureWithoutACheck(): Promise<void> {
    await using host = await CoreHost.createAsync(false, true);
    const provider = await host.createProviderAsync();
    host.adapter.signInFailure = new Error("The browser did not open.");

    const failure = await host.providers.signInAsync(new ProviderIdParams(provider.id)).then(() => null, (error: unknown) => error);
    host.adapter.signInFailure = null;
    const again = await host.providers.signInAsync(new ProviderIdParams(provider.id));

    Assert.areEqual("The browser did not open.", failure instanceof Error ? failure.message : null);
    Assert.areEqual(AuthStatus.LoggedIn, again.authStatus);
    Assert.areEqual(1, host.adapter.checkedProviders.length);
  }

  @TestMethod
  public async signsOutThroughItsAdapterThenChecksTheProvider(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const adapter = ProvidersServiceTests.leaving(host);
    const provider = await host.createProviderAsync("leaving");
    adapter.signInCheck = new SignInCheck(AuthStatus.LoggedOut, null, "1.0.0", null);

    const signedOut = await host.providers.signOutAsync(new ProviderIdParams(provider.id));

    Assert.areEqual(provider.id, adapter.signedOutProviders[0]?.id);
    Assert.areEqual(1, adapter.checkedProviders.length);
    Assert.areEqual(AuthStatus.LoggedOut, signedOut.authStatus);
    Assert.areEqual(AuthStatus.LoggedOut, (await host.providers.findAsync(provider.id))?.authStatus);
    Assert.areEqual(1, host.listener.count(EventName.ProviderUpdated));
  }

  @TestMethod
  public async refusesASignOutItsProviderCantDoOrAProviderThatIsGoneOrDisabled(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const unable = await host.createProviderAsync();
    const adapter = ProvidersServiceTests.leaving(host);
    const disabled = await host.createProviderAsync("leaving", "Off");
    await host.providers.setEnabledAsync(new ProviderEnabledParams(disabled.id, false));
    const missingMethod = new FakeProviderAdapter("partial", false, false, null, null, true);
    delete missingMethod.signOut;
    host.registry.register(missingMethod);
    const partial = await host.createProviderAsync("partial", "Partial");

    const refusals = [await ProvidersServiceTests.rejection(host.providers.signOutAsync(new ProviderIdParams(unable.id))),
      await ProvidersServiceTests.rejection(host.providers.signOutAsync(new ProviderIdParams(partial.id))),
      await ProvidersServiceTests.rejection(host.providers.signOutAsync(new ProviderIdParams(disabled.id))),
      await ProvidersServiceTests.rejection(host.providers.signOutAsync(new ProviderIdParams("nope")))];

    Assert.areEqual([ErrorCode.Unavailable, ErrorCode.Unavailable, ErrorCode.Unavailable, ErrorCode.NotFound].join(","), refusals.map(t => t.info.name).join(","));
    Assert.areEqual("Fake provider can't sign out from TeamRun.", refusals[0]?.info.message);
    Assert.areEqual(0, adapter.signedOutProviders.length);
    Assert.areEqual(0, adapter.checkedProviders.length);
  }

  @TestMethod
  public async refusesASignOutWhileItsProviderSignsInAndASignInOrSecondSignOutWhileItSignsOut(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const adapter = ProvidersServiceTests.leaving(host);
    const provider = await host.createProviderAsync("leaving");
    const params = new ProviderIdParams(provider.id);
    adapter.signInCheck = new SignInCheck(AuthStatus.LoggedOut, null, "1.0.0", null);
    adapter.holdSignInUntilAbort = true;
    const signing = host.providers.signInAsync(params);
    const whileSigningIn = await ProvidersServiceTests.rejection(host.providers.signOutAsync(params));
    host.providers.cancelSignIn(params);
    await signing;
    const held = Promise.withResolvers<void>();
    adapter.signOutHold = held.promise;

    const signingOut = host.providers.signOutAsync(params);
    const refusals = [await ProvidersServiceTests.rejection(host.providers.signOutAsync(params)), await ProvidersServiceTests.rejection(host.providers.signInAsync(params))];
    held.resolve();
    await signingOut;
    adapter.signOutHold = null;
    await host.providers.signOutAsync(params);

    Assert.areEqual(ErrorCode.Conflict, whileSigningIn.info.name);
    Assert.areEqual("\"Work\" is already signing in.", whileSigningIn.info.message);
    Assert.areEqual("Conflict:\"Work\" is signing out.,Conflict:\"Work\" is signing out.", refusals.map(t => `${t.info.name}:${t.info.message}`).join(","));
    Assert.areEqual(2, adapter.signedOutProviders.length);
    Assert.areEqual(1, adapter.signedInProviders.length);
  }

  @TestMethod
  public async keepsTheRowOfAProviderThatSignsOutWhileItsSignInIsChecked(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const adapter = ProvidersServiceTests.leaving(host);
    const provider = await host.createProviderAsync("leaving");
    const params = new ProviderIdParams(provider.id);
    const pending = Promise.withResolvers<SignInCheck>();
    const held = Promise.withResolvers<void>();
    adapter.signInCheck = pending.promise;
    adapter.signOutHold = held.promise;

    const checking = host.providers.checkAsync(params);
    const signingOut = host.providers.signOutAsync(params);
    const during = host.providers.checkAsync(params);
    pending.resolve(new SignInCheck(AuthStatus.Error, null, "1.0.0", "Fake provider is signing out."));
    const dropped = await checking;
    adapter.signInCheck = new SignInCheck(AuthStatus.LoggedOut, null, "1.0.0", null);
    held.resolve();
    const signedOut = await signingOut;

    Assert.areEqual(JSON.stringify(provider.toJson()), JSON.stringify((await during).toJson()));
    Assert.areEqual(JSON.stringify(provider.toJson()), JSON.stringify(dropped.toJson()));
    Assert.areEqual(2, adapter.checkedProviders.length);
    Assert.areEqual(`${AuthStatus.LoggedOut} null`, `${signedOut.authStatus} ${signedOut.lastError}`);
    Assert.areEqual(JSON.stringify(signedOut.toJson()), JSON.stringify((await host.providers.findAsync(provider.id))?.toJson()));
  }

  @TestMethod
  public async rethrowsAFailedSignOutAfterRecordingItsCheckAndLogsOnlyItsKindAndFailure(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const adapter = ProvidersServiceTests.leaving(host);
    const provider = await host.createProviderAsync("leaving");
    const params = new ProviderIdParams(provider.id);
    const checked = await host.providers.checkAsync(params);
    const secret = "Signed in as someone@example.com";
    adapter.signOutFailure = Object.assign(new Error(secret), { code: "EPERM" });
    adapter.signInCheck = new SignInCheck(AuthStatus.LoggedIn, null, "1.1.0", null);

    const failure = await host.providers.signOutAsync(params).then(() => null, (error: unknown) => error);
    const recorded = await host.providers.findAsync(provider.id);
    adapter.signOutFailure = null;
    adapter.signInCheck = new SignInCheck(AuthStatus.LoggedOut, null, "1.0.0", null);
    const again = await host.providers.signOutAsync(params);

    Assert.areEqual(secret, failure instanceof Error ? failure.message : null);
    Assert.areEqual(AuthStatus.LoggedIn, checked.authStatus);
    Assert.areEqual(AuthStatus.LoggedIn, recorded?.authStatus);
    Assert.areEqual("1.1.0", recorded?.harnessVersion);
    Assert.areEqual(AuthStatus.LoggedOut, again.authStatus);
    Assert.areEqual(3, adapter.checkedProviders.length);
    Assert.areEqual(`The sign-out of leaving for the provider ending in "${provider.id.slice(-Resources.loggedIdLength)}" failed: Error EPERM.`, host.log.lines.join("\n"));
  }

  @TestMethod
  public async countsAFailedSignOutAsDoneWhenItsCheckReadsTheProviderSignedOut(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const adapter = ProvidersServiceTests.leaving(host);
    const provider = await host.createProviderAsync("leaving");
    const params = new ProviderIdParams(provider.id);
    await host.providers.checkAsync(params);
    adapter.signOutFailure = new Error("The sign-out timed out.");
    adapter.signInCheck = new SignInCheck(AuthStatus.LoggedOut, null, "1.0.0", null);

    const signedOut = await host.providers.signOutAsync(params);

    Assert.areEqual(AuthStatus.LoggedOut, signedOut.authStatus);
    Assert.areEqual(AuthStatus.LoggedOut, (await host.providers.findAsync(provider.id))?.authStatus);
    Assert.areEqual(2, adapter.checkedProviders.length);
    Assert.areEqual(1, host.log.lines.length);
  }

  @TestMethod
  public async rethrowsAFailedSignOutRatherThanItsFailedCheckAndAFailedCheckAfterASignOut(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const adapter = ProvidersServiceTests.leaving(host);
    const provider = await host.createProviderAsync("leaving");
    const params = new ProviderIdParams(provider.id);
    adapter.failingProfileDirs = [provider.profileDir];
    adapter.signOutFailure = new Error("The sign-out timed out.");

    const failures = [await host.providers.signOutAsync(params).then(() => null, (error: unknown) => error)];
    adapter.signOutFailure = null;
    failures.push(await host.providers.signOutAsync(params).then(() => null, (error: unknown) => error));

    Assert.areEqual("The sign-out timed out.,Fixture check failed", failures.map(t => t instanceof Error ? t.message : null).join(","));
    Assert.areEqual(2, adapter.checkedProviders.length);
    Assert.areEqual(AuthStatus.Unknown, (await host.providers.findAsync(provider.id))?.authStatus);
  }

  @TestMethod
  public async refusesASignOutWhoseCheckStillReadsTheProviderSignedInAndRecordsTheCheck(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const adapter = ProvidersServiceTests.leaving(host);
    const provider = await host.createProviderAsync("leaving");

    const refused = await ProvidersServiceTests.rejection(host.providers.signOutAsync(new ProviderIdParams(provider.id)));

    Assert.areEqual(ErrorCode.Unavailable, refused.info.name);
    Assert.areEqual("\"Work\" is still signed in after signing out: its tool keeps another sign-in, such as an API key.", refused.info.message);
    Assert.areEqual(AuthStatus.LoggedIn, (await host.providers.findAsync(provider.id))?.authStatus);
    Assert.areEqual(1, adapter.signedOutProviders.length);
  }

  @TestMethod
  public async recordsTheDisabledProviderUnknownUncheckedWhenASignOutFinishesAfterItsProviderIsDisabled(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const adapter = ProvidersServiceTests.leaving(host);
    const provider = await host.createProviderAsync("leaving");
    const kept = await host.createProviderAsync("leaving", "Kept");
    await host.providers.checkAsync(new ProviderIdParams(provider.id));
    await host.providers.checkAsync(new ProviderIdParams(kept.id));
    const outcomes: unknown[] = [];

    for (const [target, failure] of [[provider, null], [kept, new Error("The sign-out timed out.")]] as const) {
      const held = Promise.withResolvers<void>();
      adapter.signOutHold = held.promise;
      adapter.signOutFailure = failure;
      const signingOut = host.providers.signOutAsync(new ProviderIdParams(target.id));
      await host.providers.setEnabledAsync(new ProviderEnabledParams(target.id, false));
      held.resolve();
      outcomes.push(await signingOut.then(t => t.authStatus, (error: unknown) => error instanceof Error ? error.message : null));
    }

    Assert.areEqual(`${AuthStatus.Unknown},The sign-out timed out.`, outcomes.join(","));
    Assert.areEqual([provider, kept].map(() => AuthStatus.Unknown).join(","), (await Promise.all([provider, kept].map(t => host.providers.findAsync(t.id)))).map(t => t?.authStatus).join(","));
    Assert.isNull((await host.providers.findAsync(provider.id))?.identity ?? null);
    Assert.areEqual("1.0.0", (await host.providers.findAsync(provider.id))?.harnessVersion);
    Assert.isFalse((await host.providers.findAsync(provider.id))?.enabled ?? true);
    Assert.areEqual(2, adapter.checkedProviders.length);
    Assert.areEqual(AuthStatus.Unknown, host.listener.events.filter(t => t.name === EventName.ProviderUpdated).map(t => Provider.fromJson(t.payload)).findLast(t =>
      t.id === provider.id)?.authStatus);
  }

  @TestMethod
  public async leavesAMovedProviderUncheckedAgainstItsNewFolderWhenASignOutFinishesAfterTheMove(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const adapter = ProvidersServiceTests.leaving(host);
    const provider = await host.createProviderAsync("leaving");
    const kept = await host.createProviderAsync("leaving", "Kept");
    const outcomes: unknown[] = [];

    for (const [target, failure] of [[provider, null], [kept, new Error("The sign-out timed out.")]] as const) {
      const held = Promise.withResolvers<void>();
      adapter.signOutHold = held.promise;
      adapter.signOutFailure = failure;
      const signingOut = host.providers.signOutAsync(new ProviderIdParams(target.id));
      const folder = join(host.directory.path, "profiles", `${target.label}-moved`);
      await host.providers.updateAsync(new ProviderUpdateParams(target.id, target.label, folder));
      await host.providers.checkAsync(new ProviderIdParams(target.id));
      held.resolve();
      outcomes.push(await signingOut.then(t => `${t.authStatus}:${t.profileDir === folder}`, (error: unknown) => error instanceof Error ? error.message : null));
    }

    Assert.areEqual(`${AuthStatus.LoggedIn}:true,The sign-out timed out.`, outcomes.join(","));
    Assert.areEqual(2, adapter.checkedProviders.length);
    Assert.areEqual(AuthStatus.LoggedIn, (await host.providers.findAsync(kept.id))?.authStatus);
  }

  private static leaving(host: CoreHost): FakeProviderAdapter {
    const adapter = new FakeProviderAdapter("leaving", false, true, null, null, true);
    host.registry.register(adapter);
    return adapter;
  }

  private static async rejection(promise: Promise<unknown>): Promise<ServiceException> {
    try {
      await promise;
    }
    catch (error) {
      if (error instanceof ServiceException)
        return error;
      throw error;
    }
    throw new Error("The promise did not reject.");
  }

  @TestMethod
  public async findsTheProviderAddedFirstInItsKindsUsualFolderWhateverTheOrderOfTheirIds(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.registry.register(new FakeProviderAdapter("usual", false, false, `${join(host.directory.path, "profiles", "Home")}${sep}`));
    await host.createProviderAsync("fake", "Home");
    await host.createProviderAsync("usual", "Work");

    Assert.isNull(await host.providers.findUsualAsync("usual"));

    const at = "2026-10-24T03:39:56.000Z";
    const inserted = ["01a16bfe-64a2-754f-a30c-974901622a1c", "01a16bfe-64a2-7528-8f63-468ef9f66ec4"].map(id =>
      new Provider(id, "usual", "Home", join(host.directory.path, "profiles", "Home"), AuthStatus.Unknown, null, null, null, null, at));
    for (const provider of inserted)
      await host.context.database.connection.executeAsync(new SqlQuery(Resources.insertProvider, [provider.id, provider.kind, JSON.stringify(provider.toJson()), at, at]));
    const [first, second] = inserted;

    Assert.areEqual(first!.id, (await host.providers.findUsualAsync("usual"))?.id);
    Assert.areEqual([first!.id, second!.id].join(","), (await host.providers.listAsync()).filter(t => t.label === "Home" && t.kind === "usual").map(t => t.id).join(","));
    Assert.isNull(await host.providers.findUsualAsync("fake"));
    Assert.isNull(await host.providers.findUsualAsync("gone"));
  }

  @TestMethod
  public async findsTheUnusedFoldersASearchNamesTheOnesBesideThemAndTeamRunsOwnThatHoldAnEntry(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const home = join(host.directory.path, "home");
    const named = join(host.directory.path, "elsewhere", "custom");
    const own = join(host.directory.path, "profiles", "found");
    const adapter = ProvidersServiceTests.register(host, "found", join(home, ".found"), [join(home, ".found"), named, join(home, ".found-work")]);
    ProvidersServiceTests.file(join(home, ".found"), "settings.json");
    ProvidersServiceTests.folder(join(home, ".found-work"), "projects");
    ProvidersServiceTests.file(join(home, ".found-empty"), "notes.txt");
    ProvidersServiceTests.file(join(home, ".found-used"), "settings.json");
    ProvidersServiceTests.file(join(home, "work-found"), "settings.json");
    writeFileSync(join(home, ".found-file"), "");
    ProvidersServiceTests.file(named, "settings.json");
    ProvidersServiceTests.folder(join(own, "Spare"), "projects");
    await host.providers.createAsync(new ProviderCreateParams("found", "Used", join(home, ".found-used")));

    const found = await host.providers.discoverAsync(new ProviderProfileDiscoverParams(["found"]));

    Assert.areEqual([
      `found ${join(home, ".found")} Fake provider true`,
      `found ${named} custom false`,
      `found ${join(home, ".found-work")} found-work false`,
      `found ${join(own, "Spare")} Spare false`
    ].join("\n"), found.profiles.map(t => `${t.kind} ${t.profileDir} ${t.label} ${t.usual}`).join("\n"));
    Assert.areEqual([AuthStatus.LoggedIn, "dev@example.com"].join(), [...new Set(found.profiles.flatMap(t => [t.authStatus, t.identity?.email]))].join());
    Assert.areEqual(4, adapter.foundCheckedProviders.length);
    Assert.areEqual(1, (await host.providers.listAsync()).length);
  }

  @TestMethod
  public async ordersByKindThenTheUsualFolderThenLabelAndListsAFolderWhoseCheckFailsAsAnError(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const home = join(host.directory.path, "home");
    const first = ProvidersServiceTests.register(host, "first", join(home, ".first"), [join(home, ".first")]);
    ProvidersServiceTests.register(host, "second", null, [join(home, ".second"), join(host.directory.path, "missing", "folder")]);
    for (const name of [".first", ".first-b", ".first-a"])
      ProvidersServiceTests.file(join(home, name), "settings.json");
    ProvidersServiceTests.file(join(home, ".second"), "settings.json");
    first.failingProfileDirs = [join(home, ".first-b")];

    const found = await host.providers.discoverAsync(new ProviderProfileDiscoverParams(["second", "first"]));
    const every = await host.providers.discoverAsync(new ProviderProfileDiscoverParams());

    Assert.areEqual("second second false,first Fake provider true,first first-a false,first first-b false", ProvidersServiceTests.describe(found.profiles));
    Assert.areEqual([AuthStatus.LoggedIn, AuthStatus.LoggedIn, AuthStatus.LoggedIn, AuthStatus.Error].join(), found.profiles.map(t => t.authStatus).join());
    Assert.isNull(found.profiles[3]?.identity);
    Assert.isTrue(host.log.lines.includes(Resources.formatFoundProfileCheckFailed("first", "TypeError")));
    Assert.areEqual("first Fake provider true,first first-a false,first first-b false,second second false", ProvidersServiceTests.describe(every.profiles));
  }

  @TestMethod
  public async joinsACallForTheSameKindsWhileOneRunsAndRefusesAKindThatIsNotRegistered(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const home = join(host.directory.path, "home");
    const adapter = ProvidersServiceTests.register(host, "found", join(home, ".found"), [join(home, ".found")]);
    ProvidersServiceTests.file(join(home, ".found"), "settings.json");

    const running = host.providers.discoverAsync(new ProviderProfileDiscoverParams(["found"]));
    const joined = host.providers.discoverAsync(new ProviderProfileDiscoverParams(["found", "found"]));
    const other = host.providers.discoverAsync(new ProviderProfileDiscoverParams(["fake", "found"]));
    const found = await Promise.all([running, joined, other]);
    const again = await host.providers.discoverAsync(new ProviderProfileDiscoverParams(["found"]));
    const unknown = await Assert.throwsAsync(() => host.providers.discoverAsync(new ProviderProfileDiscoverParams(["missing"])), ServiceException);

    Assert.areEqual("found Fake provider true|found Fake provider true|found Fake provider true", found.map(t => ProvidersServiceTests.describe(t.profiles)).join("|"));
    Assert.areEqual(1, again.profiles.length);
    Assert.areEqual(3, adapter.foundCheckedProviders.length);
    Assert.areEqual(ErrorCode.NotFound, unknown.info.name);
  }

  @TestMethod
  public async leavesOutAFolderAProviderTookWhileTheSearchRanForEveryCallThatJoinedIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const home = join(host.directory.path, "home");
    const adapter = ProvidersServiceTests.register(host, "found", join(home, ".found"), [join(home, ".found")]);
    ProvidersServiceTests.file(join(home, ".found"), "settings.json");
    ProvidersServiceTests.file(join(home, ".found-work"), "settings.json");
    const checking = Promise.withResolvers<SignInCheck>();
    adapter.signInCheck = checking.promise;

    const running = host.providers.discoverAsync(new ProviderProfileDiscoverParams(["found"]));
    const joined = host.providers.discoverAsync(new ProviderProfileDiscoverParams(["found"]));
    await host.providers.createAsync(new ProviderCreateParams("found", "Work", join(home, ".found-work")));
    checking.resolve(new SignInCheck(AuthStatus.LoggedIn, null, null, null));
    const found = await Promise.all([running, joined]);

    Assert.areEqual(2, adapter.foundCheckedProviders.length);
    Assert.areEqual("found Fake provider true|found Fake provider true", found.map(t => ProvidersServiceTests.describe(t.profiles)).join("|"));
  }

  @TestMethod
  public async checksEachFoundFolderWithTheKindsFoundCheckAndNeverWithTheFullOneThatReachesTheService(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const home = join(host.directory.path, "home");
    const adapter = ProvidersServiceTests.register(host, "found", join(home, ".found"), [join(home, ".found")]);
    ProvidersServiceTests.file(join(home, ".found"), "settings.json");
    ProvidersServiceTests.file(join(home, ".found-b"), "settings.json");

    await host.providers.discoverAsync(new ProviderProfileDiscoverParams(["found"]));

    Assert.areEqual(2, adapter.foundCheckedProviders.length);
    Assert.areEqual(0, adapter.checkedProviders.length);
  }

  @TestMethod
  public async listsAFoundFolderAsNotCheckedWhenItsKindHasNoFoundCheck(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const home = join(host.directory.path, "home");
    const adapter = ProvidersServiceTests.register(host, "found", join(home, ".found"), [join(home, ".found")]);
    ProvidersServiceTests.file(join(home, ".found"), "settings.json");
    delete adapter.checkFoundSignIn;

    const found = await host.providers.discoverAsync(new ProviderProfileDiscoverParams(["found"]));

    Assert.areEqual(`${join(home, ".found")} ${AuthStatus.Unknown} true`, found.profiles.map(t => `${t.profileDir} ${t.authStatus} ${Object.isNull(t.identity)}`).join());
    Assert.areEqual(0, adapter.checkedProviders.length);
  }

  @TestMethod
  public async listsAFolderThatIsNotSignedInAsLoggedOutWithoutAnIdentity(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const home = join(host.directory.path, "home");
    const adapter = ProvidersServiceTests.register(host, "found", join(home, ".found"), [join(home, ".found")]);
    ProvidersServiceTests.file(join(home, ".found"), "settings.json");
    adapter.signInCheck = new SignInCheck(AuthStatus.LoggedOut, null, "1.0.0", null);

    const found = await host.providers.discoverAsync(new ProviderProfileDiscoverParams(["found"]));

    Assert.areEqual(`${join(home, ".found")} ${AuthStatus.LoggedOut} true`, found.profiles.map(t => `${t.profileDir} ${t.authStatus} ${Object.isNull(t.identity)}`).join());
  }

  @TestMethod
  public async leavesOutAFolderTheSearchSkipsWhileStillFindingTheProfilesBesideIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const own = join(host.directory.path, "profiles", "found");
    const home = join(host.directory.path, "home");
    ProvidersServiceTests.register(host, "found", null, [join(home, ".found")], [join(own, "title-home"), join(home, ".found-title")]);
    ProvidersServiceTests.file(join(own, "title-home"), "settings.json");
    ProvidersServiceTests.file(join(own, "Work"), "settings.json");
    ProvidersServiceTests.file(join(home, ".found-title"), "settings.json");
    ProvidersServiceTests.file(join(home, ".found"), "settings.json");

    const found = await host.providers.discoverAsync(new ProviderProfileDiscoverParams(["found"]));

    Assert.areEqual([join(home, ".found"), join(own, "Work")].join(), found.profiles.map(t => t.profileDir).join());
  }

  @TestMethod
  public async leavesOutASkippedFormerDefaultProfileEvenWhenItHoldsASignIn(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const own = join(host.directory.path, "profiles", "found");
    const adapter = new FakeProviderAdapter("found", false, false, null);
    adapter.profileSearch = new ProfileSearch([], ["auth.json", "config.toml"], [join(own, "title-home"), join(own, "default")]);
    host.registry.register(adapter);
    ProvidersServiceTests.file(join(own, "default"), "auth.json");
    ProvidersServiceTests.file(join(own, "Work"), "auth.json");

    const found = await host.providers.discoverAsync(new ProviderProfileDiscoverParams(["found"]));

    Assert.areEqual(join(own, "Work"), found.profiles.map(t => t.profileDir).join());
  }

  private static register(host: CoreHost, kind: string, usualFolder: string | null, folders: readonly string[], skipped: readonly string[] = []): FakeProviderAdapter {
    const adapter = new FakeProviderAdapter(kind, false, false, usualFolder);
    adapter.profileSearch = new ProfileSearch(folders, ["settings.json", "projects"], skipped);
    host.registry.register(adapter);
    return adapter;
  }

  private static file(folder: string, name: string): void {
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, name), "{}");
  }

  private static folder(folder: string, name: string): void {
    mkdirSync(join(folder, name), { recursive: true });
  }

  private static describe(profiles: readonly DiscoveredProfile[]): string {
    return profiles.map(t => `${t.kind} ${t.label} ${t.usual}`).join(",");
  }
}
