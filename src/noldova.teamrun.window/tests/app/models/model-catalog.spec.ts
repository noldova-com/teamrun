/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ProviderMode, ProviderModel, ProviderSpeed } from "@noldova/teamrun.protocol";

import { ModelCatalog } from "../../../src/app/models/model-catalog";
import { Resources } from "../../../src/resources";

describe("ModelCatalog", () => {
  it("retains its choices independently of the caller's array", () => {
    const models = [new ProviderModel("a", "A", "", null, false, null, null)];
    const catalog = new ModelCatalog(models, 123, true);
    models.length = 0;

    expect(catalog.models.map(t => t.id)).toEqual(["a"]);
    expect(catalog.fetchedAt).toBe(123);
    expect(catalog.failed).toBe(true);
    expect(catalog.signedIn).toBeNull();
    expect(new ModelCatalog([], 0, false, false).signedIn).toBe(false);
  });

  it("offers as choices every model but a default that only stands for another listed model, and keeps a default that resolves to none listed", () => {
    const alias = new ProviderModel("default", "Opus 5.5", "", [], true, "claude-opus-5-5", true);
    const opus = new ProviderModel("opus", "Opus 5.5", "", [], false, "claude-opus-5-5", true);
    const sonnet = new ProviderModel("sonnet", "Sonnet 5.5", "", [], false, "claude-sonnet-5-5", true);
    const own = new ProviderModel("default", "Fable 5.1", "", [], true, "claude-fable-5-1", true);
    const unresolved = new ProviderModel("default", "Default (recommended)", "", [], true, null, true);
    const aliased = new ModelCatalog([alias, opus, sonnet], 0, false);

    expect([aliased.choices.map(t => t.id), aliased.defaultModelName, aliased.isAlias(alias), aliased.isAlias(opus), aliased.isAlias(undefined)])
      .toEqual([["opus", "sonnet"], "Opus 5.5", true, false, false]);
    expect([new ModelCatalog([own, sonnet], 0, false).choices.map(t => t.id), new ModelCatalog([unresolved, sonnet], 0, false).choices.map(t => t.id)])
      .toEqual([["default", "sonnet"], ["default", "sonnet"]]);
  });

  it("resolves aliases and clears only unsupported model and effort choices", () => {
    const catalog = new ModelCatalog([
      new ProviderModel("small", "Small", "", ["low"], true, "resolved-small", true),
      new ProviderModel("plain", "Plain", "", [], false, null, true),
      new ProviderModel("unknown", "Unknown", "", null, false, null, null)
    ], 0, false);

    expect(catalog.resolveModel("resolved-small")).toBe("resolved-small");
    expect(catalog.resolveModel("missing")).toBeNull();
    expect(catalog.resolveModel(null)).toBeNull();
    expect(catalog.resolveEffort(null, "high")).toBeNull();
    expect(catalog.resolveEffort("small", null)).toBeNull();
    expect(catalog.resolveEffort("small", "low")).toBe("low");
    expect(catalog.resolveEffort("plain", "low")).toBeNull();
    expect(catalog.resolveEffort("unknown", "high")).toBeNull();
  });

  it("says its models are unlisted only after a listing that succeeded with none", () => {
    expect(new ModelCatalog([], 1, false).unlisted).toBe(true);
    expect(new ModelCatalog([], 0, false).unlisted).toBe(false);
    expect(new ModelCatalog([], 1, true).unlisted).toBe(false);
    expect(new ModelCatalog([new ProviderModel("a", "A", "", null, false, null, null)], 1, false).unlisted).toBe(false);
  });

  it("reads a list that came back empty as empty rather than unlisted", () => {
    const empty = new ModelCatalog([], 1, false, true, true);

    expect(empty.empty).toBe(true);
    expect(empty.unlisted).toBe(false);
    expect(new ModelCatalog([], 1, false, true).empty).toBe(false);
  });

  it("reads a list that awaits the provider's first turn as neither unlisted nor empty, and as not knowing its models", () => {
    const awaiting = new ModelCatalog([], 1, false, true, false, null, true);

    expect([awaiting.awaitsTurn, awaiting.unlisted, awaiting.empty, awaiting.knowsModels]).toEqual([true, false, false, false]);
    expect(new ModelCatalog([], 1, false, true).awaitsTurn).toBe(false);
  });

  it("names the model it marks as the default, and none when it marks none", () => {
    const plain = new ProviderModel("gpt-5", "GPT-5", "", [], false, null, true);
    const marked = new ProviderModel("gpt-6.1-sol", "GPT-6.1-Sol", "", [], true, null, true);

    expect(new ModelCatalog([plain, marked], 1, false).defaultModelName).toBe("GPT-6.1-Sol");
    expect(new ModelCatalog([plain], 1, false).defaultModelName).toBeNull();
  });

  it("knows the models from a list or a plan, and not from a failed, empty, unlisted or unread one", () => {
    const model = new ProviderModel("gpt-5", "GPT-5", "", [], true, null, true);

    expect(new ModelCatalog([model], 1, false).knowsModels).toBe(true);
    expect(new ModelCatalog([], 1, false, true, false, "Copilot Free").knowsModels).toBe(true);
    expect(new ModelCatalog([model], 1, true).knowsModels).toBe(false);
    expect(new ModelCatalog([], 1, false, true, true).knowsModels).toBe(false);
    expect(new ModelCatalog([], 1, false, true).knowsModels).toBe(false);
    expect(new ModelCatalog([model], 0, false).knowsModels).toBe(false);
  });

  it("reads a plan that limits the models as neither unlisted nor empty, and words its note", () => {
    const free = new ModelCatalog([], 1, false, true, false, "Copilot Free");

    expect([free.unlisted, free.empty, free.planName]).toEqual([false, false, "Copilot Free"]);
    expect(free.planNote("Auto")).toBe("Your Copilot Free plan currently includes only Auto, which automatically selects the best available model for each task.");
    expect(new ModelCatalog([], 1, false, true).planNote("Auto")).toBeNull();
    expect(new ModelCatalog([], 1, false, true).planName).toBeNull();
  });

  it("offers only the effort levels the chosen model lists, and none for a model it doesn't list or that lists none", () => {
    const listed = new ModelCatalog([
      new ProviderModel("small", "Small", "", ["low"], true, null, true),
      new ProviderModel("unknown", "Unknown", "", null, false, null, null),
      new ProviderModel("gpt-5", "GPT-5", "", ["low", "high"], false, null, true)
    ], 1, false);

    expect(listed.effortLevelsOf("gpt-5")).toEqual(["low", "high"]);
    expect(listed.effortLevelsOf(null)).toEqual(["low"]);
    expect(listed.effortLevelsOf("unknown")).toEqual([]);
    expect(listed.effortLevelsOf("missing")).toEqual([]);
    expect(new ModelCatalog([], 1, false).effortLevelsOf(null)).toEqual([]);
  });

  it("names a level by the provider's name for it, else by its id with a capital, and no level by the model's default level or as the model's default", () => {
    const listed = new ModelCatalog([
      new ProviderModel("a", "A", "", ["low", "medium", "xhigh"], true, null, null, "medium", { xhigh: "Extra" }),
      new ProviderModel("b", "B", "", ["low"], false, null, null)
    ], 1, false);

    expect([listed.effortName("a", "xhigh"), listed.effortName("a", "low"), listed.effortName(null, null), listed.effortName("b", null)])
      .toEqual(["Extra", "Low", "Medium", Resources.modelDefaultEffort]);
    expect([listed.effortName("missing", "high"), listed.effortName("missing", null)]).toEqual(["High", Resources.modelDefaultEffort]);
    expect([listed.defaultEffortOf("a"), listed.defaultEffortOf("b"), listed.defaultEffortOf("missing")]).toEqual(["medium", null, null]);
  });

  it("selects the effort the provider's configuration sets, listed or not, over the model's default, which stays the default", () => {
    const listed = new ModelCatalog([
      new ProviderModel("a", "A", "", ["low", "medium", "xhigh"], true, null, null, "medium", { xhigh: "Extra" }, [], null, null, null, "xhigh"),
      new ProviderModel("b", "B", "", ["low", "medium"], false, null, null, "medium", {}, [], null, null, null, "max"),
      new ProviderModel("c", "C", "", ["low"], false, null, null, "low")
    ], 1, false);

    expect(["a", "b", "c", "missing"].map(t => [listed.defaultEffortOf(t), listed.selectedEffortOf(t), listed.effortName(t, null)]))
      .toEqual([["medium", "xhigh", "Extra"], ["medium", "max", "Max"], ["low", "low", "Low"], [null, null, Resources.modelDefaultEffort]]);
  });

  it("finds a mode by its id or, for none, the default, and keeps a mode only when it lists it", () => {
    const modes = [new ProviderMode("default", "Default"), new ProviderMode("yolo", "YOLO", "Runs every tool without asking.", true)];
    const catalog = new ModelCatalog([], 1, false, null, false, null, false, modes, "default");
    modes.length = 0;

    expect([catalog.modes.map(t => t.id), catalog.defaultMode]).toEqual([["default", "yolo"], "default"]);
    expect([catalog.modeOf("yolo")?.name, catalog.modeOf(null)?.name, catalog.modeOf("missing")]).toEqual(["YOLO", "Default", undefined]);
    expect([catalog.resolveMode("yolo"), catalog.resolveMode("missing"), catalog.resolveMode(null)]).toEqual(["yolo", null, null]);
    expect([new ModelCatalog([], 1, false).modes, new ModelCatalog([], 1, false).defaultMode, new ModelCatalog([], 1, false).modeOf(null)]).toEqual([[], null, undefined]);
  });

  it("keeps a speed only when the chosen model lists it, and none for a model the catalog doesn't list", () => {
    const listed = new ModelCatalog([
      new ProviderModel("tiered", "Tiered", "", null, true, null, null, null, {}, [new ProviderSpeed("priority", "Fast")], null),
      new ProviderModel("plain", "Plain", "", null, false, null, null)
    ], 1, false);

    expect([listed.resolveSpeed("tiered", "priority"), listed.resolveSpeed(null, "priority"), listed.resolveSpeed("tiered", "flex")]).toEqual(["priority", "priority", null]);
    expect([listed.resolveSpeed("plain", "priority"), listed.resolveSpeed("missing", "priority"), listed.resolveSpeed("tiered", null)]).toEqual([null, null, null]);
    expect([listed.speedsOf("plain"), listed.speedsOf("missing")]).toEqual([[], []]);
  });

  it("reads a saved level's id as its model at that level, and finds no model for an id it lists as a model or doesn't know", () => {
    const listed = new ModelCatalog([new ProviderModel("flash", "Flash", "", ["flash-low", "flash-medium"], true, null, true, "flash-low", { "flash-low": "Low", "flash-medium": "Medium" })], 1, false);

    expect([listed.familyOf("flash-low")?.id, listed.familyOf("flash"), listed.familyOf("missing"), listed.familyOf(null)]).toEqual(["flash", undefined, undefined, undefined]);
    expect([listed.resolveModel("flash-medium"), listed.modelOf("flash-medium")?.id, listed.effortName("flash-medium", null), listed.effortName("flash-medium", "flash-low")])
      .toEqual(["flash-medium", "flash", "Medium", "Low"]);
  });

  it("offers the default model every level a listed model offers, in the levels' order, when the provider says its unlisted default takes them, as Copilot's Auto", () => {
    const models = [
      new ProviderModel("gpt-5-mini", "GPT-5 mini", "", ["low", "high"], false, null, true, "low"),
      new ProviderModel("claude-haiku-4.5", "Claude Haiku 4.5", "", [], false, null, true),
      new ProviderModel("kimi-k3", "Kimi K3", "", null, false, null, false),
      new ProviderModel("claude-opus-4.7", "Claude Opus 4.7", "", ["medium", "xhigh"], false, null, true, "medium"),
      new ProviderModel("next", "Next", "", ["ultra", "max", "turbo"], false, null, true),
      new ProviderModel("gpt-5.5", "GPT-5.5", "", ["turbo", "minimal"], false, null, true)
    ];
    const copilot = new ModelCatalog(models, 1, false, true, false, null, false, [], null, true);
    const none = new ModelCatalog([new ProviderModel("plain", "Plain", "", [], false, null, true)], 1, false, true, false, null, false, [], null, true);

    expect(copilot.effortLevelsOf(null)).toEqual(["minimal", "low", "medium", "high", "xhigh", "max", "ultra", "turbo"]);
    expect([copilot.resolveEffort(null, "medium"), copilot.resolveEffort(null, "max"), copilot.resolveEffort(null, "none")]).toEqual(["medium", "max", null]);
    expect([copilot.defaultEffortOf(null), copilot.effortName(null, "xhigh")]).toEqual([null, Resources.formatEffort("xhigh")]);
    expect(copilot.effortLevelsOf("claude-haiku-4.5")).toEqual([]);
    expect([none.effortLevelsOf(null), none.resolveEffort(null, "medium")]).toEqual([[], null]);
  });

  it("offers no levels for the default model of a provider that marks none as its default and doesn't say its default takes the listed levels", () => {
    const codex = new ModelCatalog([
      new ProviderModel("gpt-5-mini", "GPT-5 mini", "", ["low", "medium"], false, null, true, "medium"),
      new ProviderModel("gpt-5.5", "GPT-5.5", "", ["medium", "high"], false, null, true)
    ], 1, false, true);

    expect([codex.effortLevelsOf(null), codex.resolveEffort(null, "medium")]).toEqual([[], null]);
    expect(codex.effortLevelsOf("gpt-5.5")).toEqual(["medium", "high"]);
  });

  it("keeps an effort level only when the chosen model lists it, and none for a model whose levels are unknown or a model the catalog doesn't list", () => {
    const listed = new ModelCatalog([
      new ProviderModel("small", "Small", "", ["low"], false, null, true),
      new ProviderModel("unknown", "Unknown", "", null, false, null, null)
    ], 1, false);

    expect([listed.resolveEffort("small", "low"), listed.resolveEffort("small", "high"), listed.resolveEffort("small", null)]).toEqual(["low", null, null]);
    expect([listed.resolveEffort("unknown", "ultra"), listed.resolveEffort("missing", "ultra")]).toEqual([null, null]);
    expect([new ModelCatalog([], 1, false).resolveEffort(null, "max"), new ModelCatalog([], 1, false).resolveEffort(null, null)]).toEqual([null, null]);
  });
});
