/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { SettingOption } from "@noldova/desktop.protocol";
import { AuthStatus, EventName, MethodName, Provider, ProviderListModelsParams, ProviderModel, ProviderModelList } from "@noldova/teamrun.protocol";

import { ChatStoreService } from "../../../src/app/services/chat-store.service";
import { TitleModelOptions } from "../../../src/app/services/title-model-options";
import { Resources } from "../../../src/resources";
import { DeferredResponse } from "../../fixtures/deferred-response.fixture";
import type { FakeWindowPartContext } from "../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../fixtures/sample-data.fixture";
import { Wait } from "../../fixtures/wait.fixture";

describe("TitleModelOptions", () => {
  const model = (id: string, name: string): ProviderModel => new ProviderModel(id, name, String.empty, null, false, null, null);
  const list = (...models: readonly ProviderModel[]): JsonValue => new ProviderModelList(models, true).toJson();
  const provider = (id: string, label: string, enabled: boolean = true, status: AuthStatus = AuthStatus.LoggedIn, kind: string = "codex"): Provider =>
    Provider.fromJson({ ...SampleData.provider.toJson(), id, label, enabled, authStatus: status, kind });
  const found = <T>(value: T | null | undefined, name: string): T => {
    if (Object.isNull(value) || Object.isUndefined(value))
      throw new Error(`The spec has no ${name}.`);
    return value;
  };
  const pairs = (options: readonly SettingOption[] | null): (readonly [string, string])[] | null => options?.map(t => [t.value, t.title] as const) ?? null;
  let context: FakeWindowPartContext;
  let read: () => readonly SettingOption[] | null;
  let stop: () => void;
  let store: ChatStoreService;
  const catalogs = new Map<string, DeferredResponse>();
  const failing = new Set<string>();
  const refreshes: string[] = [];

  const open = async (providers: readonly Provider[]): Promise<void> => {
    catalogs.clear();
    failing.clear();
    refreshes.length = 0;
    context = SampleData.createContext()
      .answer(MethodName.ProviderList, () => providers.map(t => t.toJson()))
      .answer(MethodName.ProviderModelCatalog, t => {
        const params = ProviderListModelsParams.fromJson(t);
        const id = found(params.providerId, "provider id");
        refreshes.push(`${id}:${String(params.refresh)}`);
        if (failing.has(id))
          return Promise.reject(new Error("The provider is busy."));
        const answer = new DeferredResponse();
        catalogs.set(id, answer);
        return answer.promise;
      });
    store = ChatStoreService.of(context);
    await store.initialize();
    stop = TitleModelOptions.provide(context, store);
    read = () => found(context.settingOptions.get(Resources.titleModelSetting), "title model options")({});
  };

  afterEach(() => {
    stop();
    ChatStoreService.release(context);
  });

  it("offers the chat's own model first, then each provider's models, once they are loaded", async () => {
    await open([provider("p1", "Home"), provider("p2", "Work")]);

    expect(read()).toBeNull();
    await Wait.until(() => expect(catalogs.size).toBe(2));
    expect(read()).toBeNull();
    expect(catalogs.size).toBe(2);
    found(catalogs.get("p1"), "p1 list").resolve(list(model("opus", "Opus"), model("haiku", "Haiku")));
    await Wait.until(() => expect(context.refreshedSettings).toEqual([Resources.titleModelSetting]));
    expect(read()).toBeNull();
    found(catalogs.get("p2"), "p2 list").resolve(list(model("gpt", "GPT")));
    await Wait.until(() => expect(context.refreshedSettings).toHaveLength(2));

    expect(pairs(read())).toEqual([
      ["", "Same as the chat"],
      ["p1/opus", "Home: Opus"],
      ["p1/haiku", "Home: Haiku"],
      ["p2/gpt", "Work: GPT"]
    ]);
    expect(catalogs.size).toBe(2);
  });

  it("keeps a saved provider's own default row that stands for another model it lists, named as the default entry", async () => {
    await open([provider("p1", "Home")]);
    const saved = (): readonly SettingOption[] | null => found(context.settingOptions.get(Resources.titleModelSetting), "title model options")({ [Resources.titleModelSetting]: "p1/default" });
    expect(saved()).toBeNull();
    await Wait.until(() => expect(catalogs.size).toBe(1));

    found(catalogs.get("p1"), "p1 list").resolve(list(new ProviderModel("default", "Opus 5.5", String.empty, null, true, "claude-opus-5-5", null),
      new ProviderModel("opus", "Opus 5.5", String.empty, null, false, "claude-opus-5-5", null)));
    await Wait.until(() => expect(context.refreshedSettings).toHaveLength(1));

    expect(pairs(saved())).toEqual([["", "Same as the chat"], ["p1/default", `Home: ${Resources.formatDefaultModel("Opus 5.5")}`], ["p1/opus", "Home: Opus 5.5"]]);
  });

  it("leaves out a disabled or signed-out provider, and offers the chat's own model with no provider left", async () => {
    await open([provider("p1", "Off", false), provider("p2", "Out", true, AuthStatus.LoggedOut)]);
    expect(pairs(read())).toEqual([["", "Same as the chat"]]);
    expect(catalogs.size).toBe(0);
  });

  it("leaves out a provider whose kind can't name a chat", async () => {
    await open([provider("p1", "Home"), provider("p3", "Claude", true, AuthStatus.LoggedIn, "claude")]);
    expect(read()).toBeNull();
    await Wait.until(() => expect(catalogs.size).toBe(1));
    found(catalogs.get("p1"), "p1 list").resolve(list(model("gpt", "GPT")));
    await Wait.until(() => expect(context.refreshedSettings).toHaveLength(1));

    expect(pairs(read())).toEqual([["", "Same as the chat"], ["p1/gpt", "Home: GPT"]]);
    expect([...catalogs.keys()]).toEqual(["p1"]);
  });

  it("keeps a failed list only until a provider changes, then loads it past the model cache, and a kept list again through the cache", async () => {
    await open([provider("p1", "Home"), provider("p2", "Work")]);
    failing.add("p1");
    expect(read()).toBeNull();
    await Wait.until(() => expect(catalogs.size).toBe(1));
    found(catalogs.get("p2"), "p2 list").resolve(list(model("gpt", "GPT")));
    await Wait.until(() => expect(context.refreshedSettings).toHaveLength(2));
    const failed = pairs(read());
    const asked = refreshes.length;

    failing.delete("p1");
    context.emit(EventName.ProviderUpdated, provider("p1", "Home").toJson());
    await Wait.until(() => expect(context.refreshedSettings).toHaveLength(3));
    const stale = pairs(read());
    await Wait.until(() => expect(catalogs.size).toBe(2));
    found(catalogs.get("p1"), "p1 list").resolve(list(model("opus", "Opus")));
    await Wait.until(() => expect(context.refreshedSettings).toHaveLength(5));

    expect(failed).toEqual([["", "Same as the chat"], ["p2/gpt", "Work: GPT"]]);
    expect(asked).toBe(2);
    expect(stale).toEqual(failed);
    expect(refreshes).toEqual(["p1:false", "p2:false", "p1:true"]);
    expect(pairs(read())).toEqual([["", "Same as the chat"], ["p1/opus", "Home: Opus"], ["p2/gpt", "Work: GPT"]]);
  });

  it("loads its lists again for the providers the store reads again once the runtime starts again", async () => {
    await open([provider("p1", "Home")]);
    expect(read()).toBeNull();
    await Wait.until(() => expect(catalogs.size).toBe(1));
    found(catalogs.get("p1"), "p1 list").resolve(list(model("gpt", "GPT")));
    await Wait.until(() => expect(pairs(read())).toEqual([["", "Same as the chat"], ["p1/gpt", "Home: GPT"]]));
    const refreshed = context.refreshedSettings.length;
    context.answer(MethodName.ProviderList, () => [provider("p1", "Home"), provider("p2", "Work")].map(t => t.toJson()));
    await expect(ChatStoreService.resync(context)).resolves.toBe(true);

    TitleModelOptions.reload(context);

    expect(context.refreshedSettings).toHaveLength(refreshed + 1);
    expect(read()).toBeNull();
    await Wait.until(() => expect(refreshes).toEqual(["p1:false", "p1:false", "p2:false"]));
    found(catalogs.get("p1"), "p1 list").resolve(list(model("gpt-5", "GPT 5")));
    found(catalogs.get("p2"), "p2 list").resolve(list(model("opus", "Opus")));
    await Wait.until(() => expect(pairs(read())).toEqual([["", "Same as the chat"], ["p1/gpt-5", "Home: GPT 5"], ["p2/opus", "Work: Opus"]]));
  });

  it("stops supplying options when asked", async () => {
    await open([]);
    expect(context.settingOptions.has(Resources.titleModelSetting)).toBe(true);
    stop();
    expect(context.settingOptions.has(Resources.titleModelSetting)).toBe(false);
    stop = () => undefined;
  });

  it("drops a list that arrives after it stops", async () => {
    await open([provider("p1", "Home")]);
    expect(read()).toBeNull();
    await Wait.until(() => expect(catalogs.size).toBe(1));
    const loaded = store.modelCatalogs.load("codex", "p1");
    stop();
    stop = () => undefined;

    found(catalogs.get("p1"), "p1 list").resolve(list(model("gpt", "GPT")));
    const catalog = await loaded;

    expect(catalog.models.map(t => t.id)).toEqual(["gpt"]);
    expect(context.refreshedSettings).toEqual([]);
  });
});
