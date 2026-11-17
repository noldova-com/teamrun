/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { type ITeammateChanges, Teammate, TeammateFallback, TeammateUpdateParams, Harness } from "@noldova/teamrun.protocol";

@TestClass
export class TeammateUpdateParamsTests {
  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    const value = new TeammateUpdateParams("teammateId-1", "Alice", "Review carefully.", "providerId-1", Harness.Provider, "model-a", "high");
    const json = value.toJson();
    Assert.areEqual(JSON.stringify(json), JSON.stringify(TeammateUpdateParams.fromJson(json).toJson()));
    Assert.isNull(TeammateUpdateParams.fromJson(new TeammateUpdateParams("teammateId-1",
      "Alice",
      null,
      "providerId-1",
      Harness.Provider,
      "model-a",
      "high").toJson()).role);
    Assert.isNull(TeammateUpdateParams.fromJson(new TeammateUpdateParams("teammateId-1",
      "Alice",
      "Review carefully.",
      "providerId-1",
      Harness.Provider,
      null,
      "high").toJson()).model);
    Assert.isNull(TeammateUpdateParams.fromJson(new TeammateUpdateParams("teammateId-1",
      "Alice",
      "Review carefully.",
      "providerId-1",
      Harness.Provider,
      "model-a",
      null).toJson()).effort);
    Assert.areEqual("$.input.teammateId", Assert.throws(() => TeammateUpdateParams.fromJson({ ...json, teammateId: 42 }, "$.input"), JsonException).path);
    Assert.throws(() => TeammateUpdateParams.fromJson({ ...json, harness: "unsupported" }), JsonException);
  }

  @TestMethod
  public validatesConstructorArguments(): void {
    Assert.throws(() => new TeammateUpdateParams(" ",
      "Alice",
      "Review carefully.",
      "providerId-1",
      Harness.Provider,
      "model-a",
      "high"),
      ArgumentException);
    Assert.throws(() => new TeammateUpdateParams("teammateId-1",
      " ",
      "Review carefully.",
      "providerId-1",
      Harness.Provider,
      "model-a",
      "high"),
      ArgumentException);
    Assert.throws(() => new TeammateUpdateParams("teammateId-1", "Alice", " ", "providerId-1", Harness.Provider, "model-a", "high"), ArgumentException);
    Assert.throws(() => new TeammateUpdateParams("teammateId-1", "Alice", "Review carefully.", " ", Harness.Provider, "model-a", "high"), ArgumentException);
    Assert.throws(() => new TeammateUpdateParams("teammateId-1",
      "Alice",
      "Review carefully.",
      "providerId-1",
      "unsupported" as Harness,
      "model-a",
      "high"),
      ArgumentException);
    Assert.throws(() => new TeammateUpdateParams("teammateId-1",
      "Alice",
      "Review carefully.",
      "providerId-1",
      Harness.Provider,
      " ",
      "high"),
      ArgumentException);
    Assert.throws(() => new TeammateUpdateParams("teammateId-1",
      "Alice",
      "Review carefully.",
      "providerId-1",
      Harness.Provider,
      "model-a",
      " "),
      ArgumentException);
  }

  @TestMethod
  public keepsItsChosenSpeedThroughJsonAndLeavesItOutWhenOlderJsonLacksIt(): void {
    const value = new TeammateUpdateParams("teammate-1", "Alice", null, "providerId-1", Harness.Provider, "model-a", "high", "priority");
    const older = { ...value.toJson() };
    delete older["speed"];

    Assert.areEqual("priority", TeammateUpdateParams.fromJson(value.toJson()).speed);
    Assert.isUndefined(TeammateUpdateParams.fromJson(older).speed);
    Assert.isFalse(Object.hasOwn(TeammateUpdateParams.fromJson(older).toJson(), "speed"));
    Assert.isUndefined(new TeammateUpdateParams("teammate-1", "Alice", null, "providerId-1", Harness.Provider, "model-a", "high").speed);
    Assert.isNull(new TeammateUpdateParams("teammate-1", "Alice", null, "providerId-1", Harness.Provider, "model-a", "high", null).speed);
    Assert.areEqual("speed", Assert.throws(() => new TeammateUpdateParams("teammate-1", "Alice", null, "providerId-1", Harness.Provider, "model-a", "high", " "), ArgumentException).parameterName);
  }

  @TestMethod
  public keepsItsChosenModeThroughJsonAndLeavesItOutWhenOlderJsonLacksIt(): void {
    const value = new TeammateUpdateParams("teammate-1", "Alice", null, "providerId-1", Harness.Provider, "model-a", "high", null, "plan");
    const older = { ...value.toJson() };
    delete older["mode"];

    Assert.areEqual("plan", TeammateUpdateParams.fromJson(value.toJson()).mode);
    Assert.isUndefined(TeammateUpdateParams.fromJson(older).mode);
    Assert.isUndefined(new TeammateUpdateParams("teammate-1", "Alice", null, "providerId-1", Harness.Provider, "model-a", "high").mode);
    Assert.isNull(new TeammateUpdateParams("teammate-1", "Alice", null, "providerId-1", Harness.Provider, "model-a", "high", null, null).mode);
    Assert.areEqual("mode", Assert.throws(() => new TeammateUpdateParams("teammate-1", "Alice", null, "providerId-1", Harness.Provider, "model-a", "high", null, " "), ArgumentException).parameterName);
  }

  @TestMethod
  public namesOnlyTheFieldsAPatchChangesAndReadsALeftOutFieldAsUnchanged(): void {
    const patch = TeammateUpdateParams.of("teammate-1", { effort: "high", role: null }, "providerId-1");
    const read = TeammateUpdateParams.fromJson({ teammateId: "teammate-1", role: "Lead" });

    Assert.areEqual(JSON.stringify({ teammateId: "teammate-1", role: null, effort: "high", expectedProviderId: "providerId-1" }), JSON.stringify(patch.toJson()));
    Assert.areEqual(JSON.stringify(patch.toJson()), JSON.stringify(TeammateUpdateParams.fromJson(patch.toJson()).toJson()));
    Assert.areEqual(JSON.stringify({ teammateId: "teammate-1", role: "Lead" }), JSON.stringify(read.toJson()));
    Assert.isTrue([read.name, read.providerId, read.harness, read.model, read.effort, read.speed, read.mode, read.expectedProviderId].every(t => Object.isUndefined(t)));
    Assert.areEqual("$.input.providerId", Assert.throws(() => TeammateUpdateParams.fromJson({ teammateId: "teammate-1", providerId: " " }, "$.input"),
      JsonException).path);
    Assert.areEqual("$.input.name", Assert.throws(() => TeammateUpdateParams.fromJson({ teammateId: "teammate-1", name: 7 }, "$.input"), JsonException).path);
    Assert.throws(() => TeammateUpdateParams.fromJson({ teammateId: "teammate-1", harness: "unsupported" }), JsonException);
    Assert.throws(() => TeammateUpdateParams.of("teammate-1", { harness: "unsupported" as Harness }), ArgumentException);
    Assert.throws(() => TeammateUpdateParams.of("teammate-1", { name: " " }), ArgumentException);
  }

  @TestMethod
  public changesOnlyTheWantedFieldsThatDifferFromTheTeammatesOwn(): void {
    const teammate = new Teammate("teammate-1", "Alice", "Review", "providerId-1", Harness.Provider, "model-a", "high", "2026-10-26T00:00:00.000Z",
      "2026-10-26T00:00:00.000Z", "priority", "plan");

    const changed = TeammateUpdateParams.changing(teammate, { model: "model-b", effort: "high", speed: null });
    const renamed = TeammateUpdateParams.changing(teammate, { name: "Bea", role: "Review" });
    const same = TeammateUpdateParams.changing(teammate, { name: "Alice", role: "Review", providerId: "providerId-1" });
    const shown = TeammateUpdateParams.changing(teammate, { effort: "low" }, "providerId-0");

    Assert.areEqual(JSON.stringify({ teammateId: "teammate-1", model: "model-b", speed: null, expectedProviderId: "providerId-1" }), JSON.stringify(changed?.toJson()));
    Assert.areEqual(JSON.stringify({ teammateId: "teammate-1", name: "Bea" }), JSON.stringify(renamed?.toJson()));
    Assert.isNull(same);
    Assert.areEqual(JSON.stringify({ teammateId: "teammate-1", effort: "low", expectedProviderId: "providerId-0" }), JSON.stringify(shown?.toJson()));
  }

  @TestMethod
  public refusesAnUpdateThatChangesNothingNamesAFieldItDoesntHaveOrSetsAProviderBoundFieldWithoutTheProviderItRead(): void {
    Assert.areEqual("teammateId", Assert.throws(() => TeammateUpdateParams.fromJson({ teammateId: "teammate-1" }), ArgumentException).parameterName);
    Assert.areEqual("teammateId", Assert.throws(() => TeammateUpdateParams.of("teammate-1", {}, "providerId-1"), ArgumentException).parameterName);
    Assert.areEqual("nmae", Assert.throws(() => TeammateUpdateParams.fromJson({ teammateId: "teammate-1", nmae: "Bea" }), ArgumentException).parameterName);
    Assert.areEqual("nmae", Assert.throws(() => TeammateUpdateParams.fromJson({ teammateId: "teammate-1", name: "Bea", nmae: "Bea" }), ArgumentException).parameterName);
    const unread: readonly ITeammateChanges[] = [{ model: "model-b" }, { effort: null }, { speed: "fast" }, { mode: null }];
    for (const changes of unread)
      Assert.areEqual("expectedProviderId", Assert.throws(() => TeammateUpdateParams.of("teammate-1", changes), ArgumentException).parameterName);
    Assert.areEqual("expectedProviderId", Assert.throws(() => TeammateUpdateParams.of("teammate-1", { model: "model-b" }, " "), ArgumentException).parameterName);
    Assert.areEqual("$.input.expectedProviderId", Assert.throws(() => TeammateUpdateParams.fromJson({ teammateId: "teammate-1", model: "model-b", expectedProviderId: 7 },
      "$.input"), JsonException).path);
    Assert.areEqual("providerId-2", TeammateUpdateParams.of("teammate-1", { providerId: "providerId-2", model: null }).providerId);
  }

  @TestMethod
  public appliesTheFieldsItNamesToATeammateAndKeepsTheOthers(): void {
    const teammate = new Teammate("teammate-1", "Alice", "Review", "providerId-1", Harness.Provider, "model-a", "high", "2026-10-26T00:00:00.000Z",
      "2026-10-26T00:00:00.000Z", "priority", "plan");

    const patched = TeammateUpdateParams.of("teammate-1", { role: null, effort: "low", mode: null }, "providerId-1").applyTo(teammate, "2026-10-27T00:00:00.000Z");
    const replaced = new TeammateUpdateParams("teammate-1", "Bob", null, "providerId-2", Harness.Provider, null, null).applyTo(teammate, "2026-10-27T00:00:00.000Z");

    Assert.areEqual(JSON.stringify(new Teammate("teammate-1", "Alice", null, "providerId-1", Harness.Provider, "model-a", "low", "2026-10-26T00:00:00.000Z",
      "2026-10-27T00:00:00.000Z", "priority", null).toJson()), JSON.stringify(patched.toJson()));
    Assert.areEqual(JSON.stringify(new Teammate("teammate-1", "Bob", null, "providerId-2", Harness.Provider, null, null, "2026-10-26T00:00:00.000Z",
      "2026-10-27T00:00:00.000Z", "priority", "plan").toJson()), JSON.stringify(replaced.toJson()));
  }

  @TestMethod
  public setsClearsOrKeepsTheContextWindowOnTheProviderItRead(): void {
    const teammate = new Teammate("teammate-1", "Alice", null, "providerId-1", Harness.Provider, "model-a", "high", "2026-10-26T00:00:00.000Z",
      "2026-10-26T00:00:00.000Z", null, null, 400_000);
    const set = TeammateUpdateParams.fromJson({ teammateId: "teammate-1", contextWindow: 300_000, expectedProviderId: "providerId-1" });
    const cleared = TeammateUpdateParams.of("teammate-1", { contextWindow: null }, "providerId-1");
    const renamed = TeammateUpdateParams.of("teammate-1", { name: "Bea" });

    Assert.areEqual("300000|null|400000", [set.applyTo(teammate, "t").contextWindow, cleared.applyTo(teammate, "t").contextWindow,
      renamed.applyTo(teammate, "t").contextWindow].map(String).join("|"));
    Assert.areEqual(JSON.stringify({ teammateId: "teammate-1", expectedProviderId: "providerId-1", contextWindow: null }), JSON.stringify(cleared.toJson()));
    Assert.isFalse(Object.hasOwn(renamed.toJson(), "contextWindow"));
    Assert.areEqual(JSON.stringify({ teammateId: "teammate-1", expectedProviderId: "providerId-1", contextWindow: 200_000 }),
      JSON.stringify(TeammateUpdateParams.changing(teammate, { contextWindow: 200_000 })?.toJson()));
    Assert.isNull(TeammateUpdateParams.changing(teammate, { contextWindow: 400_000 }));
    Assert.areEqual("expectedProviderId", Assert.throws(() => TeammateUpdateParams.of("teammate-1", { contextWindow: 300_000 }), ArgumentException).parameterName);
    Assert.areEqual("contextWindow", Assert.throws(() => TeammateUpdateParams.of("teammate-1", { contextWindow: 0 }, "providerId-1"), ArgumentException).parameterName);
  }

  @TestMethod
  public setsKeepsOrClearsUsageHandOffsAndRefusesItselfARepeatOrABlankId(): void {
    const at = "2026-11-11T00:00:00Z";
    const teammate = new Teammate("id-1", "Alice", null, "providerId-1", Harness.Provider, null, null, at, at, null, null, null, ["id-2"]);
    const set = TeammateUpdateParams.fromJson({ teammateId: "id-1", usageHandOffs: ["id-3", "id-2"] });
    const renamed = TeammateUpdateParams.fromJson({ teammateId: "id-1", name: "Bea" });
    const cleared = TeammateUpdateParams.of("id-1", { usageHandOffs: [] });

    Assert.areEqual("id-3|id-2", TeammateUpdateParams.fromJson(set.toJson()).applyTo(teammate, at).usageHandOffs.join("|"));
    Assert.isUndefined(renamed.usageHandOffs);
    Assert.isFalse(Object.hasOwn(renamed.toJson(), "usageHandOffs"));
    Assert.areEqual("id-2", renamed.applyTo(teammate, at).usageHandOffs.join("|"));
    Assert.areEqual(0, cleared.applyTo(teammate, at).usageHandOffs.length);
    for (const list of [["id-1"], ["id-2", "id-2"], [" "]])
      Assert.areEqual("usageHandOffs", Assert.throws(() => TeammateUpdateParams.of("id-1", { usageHandOffs: list }), ArgumentException).parameterName);
  }

  @TestMethod
  public changesUsageHandOffsOnlyWhenTheirOrderOrMembersDiffer(): void {
    const at = "2026-11-11T00:00:00Z";
    const teammate = new Teammate("id-1", "Alice", null, "providerId-1", Harness.Provider, null, null, at, at, null, null, null, ["id-2", "id-3"]);

    Assert.isNull(TeammateUpdateParams.changing(teammate, { name: "Alice", usageHandOffs: ["id-2", "id-3"] }));
    Assert.areEqual("id-3|id-2", TeammateUpdateParams.changing(teammate, { usageHandOffs: ["id-3", "id-2"] })?.usageHandOffs?.join("|"));
    Assert.areEqual("id-2", TeammateUpdateParams.changing(teammate, { usageHandOffs: ["id-2"] })?.usageHandOffs?.join("|"));
    Assert.areEqual("Bea|undefined", [TeammateUpdateParams.changing(teammate, { name: "Bea" })?.name,
      String(TeammateUpdateParams.changing(teammate, { name: "Bea" })?.usageHandOffs)].join("|"));
  }

  @TestMethod
  public setsOrKeepsTheSustainSettingsWithoutTheProviderItReadAndReplacesTheListWhole(): void {
    const teammate = new Teammate("teammate-1", "Alice", null, "providerId-1", Harness.Provider, "model-a", "high", "2026-10-26T00:00:00.000Z",
      "2026-10-26T00:00:00.000Z", null, null, null, [], true, [new TeammateFallback("providerId-2", "model-b"), new TeammateFallback("providerId-3")]);
    const described = (value: Teammate): string => [value.fallbacks.map(t => t.providerId).join(), value.sustain, value.resetsSoonestFirst].join("|");
    const replaced = TeammateUpdateParams.fromJson({ teammateId: "teammate-1", fallbacks: [{ providerId: "providerId-3", model: null, effort: null }] });
    const switched = TeammateUpdateParams.of("teammate-1", { sustain: false, resetsSoonestFirst: false });
    const emptied = TeammateUpdateParams.of("teammate-1", { fallbacks: [] });

    Assert.areEqual("providerId-3|true|true", described(replaced.applyTo(teammate, "t")));
    Assert.areEqual("providerId-2,providerId-3|false|false", described(switched.applyTo(teammate, "t")));
    Assert.areEqual("|true|true", described(emptied.applyTo(teammate, "t")));
    Assert.areEqual(JSON.stringify({ teammateId: "teammate-1", sustain: false, resetsSoonestFirst: false }), JSON.stringify(switched.toJson()));
    Assert.areEqual(JSON.stringify(switched.toJson()), JSON.stringify(TeammateUpdateParams.fromJson(switched.toJson()).toJson()));
    Assert.areEqual(JSON.stringify({ teammateId: "teammate-1", fallbacks: [{ providerId: "providerId-3", model: null, effort: null }] }),
      JSON.stringify(replaced.toJson()));
    Assert.areEqual(JSON.stringify({ teammateId: "teammate-1", fallbacks: [] }), JSON.stringify(emptied.toJson()));
    Assert.areEqual("$.fallbacks.0.providerId", Assert.throws(() => TeammateUpdateParams.fromJson({ teammateId: "teammate-1", fallbacks: [{ model: null, effort: null }] }),
      JsonException).path);
  }

  @TestMethod
  public keepsTheHandOffsAndEverySustainSettingItLeavesAloneWhenAllDifferFromTheirDefaults(): void {
    const teammate = new Teammate("teammate-1", "Alice", null, "providerId-1", Harness.Provider, "model-a", "high", "2026-10-26T00:00:00.000Z",
      "2026-10-26T00:00:00.000Z", null, null, null, ["teammate-2"], true, [new TeammateFallback("providerId-2", "model-b", "low")], false);
    const described = (value: Teammate): string => [value.name, value.usageHandOffs.join(), value.sustain, value.fallbacks.map(t => [t.providerId, t.model, t.effort].join(" ")).join(),
      value.resetsSoonestFirst].join("|");

    Assert.areEqual("Bo|teammate-2|true|providerId-2 model-b low|false", described(TeammateUpdateParams.of("teammate-1", { name: "Bo" }).applyTo(teammate, "t")));
    Assert.areEqual("Alice||true|providerId-2 model-b low|false", described(TeammateUpdateParams.of("teammate-1", { usageHandOffs: [] }).applyTo(teammate, "t")));
    Assert.areEqual("Alice|teammate-2|true||false", described(TeammateUpdateParams.of("teammate-1", { fallbacks: [] }).applyTo(teammate, "t")));
  }

  @TestMethod
  public changesTheFallbacksOnlyWhenAnEntryDiffersFromTheTeammatesOwnList(): void {
    const second = new TeammateFallback("providerId-3");
    const teammate = new Teammate("teammate-1", "Alice", null, "providerId-1", Harness.Provider, "model-a", "high", "2026-10-26T00:00:00.000Z",
      "2026-10-26T00:00:00.000Z", null, null, null, [], false, [new TeammateFallback("providerId-2", "model-b"), second]);
    const same = [new TeammateFallback("providerId-2", "model-b"), new TeammateFallback("providerId-3")];
    const differing = [[second, same[0] ?? second], [second], [...same, new TeammateFallback("providerId-4")], [new TeammateFallback("providerId-2", "model-b", "low"), second]];

    Assert.isNull(TeammateUpdateParams.changing(teammate, { fallbacks: same, sustain: false, resetsSoonestFirst: true }));
    Assert.areEqual(JSON.stringify({ teammateId: "teammate-1", sustain: true }), JSON.stringify(TeammateUpdateParams.changing(teammate, { fallbacks: same,
      sustain: true })?.toJson()));
    for (const fallbacks of differing)
      Assert.areEqual(JSON.stringify({ teammateId: "teammate-1", fallbacks: fallbacks.map(t => t.toJson()) }),
        JSON.stringify(TeammateUpdateParams.changing(teammate, { fallbacks })?.toJson()));
  }
}
