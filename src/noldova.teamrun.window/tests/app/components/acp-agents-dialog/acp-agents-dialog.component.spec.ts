/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";

import "@noldova/context.core";
import {
  AcpAgentEntry,
  AcpAgentIdParams,
  AcpAgentListing,
  AcpLocalCommandAddParams,
  EventName,
  MethodName,
  ProviderKindInstallation,
  ProviderKindInstallState,
  ProviderKindParams
} from "@noldova/teamrun.protocol";
import { DefaultTheme, DialogTokens, LinkGesture, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { page } from "vitest/browser";

import { AcpAgentsDialogComponent } from "../../../../src/app/components/acp-agents-dialog/acp-agents-dialog.component";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { Resources } from "../../../../src/resources";
import { AccessibilityFixture } from "../../../fixtures/accessibility.fixture";
import { DeferredResponse } from "../../../fixtures/deferred-response.fixture";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import { FakeTerminalLauncher } from "../../../fixtures/fake-terminal-launcher.fixture";
import type { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("AcpAgentsDialogComponent", () => {
  const icon = "data:image/svg+xml;base64,PHN2Zy8+";
  const droid = new AcpAgentEntry("droid", "Droid", "1.1.0", "Works through your tasks", "https://example.com/droid", null, false, false);
  const devin = new AcpAgentEntry("devin", "Devin", "3.0.0", "A software agent", null, null, true, true);
  const plain = new AcpAgentEntry("plain", "Plain", "", "", null, "Plain has no build for this computer.", false, false);
  const mine = new AcpAgentEntry("local-mine", "Mine", "", "", null, null, false, true);
  let context: FakeWindowPartContext;
  let store: ChatStoreService;
  let fixture: ComponentFixture<AcpAgentsDialogComponent>;
  let closes: number;
  let listing: AcpAgentListing;

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await fixture.whenStable();
  };
  const part = <T extends Element>(selector: string, within: ParentNode = element()): T => {
    const found = within.querySelector<T>(selector);
    if (Object.isNull(found))
      throw new Error(`The dialog shows no ${selector}.`);
    return found;
  };
  const all = <T extends Element>(selector: string): T[] => [...element().querySelectorAll<T>(selector)];
  const texts = (selector: string, within: ParentNode = element()): string[] => [...within.querySelectorAll(selector)].map(t => t.textContent?.trim() ?? "");
  const row = (id: string): HTMLElement => part(`.nol-teamrun-acp-agent[data-agent="${id}"]`);
  const names = (): string[] => texts(".nol-teamrun-acp-list:first-of-type .nol-teamrun-acp-name");
  const click = async (selector: string, within: ParentNode = element()): Promise<void> => {
    part<HTMLButtonElement>(selector, within).click();
    await settle();
  };
  const type = async (target: HTMLInputElement | HTMLTextAreaElement, value: string): Promise<void> => {
    target.value = value;
    target.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
  };
  const fill = (selector: string, value: string): Promise<void> => type(part(selector), value);
  const box = (target: Element): DOMRect => target.getBoundingClientRect();
  const mark = (id: string): HTMLElement => part<HTMLElement>(".nol-teamrun-acp-mark", row(id));
  const resolve = (token: string): string => {
    const probe = document.body.appendChild(document.createElement("span"));
    probe.style.color = `var(${token})`;
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  };
  const expectWholeLabels = (within: Element): void => {
    for (const label of within.querySelectorAll(".nol-teamrun-acp-actions button .nol-button-label"))
      expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth);
  };
  const create = async (configure: (target: FakeWindowPartContext) => void = () => undefined): Promise<void> => {
    context = SampleData.createContext();
    listing = new AcpAgentListing([droid, devin, plain], [mine], null, SampleData.timestamp);
    context.answer(MethodName.AcpAgentList, () => listing.toJson());
    context.answer(MethodName.AcpAgentIcon, t => AcpAgentIdParams.fromJson(t).id === droid.id ? icon : null);
    context.answer(MethodName.AcpAgentAdd, () => null);
    context.answer(MethodName.AcpAgentRemove, () => null);
    context.answer(MethodName.AcpLocalCommandAdd, () => null);
    context.answer(MethodName.ProviderKindInstall, () => new ProviderKindInstallation(droid.id, ProviderKindInstallState.Installed).toJson());
    configure(context);
    TestBed.configureTestingModule({ providers: [{ provide: DialogTokens.titleId, useValue: "nol-teamrun-dialog-title" }] });
    store = new ChatStoreService(context, new FakeTerminalLauncher());
    await store.initialize();
    fixture = TestBed.createComponent(AcpAgentsDialogComponent);
    fixture.componentRef.setInput("store", store);
    closes = 0;
    fixture.componentInstance.closed.subscribe(() => closes++);
    fixture.autoDetectChanges();
    await Wait.until(() => expect(context.count(MethodName.AcpAgentList)).toBe(1));
    await settle();
  };
  const fillForm = async (): Promise<void> => {
    await click(".nol-teamrun-acp-local-open");
    await fill(".nol-teamrun-acp-local-name", "Tool");
    await fill(".nol-teamrun-acp-local-command", "tool");
  };
  const submit = (): Promise<void> => click(".nol-teamrun-acp-local-add");

  afterEach(() => {
    store.dispose();
    AppearanceFixture.reset();
  });

  it("lists each agent with its icon or letter, version, description and why it can't install", async () => {
    await create();

    expect(names()).toEqual(["Droid", "Devin", "Plain"]);
    await Wait.until(() => expect(mark("droid").style.maskImage).toBe(`url("${icon}")`));
    expect(mark("droid").getAttribute("aria-hidden")).toBe("true");
    expect(row("droid").querySelector("img")).toBeNull();
    expect(texts(".nol-teamrun-acp-letter", row("devin"))).toEqual(["D"]);
    expect(texts(".nol-teamrun-acp-version", row("droid"))).toEqual(["1.1.0"]);
    expect(texts(".nol-teamrun-acp-description", row("droid"))).toEqual(["Works through your tasks"]);
    expect(row("plain").querySelector(".nol-teamrun-acp-version")).toBeNull();
    expect(row("plain").querySelector(".nol-teamrun-acp-description")).toBeNull();
    expect(texts(".nol-teamrun-acp-unavailable", row("plain"))).toEqual(["Plain has no build for this computer."]);
    expect(row("droid").querySelector(".nol-teamrun-acp-unavailable")).toBeNull();
    expect(part<HTMLButtonElement>(".nol-teamrun-acp-add", row("plain")).disabled).toBe(true);
    expect(part<HTMLButtonElement>(".nol-teamrun-acp-add", row("droid")).disabled).toBe(false);
    expect(part(".nol-teamrun-acp-add", row("droid")).getAttribute("aria-label")).toBe(Resources.formatKindAction(Resources.acpAddLabel, "Droid"));
    expect(row("droid").querySelector(".nol-teamrun-acp-remove")).toBeNull();
    expect(row("devin").querySelector(".nol-teamrun-acp-add")).toBeNull();
    expect(row("devin").querySelector(".nol-teamrun-acp-about")).toBeNull();
    expect(element().querySelector(".nol-teamrun-acp-failure")).toBeNull();
  });

  it("masks only an SVG icon, and shows a raster icon as an image of the same size", async () => {
    const raster = "data:image/png;base64,iVBORw0KGgo=";
    await create(t => t.answer(MethodName.AcpAgentIcon, u => new Map([["droid", icon], ["devin", raster]]).get(AcpAgentIdParams.fromJson(u).id) ?? null));
    await Wait.until(() => expect(row("devin").querySelector("img")).not.toBeNull());

    expect(mark("droid").style.maskImage).toBe(`url("${icon}")`);
    expect(row("droid").querySelector("img")).toBeNull();
    expect(part<HTMLImageElement>("img.nol-teamrun-acp-icon", row("devin")).getAttribute("src")).toBe(raster);
    expect(part<HTMLImageElement>("img.nol-teamrun-acp-icon", row("devin")).getAttribute("alt")).toBe("");
    expect(row("devin").querySelector(".nol-teamrun-acp-mark")).toBeNull();
    expect(row("devin").querySelector(".nol-teamrun-acp-letter")).toBeNull();
    AppearanceFixture.expectPixels(box(part("img.nol-teamrun-acp-icon", row("devin"))).width, box(mark("droid")).width);
    AppearanceFixture.expectPixels(box(part("img.nol-teamrun-acp-icon", row("devin"))).height, box(mark("droid")).height);
  });

  it("labels a download whose hash the registry doesn't list, and only that one", async () => {
    await create();

    expect(texts(".nol-teamrun-acp-not-checked", row("devin"))).toEqual([Resources.acpNotCheckedLabel]);
    expect(part(".nol-teamrun-acp-not-checked", row("devin")).getAttribute("title")).toBe(Resources.acpNotCheckedHint);
    expect(row("droid").querySelector(".nol-teamrun-acp-not-checked")).toBeNull();
  });

  it("opens an agent's page, and shows a page that won't open in its error line", async () => {
    await create();

    await click(".nol-teamrun-acp-about", row("droid"));
    expect(context.links).toEqual(["https://example.com/droid"]);
    expect(element().querySelector(".nol-teamrun-acp-error")).toBeNull();

    context.linkFailure = "No browser opens links.";
    await click(".nol-teamrun-acp-about", row("droid"));
    await Wait.until(() => expect(texts(".nol-teamrun-acp-error")).toEqual(["No browser opens links."]));
  });

  it("opens an agent's page with how the person opened it, a click, Ctrl+click or a middle click, and not with the right button", async () => {
    await create();
    const about = part<HTMLButtonElement>(".nol-teamrun-acp-about", row("droid"));

    about.dispatchEvent(new MouseEvent("click", { button: 0, bubbles: true }));
    about.dispatchEvent(new MouseEvent("click", { button: 0, ctrlKey: true, bubbles: true }));
    about.dispatchEvent(new MouseEvent("auxclick", { button: 1, bubbles: true }));
    about.dispatchEvent(new MouseEvent("auxclick", { button: 2, bubbles: true }));
    await settle();

    expect([context.links, context.linkGestures]).toEqual([Array(3).fill("https://example.com/droid"), [LinkGesture.Plain, LinkGesture.Modified, LinkGesture.Middle]]);
  });

  it("narrows the list by name or description, ignoring case, and says when nothing matches", async () => {
    await create();
    const search = part<HTMLInputElement>(".nol-teamrun-acp-search");

    await type(search, "  DEV ");
    expect(names()).toEqual(["Devin"]);
    await type(search, "tasks");
    expect(names()).toEqual(["Droid"]);
    await type(search, "nothing like it");
    expect(texts(".nol-teamrun-acp-none")).toEqual([Resources.acpNoAgentsText]);
    await type(search, "");
    expect(names()).toEqual(["Droid", "Devin", "Plain"]);
    expect(element().querySelector(".nol-teamrun-acp-none")).toBeNull();
  });

  it("says the list is old and why", async () => {
    await create(() => {
      listing = new AcpAgentListing([droid], [], "The registry didn't answer.", SampleData.timestamp);
    });

    expect(texts(".nol-teamrun-acp-failure")).toEqual([Resources.formatAcpListOld("The registry didn't answer.")]);
    expect(names()).toEqual(["Droid"]);
  });

  it("shows a list it can't read in the error line, with no empty-list text", async () => {
    await create(t => t.fail(MethodName.AcpAgentList, "The list can't be read."));

    await Wait.until(() => expect(texts(".nol-teamrun-acp-error")).toEqual(["The list can't be read."]));
    expect(element().querySelector(".nol-teamrun-acp-none")).toBeNull();
  });

  it("adds an agent, its button busy at its own size while it works, then starts its install and reads the list again", async () => {
    const adding = new DeferredResponse();
    await create(t => t.answer(MethodName.AcpAgentAdd, () => adding.promise));
    const kinds = context.count(MethodName.ProviderKindList);
    const idle = box(part(".nol-teamrun-acp-add", row("droid")));

    await click(".nol-teamrun-acp-add", row("droid"));
    const add = part<HTMLButtonElement>(".nol-teamrun-acp-add", row("droid"));
    expect([add.getAttribute("aria-busy"), add.disabled]).toEqual(["true", false]);
    expect(add.querySelector("nol-spinner")).not.toBeNull();
    expect(part(".nol-teamrun-acp-actions", row("droid")).querySelectorAll("nol-spinner")).toHaveLength(1);
    AppearanceFixture.expectPixels(box(add).width, idle.width);
    AppearanceFixture.expectPixels(box(add).height, idle.height);
    await click(".nol-teamrun-acp-add", row("droid"));
    expect(context.count(MethodName.AcpAgentAdd)).toBe(1);
    expect(part<HTMLButtonElement>(".nol-teamrun-acp-add", row("plain")).disabled).toBe(true);
    expect(context.count(MethodName.ProviderKindInstall)).toBe(0);
    listing = new AcpAgentListing([new AcpAgentEntry(droid.id, droid.name, droid.version, droid.description, null, null, false, true)], [], null, SampleData.timestamp);
    adding.resolve(null);

    await Wait.until(() => expect(part<HTMLButtonElement>(".nol-teamrun-acp-remove", row("droid")).disabled).toBe(false));
    expect(AcpAgentIdParams.fromJson(context.parametersOf(MethodName.AcpAgentAdd)).id).toBe("droid");
    expect(context.count(MethodName.AcpAgentList)).toBe(2);
    expect(context.count(MethodName.ProviderKindList)).toBe(kinds + 1);
    expect(context.count(MethodName.ProviderKindInstall)).toBe(1);
  });

  it("shows a refused add in the error line and asks for no install", async () => {
    await create(t => t.fail(MethodName.AcpAgentAdd, "Droid can't be added."));

    await click(".nol-teamrun-acp-add", row("droid"));

    await Wait.until(() => expect(texts(".nol-teamrun-acp-error")).toEqual(["Droid can't be added."]));
    expect(context.count(MethodName.ProviderKindInstall)).toBe(0);
    await Wait.until(() => expect(part(".nol-teamrun-acp-add", row("droid")).getAttribute("aria-busy")).toBeNull());
    expect(part<HTMLButtonElement>(".nol-teamrun-acp-add", row("droid")).disabled).toBe(false);
    await click(".nol-teamrun-acp-add", row("droid"));
    await Wait.until(() => expect(context.count(MethodName.AcpAgentAdd)).toBe(2));
  });

  it("ends Add's busy state and offers it again when its install is refused or fails", async () => {
    await create(t => t.fail(MethodName.ProviderKindInstall, "Droid can't be installed."));

    await click(".nol-teamrun-acp-add", row("droid"));

    await Wait.until(() => expect(texts(".nol-teamrun-acp-error")).toEqual(["Droid can't be installed."]));
    await Wait.until(() => expect(part(".nol-teamrun-acp-add", row("droid")).getAttribute("aria-busy")).toBeNull());
    context.emit(EventName.ProviderKindInstallationChanged, new ProviderKindInstallation(droid.id, ProviderKindInstallState.Installing, null, 25, 100).toJson());
    await Wait.until(() => expect(part(".nol-teamrun-acp-add", row("droid")).getAttribute("aria-busy")).toBe("true"));
    context.emit(EventName.ProviderKindInstallationChanged,
      new ProviderKindInstallation(droid.id, ProviderKindInstallState.NotInstalled, "The download stopped.").toJson());
    await Wait.until(() => expect(part(".nol-teamrun-acp-add", row("droid")).getAttribute("aria-busy")).toBeNull());
    const add = part<HTMLButtonElement>(".nol-teamrun-acp-add", row("droid"));

    expect([add.disabled, row("droid").querySelector(".nol-teamrun-acp-progress"), row("droid").querySelector("nol-spinner")]).toEqual([false, null, null]);
    await click(".nol-teamrun-acp-add", row("droid"));
    await Wait.until(() => expect(context.count(MethodName.AcpAgentAdd)).toBe(2));
  });

  it("keeps the focus on Add from its click through the install it starts", async () => {
    const adding = new DeferredResponse();
    await create(t => t.answer(MethodName.AcpAgentAdd, () => adding.promise));
    const add = part<HTMLButtonElement>(".nol-teamrun-acp-add", row("droid"));
    add.focus();

    await click(".nol-teamrun-acp-add", row("droid"));
    expect([add.getAttribute("aria-busy"), document.activeElement === add]).toEqual(["true", true]);
    context.emit(EventName.ProviderKindInstallationChanged, new ProviderKindInstallation(droid.id, ProviderKindInstallState.Installing, null, 25, 100).toJson());
    adding.resolve(null);
    await Wait.until(() => expect(context.count(MethodName.AcpAgentList)).toBe(2));
    await settle();

    expect(part(".nol-teamrun-acp-add", row("droid"))).toBe(add);
    expect([add.getAttribute("aria-busy"), texts(".nol-teamrun-acp-progress", row("droid")), document.activeElement === add])
      .toEqual(["true", ["Installing… 25%"], true]);
  });

  it("moves the focus to the Remove that takes Add's place once an add ends, and to the Add that takes Remove's place once a remove ends", async () => {
    await create();
    const before = listing;
    listing = new AcpAgentListing([new AcpAgentEntry(droid.id, droid.name, droid.version, droid.description, null, null, false, true), devin, plain], [mine], null,
      SampleData.timestamp);
    part<HTMLButtonElement>(".nol-teamrun-acp-add", row("droid")).focus();

    await click(".nol-teamrun-acp-add", row("droid"));
    await Wait.until(() => expect(row("droid").querySelector(".nol-teamrun-acp-remove")).not.toBeNull());
    await settle();
    const added = document.activeElement === part(".nol-teamrun-acp-remove", row("droid"));
    listing = before;
    await click(".nol-teamrun-acp-remove", row("droid"));
    await Wait.until(() => expect(row("droid").querySelector(".nol-teamrun-acp-add")).not.toBeNull());
    await settle();

    expect([added, document.activeElement === part(".nol-teamrun-acp-add", row("droid"))]).toEqual([true, true]);
  });

  it("removes an agent and a local command, and clears an old error when it tries again", async () => {
    const removed: string[] = [];
    await create(t => t.answer(MethodName.AcpAgentRemove, u => {
      removed.push(AcpAgentIdParams.fromJson(u).id);
      return null;
    }));

    await click(".nol-teamrun-acp-remove", row("devin"));
    await Wait.until(() => expect(part<HTMLButtonElement>(".nol-teamrun-acp-remove", row("devin")).disabled).toBe(false));
    await click(".nol-teamrun-acp-remove", row("local-mine"));
    await Wait.until(() => expect(removed).toEqual(["devin", "local-mine"]));

    context.fail(MethodName.AcpAgentRemove, "A provider still uses Devin.");
    await Wait.until(() => expect(part<HTMLButtonElement>(".nol-teamrun-acp-remove", row("local-mine")).disabled).toBe(false));
    await click(".nol-teamrun-acp-remove", row("devin"));
    await Wait.until(() => expect(texts(".nol-teamrun-acp-error")).toEqual(["A provider still uses Devin."]));

    context.answer(MethodName.AcpAgentRemove, () => null);
    await Wait.until(() => expect(part<HTMLButtonElement>(".nol-teamrun-acp-remove", row("devin")).disabled).toBe(false));
    await click(".nol-teamrun-acp-remove", row("devin"));
    await Wait.until(() => expect(element().querySelector(".nol-teamrun-acp-error")).toBeNull());
  });

  it("lists local commands by their letter, and shows no such list when there are none", async () => {
    await create();
    expect(texts(".nol-teamrun-acp-name", row("local-mine"))).toEqual(["Mine"]);
    expect(texts(".nol-teamrun-acp-letter", row("local-mine"))).toEqual(["M"]);
    expect(all(".nol-teamrun-acp-list")).toHaveLength(2);
    store.dispose();
    fixture.destroy();
    TestBed.resetTestingModule();

    await create(() => {
      listing = new AcpAgentListing([droid], [], null, SampleData.timestamp);
    });

    expect(all(".nol-teamrun-acp-list")).toHaveLength(1);
  });

  it("adds a local command with its values saved as secrets, sending only their references", async () => {
    await create();

    await click(".nol-teamrun-acp-local-open");
    await fill(".nol-teamrun-acp-local-name", " Tool ");
    await fill(".nol-teamrun-acp-local-command", " tool ");
    await fill(".nol-teamrun-acp-local-arguments", " --acp \n\n--verbose\n");
    await click(".nol-teamrun-acp-variable-add");
    await click(".nol-teamrun-acp-variable-add");
    await type(all<HTMLInputElement>(".nol-teamrun-acp-variable-name")[0]!, "TOOL_KEY");
    await type(all<HTMLInputElement>(".nol-teamrun-acp-variable-value")[0]!, "first value");
    await type(all<HTMLInputElement>(".nol-teamrun-acp-variable-name")[1]!, "TOOL_OTHER");
    await type(all<HTMLInputElement>(".nol-teamrun-acp-variable-value")[1]!, "second value");
    expect(all<HTMLInputElement>(".nol-teamrun-acp-variable-name")[0]!.value).toBe("TOOL_KEY");
    expect(all<HTMLInputElement>(".nol-teamrun-acp-variable-value")[0]!.value).toBe("first value");
    expect(all<HTMLInputElement>(".nol-teamrun-acp-variable-value")[0]!.type).toBe("password");
    await submit();

    await Wait.until(() => expect(element().querySelector(".nol-teamrun-acp-form")).toBeNull());
    const parameters = context.parametersOf(MethodName.AcpLocalCommandAdd);
    const sent = AcpLocalCommandAddParams.fromJson(parameters);
    expect([sent.name, sent.command, sent.arguments]).toEqual(["Tool", "tool", ["--acp", "--verbose"]]);
    expect(sent.secrets.map(t => t.variable)).toEqual(["TOOL_KEY", "TOOL_OTHER"]);
    expect(sent.secrets.map(t => context.secretStore.values.get(t.reference))).toEqual(["first value", "second value"]);
    expect(JSON.stringify(parameters)).not.toContain("first value");
    expect(JSON.stringify(parameters)).not.toContain("second value");

    await click(".nol-teamrun-acp-local-open");
    expect(part<HTMLInputElement>(".nol-teamrun-acp-local-name").value).toBe("");
    expect(part<HTMLInputElement>(".nol-teamrun-acp-local-command").value).toBe("");
    expect(part<HTMLTextAreaElement>(".nol-teamrun-acp-local-arguments").value).toBe("");
    expect(all(".nol-teamrun-acp-variable")).toHaveLength(0);
  });

  it("takes a variable back and keeps the others' fields", async () => {
    await create();
    await fillForm();
    await click(".nol-teamrun-acp-variable-add");
    await click(".nol-teamrun-acp-variable-add");
    await type(all<HTMLInputElement>(".nol-teamrun-acp-variable-name")[0]!, "FIRST");
    await type(all<HTMLInputElement>(".nol-teamrun-acp-variable-value")[0]!, "one");
    await type(all<HTMLInputElement>(".nol-teamrun-acp-variable-name")[1]!, "SECOND");
    await type(all<HTMLInputElement>(".nol-teamrun-acp-variable-value")[1]!, "two");

    all<HTMLButtonElement>(".nol-teamrun-acp-variable-remove")[0]!.click();
    await settle();

    expect(part<HTMLInputElement>(".nol-teamrun-acp-variable-name").value).toBe("SECOND");
    expect(part<HTMLInputElement>(".nol-teamrun-acp-variable-value").value).toBe("two");
    await submit();
    await Wait.until(() => expect(context.count(MethodName.AcpLocalCommandAdd)).toBe(1));
    expect(AcpLocalCommandAddParams.fromJson(context.parametersOf(MethodName.AcpLocalCommandAdd)).secrets.map(t => t.variable)).toEqual(["SECOND"]);
    expect(context.secretStore.values.size).toBe(1);
  });

  it("says what a local command's form is missing and sends nothing until it's right", async () => {
    await create();
    await click(".nol-teamrun-acp-local-open");
    const check = async (message: string): Promise<void> => {
      await submit();
      expect(texts(".nol-teamrun-acp-error")).toEqual([message]);
      expect(context.count(MethodName.AcpLocalCommandAdd)).toBe(0);
      expect(context.secretStore.values.size).toBe(0);
    };

    await check(Resources.acpLocalNameRequired);
    await fill(".nol-teamrun-acp-local-name", "Tool");
    await check(Resources.acpLocalCommandRequired);
    await fill(".nol-teamrun-acp-local-command", "tool");
    await click(".nol-teamrun-acp-variable-add");
    await check(Resources.formatAcpLocalVariableInvalid(""));
    await fill(".nol-teamrun-acp-variable-name", "NOT-A-NAME");
    await check(Resources.formatAcpLocalVariableInvalid("NOT-A-NAME"));
    await fill(".nol-teamrun-acp-variable-name", "KEY");
    await check(Resources.acpLocalValueRequired);
    await click(".nol-teamrun-acp-variable-add");
    await type(all<HTMLInputElement>(".nol-teamrun-acp-variable-name")[1]!, "KEY");
    await check(Resources.acpLocalVariableRepeated);
  });

  it("forgets the values it saved, keeps the form and shows the reason when the command is refused", async () => {
    await create(t => t.fail(MethodName.AcpLocalCommandAdd, "The command can't be added."));
    await fillForm();
    await click(".nol-teamrun-acp-variable-add");
    await fill(".nol-teamrun-acp-variable-name", "KEY");
    await fill(".nol-teamrun-acp-variable-value", "value");

    await submit();

    await Wait.until(() => expect(texts(".nol-teamrun-acp-error")).toEqual(["The command can't be added."]));
    const sent = AcpLocalCommandAddParams.fromJson(context.parametersOf(MethodName.AcpLocalCommandAdd));
    expect(context.secretStore.removed).toEqual([sent.secrets[0]!.reference]);
    expect(context.secretStore.values.size).toBe(0);
    expect(part<HTMLInputElement>(".nol-teamrun-acp-local-name").value).toBe("Tool");
  });

  it("closes the form on Cancel, forgetting what was typed in it, and the dialog on Done", async () => {
    await create();
    await fillForm();
    await fill(".nol-teamrun-acp-local-arguments", "agent.js");
    await click(".nol-teamrun-acp-variable-add");
    await fill(".nol-teamrun-acp-variable-name", "TOOL_KEY");
    await fill(".nol-teamrun-acp-variable-value", "typed");
    expect(element().querySelector(".nol-teamrun-acp-local-open")).toBeNull();

    await click(".nol-teamrun-acp-local-cancel");
    expect(element().querySelector(".nol-teamrun-acp-form")).toBeNull();
    expect(element().querySelector(".nol-teamrun-acp-local-open")).not.toBeNull();
    expect(closes).toBe(0);
    await click(".nol-teamrun-acp-local-open");
    expect([".nol-teamrun-acp-local-name", ".nol-teamrun-acp-local-command", ".nol-teamrun-acp-local-arguments"].map(t => part<HTMLInputElement>(t).value)).toEqual(["", "", ""]);
    expect(element().querySelectorAll(".nol-teamrun-acp-variable")).toHaveLength(0);
    await click(".nol-teamrun-acp-local-cancel");

    await click(".nol-teamrun-acp-done");
    expect(closes).toBe(1);
  });

  it("shows an added agent's install as its busy Add with the progress beside it and Cancel in Remove's place while it can be cancelled, and asks the runtime to stop it",
    async () => {
    await create(t => t.answer(MethodName.ProviderKindInstallCancel, () => null));
    context.emit(EventName.ProviderKindInstallationChanged, new ProviderKindInstallation(devin.id, ProviderKindInstallState.Installing, null, 25, 100).toJson());
    await Wait.until(() => expect(row("devin").querySelector(".nol-teamrun-acp-cancel-install")).not.toBeNull());
    const cancel = part<HTMLButtonElement>(".nol-teamrun-acp-cancel-install", row("devin"));

    expect([cancel.textContent?.trim(), cancel.getAttribute("aria-label")])
      .toEqual([Resources.cancelInstallLabel, Resources.formatKindAction(Resources.cancelInstallLabel, "Devin")]);
    expect(row("devin").querySelector(".nol-teamrun-acp-remove")).toBeNull();
    expect(row("droid").querySelector("nol-spinner")).toBeNull();
    const progress = part(".nol-teamrun-acp-progress", row("devin"));
    const add = part<HTMLButtonElement>(".nol-teamrun-acp-add", row("devin"));
    expect([progress.textContent?.trim(), progress.getAttribute("role")]).toEqual(["Installing… 25%", "status"]);
    expect([add.getAttribute("aria-busy"), add.getAttribute("aria-label")]).toEqual(["true", Resources.formatKindAction(Resources.acpAddLabel, "Devin")]);
    expect(part(".nol-teamrun-acp-actions", row("devin")).querySelectorAll("nol-spinner")).toHaveLength(1);
    expect(add.querySelector("nol-spinner")).not.toBeNull();
    expect([box(progress).right <= box(add).left || box(progress).bottom <= box(add).top, box(add).right <= box(cancel).left || box(add).bottom <= box(cancel).top])
      .toEqual([true, true]);
    expect(box(cancel).right).toBeLessThanOrEqual(box(row("devin")).right);
    expectWholeLabels(row("devin"));
    await click(".nol-teamrun-acp-cancel-install", row("devin"));
    await Wait.until(() => expect(context.count(MethodName.ProviderKindInstallCancel)).toBe(1));
    expect(ProviderKindParams.fromJson(context.parametersOf(MethodName.ProviderKindInstallCancel)).kind).toBe("devin");

    context.emit(EventName.ProviderKindInstallationChanged,
      new ProviderKindInstallation(devin.id, ProviderKindInstallState.Installing, null, 100, 100, null, null, false).toJson());
    await settle();
    expect(row("devin").querySelector(".nol-teamrun-acp-cancel-install")).toBeNull();
    expect(texts(".nol-teamrun-acp-progress", row("devin"))).toEqual(["Installing… setting up"]);
    expect(part(".nol-teamrun-acp-add", row("devin")).getAttribute("aria-busy")).toBe("true");
    context.emit(EventName.ProviderKindInstallationChanged, new ProviderKindInstallation(devin.id, ProviderKindInstallState.Installed).toJson());
    await settle();

    expect(row("devin").querySelector("nol-spinner")).toBeNull();
    expect(row("devin").querySelector(".nol-teamrun-acp-progress")).toBeNull();
    expect(row("devin").querySelector(".nol-teamrun-acp-remove")).not.toBeNull();
  });

  it("shows a cancel that fails in the error line", async () => {
    await create(t => t.fail(MethodName.ProviderKindInstallCancel, "The install had already ended."));
    context.emit(EventName.ProviderKindInstallationChanged, new ProviderKindInstallation(devin.id, ProviderKindInstallState.Installing, null, 25, 100).toJson());
    await Wait.until(() => expect(row("devin").querySelector(".nol-teamrun-acp-cancel-install")).not.toBeNull());

    await click(".nol-teamrun-acp-cancel-install", row("devin"));

    await Wait.until(() => expect(texts(".nol-teamrun-acp-error")).toEqual(["The install had already ended."]));
  });

  describe.each([
    { look: "light", mode: ThemeMode.Light, forcedColors: "none" },
    { look: "dark", mode: ThemeMode.Dark, forcedColors: "none" },
    { look: "forced colors", mode: ThemeMode.Light, forcedColors: "active" }
  ])("in $look", ({ mode, forcedColors }) => {
    beforeAll(() => EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors));

    afterAll(() => EmulatedMediaFixture.resetAsync());

    it("sets an install's progress on its busy Add's label line, one small space before it, and keeps Add at its idle size", async () => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      await create();
      const idle = box(part(".nol-teamrun-acp-add", row("droid")));
      context.emit(EventName.ProviderKindInstallationChanged, new ProviderKindInstallation(droid.id, ProviderKindInstallState.Installing, null, 25, 100).toJson());
      await Wait.until(() => expect(row("droid").querySelector(".nol-teamrun-acp-progress")).not.toBeNull());
      const progress = part(".nol-teamrun-acp-progress", row("droid"));
      const add = part(".nol-teamrun-acp-add", row("droid"));
      const label = part(".nol-button-label", add);
      const space = AppearanceFixture.measureLook("space-2");

      expect([matchMedia("(forced-colors: active)").matches, add.getAttribute("aria-busy")]).toEqual([forcedColors === "active", "true"]);
      AppearanceFixture.expectPixels(box(add).width, idle.width);
      AppearanceFixture.expectPixels(box(add).height, idle.height);
      expect([getComputedStyle(progress).fontSize, getComputedStyle(progress).lineHeight])
        .toEqual([getComputedStyle(label).fontSize, getComputedStyle(label).lineHeight]);
      AppearanceFixture.expectPixels(box(progress).top + box(progress).height / 2, box(label).top + box(label).height / 2);
      AppearanceFixture.expectPixels(box(add).left - box(progress).right, space);
      expect(space).toBeGreaterThan(0);
      expect(progress.scrollWidth).toBeLessThanOrEqual(progress.clientWidth);
    });
  });

  it("reads again only the icons it doesn't have yet", async () => {
    await create();
    await Wait.until(() => expect(element().querySelector(".nol-teamrun-acp-mark")).not.toBeNull());
    expect(context.count(MethodName.AcpAgentIcon)).toBe(3);

    await click(".nol-teamrun-acp-remove", row("devin"));
    await Wait.until(() => expect(context.count(MethodName.AcpAgentIcon)).toBe(5));

    expect(mark("droid").style.maskImage).toBe(`url("${icon}")`);
  });

  it("settles an added local command without waiting on the icons it reads again, and shows them when they come", async () => {
    await create();
    await Wait.until(() => expect(context.count(MethodName.AcpAgentIcon)).toBe(3));
    const icons = new DeferredResponse();
    context.answer(MethodName.AcpAgentIcon, () => icons.promise);
    let settled = false;

    await fillForm();
    await submit();
    await Wait.until(() => expect(context.count(MethodName.AcpAgentIcon)).toBe(5));
    void fixture.componentInstance.settled().then(() => {
      settled = true;
    });

    await Wait.until(() => expect(settled).toBe(true));
    expect(all(".nol-teamrun-acp-mark")).toHaveLength(1);
    icons.resolve(icon);
    await Wait.until(() => expect(all(".nol-teamrun-acp-mark")).toHaveLength(3));
  });

  for (const mode of [ThemeMode.Light, ThemeMode.Dark]) {
    it(`fills a registry icon with the theme's text colour, the row's own, in ${mode} mode`, async () => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      await create();
      await Wait.until(() => expect(element().querySelector(".nol-teamrun-acp-mark")).not.toBeNull());
      const style = getComputedStyle(mark("droid"));

      expect(style.backgroundColor).toBe(resolve("--nol-text"));
      expect(style.backgroundColor).toBe(getComputedStyle(part(".nol-teamrun-acp-name", row("droid"))).color);
      expect([style.maskSize, style.maskRepeat, style.maskPosition]).toEqual(["contain", "no-repeat", "50% 50%"]);
      AppearanceFixture.expectPixels(box(mark("droid")).width, box(part(".nol-teamrun-acp-letter", row("devin"))).width);
      AppearanceFixture.expectPixels(box(mark("droid")).height, box(part(".nol-teamrun-acp-letter", row("devin"))).height);
    });
  }

  it("fills a registry icon with the forced text colour under forced colours", async () => {
    await EmulatedMediaFixture.emulateAsync("forced-colors", "active");
    try {
      AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Dark);
      await create();
      await Wait.until(() => expect(element().querySelector(".nol-teamrun-acp-mark")).not.toBeNull());

      expect(getComputedStyle(mark("droid")).backgroundColor).toBe(getComputedStyle(part(".nol-teamrun-acp-name", row("droid"))).color);
      const canvas = document.body.appendChild(document.createElement("span"));
      canvas.style.backgroundColor = "Canvas";
      const ground = getComputedStyle(canvas).backgroundColor;
      canvas.remove();
      expect(getComputedStyle(mark("droid")).backgroundColor).not.toBe(ground);
    } finally {
      await EmulatedMediaFixture.resetAsync();
    }
  });

  for (const mode of [ThemeMode.Light, ThemeMode.Dark]) {
    it(`lines its rows up with its text and keeps them inside the dialog in ${mode} mode`, async () => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      await create();
      await click(".nol-teamrun-acp-local-open");
      await click(".nol-teamrun-acp-variable-add");
      const body = part<HTMLElement>(".nol-teamrun-acp-agents");
      const start = box(part(".nol-teamrun-acp-search")).left;
      const end = box(part(".nol-teamrun-acp-search")).right;
      const size = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);

      for (const selector of [".nol-teamrun-acp-muted", ".nol-teamrun-acp-heading", ".nol-teamrun-acp-field"])
        AppearanceFixture.expectPixels(box(part(selector, body)).left, start);
      for (const id of ["droid", "devin", "plain", "local-mine"]) {
        const shown = row(id);
        const first = box(part(".nol-teamrun-acp-icon", shown));
        AppearanceFixture.expectPixels(first.left, start);
        AppearanceFixture.expectPixels(box(shown).right, end);
        AppearanceFixture.expectPixels(box([...shown.querySelectorAll(".nol-teamrun-acp-actions button")].at(-1)!).right, end);
        expectWholeLabels(shown);
        AppearanceFixture.expectPixels(first.width, 2 * size);
        AppearanceFixture.expectPixels(first.height, 2 * size);
        AppearanceFixture.expectPixels(box(part(".nol-teamrun-acp-text", shown)).left, first.right + AppearanceFixture.measureLook("space-3"));
      }
      for (const field of [".nol-teamrun-acp-local-name", ".nol-teamrun-acp-local-command", ".nol-teamrun-acp-local-arguments"]) {
        AppearanceFixture.expectPixels(box(part(field)).left, start);
        AppearanceFixture.expectPixels(box(part(field)).right, end);
      }
      AppearanceFixture.expectPixels(box(part(".nol-teamrun-acp-local-add")).right, end);
      AppearanceFixture.expectPixels(box(part(".nol-teamrun-acp-variable-remove")).right, end);
      expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth);
      const heading = part<HTMLElement>(".nol-teamrun-acp-heading");
      expect(box(heading).top - box(heading.previousElementSibling!).bottom).toBeGreaterThan(2 * (box(heading.nextElementSibling!).top - box(heading).bottom));
      expect(getComputedStyle(heading).fontSize).toBe(getComputedStyle(part(".nol-dialog-title")).fontSize);
      expect(getComputedStyle(part(".nol-teamrun-acp-not-checked", row("devin"))).color).not.toBe(getComputedStyle(part(".nol-teamrun-acp-name", row("devin"))).color);
    });
  }

  it("puts a row's actions under its text on a narrow window, with nothing past the dialog's edge", async () => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    await page.viewport(360, 640);
    try {
      AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Light);
      await create(() => {
        listing = new AcpAgentListing([new AcpAgentEntry("long", "A".repeat(80), "1.0.0", "B".repeat(200), "https://example.com/long", null, true, false)], [], null, null);
      });
      const body = part<HTMLElement>(".nol-teamrun-acp-agents");
      const long = row("long");

      expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth);
      expect(box(part(".nol-teamrun-acp-actions", long)).top).toBeGreaterThanOrEqual(box(part(".nol-teamrun-acp-text", long)).bottom - 0.5);
      AppearanceFixture.expectPixels(box(part(".nol-teamrun-acp-actions", long)).right, box(long).right);
      expect(box(part(".nol-teamrun-acp-text", long)).right).toBeLessThanOrEqual(box(long).right + 0.5);
      expectWholeLabels(long);
    }
    finally {
      await page.viewport(viewport.width, viewport.height);
    }
  });

  describe("under forced colours and at 200% zoom", () => {
    it("keeps every control, state and focus ring in the ACP agents dialog visible under forced colours", async () => {
      await create();
      await click(".nol-teamrun-acp-local-open");
      await AccessibilityFixture.expectVisibleForcedAsync(element());
      expect(AccessibilityFixture.popups(element())).toBeGreaterThan(0);
    });

    it("neither cuts, crosses nor loses a control in the ACP agents dialog at 200% zoom", async () => {
      await create();
      await click(".nol-teamrun-acp-local-open");
      await AccessibilityFixture.expectFitsZoomedAsync(element(), settle);
    });
  });

  describe("by keyboard and screen reader", () => {
    it("reaches every control in the ACP agents dialog by keyboard, with a visible ring", async () => {
      await create();
      await click(".nol-teamrun-acp-local-open");
      expect(await AccessibilityFixture.expectKeyboardAsync(element())).toBeGreaterThan(0);
    });

    it("names every control, dialog, list and image in the ACP agents dialog", async () => {
      await create();
      await click(".nol-teamrun-acp-local-open");
      expect(AccessibilityFixture.expectNamed(element())).toBeGreaterThan(0);
    });
  });
});
