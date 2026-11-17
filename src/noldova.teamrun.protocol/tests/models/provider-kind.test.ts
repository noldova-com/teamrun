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
import { AbilityCell, AbilitySource, ProviderAbilities, ProviderAbility, ProviderKind, ProviderProfile } from "@noldova/teamrun.protocol";

@TestClass
export class ProviderKindTests {
  private static readonly json: object = {
    id: "codex",
    displayName: "Codex",
    supportsResume: true,
    supportsSignInCheck: true,
    supportsFork: true,
    supportsSignIn: true,
    defaultModelName: "Auto",
    profile: { variable: "CODEX_HOME", signInCommand: null, usualFolder: "/home/person/.codex", toolCommand: null, signInVariables: {}, signInValues: {}, personFolders: [] },
    ownMcpServersUnavailable: null,
    supportsSignOut: true,
    signOutCommand: null,
    signOutEndsWithCommand: false,
    singleAccount: null,
    followsOwnConfig: false,
    ownMcpServersNote: null,
    ownMcpServersShortNote: null,
    abilities: null,
    namesChats: true,
    confirmsSignInAtPrompt: false,
    choosesServerPath: true,
    reportsLimits: true,
    carriesSessions: false,
    sessionsChecked: true
  };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ProviderKind.fromJson(ProviderKindTests.json);

