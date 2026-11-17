/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import "@noldova/context.core";
import type { SettingsRow } from "@noldova/desktop.window";
import { AbilityCell, AbilitySource, EventName, MethodName, ProviderAbility, ProviderKind } from "@noldova/teamrun.protocol";

import { AbilitySettingsRows } from "../../../src/app/services/ability-settings-rows";
import { ChatStoreService } from "../../../src/app/services/chat-store.service";
import { Resources } from "../../../src/resources";
import type { FakeWindowPartContext } from "../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../fixtures/sample-data.fixture";
import { Wait } from "../../fixtures/wait.fixture";

describe("AbilitySettingsRows", () => {
  const untabled = new ProviderKind("old", "Old", true);
  const cursor = new ProviderKind("cursor", "Cursor", true, false, null, null, false, null, false, null, false, null,
    SampleData.abilities({ [ProviderAbility.Fork]: AbilityCell.cannot("its fork answers that it has no such method") }));
  const pi = new ProviderKind("pi", "Pi", true, false, null, null, false, null, false, null, false, null,
    SampleData.abilities({ [ProviderAbility.Fork]: AbilityCell.works(AbilitySource.AcpAddition) }));
  let context: FakeWindowPartContext;
  let kinds: readonly ProviderKind[];

  const rows = (): readonly SettingsRow[] | undefined => context.settingsRows.get(Resources.abilitiesPageName);
  const fork = (): string | null | undefined => rows()?.find(t => t.id === "teamrun.providers.fork")?.description;
  const create = async (): Promise<ChatStoreService> => {
    context = SampleData.createContext().answer(MethodName.ProviderKindList, () => kinds.map(t => t.toJson()));
    const store = ChatStoreService.of(context);
    AbilitySettingsRows.register(context, store);
    await Wait.until(() => expect(store.kindsLoaded()).toBe(true));
    return store;
  };

  afterEach(() => {
    AbilitySettingsRows.release(context);
    ChatStoreService.release(context);
  });

  it("gives no rows until a provider with a table comes, then the first one's, each with its title, section and answer", async () => {
    kinds = [untabled];
    await create();
    expect(rows()).toEqual([]);

    kinds = [untabled, cursor, pi];
    context.emit(EventName.ProviderKindsChanged, null);

    await Wait.until(() => expect(fork()).toBe("Chats: Can't"));
    expect(rows()?.map(t => t.id)).toHaveLength(Object.values(ProviderAbility).length);
    expect([rows()?.[0]?.id, rows()?.[0]?.title, rows()?.[0]?.description]).toEqual(["teamrun.providers.runTurn", "Run and stop a turn", "Chats: Works"]);
    expect(rows()?.at(-1)?.description).toBe("/ commands: Works");
  });

  it("gives the chosen provider's rows, keeps the choice for the page, and gives nothing more once released", async () => {
    kinds = [cursor, pi];
    const store = await create();
    await Wait.until(() => expect(fork()).toBe("Chats: Can't"));

    AbilitySettingsRows.of(context)?.choose("pi");

    expect([fork(), AbilitySettingsRows.of(context)?.chosen]).toEqual(["Chats: Works", "pi"]);
    AbilitySettingsRows.release(context);
    context.settingsRows.clear();
    kinds = [pi];
    context.emit(EventName.ProviderKindsChanged, null);
    await Wait.until(() => expect(store.kinds().map(t => t.id)).toEqual(["pi"]));
    expect([rows(), AbilitySettingsRows.of(context)]).toEqual([undefined, null]);
  });
});
