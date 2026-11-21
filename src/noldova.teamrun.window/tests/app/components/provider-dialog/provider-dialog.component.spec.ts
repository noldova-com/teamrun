/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import "@noldova/context.core";
import { LinkPlace } from "@noldova/desktop.window";
import {
  AcpAgentEntry,
  AcpAgentIdParams,
  AcpAgentListing,
  AuthStatus,
  DataFolder,
  EventName,
  MethodName,
  Provider,
  ProviderCreateParams,
  ProviderKind,
  ProviderKindInstallation,
  ProviderKindInstallState,
  ProviderProfile,
  ProviderTool,
  ProviderUpdateParams
} from "@noldova/teamrun.protocol";
import { DialogService, DialogTokens, LinkGesture, type SelectComponent, SelectOption, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";

import { ProviderDialogComponent } from "../../../../src/app/components/provider-dialog/provider-dialog.component";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { Resources } from "../../../../src/resources";
import { AccessibilityFixture } from "../../../fixtures/accessibility.fixture";
import { DeferredResponse } from "../../../fixtures/deferred-response.fixture";
import { DialogActionsFixture } from "../../../fixtures/dialog-actions.fixture";
import { DialogDescriptionFixture } from "../../../fixtures/dialog-description.fixture";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import { FakeTerminalLauncher } from "../../../fixtures/fake-terminal-launcher.fixture";
import type { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("ProviderDialogComponent", () => {
  let context: FakeWindowPartContext;
  let store: ChatStoreService;
  let fixture: ComponentFixture<ProviderDialogComponent>;
  let closes: number;
  let folder: string | null;
  let terminals: FakeTerminalLauncher;

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await fixture.whenStable();
  };
  const kind = (): SelectComponent => fixture.debugElement.query(By.css("nol-select.nol-teamrun-kind")).componentInstance as SelectComponent;
  const field = <T extends HTMLElement>(selector: string): T => {
    const found = element().querySelector<T>(selector);
    if (Object.isNull(found))
      throw new Error(`The provider dialog shows no ${selector}.`);
    return found;
  };
  const type = async (selector: string, text: string): Promise<void> => {
    const input = field<HTMLInputElement>(selector);
    input.value = text;
    input.dispatchEvent(new Event("input"));
    await settle();
  };
  const hint = (): string => element().querySelector("#nol-teamrun-profile-hint")?.textContent?.trim() ?? "";
  const codes = (): string[] => [...element().querySelectorAll("#nol-teamrun-profile-hint code[nol-inline-code]")].map(t => t.textContent ?? "");
  const shown = (selector: string): boolean => field(selector).checkVisibility({ checkVisibilityCSS: true });
  const dataFolder = (target: FakeWindowPartContext, path: string): FakeWindowPartContext =>
    target.answer(MethodName.DataFolderRead, () => new DataFolder(path, `${path}/teamrun.sqlite`).toJson());
  const choice = (name: string): HTMLInputElement => field<HTMLInputElement>(`.nol-teamrun-${name}-folder input[type=radio]`);
  const isDisabled = (input: HTMLInputElement): boolean => input.getAttribute("aria-disabled") === "true";
  const pick = async (name: string): Promise<void> => {
    choice(name).click();
    await settle();
  };
  const save = (): HTMLButtonElement => field<HTMLButtonElement>(".nol-teamrun-save");
  const choices = (): string[][] => kind().options().filter((t): t is SelectOption => t instanceof SelectOption).map(t => [t.value, t.title]);
  const listed = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>(".nol-select-option")];
  const openKinds = async (count: number): Promise<void> => {
    field<HTMLButtonElement>("nol-select.nol-teamrun-kind .nol-select-button").click();
    await Wait.until(() => expect(listed()).toHaveLength(count));
  };
  const overlay = (): HTMLElement => document.querySelector<HTMLElement>(".cdk-overlay-container") ?? document.body;
  const antigravity = new ProviderKind("antigravity", "Antigravity", true, true);
  const ownCopy = (state: ProviderKindInstallState, received: number = 0, version: string | null = null, update: string | null = null): ProviderKindInstallation =>
    new ProviderKindInstallation("antigravity", state, null, received, 1000, version, update);
  const status = (): string => field(".nol-teamrun-install-status").textContent?.trim() ?? "";
  const droid = new AcpAgentEntry("droid", "Droid", "1.1.0", "Works through your tasks", null, null, false, false);
  const submit = async (): Promise<void> => {
    field<HTMLFormElement>("form").requestSubmit();
    await settle();
  };
  const create = async (configure: (context: FakeWindowPartContext) => void = () => undefined, provider: Provider | null = null): Promise<void> => {
    context = SampleData.createContext();
    configure(context);
    TestBed.configureTestingModule({ providers: [{ provide: DialogTokens.titleId, useValue: "nol-teamrun-dialog-title" }] });
    terminals = new FakeTerminalLauncher();
    store = ChatStoreService.of(context, terminals);
    await Wait.until(() => expect(store.loaded()).toBe(true));
    fixture = TestBed.createComponent(ProviderDialogComponent);
    fixture.componentRef.setInput("store", store);
    fixture.componentRef.setInput("chooseFolder", () => Promise.resolve(folder));
    fixture.componentRef.setInput("provider", provider);
    closes = 0;
    fixture.componentInstance.closed.subscribe(() => closes++);
    fixture.autoDetectChanges();
    await settle();
  };

  beforeEach(() => {
    folder = null;
  });

  afterEach(() => {
    ChatStoreService.release(context);
  });

  it("offers every provider type the runtime lists, the first chosen, with a new folder by default and each type's own hint for an existing one", async () => {
    await create();

    expect(element().querySelector(".nol-dialog-title")?.textContent).toBe("Add provider");
    expect(element().querySelector("form > .nol-teamrun-muted:first-child")?.textContent?.trim())
      .toBe("Connect one of the supported providers using a local profile. After adding it, check it from its menu to verify the connection.");
    expect(element().querySelector(".nol-teamrun-save")?.textContent?.trim()).toBe("Add provider");
    expect(choices()).toEqual([["codex", "Codex"], ["claude", "Claude Code"], [Resources.acpRowKind, Resources.acpKindOption]]);
    expect(kind().value()).toBe("codex");
    expect(field("nol-radio-group.nol-teamrun-folder-choice").getAttribute("aria-label")).toBe("Profile folder");
    expect([...element().querySelectorAll("nol-radio")].map(t => [t.textContent?.trim(), t.querySelector("input")?.checked]))
      .toEqual([["New folder", true], ["Existing folder", false]]);
    expect(shown(".nol-teamrun-profile-folder")).toBe(false);
    expect(hint()).toBe("TeamRun makes a new folder for the provider in its data folder, named after the provider's name. Sign-in is managed by the provider's own application.");
    expect(field<HTMLInputElement>(".nol-teamrun-provider-name").placeholder).toBe(Resources.providerNameHint);

    await pick("existing");

    expect(choice("existing").checked).toBe(true);
    expect(shown(".nol-teamrun-profile-folder")).toBe(true);
    expect(field<HTMLInputElement>(".nol-teamrun-profile-folder").value).toBe("");
    expect(hint()).toBe(
      "Choose the Codex profile that holds your CLI sign-in (usually the .codex folder in your home directory). TeamRun can sign Codex in too: choose Sign in in the provider's menu.");

    kind().valueChange.emit("claude");
    await settle();

    expect(kind().value()).toBe("claude");
    expect(hint()).toBe("Choose your Claude CLI profile folder (usually .claude). A Claude desktop login does not necessarily sign in this CLI profile: " +
      "choose Sign in in the provider's menu to sign this profile in from a terminal.");

    await pick("new");

    expect(shown(".nol-teamrun-profile-folder")).toBe(false);
    expect(shown(".nol-teamrun-choose-folder")).toBe(false);
  });

  it("is described by its hint, under the title, when the name field takes the first focus", async () => {
    await create();
    fixture.destroy();
    const reference = TestBed.inject(DialogService).open(ProviderDialogComponent, ".nol-teamrun-provider-name");
    reference.componentRef?.setInput("store", store);
    reference.componentRef?.setInput("chooseFolder", () => Promise.resolve(folder));
    reference.componentRef?.setInput("provider", null);

    DialogDescriptionFixture.expectDescribedBy(await DialogDescriptionFixture.focusedAsync(".nol-teamrun-provider-name"), [Resources.addProviderHint]);

    await DialogDescriptionFixture.closeAsync(reference);
  });

  it("disables a type that takes one provider once there is one, with its reason in a note the select reads, starts on the next type, and takes no click on it", async () => {
    const single = new ProviderKind("codex", "Codex", true, false, null, SampleData.codex.profile, false, null, false, "Codex keeps one sign-in on this computer, so TeamRun takes one Codex provider.");
    const free = new ProviderKind("claude", "Claude Code", true, false, null, null, false, null, false, "Claude Code keeps one sign-in here.");
    await create(t => t.answer(MethodName.ProviderKindList, () => [single.toJson(), free.toJson()]));
    const note = field(".nol-teamrun-refusal");
    const select = field("nol-select.nol-teamrun-kind");
    const kindField = field(".nol-teamrun-field:has(> nol-select.nol-teamrun-kind)");

    expect([kind().options().filter((t): t is SelectOption => t instanceof SelectOption).map(t => [t.value, t.isDisabled]), kind().value()])
      .toEqual([[["codex", true], ["claude", false], [Resources.acpRowKind, false]], "claude"]);
    expect([note.textContent?.trim(), note.id, kind().describedBy(), note.parentElement]).toEqual(["Codex keeps one sign-in on this computer, so TeamRun takes one Codex provider.", Resources.kindRefusalId, Resources.kindRefusalId, kindField]);
    expect(Math.round(note.getBoundingClientRect().left - select.getBoundingClientRect().left)).toBe(0);
    const label = field(".nol-teamrun-field:has(> nol-select.nol-teamrun-kind) > .nol-teamrun-field-label");
    const above = note.previousElementSibling ?? select;
    expect(note.getBoundingClientRect().top - above.getBoundingClientRect().bottom).toBeCloseTo(select.getBoundingClientRect().top - label.getBoundingClientRect().bottom, 0);

    fixture.componentRef.setInput("startingKind", "codex");
    await settle();
    expect(kind().value()).toBe("claude");

    await openKinds(3);
    listed()[0]?.click();
    await settle();
    expect(kind().value()).toBe("claude");
  });

  it("moves off a type once it becomes taken while open, and onto the ACP agents row once every type is taken, adding nothing there", async () => {
    const single = new ProviderKind("codex", "Codex", true, false, null, SampleData.codex.profile, false, null, false, "Codex keeps one sign-in on this computer.");
    const alone = new ProviderKind("claude", "Claude Code", true, false, null, null, false, null, false, "Claude Code keeps one sign-in here.");
    await create(t => t.answer(MethodName.ProviderKindList, () => [single.toJson(), alone.toJson()]).answer(MethodName.ProviderList, () => []));
    fixture.componentRef.setInput("startingKind", "codex");
    await settle();
    expect(kind().value()).toBe("codex");

    context.emit(EventName.ProviderUpdated, SampleData.provider.toJson());
    await settle();
    expect([kind().value(), field(".nol-teamrun-refusal").textContent?.trim()]).toEqual(["claude", "Codex keeps one sign-in on this computer."]);

    context.emit(EventName.ProviderUpdated, new Provider("a2", "claude", "Home", "D:\\profiles\\claude", AuthStatus.LoggedIn, null, "1.0", SampleData.timestamp, null,
      SampleData.timestamp).toJson());
    await settle();
    await type(".nol-teamrun-provider-name", "Third");

    expect([kind().value(), kind().options().filter((t): t is SelectOption => t instanceof SelectOption).map(t => t.isDisabled), save().disabled])
      .toEqual([Resources.acpRowKind, [true, true, false], true]);
    expect(hint()).toBe(Resources.noProviderProfileHint);
    await submit();
    expect(context.count(MethodName.ProviderCreate)).toBe(0);
  });

  it("starts on the provider type it's given, and on the first one listed without", async () => {
    await create();
    fixture.componentRef.setInput("startingKind", "claude");
    await settle();

    expect(kind().value()).toBe("claude");

    fixture.componentRef.setInput("startingKind", null);
    await settle();

    expect(kind().value()).toBe("codex");
  });

  it("adds a provider in a new folder named after its trimmed name, previewing the folder, and sends no folder typed before", async () => {
    await create(t => dataFolder(t, "D:\\data\\modules\\teamrun").answer(MethodName.ProviderCreate, u => {
      const params = ProviderCreateParams.fromJson(u);
      return new Provider("a2", params.kind, params.label, "D:\\data\\profiles\\codex\\Second- home", AuthStatus.Unknown, null, null, null, null, SampleData.timestamp)
        .toJson();
    }));
    await pick("existing");
    await type(".nol-teamrun-profile-folder", "D:\\typed");
    await pick("new");

    expect(save().disabled).toBe(true);

    await type(".nol-teamrun-provider-name", "  Second: home ");

    expect(hint()).toBe("TeamRun makes the folder D:\\data\\modules\\teamrun\\profiles\\codex\\Second- home for the provider. Sign-in is managed by the provider's own application.");
    expect(save().disabled).toBe(false);

    await submit();

    const params = ProviderCreateParams.fromJson(context.parametersOf(MethodName.ProviderCreate));
    expect([params.kind, params.label, params.profileDir]).toEqual(["codex", "Second: home", null]);
    expect(closes).toBe(1);
  });

  it("won't add in a new folder when the name leaves no character a folder name can use, and says why as the name field's message", async () => {
    await create();
    const name = field<HTMLInputElement>(".nol-teamrun-provider-name");

    expect(element().querySelector(".nol-teamrun-name-message")).toBeNull();
    expect(name.getAttribute("aria-invalid")).toBeNull();

    await type(".nol-teamrun-provider-name", " . . ");
    await submit();

    expect(field(".nol-teamrun-name-message").textContent?.trim()).toBe("The name \". .\" has no character a folder name can use. Choose another name.");
    expect(field(".nol-teamrun-name-message").id).toBe("nol-teamrun-name-message");
    expect(name.getAttribute("aria-describedby")).toBe("nol-teamrun-name-message nol-teamrun-profile-hint");
    expect(name.getAttribute("aria-invalid")).toBe("true");
    expect(hint()).toBe("TeamRun makes a new folder for the provider in its data folder, named after the provider's name. Sign-in is managed by the provider's own application.");
    expect(save().disabled).toBe(true);
    expect(context.count(MethodName.ProviderCreate)).toBe(0);

    await pick("existing");

    expect(shown(".nol-teamrun-name-message")).toBe(false);
    expect(field(".nol-teamrun-name-message").getAttribute("id")).toBeNull();
    expect(name.getAttribute("aria-describedby")).toBe("nol-teamrun-profile-hint");
    expect(name.getAttribute("aria-invalid")).toBeNull();

    await pick("new");

    expect(shown(".nol-teamrun-name-message")).toBe(true);
    expect(name.getAttribute("aria-describedby")).toBe("nol-teamrun-name-message nol-teamrun-profile-hint");
  });

  it("shows no name message on Edit, where the name makes no folder", async () => {
    await create(() => undefined, SampleData.provider);
    await type(".nol-teamrun-provider-name", " . . ");

    expect(element().querySelector(".nol-teamrun-name-message")).toBeNull();
    expect(field(".nol-teamrun-provider-name").getAttribute("aria-invalid")).toBeNull();
    expect(save().disabled).toBe(false);
  });

  it("describes the folder choice and the name field by the hint that shows, and names the existing folder's field apart from the choice", async () => {
    await create();
    const described = (): (string | null)[] => ["nol-radio-group.nol-teamrun-folder-choice", ".nol-teamrun-provider-name", ".nol-teamrun-profile-folder"]
      .map(t => field(t).getAttribute("aria-describedby"));

    expect(described()).toEqual(["nol-teamrun-profile-hint", "nol-teamrun-profile-hint", "nol-teamrun-profile-hint"]);
    expect(element().querySelectorAll("#nol-teamrun-profile-hint")).toHaveLength(1);
    expect(shown("#nol-teamrun-profile-hint")).toBe(true);
    expect(hint()).toContain("TeamRun makes a new folder");

    await pick("existing");

    expect(described()).toEqual(["nol-teamrun-profile-hint", "nol-teamrun-profile-hint", "nol-teamrun-profile-hint"]);
    expect(element().querySelectorAll("#nol-teamrun-profile-hint")).toHaveLength(1);
    expect(shown("#nol-teamrun-profile-hint")).toBe(true);
    expect(hint()).toContain("Choose the Codex profile");
    expect(field("nol-radio-group.nol-teamrun-folder-choice").getAttribute("aria-label")).toBe("Profile folder");
    expect(field(".nol-teamrun-profile-folder").getAttribute("aria-label")).toBe("Existing profile folder");
  });

  it("says how a new folder signs in: by TeamRun, after its install, or by the provider's login command with its profile variable in code", async () => {
    await create(t => dataFolder(t, "/home/person/.config/app/modules/teamrun")
      .answer(MethodName.ProviderKindList, () => [new ProviderKind("grok", "Grok CLI", true, true).toJson(),
        new ProviderKind("antigravity", "Antigravity", true, true).toJson(),
        new ProviderKind("claude", "Claude Code", true, false, null, new ProviderProfile("CLAUDE_CONFIG_DIR", "claude auth login")).toJson(),
        new ProviderKind("codex", "Codex", true, false, null, new ProviderProfile("CODEX_HOME")).toJson()])
      .answer(MethodName.ProviderKindInstallationList, () => [new ProviderKindInstallation("antigravity", ProviderKindInstallState.NotInstalled).toJson()]));
    await type(".nol-teamrun-provider-name", "Work");
    const hints: string[] = [];
    const code: string[][] = [];
    for (const id of ["grok", "antigravity", "claude", "codex"]) {
      kind().valueChange.emit(id);
      await settle();
      hints.push(hint());
      code.push(codes());
    }

    expect(hints).toEqual([
      "TeamRun makes the folder /home/person/.config/app/modules/teamrun/profiles/grok/Work for the provider. TeamRun then signs the provider in.",
      "TeamRun makes the folder /home/person/.config/app/modules/teamrun/profiles/antigravity/Work for the provider. Then choose Install here, then Sign in in the provider's menu.",
      "TeamRun makes the folder /home/person/.config/app/modules/teamrun/profiles/claude/Work for the provider. " +
        "TeamRun then opens a terminal where you run claude auth login, with CLAUDE_CONFIG_DIR set to that folder.",
      "TeamRun makes the folder /home/person/.config/app/modules/teamrun/profiles/codex/Work for the provider. Sign-in is managed by the provider's own application."
    ]);
    expect(code).toEqual([[], [], ["claude auth login", "CLAUDE_CONFIG_DIR"], []]);
  });

  it("names the new folder without a path while its data folder is unknown", async () => {
    await create();
    await type(".nol-teamrun-provider-name", "Work");

    expect(hint()).toBe("TeamRun makes a folder named Work for the provider in its data folder. Sign-in is managed by the provider's own application.");
    expect(context.noticeText()).toBeNull();
  });

  it("keeps the form open when the new folder already exists and shows why in the dialog only", async () => {
    const refusal = "A folder for \"Work\" already exists at \"D:\\data\\profiles\\codex\\Work\". Choose another name, or choose Existing folder and that folder.";
    await create(t => t.fail(MethodName.ProviderCreate, refusal));
    await type(".nol-teamrun-provider-name", "Work");
    await submit();

    expect(element().querySelector("nol-field-message")?.textContent?.trim()).toBe(refusal);
    expect(context.noticeText()).toBeNull();
    expect(choice("new").checked).toBe(true);
    expect(closes).toBe(0);
  });

  it("adds the provider with its trimmed name and an existing folder typed or chosen, then closes", async () => {
    await create(t => t.answer(MethodName.ProviderCreate, u => {
      const params = ProviderCreateParams.fromJson(u);
      return new Provider("a2", params.kind, params.label, params.profileDir ?? String.empty, AuthStatus.Unknown, null, null, null, null, SampleData.timestamp).toJson();
    }));

    await pick("existing");

    expect(save().disabled).toBe(true);

    await type(".nol-teamrun-provider-name", "  Second ");
    await type(".nol-teamrun-profile-folder", "  D:\\typed  ");

    expect(save().disabled).toBe(false);

    folder = "D:\\profiles\\chosen";
    field<HTMLButtonElement>(".nol-teamrun-choose-folder").click();
    await settle();

    expect(field<HTMLInputElement>(".nol-teamrun-profile-folder").value).toBe("D:\\profiles\\chosen");

    await submit();

    const params = ProviderCreateParams.fromJson(context.parametersOf(MethodName.ProviderCreate));
    expect([params.kind, params.label, params.profileDir]).toEqual(["codex", "Second", "D:\\profiles\\chosen"]);
    expect(closes).toBe(1);
    expect(store.providers().map(t => t.label)).toEqual(["Second", SampleData.provider.label]);
  });

  it("keeps a typed folder when the person cancels the folder chooser", async () => {
    await create();
    await pick("existing");
    await type(".nol-teamrun-profile-folder", "D:\\typed");

    field<HTMLButtonElement>(".nol-teamrun-choose-folder").click();
    await settle();

    expect(field<HTMLInputElement>(".nol-teamrun-profile-folder").value).toBe("D:\\typed");
  });

  it("won't add without a name, or in an existing folder without its folder", async () => {
    await create();
    await pick("existing");
    await type(".nol-teamrun-provider-name", "   ");
    await type(".nol-teamrun-profile-folder", "D:\\typed");
    await submit();

    expect(save().disabled).toBe(true);

    await type(".nol-teamrun-provider-name", "Second");
    await type(".nol-teamrun-profile-folder", "  ");
    await submit();

    expect(save().disabled).toBe(true);
    expect(context.count(MethodName.ProviderCreate)).toBe(0);
  });

  it("tells Grok in an existing folder that TeamRun signs it in, and gives a provider without its own hint the general one", async () => {
    await create(t => t.answer(MethodName.ProviderKindList, () => [new ProviderKind("grok", "Grok CLI", true, true).toJson(),
      new ProviderKind("other", "Other CLI", true).toJson()]));
    await pick("existing");

    expect(hint()).toBe(
      "Choose your Grok home (usually the .grok folder in your home directory); Grok in TeamRun uses its settings, memory, rules, MCP servers and " +
        "sign-in, shared with your own Grok CLI, so signing in here replaces its sign-in and signing out signs it out too; another folder keeps a " +
        "sign-in of its own. TeamRun signs Grok in: after adding the provider, choose Sign in in its menu.");

    kind().valueChange.emit("other");
    await settle();

    expect(hint()).toBe("Use the full path to the profile folder. Sign-in is managed by the provider's own application.");
  });

  it("ends its provider types with ACP agents, which opens the agents' list with its search focused and keeps the type chosen when closed with none added", async () => {
    await create(t => t.answer(MethodName.AcpAgentList, () => new AcpAgentListing([droid], [], null, SampleData.timestamp).toJson())
      .answer(MethodName.AcpAgentIcon, () => null));

    await openKinds(3);
    expect(listed().map(t => t.textContent?.trim())).toEqual(["Codex", "Claude Code", Resources.acpKindOption]);
    listed().at(-1)!.click();
    await Wait.until(() => expect(document.activeElement?.classList.contains("nol-teamrun-acp-search")).toBe(true));
    await Wait.until(() => expect(overlay().querySelector(".nol-teamrun-acp-agent[data-agent=\"droid\"]")).not.toBeNull());

    expect(kind().value()).toBe("codex");

    overlay().querySelector<HTMLButtonElement>(".nol-teamrun-acp-done")!.click();
    await Wait.until(() => expect(overlay().querySelector(".nol-teamrun-acp-search")).toBeNull());
    await settle();

    expect(kind().value()).toBe("codex");
    expect(hint()).toContain("TeamRun makes a new folder");
  });

  it("chooses an agent added from the ACP agents' list as the provider type, added as the Providers tab adds it", async () => {
    const added = new ProviderKind("droid", "Droid", true);
    let kinds = [SampleData.codex, SampleData.claude];
    let listing = new AcpAgentListing([droid], [], null, SampleData.timestamp);
    await create(t => t.answer(MethodName.ProviderKindList, () => kinds.map(u => u.toJson()))
      .answer(MethodName.AcpAgentList, () => listing.toJson())
      .answer(MethodName.AcpAgentIcon, () => null)
      .answer(MethodName.AcpAgentAdd, () => {
        kinds = [...kinds, added];
        listing = new AcpAgentListing([new AcpAgentEntry("droid", "Droid", "1.1.0", "Works through your tasks", null, null, false, true)], [], null, SampleData.timestamp);
        return null;
      })
      .answer(MethodName.ProviderKindInstall, () => new ProviderKindInstallation("droid", ProviderKindInstallState.Installed).toJson()));

    kind().valueChange.emit(Resources.acpRowKind);
    await Wait.until(() => expect(overlay().querySelector(".nol-teamrun-acp-agent[data-agent=\"droid\"] .nol-teamrun-acp-add")).not.toBeNull());
    overlay().querySelector<HTMLButtonElement>(".nol-teamrun-acp-agent[data-agent=\"droid\"] .nol-teamrun-acp-add")!.click();
    await Wait.until(() => expect(overlay().querySelector(".nol-teamrun-acp-agent[data-agent=\"droid\"] .nol-teamrun-acp-remove")).not.toBeNull());
    overlay().querySelector<HTMLButtonElement>(".nol-teamrun-acp-done")!.click();
    await Wait.until(() => expect(kind().value()).toBe("droid"));

    expect(AcpAgentIdParams.fromJson(context.parametersOf(MethodName.AcpAgentAdd)).id).toBe("droid");
    expect(context.count(MethodName.ProviderKindInstall)).toBe(1);
    expect(choices()).toEqual([["codex", "Codex"], ["claude", "Claude Code"], ["droid", "Droid"], [Resources.acpRowKind, Resources.acpKindOption]]);
    expect(overlay().querySelector(".nol-teamrun-acp-search")).toBeNull();
  });

  it("says in the ACP agents' list to add a provider, without sending the person to the Providers tab", async () => {
    await create(t => t.answer(MethodName.AcpAgentList, () => new AcpAgentListing([droid], [], null, SampleData.timestamp).toJson())
      .answer(MethodName.AcpAgentIcon, () => null));

    kind().valueChange.emit(Resources.acpRowKind);
    await Wait.until(() => expect(overlay().querySelector("nol-teamrun-acp-agents-dialog p[nolDialogDescription]")?.textContent?.trim())
      .toBe("Add an agent from the ACP registry, and it is installed for TeamRun alone. Then add a provider for it."));
  });

  it("waits for an add still in flight when the ACP agents' list closes on Escape, then chooses the added agent", async () => {
    const adding = new DeferredResponse();
    let kinds = [SampleData.codex, SampleData.claude];
    await create(t => t.answer(MethodName.ProviderKindList, () => kinds.map(u => u.toJson()))
      .answer(MethodName.AcpAgentList, () => new AcpAgentListing([droid], [], null, SampleData.timestamp).toJson())
      .answer(MethodName.AcpAgentIcon, () => null)
      .answer(MethodName.AcpAgentAdd, () => adding.promise)
      .answer(MethodName.ProviderKindInstall, () => new ProviderKindInstallation("droid", ProviderKindInstallState.Installed).toJson()));

    kind().valueChange.emit(Resources.acpRowKind);
    await Wait.until(() => expect(overlay().querySelector(".nol-teamrun-acp-agent[data-agent=\"droid\"] .nol-teamrun-acp-add")).not.toBeNull());
    overlay().querySelector<HTMLButtonElement>(".nol-teamrun-acp-agent[data-agent=\"droid\"] .nol-teamrun-acp-add")!.click();
    await Wait.until(() => expect(context.count(MethodName.AcpAgentAdd)).toBe(1));
    overlay().querySelector("nol-teamrun-acp-agents-dialog nol-dialog")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await Wait.until(() => expect(overlay().querySelector(".nol-teamrun-acp-search")).toBeNull());
    await settle();

    expect(kind().value()).toBe("codex");

    kinds = [...kinds, new ProviderKind("droid", "Droid", true)];
    adding.resolve(null);
    await Wait.until(() => expect(kind().value()).toBe("droid"));

    expect(choices()).toEqual([["codex", "Codex"], ["claude", "Claude Code"], ["droid", "Droid"], [Resources.acpRowKind, Resources.acpKindOption]]);
  });

  it("can't add when the runtime lists no provider", async () => {
    await create(t => t.answer(MethodName.ProviderKindList, () => []));
    await type(".nol-teamrun-provider-name", "Second");

    expect(choices()).toEqual([[Resources.acpRowKind, Resources.acpKindOption]]);
    expect(kind().value()).toBe(Resources.acpRowKind);
    expect(hint()).toBe("Choose a provider first; the hint then says where its profile folder usually is.");
    expect(save().disabled).toBe(true);

    await pick("existing");
    await type(".nol-teamrun-profile-folder", "D:\\typed");

    expect(save().disabled).toBe(true);
  });

  it("keeps the form open on a refusal and shows it in the dialog only", async () => {
    await create(t => t.fail(MethodName.ProviderCreate, "The profile folder must be an absolute path."));
    await pick("existing");
    await type(".nol-teamrun-provider-name", "Second");
    await type(".nol-teamrun-profile-folder", "profiles");
    await submit();

    expect(element().querySelector("nol-field-message")?.textContent?.trim()).toBe("The profile folder must be an absolute path.");
    expect(context.noticeText()).toBeNull();
    expect(field<HTMLInputElement>(".nol-teamrun-provider-name").value).toBe("Second");
    expect(closes).toBe(0);
  });

  it("closes from Close or Escape, but not while it adds", async () => {
    const added = new DeferredResponse();
    await create(t => t.answer(MethodName.ProviderCreate, () => added.promise));
    const dialog = fixture.debugElement.query(By.css("nol-dialog"));

    field<HTMLButtonElement>(".nol-teamrun-cancel").click();
    dialog.triggerEventHandler("dismissed");

    expect(closes).toBe(2);

    await pick("existing");
    await type(".nol-teamrun-provider-name", "Second");
    await type(".nol-teamrun-profile-folder", "D:\\typed");
    field<HTMLFormElement>("form").requestSubmit();
    await fixture.whenStable();
    dialog.triggerEventHandler("dismissed");

    expect(save().disabled).toBe(true);
    expect(field<HTMLButtonElement>(".nol-teamrun-choose-folder").disabled).toBe(true);
    expect([isDisabled(choice("new")), isDisabled(choice("existing"))]).toEqual([true, true]);
    expect(closes).toBe(2);

    added.resolve(SampleData.provider.toJson());
    await settle();

    expect(closes).toBe(3);
  });

  it("takes input only from its own fields", async () => {
    await create();
    await pick("existing");

    fixture.debugElement.query(By.css(".nol-teamrun-provider-name")).triggerEventHandler("input", { target: document.createElement("div") });
    fixture.debugElement.query(By.css(".nol-teamrun-profile-folder")).triggerEventHandler("input", { target: document.createElement("div") });
    await settle();

    expect(save().disabled).toBe(true);
  });

  it("says in Cursor's hint on a Mac that its sign-in is the keychain's, shared with the person's own Cursor CLI", async () => {
    const cursor = new ProviderKind("cursor", "Cursor", true, false, null, null, true, null, false,
      "Cursor keeps its sign-in in this Mac's keychain, which every Cursor profile shares, so TeamRun takes one Cursor provider per Mac.");
    await create(t => t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), cursor.toJson()]),
      new Provider("c1", "cursor", "Studio", "D:\\profiles\\cursor", AuthStatus.Unknown, null, null, null, null, SampleData.timestamp));

    expect(hint()).toBe(Resources.profileHintFor("cursor", true));
    expect(hint()).toContain("shared with your own Cursor CLI");
  });

  it.each([
    { platform: "Win32", file: "%USERPROFILE%\\.cursor\\mcp.json" },
    { platform: "Linux x86_64", file: "~/.cursor/mcp.json" }
  ])("names on $platform the Cursor MCP file the system's Cursor starts servers from", async ({ platform, file }) => {
    const cursor = new ProviderKind("cursor", "Cursor", true, false, null, null, true, null, false, null);
    await create(t => t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), cursor.toJson()]),
      new Provider("c1", "cursor", "Studio", "D:\\profiles\\cursor", AuthStatus.Unknown, null, null, null, null, SampleData.timestamp));
    fixture.componentRef.setInput("platform", platform);
    await settle();

    expect(hint()).toBe(Resources.profileHintFor("cursor", false, platform === "Win32"));
    expect(hint()).toContain(`in your ${file}, outside the profile.`);
  });

  it("says in fx's hint that fx in TeamRun is the person's own, one provider per computer, signed in with fx login", async () => {
    const fx = new ProviderKind("fx", "fx", true, false, null, null, false, null, false,
      "fx in TeamRun uses your own fx, with its sign-in, settings, sessions and MCP servers in .fx in your home folder, so TeamRun takes one fx provider per computer.");
    await create(t => t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), fx.toJson()]),
      new Provider("f1", "fx", "Studio", "/home/ann/.fx", AuthStatus.Unknown, null, null, null, null, SampleData.timestamp));

    expect(hint()).toBe(Resources.profileHintFor("fx", true));
    expect(Resources.profileHintFor("fx", true)).toBe(Resources.profileHintFor("fx", false));
    expect(hint()).toContain("uses your own fx");
    expect(hint()).toContain("one fx provider per computer");
    expect(hint()).toContain("run fx login, which signs in your own fx.");
  });

  it("edits a provider's name and folder, its provider fixed, with a hint on what a new folder does", async () => {
    await create(t => t.answer(MethodName.ProviderUpdate, u => {
      const params = ProviderUpdateParams.fromJson(u);
      return new Provider(params.providerId, "codex", params.label, params.profileDir, AuthStatus.Unknown, null, null, null, null, SampleData.timestamp).toJson();
    }), SampleData.provider);

    expect(element().querySelector(".nol-dialog-title")?.textContent).toBe(Resources.editProviderLabel);
    expect(element().textContent).toContain(Resources.editProviderHint);
    expect(element().querySelector("nol-radio-group")).toBeNull();
    expect(field(".nol-teamrun-profile-folder").getAttribute("aria-label")).toBe("Profile folder");
    expect(field(".nol-teamrun-profile-folder").getAttribute("aria-describedby")).toBe("nol-teamrun-profile-hint");
    expect(field(".nol-teamrun-provider-name").getAttribute("aria-describedby")).toBe("nol-teamrun-profile-hint");
    expect(hint()).toBe(Resources.profileHintFor("codex"));
    expect(save().textContent?.trim()).toBe(Resources.saveLabel);
    expect(kind().value()).toBe("codex");
    expect(kind().disabled()).toBe(true);
    expect(choices()).toEqual([["codex", "Codex"], ["claude", "Claude Code"]]);
    expect(field<HTMLInputElement>(".nol-teamrun-provider-name").value).toBe("Work");
    expect(field<HTMLInputElement>(".nol-teamrun-profile-folder").value).toBe("D:\\profiles\\codex");
    expect(save().disabled).toBe(false);

    await type(".nol-teamrun-provider-name", " Office  ");
    await type(".nol-teamrun-profile-folder", "D:\\profiles\\office ");
    await submit();

    const params = ProviderUpdateParams.fromJson(context.parametersOf(MethodName.ProviderUpdate));
    expect([params.providerId, params.label, params.profileDir]).toEqual(["a1", "Office", "D:\\profiles\\office"]);
    expect(context.count(MethodName.ProviderCreate)).toBe(0);
    expect(closes).toBe(1);
    expect(store.providers().map(t => [t.label, t.profileDir, t.authStatus])).toEqual([["Office", "D:\\profiles\\office", AuthStatus.Unknown]]);
  });

  it("edits the binary path of a provider whose type runs a chosen server, lined up with the folder, and sends it trimmed or empty", async () => {
    const chooser = new ProviderKind("antigravity", "Antigravity", true, true, null, null, false, null, false, null, false, null, null, false, false,
      { resume: false, fork: false, ownMcpServersUnavailable: null }, null, true);
    const provider = new Provider("a2", "antigravity", "Work", "D:\\profiles", AuthStatus.Unknown, null, null, null, null, SampleData.timestamp, true, false,
      "D:\\agy\\agy_acp_server.exe");
    await create(t => t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), chooser.toJson()])
      .answer(MethodName.ProviderUpdate, u => {
        const params = ProviderUpdateParams.fromJson(u);
        return provider.withBinaryPath(params.binaryPath === String.empty ? null : params.binaryPath).toJson();
      }), provider);
    const path = field<HTMLInputElement>(".nol-teamrun-binary-path");
    const left = (selector: string): number => field(selector).getBoundingClientRect().left;

    expect(path.value).toBe("D:\\agy\\agy_acp_server.exe");
    expect(path.getAttribute("aria-label")).toBe(Resources.binaryPathLabel);
    expect(path.getAttribute("aria-describedby")).toBe("nol-teamrun-binary-path-hint");
    expect(field("#nol-teamrun-binary-path-hint").textContent?.trim()).toBe(Resources.binaryPathHint);
    expect(left(".nol-teamrun-binary-path")).toBe(left(".nol-teamrun-profile-folder"));
    expect(left(".nol-teamrun-binary-path-hint")).toBe(left(".nol-teamrun-profile-folder"));

    await type(".nol-teamrun-binary-path", "  D:\\agy\\newer.exe ");
    await submit();
    expect(ProviderUpdateParams.fromJson(context.parametersOf(MethodName.ProviderUpdate)).binaryPath).toBe("D:\\agy\\newer.exe");
    expect(store.providers().find(t => t.id === "a2")?.binaryPath).toBe("D:\\agy\\newer.exe");
  });

  it("clears a chosen binary path when the field is left empty, and shows no such field for a type that runs only its own server", async () => {
    const chooser = new ProviderKind("antigravity", "Antigravity", true, true, null, null, false, null, false, null, false, null, null, false, false,
      { resume: false, fork: false, ownMcpServersUnavailable: null }, null, true);
    const provider = new Provider("a2", "antigravity", "Work", "D:\\profiles", AuthStatus.Unknown, null, null, null, null, SampleData.timestamp, true, false,
      "D:\\agy\\agy_acp_server.exe");
    await create(t => t.answer(MethodName.ProviderKindList, () => [chooser.toJson()]).answer(MethodName.ProviderUpdate, () => provider.withBinaryPath(null).toJson()),
      provider);
    await type(".nol-teamrun-binary-path", " ");
    await submit();

    expect(context.parametersOf(MethodName.ProviderUpdate)).toEqual({ providerId: "a2", label: "Work", profileDir: "D:\\profiles", binaryPath: "" });
    expect(store.providers().find(t => t.id === "a2")?.binaryPath).toBeNull();
  });

  it("shows no binary path for a type that runs only its own server, and sends none", async () => {
    await create(t => t.answer(MethodName.ProviderUpdate, u => {
      const params = ProviderUpdateParams.fromJson(u);
      return new Provider(params.providerId, "codex", params.label, params.profileDir, AuthStatus.Unknown, null, null, null, null, SampleData.timestamp).toJson();
    }), SampleData.provider);

    expect(element().querySelector(".nol-teamrun-binary-path")).toBeNull();
    await submit();
    expect(context.parametersOf(MethodName.ProviderUpdate)).toEqual({ providerId: "a1", label: "Work", profileDir: "D:\\profiles\\codex" });
  });

  it("takes the binary path only from its own field", async () => {
    const chooser = new ProviderKind("antigravity", "Antigravity", true, true, null, null, false, null, false, null, false, null, null, false, false,
      { resume: false, fork: false, ownMcpServersUnavailable: null }, null, true);
    const provider = new Provider("a2", "antigravity", "Work", "D:\\profiles", AuthStatus.Unknown, null, null, null, null, SampleData.timestamp);
    await create(t => t.answer(MethodName.ProviderKindList, () => [chooser.toJson()]).answer(MethodName.ProviderUpdate, () => provider.toJson()), provider);

    fixture.debugElement.query(By.css(".nol-teamrun-binary-path")).triggerEventHandler("input", { target: document.createElement("div") });
    await settle();
    expect(field<HTMLInputElement>(".nol-teamrun-binary-path").value).toBe("");
    await submit();

    expect(context.parametersOf(MethodName.ProviderUpdate)).toEqual({ providerId: "a2", label: "Work", profileDir: "D:\\profiles", binaryPath: "" });
  });

  it("shows no binary path while a provider is added, even of a type that runs a chosen server", async () => {
    const chooser = new ProviderKind("antigravity", "Antigravity", true, true, null, null, false, null, false, null, false, null, null, false, false,
      { resume: false, fork: false, ownMcpServersUnavailable: null }, null, true);
    await create(t => t.answer(MethodName.ProviderKindList, () => [chooser.toJson()]));

    expect(kind().value()).toBe("antigravity");
    expect(element().querySelector(".nol-teamrun-binary-path")).toBeNull();
  });

  it("keeps the edit open when the runtime refuses a folder move during a reply", async () => {
    await create(t => t.fail(MethodName.ProviderUpdate, "A reply on this provider is in progress."), SampleData.provider);
    await type(".nol-teamrun-profile-folder", "D:\\profiles\\office");
    await submit();

    expect(element().querySelector("nol-field-message")?.textContent?.trim()).toBe("A reply on this provider is in progress.");
    expect(context.noticeText()).toBeNull();
    expect(store.providers().map(t => t.profileDir)).toEqual(["D:\\profiles\\codex"]);
    expect(closes).toBe(0);
  });

  it("says under the provider type whether its tool is on this computer, and installs a missing one in a Terminals tab from Install, closing the dialog",
    async () => {
      await create(t => t.answer(MethodName.ProviderToolList, () => [new ProviderTool("codex", true, "0.98.0").toJson(),
        new ProviderTool("claude", false, null, "npm install -g claude-code").toJson()]));
      await store.refreshTools(() => undefined);
      await settle();

      expect([status(), field(".nol-teamrun-install-status").getAttribute("role")]).toEqual([Resources.formatToolFound("Codex", "0.98.0"), "status"]);
      expect(element().querySelectorAll(".nol-teamrun-install-row button")).toHaveLength(0);
      kind().valueChange.emit("claude");
      await settle();

      expect(status()).toBe(Resources.formatToolMissing("Claude Code"));
      expect(field(".nol-teamrun-install").textContent?.trim()).toBe("Install");
      field<HTMLButtonElement>(".nol-teamrun-install").click();
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));

      expect([terminals.launches[0]?.request.command, terminals.launches[0]?.request.opensTab, closes]).toEqual(["npm install -g claude-code", true, 1]);
    });

  it("installs a provider type TeamRun installs itself from Install, with Cancel while it runs, then offers Update to a newer version, keeping the dialog open",
    async () => {
      await create(t => t.answer(MethodName.ProviderKindList, () => [antigravity.toJson()])
        .answer(MethodName.ProviderKindInstallationList, () => [ownCopy(ProviderKindInstallState.NotInstalled).toJson()])
        .answer(MethodName.ProviderKindInstall, () => new Promise<never>(() => undefined))
        .answer(MethodName.ProviderKindInstallCancel, () => null));
      await store.refreshInstallations();
      await settle();

      expect(status()).toBe(Resources.formatOwnCopyMissing("Antigravity"));
      field<HTMLButtonElement>(".nol-teamrun-install").click();
      await Wait.until(() => expect(context.count(MethodName.ProviderKindInstall)).toBe(1));
      context.emit(EventName.ProviderKindInstallationChanged, ownCopy(ProviderKindInstallState.Installing, 420).toJson());
      await settle();

      expect(status()).toBe(Resources.formatInstalling(ownCopy(ProviderKindInstallState.Installing, 420)));
      expect(element().querySelector(".nol-teamrun-update")).toBeNull();
      field<HTMLButtonElement>(".nol-teamrun-cancel-install").click();
      await settle();
      expect(context.count(MethodName.ProviderKindInstallCancel)).toBe(1);
      context.emit(EventName.ProviderKindInstallationChanged, ownCopy(ProviderKindInstallState.Installed, 0, "1.3.0", "1.4.0").toJson());
      await settle();

      expect(status()).toBe(Resources.formatOwnCopyInstalled("Antigravity", "1.3.0", "1.4.0"));
      expect([element().querySelector(".nol-teamrun-install"), field(".nol-teamrun-update").textContent?.trim()]).toEqual([null, "Update"]);
      field<HTMLButtonElement>(".nol-teamrun-update").click();
      await Wait.until(() => expect(context.count(MethodName.ProviderKindInstall)).toBe(2));
      context.emit(EventName.ProviderKindInstallationChanged, ownCopy(ProviderKindInstallState.Installing, 420, "1.3.0").toJson());
      await settle();

      expect([element().querySelector(".nol-teamrun-install"), element().querySelectorAll(".nol-teamrun-update").length, closes]).toEqual([null, 1, 0]);
    });

  it("shows a failed install, cancel or subscription page in the dialog only", async () => {
    await create(t => t.answer(MethodName.ProviderKindList, () => [antigravity.toJson(), SampleData.claude.toJson()])
      .answer(MethodName.ProviderKindInstallationList, () => [ownCopy(ProviderKindInstallState.NotInstalled).toJson()])
      .answer(MethodName.ProviderToolList, () => [new ProviderTool("claude", true, "2.1.211", null, "https://example.com/pricing").toJson()])
      .fail(MethodName.ProviderKindInstall, "The download failed.")
      .fail(MethodName.ProviderKindInstallCancel, "The install had already ended."));
    await Promise.all([store.refreshInstallations(), store.refreshTools(() => undefined)]);
    await settle();
    const error = (): string => element().querySelector(".nol-teamrun-dialog-error")?.textContent?.trim() ?? "";

    field<HTMLButtonElement>(".nol-teamrun-install").click();
    await Wait.until(() => expect(error()).toBe("The download failed."));
    context.emit(EventName.ProviderKindInstallationChanged, ownCopy(ProviderKindInstallState.Installing, 420).toJson());
    await settle();
    field<HTMLButtonElement>(".nol-teamrun-cancel-install").click();
    await Wait.until(() => expect(error()).toBe("The install had already ended."));
    kind().valueChange.emit("claude");
    await settle();
    context.linkFailure = "No browser is set.";
    field<HTMLButtonElement>(".nol-teamrun-subscribe").click();
    await Wait.until(() => expect(error()).toBe("No browser is set."));

    expect([context.links, context.shownNotices(), closes]).toEqual([["https://example.com/pricing"], [], 0]);
  });

  it("offers Get a subscription for a provider type with no provider yet, opening its page", async () => {
    await create(t => t.answer(MethodName.ProviderToolList, () => [new ProviderTool("claude", true, "2.1.211", null, "https://example.com/pricing").toJson()]));
    await store.refreshTools(() => undefined);
    kind().valueChange.emit("claude");
    await settle();

    expect(field(".nol-teamrun-subscribe").textContent?.trim()).toBe("Get a subscription");
    field<HTMLButtonElement>(".nol-teamrun-subscribe").click();
    await settle();
    expect(context.links).toEqual(["https://example.com/pricing"]);
  });

  it("opens a subscription's page in the system's browser while the in-app browser places links in the app", async () => {
    await create(t => t.answer(MethodName.ProviderToolList, () => [new ProviderTool("claude", true, "2.1.211", null, "https://example.com/pricing").toJson()]));
    const browser = { placeFor: (): LinkPlace => LinkPlace.InApp, openAsync: (): Promise<void> => Promise.resolve() };
    context.registerInAppBrowser(browser);
    await store.refreshTools(() => undefined);
    kind().valueChange.emit("claude");
    await settle();

    field<HTMLButtonElement>(".nol-teamrun-subscribe").click();
    await settle();

    expect([context.links, context.linkPlaces.map(t => t ?? browser.placeFor())]).toEqual([["https://example.com/pricing"], [LinkPlace.System]]);
  });

  it("opens a subscription's page with how the person opened it, a click, Ctrl+click or a middle click, and not with the right button", async () => {
    await create(t => t.answer(MethodName.ProviderToolList, () => [new ProviderTool("claude", true, "2.1.211", null, "https://example.com/pricing").toJson()]));
    await store.refreshTools(() => undefined);
    kind().valueChange.emit("claude");
    await settle();
    const subscribe = field<HTMLButtonElement>(".nol-teamrun-subscribe");

    subscribe.dispatchEvent(new MouseEvent("click", { button: 0, bubbles: true }));
    subscribe.dispatchEvent(new MouseEvent("click", { button: 0, ctrlKey: true, bubbles: true }));
    subscribe.dispatchEvent(new MouseEvent("auxclick", { button: 1, bubbles: true }));
    subscribe.dispatchEvent(new MouseEvent("auxclick", { button: 2, bubbles: true }));
    await settle();

    expect([context.links, context.linkGestures]).toEqual([Array(3).fill("https://example.com/pricing"), [LinkGesture.Plain, LinkGesture.Modified, LinkGesture.Middle]]);
  });

  it("shows no install line while it edits a provider", async () => {
    await create(() => undefined, SampleData.provider);

    expect(element().querySelector(".nol-teamrun-install-row")).toBeNull();
  });

  describe.each([
    { look: "the fixture theme", mode: ThemeMode.Light, forcedColors: "none" },
    { look: "dark", mode: ThemeMode.Dark, forcedColors: "none" },
    { look: "forced colors", mode: ThemeMode.Light, forcedColors: "active" }
  ])("in $look", ({ mode, forcedColors }) => {
    const space = (step: number): number => AppearanceFixture.measureLook(`space-${step}`);
    const box = (target: Element): DOMRect => target.getBoundingClientRect();

    beforeAll(() => EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors));

    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

    afterEach(() => AppearanceFixture.reset());

    afterAll(() => EmulatedMediaFixture.resetAsync());

    it("spaces the form's parts, a field's label, list, input, folder choice and folder button, and the profile hint's own row by the spacing scale, to the form's edges", async () => {
      await create();
      const form = (): DOMRect => box(field<HTMLFormElement>("form"));
      const formPart = (position: number): DOMRect => box(field(`form > :nth-child(${position})`));
      const [hintLine, kindField, nameField] = [formPart(1), formPart(2), formPart(3)];
      const label = box(field("label.nol-teamrun-field .nol-teamrun-field-label"));
      const providerKindList = box(field("nol-select.nol-teamrun-kind"));
      const name = box(field(".nol-teamrun-provider-name"));
      const folderLabel = box(field("form > :nth-child(4) > .nol-teamrun-field-label"));
      const [newFolder, existingFolder] = [box(choice("new")), box(choice("existing"))];
      const [newText, existingText] = [box(field(".nol-teamrun-new-folder .nol-radio-text")), box(field(".nol-teamrun-existing-folder .nol-radio-text"))];
      const choices = box(field("nol-radio-group.nol-teamrun-folder-choice"));

      AppearanceFixture.expectPixels(kindField.top - hintLine.bottom, space(3));
      AppearanceFixture.expectPixels(nameField.top - kindField.bottom, space(3));
      AppearanceFixture.expectPixels(formPart(4).top - nameField.bottom, space(3));
      AppearanceFixture.expectPixels(name.top - label.bottom, space(1));
      AppearanceFixture.expectPixels(providerKindList.left, form().left);
      AppearanceFixture.expectPixels(providerKindList.right, form().right);
      AppearanceFixture.expectPixels(name.left, form().left);
      AppearanceFixture.expectPixels(name.right, form().right);
      AppearanceFixture.expectPixels(choices.top - folderLabel.bottom, space(1));
      AppearanceFixture.expectPixels(newFolder.left, form().left);
      AppearanceFixture.expectPixels(existingFolder.left, form().left);
      AppearanceFixture.expectPixels(newText.left - newFolder.right, space(2));
      AppearanceFixture.expectPixels(existingText.left, newText.left);
      AppearanceFixture.expectPixels(existingText.top - newText.bottom, space(2));
      AppearanceFixture.expectPixels(box(field("#nol-teamrun-profile-hint")).top - choices.bottom, space(3));
      AppearanceFixture.expectPixels(box(field("#nol-teamrun-profile-hint")).left, form().left);

      await pick("existing");
      const folder = box(field(".nol-teamrun-profile-folder"));
      const choose = box(field(".nol-teamrun-choose-folder"));
      const folderHint = box(field("#nol-teamrun-profile-hint"));

      AppearanceFixture.expectPixels(Math.min(folder.top, choose.top) - box(field("nol-radio-group.nol-teamrun-folder-choice")).bottom, space(2));
      AppearanceFixture.expectPixels(folder.left, form().left);
      AppearanceFixture.expectPixels(choose.left - folder.right, space(2));
      AppearanceFixture.expectPixels(choose.right, form().right);
      AppearanceFixture.expectPixels(folderHint.top - Math.max(folder.bottom, choose.bottom), space(3));
      AppearanceFixture.expectPixels(folderHint.left, form().left);
    });

    it("keeps the form's height and the folder choice in place as the person switches between New folder and Existing folder", async () => {
      await create(t => t.answer(MethodName.ProviderKindList, () => [new ProviderKind("claude", "Claude Code", true, false, null,
        new ProviderProfile("CLAUDE_CONFIG_DIR", "claude auth login")).toJson()]));
      await type(".nol-teamrun-provider-name", "Work");
      const place = (): number[] => [box(field("form")).height, box(choice("new")).top, box(choice("existing")).top];
      const placed = place();

      await pick("existing");
      const existing = place();
      await pick("new");
      const back = place();

      existing.forEach((value, index) => AppearanceFixture.expectPixels(value, placed[index]!));
      back.forEach((value, index) => AppearanceFixture.expectPixels(value, placed[index]!));
    });

    it("keeps the form's height and the folder choice in place when the name leaves no character a folder name can use", async () => {
      await create();
      await type(".nol-teamrun-provider-name", " . . ");
      const place = (): number[] => [box(field("form")).height, box(choice("new")).top, box(choice("existing")).top];
      const placed = place();

      await pick("existing");
      const existing = place();
      await pick("new");
      const back = place();

      existing.forEach((value, index) => AppearanceFixture.expectPixels(value, placed[index]!));
      back.forEach((value, index) => AppearanceFixture.expectPixels(value, placed[index]!));
    });

    it("puts a name's reason a quarter rem under the name field, to the form's edges, and the folder field three steps below it", async () => {
      await create();
      await type(".nol-teamrun-provider-name", " . . ");
      const form = box(field("form"));
      const name = box(field(".nol-teamrun-provider-name"));
      const message = box(field(".nol-teamrun-name-message"));

      AppearanceFixture.expectPixels(message.top - name.bottom, space(1));
      AppearanceFixture.expectPixels(message.left, form.left);
      AppearanceFixture.expectPixels(message.right, form.right);
      AppearanceFixture.expectPixels(box(field("form > :nth-child(4)")).top - message.bottom, space(3));
    });

    it("keeps the edit's folder row right under its label, with no folder choice", async () => {
      await create(() => undefined, SampleData.provider);
      const form = box(field<HTMLFormElement>("form"));
      const folderLabel = box(field("form > :nth-child(4) > .nol-teamrun-field-label"));
      const folder = box(field(".nol-teamrun-profile-folder"));
      const choose = box(field(".nol-teamrun-choose-folder"));

      AppearanceFixture.expectPixels(Math.min(folder.top, choose.top) - folderLabel.bottom, space(1));
      AppearanceFixture.expectPixels(folder.left, form.left);
      AppearanceFixture.expectPixels(choose.right, form.right);
    });

    it("lines the ACP agents entry up with the provider types above it, one row high, at the list's end", async () => {
      await create();
      await openKinds(3);
      const [codex, claude, acp] = listed().map(t => box(t));
      const titles = listed().map(t => box(t.querySelector(".nol-select-option-title")!));

      AppearanceFixture.expectPixels(acp!.left, codex!.left);
      AppearanceFixture.expectPixels(acp!.right, codex!.right);
      AppearanceFixture.expectPixels(acp!.height, codex!.height);
      AppearanceFixture.expectPixels(acp!.top, claude!.bottom);
      AppearanceFixture.expectPixels(titles[2]!.left, titles[0]!.left);
      expect(listed().at(-1)!.querySelector<HTMLElement>(".nol-select-option-title")!.scrollWidth)
        .toBeLessThanOrEqual(listed().at(-1)!.querySelector<HTMLElement>(".nol-select-option-title")!.clientWidth);
      field<HTMLButtonElement>("nol-select.nol-teamrun-kind .nol-select-button").click();
      await Wait.until(() => expect(listed()).toHaveLength(0));
    });

    it("puts Close as a text button before Add provider, half a rem apart, with Add provider at the end of the actions", async () => {
      await create();

      DialogActionsFixture.expectCloseThenPrimary(element(), ".nol-teamrun-save");
    });

    it("puts the install line a quarter rem under the provider type, its status on the form's start edge and its button at the end edge, centred on the status",
      async () => {
        await create(t => t.answer(MethodName.ProviderKindList, () => [antigravity.toJson()])
          .answer(MethodName.ProviderKindInstallationList, () => [ownCopy(ProviderKindInstallState.Installed, 0, "1.3.0", "1.4.0").toJson()]));
        await store.refreshInstallations();
        await settle();
        const form = box(field("form"));
        const line = box(field(".nol-teamrun-install-row"));
        const shown = box(field(".nol-teamrun-install-status"));
        const update = box(field(".nol-teamrun-update"));

        AppearanceFixture.expectPixels(line.top - box(field("nol-select.nol-teamrun-kind")).bottom, space(1));
        AppearanceFixture.expectPixels(shown.left, form.left);
        AppearanceFixture.expectPixels(update.right, form.right);
        expect(update.left - shown.right).toBeGreaterThanOrEqual(space(2) - 0.5);
        expect(Math.abs(shown.top + shown.height / 2 - (update.top + update.height / 2))).toBeLessThanOrEqual(1);
        expect(field(".nol-teamrun-update").classList).toContain("nol-button-outlined");
      });
  });

  describe("under forced colours and at 200% zoom", () => {
    it("keeps every control, state and focus ring in the provider dialog visible under forced colours", async () => {
      await create();
      await pick("existing");
      await AccessibilityFixture.expectVisibleForcedAsync(element());
      expect(AccessibilityFixture.popups(element())).toBeGreaterThan(0);
    });

    it("neither cuts, crosses nor loses a control in the provider dialog at 200% zoom", async () => {
      await create();
      await pick("existing");
      await AccessibilityFixture.expectFitsZoomedAsync(element(), settle);
    });
  });

  describe("by keyboard and screen reader", () => {
    it("reaches every control in the provider dialog by keyboard, with a visible ring", async () => {
      await create();
      await pick("existing");
      expect(await AccessibilityFixture.expectKeyboardAsync(element())).toBeGreaterThan(0);
    });

    it("names every control, dialog, list and image in the provider dialog", async () => {
      await create();
      await pick("existing");
      expect(AccessibilityFixture.expectNamed(element())).toBeGreaterThan(0);
    });
  });
});