    Assert.areEqual(JSON.stringify(ProviderKindTests.json), JSON.stringify(value.toJson()));
    Assert.isTrue(value.supportsFork);
    Assert.isFalse(ProviderKind.fromJson({ ...ProviderKindTests.json, supportsFork: undefined }).supportsFork);
    Assert.isFalse(new ProviderKind("claude", "Claude Code", true).supportsFork);
    Assert.isTrue(value.supportsSignIn);
    Assert.isFalse(ProviderKind.fromJson({ ...ProviderKindTests.json, supportsSignIn: undefined }).supportsSignIn);
    Assert.isFalse(new ProviderKind("claude", "Claude Code", true).supportsSignIn);
    Assert.areEqual("Auto", value.defaultModelName);
    Assert.isNull(ProviderKind.fromJson({ ...ProviderKindTests.json, defaultModelName: undefined }).defaultModelName);
    Assert.isNull(ProviderKind.fromJson({ ...ProviderKindTests.json, defaultModelName: null }).defaultModelName);
    Assert.isNull(new ProviderKind("claude", "Claude Code", true).defaultModelName);
    Assert.areEqual("CODEX_HOME", value.profile?.variable);
    Assert.isNull(ProviderKind.fromJson({ ...ProviderKindTests.json, profile: undefined }).profile);
    Assert.isNull(ProviderKind.fromJson({ ...ProviderKindTests.json, profile: null }).profile);
    Assert.isNull(ProviderKind.fromJson({ ...ProviderKindTests.json, profile: null }).toJson()["profile"]);
    const claude = new ProviderKind("claude", "Claude Code", true, false, null, new ProviderProfile("CLAUDE_CONFIG_DIR", "claude auth login"));
    Assert.areEqual("claude auth login", ProviderKind.fromJson(claude.toJson()).profile?.signInCommand);
  }

  @TestMethod
  public saysWhyItsOwnMcpServersCantBeSwitchedOnOrNullWhenTheyCan(): void {
    const claude = ProviderKind.fromJson({ ...ProviderKindTests.json, ownMcpServersUnavailable: "Claude reads its servers only with the person's settings." });

    Assert.areEqual("Claude reads its servers only with the person's settings.", ProviderKind.fromJson(claude.toJson()).ownMcpServersUnavailable);
    Assert.isNull(ProviderKind.fromJson({ ...ProviderKindTests.json, ownMcpServersUnavailable: undefined }).ownMcpServersUnavailable);
    Assert.isNull(new ProviderKind("codex", "Codex", true).ownMcpServersUnavailable);
    Assert.isTrue(ProviderKind.fromJson(new ProviderKind("codex", "Codex", true, false, null, null, false, null, false, null, true).toJson()).followsOwnConfig);
    Assert.isFalse(ProviderKind.fromJson({ ...ProviderKindTests.json, followsOwnConfig: undefined }).followsOwnConfig);
    Assert.areEqual("Covers apps.", ProviderKind.fromJson(new ProviderKind("codex", "Codex", true, false, null, null, false, null, false, null, false,
      "Covers apps.").toJson()).ownMcpServersNote);
    Assert.isNull(ProviderKind.fromJson({ ...ProviderKindTests.json, ownMcpServersNote: undefined }).ownMcpServersNote);
    Assert.isTrue(ProviderKind.fromJson(new ProviderKind("devin", "Devin", true, true, null, null, false, null, false, null, false, null, null, false, true).toJson())
      .confirmsSignInAtPrompt);
    Assert.isFalse(ProviderKind.fromJson({ ...ProviderKindTests.json, confirmsSignInAtPrompt: undefined }).confirmsSignInAtPrompt);
    Assert.isTrue(new ProviderKind("devin", "Devin", true, true, null, null, false, null, false, null, false, null, null, false, true).withNamesChats(true)
      .confirmsSignInAtPrompt);
  }

  @TestMethod
  public saysWhetherAProviderOfTheKindCanNameTheServerItRuns(): void {
    const untabled = { resume: false, fork: false, ownMcpServersUnavailable: null };
    const chooses = new ProviderKind("antigravity", "Antigravity", true, true, null, null, false, null, false, null, false, null, null, false, false, untabled, null, true);

    Assert.isTrue(ProviderKind.fromJson(ProviderKindTests.json).choosesServerPath);
    Assert.isFalse(ProviderKind.fromJson({ ...ProviderKindTests.json, choosesServerPath: undefined }).choosesServerPath);
    Assert.isFalse(new ProviderKind("codex", "Codex", true).choosesServerPath);
    Assert.isTrue(ProviderKind.fromJson(chooses.toJson()).choosesServerPath);
    Assert.isTrue(chooses.withNamesChats(true).choosesServerPath);
    Assert.areEqual("$.choosesServerPath", Assert.throws(() => ProviderKind.fromJson({ ...ProviderKindTests.json, choosesServerPath: "yes" }), JsonException).path);
  }

  @TestMethod
  public saysWhetherItsLimitsAreReadAndWhetherItsSessionsGoOnUnderAnotherAccountAndReadsAnOlderDescriptorWithout(): void {
    const untabled = { resume: false, fork: false, ownMcpServersUnavailable: null };
    const codex = new ProviderKind("codex", "Codex", true, true, null, null, false, null, false, null, false, null, null, false, false, untabled, null, false, true,
      true, true);
    const older = { ...ProviderKindTests.json, reportsLimits: undefined, carriesSessions: undefined, sessionsChecked: undefined };
    const flags = (kind: ProviderKind): string => [kind.reportsLimits, kind.carriesSessions, kind.sessionsChecked].join(":");

    Assert.areEqual("true:false:true", flags(ProviderKind.fromJson(ProviderKindTests.json)));
    Assert.areEqual("false:true:false", flags(ProviderKind.fromJson(older)));
    Assert.areEqual("false:true:false", flags(new ProviderKind("cursor", "Cursor", true)));
    Assert.areEqual("true:true:true", flags(ProviderKind.fromJson(codex.toJson())));
    Assert.areEqual("true:true:true", flags(codex.withNamesChats(true)));
    for (const field of ["reportsLimits", "carriesSessions", "sessionsChecked"])
      Assert.areEqual(`$.${field}`, Assert.throws(() => ProviderKind.fromJson({ ...ProviderKindTests.json, [field]: "yes" }), JsonException).path);
  }

  @TestMethod
  public carriesItsNoteInAFewWordsThroughJsonAndACopyAndReadsAnOlderDescriptorWithoutIt(): void {
    const claude = new ProviderKind("claude", "Claude Code", true, false, null, null, false, null, false, null, false,
      "This switch also covers the connectors on your Claude account.", null, false, false, undefined, "your Claude account's connectors");

    Assert.areEqual("your Claude account's connectors", ProviderKind.fromJson(claude.toJson()).ownMcpServersShortNote);
    Assert.areEqual("your Claude account's connectors", claude.withNamesChats(true).ownMcpServersShortNote);
    Assert.isNull(ProviderKind.fromJson({ ...ProviderKindTests.json, ownMcpServersShortNote: undefined }).ownMcpServersShortNote);
    Assert.isNull(new ProviderKind("claude", "Claude Code", true).ownMcpServersShortNote);
    Assert.areEqual("$.k.ownMcpServersShortNote",
      Assert.throws(() => ProviderKind.fromJson({ ...ProviderKindTests.json, ownMcpServersShortNote: 3 }, "$.k"), JsonException).path);
    Assert.throws(() => new ProviderKind("claude", "Claude Code", true, false, null, null, false, null, false, null, false, "Note.", null, false, false, undefined, " "),
      ArgumentException);
  }

  @TestMethod
  public saysWhetherItNamesChatsAndReadsAnOlderDescriptorAsNot(): void {
    const value = ProviderKind.fromJson({ ...ProviderKindTests.json, ownMcpServersNote: "Its apps too." });
    const named = new ProviderKind("pi", "Pi", true).withNamesChats(true);

    Assert.isTrue(value.namesChats);
    Assert.isFalse(ProviderKind.fromJson({ ...ProviderKindTests.json, namesChats: undefined }).namesChats);
    Assert.isFalse(new ProviderKind("pi", "Pi", true).namesChats);
    Assert.areEqual(JSON.stringify({ ...value.toJson(), namesChats: false }), JSON.stringify(value.withNamesChats(false).toJson()));
    Assert.isTrue(named.namesChats);
  }

  @TestMethod
  public saysWhetherTeamRunSignsItOutOrWhatThePersonTypesInItsOwnTool(): void {
    const copilot = new ProviderKind("copilot", "Copilot", true, false, null, null, false, "/logout");

    Assert.areEqual("false:/logout", [ProviderKind.fromJson(copilot.toJson()).supportsSignOut, ProviderKind.fromJson(copilot.toJson()).signOutCommand].join(":"));
    Assert.areEqual("true:null", [ProviderKind.fromJson(ProviderKindTests.json).supportsSignOut, ProviderKind.fromJson(ProviderKindTests.json).signOutCommand ?? "null"].join(":"));
    Assert.areEqual("false:null", [ProviderKind.fromJson({ ...ProviderKindTests.json, supportsSignOut: undefined, signOutCommand: undefined }).supportsSignOut,
      new ProviderKind("codex", "Codex", true).signOutCommand ?? "null"].join(":"));
    const opencode = new ProviderKind("opencode", "OpenCode", true, false, null, null, false, "opencode auth logout", true);
    Assert.areEqual("opencode auth logout:true", [ProviderKind.fromJson(opencode.toJson()).signOutCommand, ProviderKind.fromJson(opencode.toJson()).signOutEndsWithCommand].join(":"));
    Assert.isFalse(ProviderKind.fromJson({ ...ProviderKindTests.json, signOutEndsWithCommand: undefined }).signOutEndsWithCommand);
    Assert.isFalse(new ProviderKind("codex", "Codex", true).signOutEndsWithCommand);
  }

  @TestMethod
  public saysWhyThisComputerTakesOnlyOneProviderOfTheKindOrNullWhenItTakesSeveral(): void {
    const cursor = new ProviderKind("cursor", "Cursor", true, false, null, null, true, null, false, "One sign-in per Mac.");

    Assert.areEqual("One sign-in per Mac.", ProviderKind.fromJson(cursor.toJson()).singleAccount);
    Assert.isNull(ProviderKind.fromJson({ ...ProviderKindTests.json, singleAccount: undefined }).singleAccount);
    Assert.isNull(new ProviderKind("codex", "Codex", true).singleAccount);
    Assert.throws(() => new ProviderKind("cursor", "Cursor", true, false, null, null, true, null, false, " "), ArgumentException);
  }

  @TestMethod
  public carriesItsAbilitiesOrNullForAKindThatStatesNone(): void {
    const cells = Object.fromEntries(Object.values(ProviderAbility).map(t => [t, AbilityCell.works(AbilitySource.Acp)])) as Record<ProviderAbility, AbilityCell>;
    const grok = new ProviderKind("grok", "Grok", true, false, null, null, false, null, false, null, false, null,
      new ProviderAbilities({ ...cells, [ProviderAbility.Fork]: AbilityCell.works(AbilitySource.AcpAddition, "x.ai/session/fork") }));

    Assert.areEqual("AcpAddition:x.ai/session/fork", [ProviderKind.fromJson(grok.toJson()).abilities?.cellOf(ProviderAbility.Fork).source,
      ProviderKind.fromJson(grok.toJson()).abilities?.cellOf(ProviderAbility.Fork).detail].join(":"));
    Assert.isNull(ProviderKind.fromJson({ ...ProviderKindTests.json, abilities: undefined }).abilities);
    Assert.isNull(new ProviderKind("codex", "Codex", true).abilities);
    Assert.areEqual("AcpAddition", grok.withNamesChats(true).abilities?.cellOf(ProviderAbility.Fork).source);
    Assert.areEqual("$.abilities.cells.Fork.answer",
      Assert.throws(() => ProviderKind.fromJson({ ...ProviderKindTests.json, abilities: { cells: { ...grok.abilities?.toJson()["cells"] as object, Fork: { answer: "Maybe" } } } }), JsonException).path);
  }

  @TestMethod
  public takesResumeForkAndItsOwnServersSwitchFromItsAbilitiesOverItsJson(): void {
    const cells = Object.fromEntries(Object.values(ProviderAbility).map(t => [t, AbilityCell.works(AbilitySource.Acp)])) as Record<ProviderAbility, AbilityCell>;
    const refused = new ProviderAbilities({ ...cells, [ProviderAbility.Resume]: AbilityCell.notBuilt("Not yet."), [ProviderAbility.Fork]: AbilityCell.cannot("ACP names no fork."),
      [ProviderAbility.OwnServersSwitch]: AbilityCell.cannot("it always reads them") });
    const offered = new ProviderAbilities({ ...cells, [ProviderAbility.Resume]: AbilityCell.notChecked("Never seen.") });
    const kindOf = (abilities: ProviderAbilities): ProviderKind => new ProviderKind("grok", "Grok", true, false, null, null, false, null, false, null,
      false, null, abilities);
    const read = ProviderKind.fromJson({ ...kindOf(refused).toJson(), supportsResume: true, supportsFork: true, ownMcpServersUnavailable: "Kept off." });

    Assert.areEqual("false:false:Grok can't switch on its own MCP servers here: it always reads them.", [kindOf(refused).supportsResume, kindOf(refused).supportsFork, kindOf(refused).ownMcpServersUnavailable].join(":"));
    Assert.areEqual("true:true:null", [kindOf(offered).supportsResume, kindOf(offered).supportsFork, kindOf(offered).ownMcpServersUnavailable ?? "null"].join(":"));
    Assert.areEqual("false:false:Grok can't switch on its own MCP servers here: it always reads them.", [read.supportsResume, read.supportsFork, read.ownMcpServersUnavailable].join(":"));
    Assert.areEqual("ACP names no fork.|null|null", [kindOf(refused).reasonAgainst(ProviderAbility.Fork), kindOf(offered).reasonAgainst(ProviderAbility.Resume),
      new ProviderKind("pi", "Pi", true).reasonAgainst(ProviderAbility.Fork)].map(t => t ?? "null").join("|"));
  }

  @TestMethod
  public takesResumeForkAndItsOwnServersSwitchFromItsJsonWithoutAbilitiesAndNoneFromItsConstructor(): void {
    const read = ProviderKind.fromJson({ ...ProviderKindTests.json, supportsResume: true, supportsFork: true, ownMcpServersUnavailable: "Kept off." });
    const made = new ProviderKind("codex", "Codex", true, true);

    Assert.areEqual("true:true:Kept off.", [read.supportsResume, read.supportsFork, read.ownMcpServersUnavailable].join(":"));
    Assert.areEqual("true:true:Kept off.", [read.withNamesChats(false).supportsResume, read.withNamesChats(false).supportsFork,
      read.withNamesChats(false).ownMcpServersUnavailable].join(":"));
    Assert.areEqual("false:false:null", [made.supportsResume, made.supportsFork, made.ownMcpServersUnavailable ?? "null"].join(":"));
    Assert.areEqual("false:false:null", [made.withNamesChats(true).supportsResume, made.withNamesChats(true).supportsFork,
      made.withNamesChats(true).ownMcpServersUnavailable ?? "null"].join(":"));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    const valid = ProviderKind.fromJson(ProviderKindTests.json);

    Assert.throws(
      () => new ProviderKind(String.empty, valid.displayName, valid.supportsSignInCheck), ArgumentException);
    Assert.throws(() => new ProviderKind(valid.id, String.empty, valid.supportsSignInCheck), ArgumentException);
    Assert.throws(() => new ProviderKind(valid.id, valid.displayName, true, false, null, null, false, " "), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => ProviderKind.fromJson({ ...ProviderKindTests.json, supportsResume: "yes" }), JsonException);

    Assert.areEqual("$.supportsResume", exception.path);
    const profile = Assert.throws(() => ProviderKind.fromJson({ ...ProviderKindTests.json, profile: { variable: 1, signInCommand: null } }), JsonException);
    Assert.areEqual("$.profile.variable", profile.path);
    Assert.areEqual("$.supportsSignOut", Assert.throws(() => ProviderKind.fromJson({ ...ProviderKindTests.json, supportsSignOut: "yes" }), JsonException).path);
  }
}
