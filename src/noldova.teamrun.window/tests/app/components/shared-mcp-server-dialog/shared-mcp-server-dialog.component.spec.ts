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
import type { JsonValue } from "@noldova/context.json";
import {
  MethodName,
  Resources as ProtocolResources,
  SharedMcpAccount,
  SharedMcpHeader,
  SharedMcpSecretSetParams,
  SharedMcpServer,
  SharedMcpServerDefinition,
  SharedMcpServerUpdateParams,
  SharedMcpTransport,
  SharedMcpVariable,
  SharedMcpVariableSource
} from "@noldova/teamrun.protocol";
import { Announcer, AnnouncementPoliteness, DialogTokens, SelectComponent, SelectOption, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";

import { SharedMcpServerDialogComponent } from "../../../../src/app/components/shared-mcp-server-dialog/shared-mcp-server-dialog.component";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { TimeFormatService } from "../../../../src/app/services/time-format.service";
import { Resources } from "../../../../src/resources";
import { AccessibilityFixture } from "../../../fixtures/accessibility.fixture";
import { DeferredResponse } from "../../../fixtures/deferred-response.fixture";
import { DialogActionsFixture } from "../../../fixtures/dialog-actions.fixture";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("SharedMcpServerDialogComponent", () => {
  const docs = new SharedMcpServer("s1", new SharedMcpServerDefinition("docs", SharedMcpTransport.Stdio, "npx", ["docs-mcp", "--stdio"], ["DOCS_KEY"], null, [], null),
    ["a1"], [], SampleData.timestamp, SampleData.timestamp);
  const tracker = new SharedMcpServer("s2", new SharedMcpServerDefinition("tracker", SharedMcpTransport.Http, null, [], [], "https://tracker.example/mcp",
    [new SharedMcpHeader("X-Team", "TRACKER_TEAM")], "TRACKER_TOKEN"), [], [], SampleData.timestamp, SampleData.timestamp);
  const value = "typed-secret-4b7e";
  const refusal = "This machine has no keyring to keep secrets.";
  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<SharedMcpServerDialogComponent>;
  let closes: boolean[];

  const element = (): HTMLElement => {
    const native: unknown = fixture.nativeElement;
    if (!(native instanceof HTMLElement))
      throw new Error("The dialog has no element.");
    return native;
  };
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await fixture.whenStable();
  };
  const field = <T extends HTMLElement>(selector: string): T => {
    const found = element().querySelector<T>(selector);
    if (Object.isNull(found))
      throw new Error(`The dialog shows no ${selector}.`);
    return found;
  };
  const type = async (name: string, text: string): Promise<void> => {
    const input = field<HTMLInputElement | HTMLTextAreaElement>(`.nol-teamrun-shared-mcp-${name}`);
    input.value = text;
    input.dispatchEvent(new Event("input"));
    await settle();
  };
  const choose = async (transport: SharedMcpTransport): Promise<void> => {
    fixture.debugElement.query(By.css("nol-select.nol-teamrun-shared-mcp-transport")).injector.get(SelectComponent).valueChange.emit(transport);
    await settle();
  };
  const save = (): HTMLButtonElement => field<HTMLButtonElement>(".nol-teamrun-save");
  const sent = (method: MethodName): JsonValue[] => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(method)).map(t => t.parameters);
  const rows = (): HTMLElement[] => [...element().querySelectorAll<HTMLElement>(".nol-teamrun-shared-mcp-value")];
  const rowOf = (variable: string): HTMLElement => {
    const found = rows().find(t => t.querySelector(".nol-teamrun-field-label")?.textContent?.trim() === variable);
    if (Object.isUndefined(found))
      throw new Error(`The dialog shows no value for ${variable}.`);
    return found;
  };
  const sourceOf = (variable: string): SelectComponent => {
    const found = fixture.debugElement.queryAll(By.css("nol-select.nol-teamrun-shared-mcp-source"))
      .find(t => t.nativeElement instanceof Node && rowOf(variable).contains(t.nativeElement));
    if (Object.isUndefined(found))
      throw new Error(`The dialog shows no choice for ${variable}.`);
    return found.injector.get(SelectComponent);
  };
  const pick = async (variable: string, source: SharedMcpVariableSource): Promise<void> => {
    sourceOf(variable).valueChange.emit(source);
    await settle();
  };
  const secretOf = (variable: string): HTMLInputElement | null => rowOf(variable).querySelector<HTMLInputElement>(".nol-teamrun-shared-mcp-secret");
  const enter = async (variable: string, text: string): Promise<void> => {
    const input = secretOf(variable);
    if (Object.isNull(input))
      throw new Error(`The dialog shows no field for ${variable}.`);
    input.value = text;
    input.dispatchEvent(new Event("input"));
    await settle();
  };
  const stateOf = (variable: string): (string | null)[] => {
    const row = rowOf(variable);
    return [sourceOf(variable).value(), row.querySelector(".nol-teamrun-shared-mcp-saved")?.textContent?.trim() ?? null,
      row.querySelector(".nol-teamrun-shared-mcp-not-set")?.textContent?.trim() ?? null, secretOf(variable)?.value ?? null];
  };
  const secretSets = (): SharedMcpSecretSetParams[] => sent(MethodName.SharedMcpSecretSet).map(t => SharedMcpSecretSetParams.fromJson(t));
  const create = async (server: SharedMcpServer | null, configure: (context: FakeWindowPartContext) => void = () => undefined,
    variables: readonly SharedMcpVariable[] = []): Promise<void> => {
    context = SampleData.createContext()
      .answer(MethodName.SharedMcpServerCreate, t => new SharedMcpServer("s9", SharedMcpServerDefinition.fromJson(t), [], [], SampleData.timestamp,
        SampleData.timestamp).toJson())
      .answer(MethodName.SharedMcpServerUpdate, t => {
        const params = SharedMcpServerUpdateParams.fromJson(t);
        return new SharedMcpServer(params.serverId, params.definition, [], [], SampleData.timestamp, SampleData.timestamp).toJson();
      })
      .answer(MethodName.SharedMcpSecretSet, () => docs.toJson());
    configure(context);
    TestBed.configureTestingModule({ providers: [{ provide: DialogTokens.titleId, useValue: "nol-teamrun-dialog-title" }] });
    const store = ChatStoreService.of(context);
    await Wait.until(() => expect(store.loaded()).toBe(true));
    fixture = TestBed.createComponent(SharedMcpServerDialogComponent);
    fixture.componentRef.setInput("store", store);
    fixture.componentRef.setInput("server", server);
    fixture.componentRef.setInput("variables", variables);
    closes = [];
    fixture.componentInstance.closed.subscribe(t => closes.push(t));
    fixture.autoDetectChanges();
    await settle();
  };

  it("adds a stdio server from its name, its command, one argument and one variable a line, without blank lines", async () => {
    await create(null);

    expect(field(".nol-dialog-title").textContent?.trim()).toBe(Resources.addSharedMcpServerTitle);
    expect([element().querySelector(".nol-teamrun-shared-mcp-url"), element().querySelector(".nol-teamrun-shared-mcp-headers")]).toEqual([null, null]);
    await type("name", " docs ");
    await type("command", "npx");
    await type("arguments", "docs-mcp\n\n --stdio \n");
    await type("variables", "DOCS_KEY\nDOCS_REGION\n");
    save().click();

    await Wait.until(() => expect(closes).toEqual([true]));
    expect(sent(MethodName.SharedMcpServerCreate)).toEqual([new SharedMcpServerDefinition("docs", SharedMcpTransport.Stdio, "npx", ["docs-mcp", "--stdio"],
      ["DOCS_KEY", "DOCS_REGION"], null, [], null).toJson()]);
  });

  it("adds an HTTP server from its address, each header as its name and variable, and its bearer token's variable", async () => {
    await create(null);

    await type("name", "tracker");
    await choose(SharedMcpTransport.Http);
    expect([element().querySelector(".nol-teamrun-shared-mcp-command"), element().querySelector(".nol-teamrun-shared-mcp-variables")]).toEqual([null, null]);
    await type("url", "https://tracker.example/mcp");
    await type("headers", "X-Team: TRACKER_TEAM\nX-Region:TRACKER_REGION");
    await type("bearer", "TRACKER_TOKEN");
    save().click();

    await Wait.until(() => expect(closes).toEqual([true]));
    expect(sent(MethodName.SharedMcpServerCreate)).toEqual([new SharedMcpServerDefinition("tracker", SharedMcpTransport.Http, null, [], [], "https://tracker.example/mcp",
      [new SharedMcpHeader("X-Team", "TRACKER_TEAM"), new SharedMcpHeader("X-Region", "TRACKER_REGION")], "TRACKER_TOKEN").toJson()]);
  });

  it("adds an HTTP server that signs in with OAuth, with no bearer token", async () => {
    const signsIn = (): HTMLInputElement => field<HTMLInputElement>(".nol-teamrun-shared-mcp-signs-in input[type='checkbox']");
    await create(null);

    await type("name", "wiki");
    await choose(SharedMcpTransport.Http);
    await type("url", "https://wiki.example/mcp");
    await type("bearer", "WIKI_TOKEN");
    const before = [signsIn().checked, element().querySelector(".nol-teamrun-shared-mcp-bearer") !== null];
    signsIn().click();
    await settle();
    const after = [signsIn().checked, element().querySelector(".nol-teamrun-shared-mcp-bearer"), rows().length];
    save().click();
    await Wait.until(() => expect(closes).toEqual([true]));

    expect(before).toEqual([false, true]);
    expect(after).toEqual([true, null, 0]);
    expect(field("#nol-teamrun-shared-mcp-signs-in-hint").textContent?.trim()).toBe(Resources.sharedMcpSignsInHint);
    expect(sent(MethodName.SharedMcpServerCreate)).toEqual([new SharedMcpServerDefinition("wiki", SharedMcpTransport.Http, null, [], [], "https://wiki.example/mcp",
      [], null, true).toJson()]);
  });

  it("edits a server that signs in with the OAuth choice on and no bearer token, and shows the bearer token again once it's off", async () => {
    const signsIn = (): HTMLInputElement => field<HTMLInputElement>(".nol-teamrun-shared-mcp-signs-in input[type='checkbox']");
    await create(new SharedMcpServer("s3", new SharedMcpServerDefinition("wiki", SharedMcpTransport.Http, null, [], [], "https://wiki.example/mcp", [], null, true),
      [], [], SampleData.timestamp, SampleData.timestamp));
    expect([signsIn().checked, element().querySelector(".nol-teamrun-shared-mcp-bearer")]).toEqual([true, null]);
    signsIn().click();
    await settle();
    expect([signsIn().checked, element().querySelector(".nol-teamrun-shared-mcp-bearer") !== null]).toEqual([false, true]);
  });

  it("shows under the OAuth choice why a server that signs in can't take an Authorization header, until the choice changes", async () => {
    const signsIn = (): HTMLInputElement => field<HTMLInputElement>(".nol-teamrun-shared-mcp-signs-in input[type='checkbox']");
    await create(null);
    await type("name", "wiki");
    await choose(SharedMcpTransport.Http);
    await type("url", "https://wiki.example/mcp");
    await type("headers", "Authorization: WIKI_TOKEN");
    signsIn().click();
    await settle();
    save().click();
    await settle();

    const refusal = field(".nol-teamrun-field-refusal");
    expect([refusal.textContent?.trim(), refusal.id]).toEqual([Resources.sharedMcpSignsInRefusal, "nol-teamrun-shared-mcp-signsIn-message"]);
    expect(sent(MethodName.SharedMcpServerCreate)).toEqual([]);
    signsIn().click();
    await settle();
    expect(element().querySelector(".nol-teamrun-field-refusal")).toBeNull();
  });

  it("keeps the account a server signs in with through an edit, and shows under the headers why it takes no Authorization header", async () => {
    const github = new SharedMcpServer("s4", SharedMcpServerDefinition.gitHub, [], [], SampleData.timestamp, SampleData.timestamp);
    await create(github);
    await type("headers", "Authorization: GITHUB_TOKEN");
    save().click();
    await settle();
    const refusal = field(".nol-teamrun-field-refusal");
    const refused = [refusal.textContent?.trim(), refusal.id, sent(MethodName.SharedMcpServerUpdate)];
    await type("headers", "X-Team: GITHUB_TEAM");
    save().click();
    await settle();

    expect(refused).toEqual([Resources.sharedMcpAccountRefusal, "nol-teamrun-shared-mcp-headers-message", []]);
    const params = SharedMcpServerUpdateParams.fromJson(sent(MethodName.SharedMcpServerUpdate)[0]);
    expect([params.serverId, params.definition.account, params.definition.url]).toEqual(["s4", SharedMcpAccount.GitHub, ProtocolResources.gitHubMcpServerUrl]);
  });

  it("locks the address of a server that signs in with GitHub, so an edit can't send its token elsewhere", async () => {
    const github = new SharedMcpServer("s4", SharedMcpServerDefinition.gitHub, [], [], SampleData.timestamp, SampleData.timestamp);
    await create(github);
    const url = field<HTMLInputElement>(".nol-teamrun-shared-mcp-url");
    const hint = field(`#${url.getAttribute("aria-describedby") ?? String.empty}`);
    await type("url", "https://example.com/mcp/");
    save().click();
    await settle();

    expect([url.readOnly, hint.textContent?.trim()]).toEqual([true, Resources.sharedMcpAccountUrlHint]);
    const params = SharedMcpServerUpdateParams.fromJson(sent(MethodName.SharedMcpServerUpdate)[0]);
    expect([params.definition.url, params.definition.account]).toEqual([ProtocolResources.gitHubMcpServerUrl, SharedMcpAccount.GitHub]);
  });

  it("leaves the address of a server with no account open to edits", async () => {
    await create(new SharedMcpServer("s5", new SharedMcpServerDefinition("docs", SharedMcpTransport.Http, null, [], [], "https://docs.example.com/mcp", [], null),
      [], [], SampleData.timestamp, SampleData.timestamp));
    const url = field<HTMLInputElement>(".nol-teamrun-shared-mcp-url");
    await type("url", "https://docs.example.org/mcp");
    save().click();
    await settle();

    expect([url.readOnly, url.getAttribute("aria-describedby")]).toEqual([false, null]);
    expect(SharedMcpServerUpdateParams.fromJson(sent(MethodName.SharedMcpServerUpdate)[0]).definition.url).toBe("https://docs.example.org/mcp");
  });

  it("keeps its type when the type list reports one it doesn't offer", async () => {
    await create(null);

    await choose(SharedMcpTransport.Http);
    fixture.debugElement.query(By.css("nol-select.nol-teamrun-shared-mcp-transport")).injector.get(SelectComponent).valueChange.emit("sse");
    await settle();

    expect([element().querySelector(".nol-teamrun-shared-mcp-url") !== null, element().querySelector(".nol-teamrun-shared-mcp-command")]).toEqual([true, null]);
  });

  it("keeps a field's value when an input event comes from something that isn't a text field", async () => {
    await create(docs);

    fixture.debugElement.query(By.css(".nol-teamrun-shared-mcp-name")).triggerEventHandler("input", { target: document.createElement("div") });
    fixture.debugElement.query(By.css(".nol-teamrun-shared-mcp-arguments")).triggerEventHandler("input", { target: document.createElement("div") });
    await settle();

    expect([field<HTMLInputElement>(".nol-teamrun-shared-mcp-name").value, field<HTMLTextAreaElement>(".nol-teamrun-shared-mcp-arguments").value])
      .toEqual(["docs", "docs-mcp\n--stdio"]);
  });

  it("keeps Save off until the server has a name and a command, or an address once it is HTTP", async () => {
    await create(null);

    expect(save().disabled).toBe(true);
    await type("name", "docs");
    expect(save().disabled).toBe(true);
    await type("command", "npx");
    expect(save().disabled).toBe(false);
    await choose(SharedMcpTransport.Http);
    expect(save().disabled).toBe(true);
    await type("url", "https://tracker.example/mcp");
    expect(save().disabled).toBe(false);
    await type("name", "  ");
    expect(save().disabled).toBe(true);
  });

  it.each([
    { kind: "stdio", server: docs, fields: { name: "docs", command: "npx", arguments: "docs-mcp\n--stdio", variables: "DOCS_KEY" } },
    { kind: "HTTP", server: tracker, fields: { name: "tracker", url: "https://tracker.example/mcp", headers: "X-Team: TRACKER_TEAM", bearer: "TRACKER_TOKEN" } }
  ])("edits a $kind server with its fields filled in, and saves it under its id", async ({ server, fields }) => {
    await create(server);

    expect(field(".nol-dialog-title").textContent?.trim()).toBe(Resources.editSharedMcpServerTitle);
    expect(Object.fromEntries(Object.keys(fields).map(t => [t, field<HTMLInputElement>(`.nol-teamrun-shared-mcp-${t}`).value]))).toEqual(fields);
    await type("name", `${server.definition.name}-2`);
    save().click();

    await Wait.until(() => expect(closes).toEqual([true]));
    const params = SharedMcpServerUpdateParams.fromJson(sent(MethodName.SharedMcpServerUpdate)[0]);
    expect([params.serverId, params.definition.name]).toEqual([server.id, `${server.definition.name}-2`]);
    const old = server.definition;
    expect(params.definition.toJson()).toEqual(new SharedMcpServerDefinition(`${old.name}-2`, old.transport, old.command, old.arguments, old.variables, old.url,
      old.headers, old.bearerVariable).toJson());
  });

  it("shows why the runtime part refused the server under its fields and stays open, until a field changes", async () => {
    const refusal = "A shared MCP server named docs already exists.";
    await create(null, t => t.answer(MethodName.SharedMcpServerCreate, () => {
      throw new Error(refusal);
    }));
    await type("name", "docs");
    await type("command", "npx");
    save().click();

    await Wait.until(() => expect(field(".nol-teamrun-dialog-error").textContent?.trim()).toBe(refusal));
    expect(closes).toEqual([]);
    expect(field(".nol-teamrun-shared-mcp-name").getAttribute("aria-describedby")).toBe("nol-teamrun-shared-mcp-name-hint nol-teamrun-shared-mcp-message");
    expect(save().disabled).toBe(false);
    await type("command", "npx2");
    expect(element().querySelector(".nol-teamrun-dialog-error")).toBeNull();
  });

  it.each([
    { refused: "a name with capitals", http: false, fields: { name: "Docs", command: "npx" }, target: "name", id: "name",
      message: Resources.sharedMcpNameRefusal },
    { refused: "TeamRun's own name", http: false, fields: { name: "teamrun", command: "npx" }, target: "name", id: "name",
      message: Resources.sharedMcpOwnNameRefusal },
    { refused: "a repeated variable", http: false, fields: { name: "docs", command: "npx", variables: "DOCS_KEY\nDOCS_KEY" }, target: "variables", id: "variables",
      message: Resources.sharedMcpVariablesRefusal },
    { refused: "an address without http", http: true, fields: { name: "tracker", url: "tracker.example/mcp" }, target: "url", id: "url",
      message: Resources.sharedMcpAddressRefusal },
    { refused: "an address holding a token", http: true, fields: { name: "tracker", url: "https://tracker.example/mcp?token=abc" }, target: "url", id: "url",
      message: Resources.sharedMcpAddressSecretRefusal },
    { refused: "a header without its variable", http: true, fields: { name: "tracker", url: "https://tracker.example/mcp", headers: "X-Team" }, target: "headers",
      id: "headers", message: Resources.sharedMcpHeaderLineRefusal },
    { refused: "a header named twice", http: true, fields: { name: "tracker", url: "https://tracker.example/mcp", headers: "X-Team: TEAM_A\nx-team: TEAM_B" },
      target: "headers", id: "headers", message: Resources.sharedMcpHeaderNamesRefusal },
    { refused: "a bearer variable starting with a digit", http: true, fields: { name: "tracker", url: "https://tracker.example/mcp", bearer: "1TOKEN" },
      target: "bearer", id: "bearerVariable", message: Resources.sharedMcpBearerRefusal }
  ])("shows under its field why $refused can't be saved, without asking the runtime part, until a field changes", async ({ http, fields, target, id, message }) => {
    await create(null);
    if (http)
      await choose(SharedMcpTransport.Http);
    for (const [name, text] of Object.entries(fields))
      await type(name, text);
    save().click();
    await settle();

    const refusal = field(".nol-teamrun-field-refusal");
    const input = field<HTMLInputElement | HTMLTextAreaElement>(`.nol-teamrun-shared-mcp-${target}`);
    expect([refusal.textContent?.trim(), refusal.id]).toEqual([message, `nol-teamrun-shared-mcp-${id}-message`]);
    expect([input.getAttribute("aria-invalid"), input.getAttribute("aria-describedby")?.split(" ").at(-1)]).toEqual(["true", refusal.id]);
    expect([element().querySelectorAll(".nol-teamrun-field-refusal").length, element().querySelector(".nol-teamrun-dialog-error"), closes,
      sent(MethodName.SharedMcpServerCreate)]).toEqual([1, null, [], []]);
    expect(element().textContent).not.toContain("Parameter");

    await type(target, input.value);
    expect([element().querySelector(".nol-teamrun-field-refusal"), input.getAttribute("aria-invalid")]).toEqual([null, null]);
  });

  it("sends nothing when its form is submitted while Save is off", async () => {
    await create(null);
    await type("name", "docs");

    field<HTMLFormElement>("form").requestSubmit();
    await settle();

    expect([closes, sent(MethodName.SharedMcpServerCreate), element().querySelector(".nol-teamrun-dialog-error")]).toEqual([[], [], null]);
  });

  it("closes without saving from Close or Escape, but not while it saves", async () => {
    const saved = new DeferredResponse();
    await create(docs, t => t.answer(MethodName.SharedMcpServerUpdate, () => saved.promise));
    const dialog = fixture.debugElement.query(By.css("nol-dialog"));

    field<HTMLButtonElement>(".nol-teamrun-cancel").click();
    dialog.triggerEventHandler("dismissed");
    expect(closes).toEqual([false, false]);
    expect(sent(MethodName.SharedMcpServerUpdate)).toEqual([]);

    save().click();
    await fixture.whenStable();
    dialog.triggerEventHandler("dismissed");
    expect([save().disabled, field<HTMLButtonElement>(".nol-teamrun-cancel").disabled, closes]).toEqual([true, true, [false, false]]);

    saved.resolve(docs.toJson());
    await settle();
    expect(closes).toEqual([false, false, true]);
  });

  it("adds an HTTP server with no headers and no bearer token", async () => {
    await create(null);
    await type("name", "open");
    await choose(SharedMcpTransport.Http);
    await type("url", "https://open.example/mcp");
    await type("bearer", "  ");
    save().click();

    await Wait.until(() => expect(closes).toEqual([true]));
    expect(sent(MethodName.SharedMcpServerCreate)).toEqual([new SharedMcpServerDefinition("open", SharedMcpTransport.Http, null, [], [], "https://open.example/mcp", [],
      null).toJson()]);
  });

  it("shows a value row for each variable the draft names, its variables or its headers' and bearer token's, from the environment by default", async () => {
    await create(docs);

    expect(rows().map(t => t.querySelector(".nol-teamrun-field-label")?.textContent?.trim())).toEqual(["DOCS_KEY"]);
    expect(stateOf("DOCS_KEY")).toEqual([SharedMcpVariableSource.Environment, null, null, null]);
    expect(sourceOf("DOCS_KEY").options().map(t => t instanceof SelectOption ? t.title : null))
      .toEqual([Resources.sharedMcpVariableSourceLabels[SharedMcpVariableSource.Environment],
        Resources.sharedMcpVariableSourceLabels[SharedMcpVariableSource.Saved]]);
    expect(sourceOf("DOCS_KEY").label()).toBe(Resources.formatSharedMcpVariableSource("DOCS_KEY"));
    await type("variables", "DOCS_KEY\nDOCS_REGION\nDOCS_KEY\n1BAD");
    expect(rows().map(t => t.querySelector(".nol-teamrun-field-label")?.textContent?.trim())).toEqual(["DOCS_KEY", "DOCS_REGION"]);
    await choose(SharedMcpTransport.Http);
    await type("headers", "X-Team: TRACKER_TEAM\nX-Plain\nX-Copy: TRACKER_TEAM");
    await type("bearer", "TRACKER_TOKEN");
    expect(rows().map(t => t.querySelector(".nol-teamrun-field-label")?.textContent?.trim())).toEqual(["TRACKER_TEAM", "TRACKER_TOKEN"]);
    await type("headers", String.empty);
    await type("bearer", String.empty);
    expect([rows(), element().querySelector("#nol-teamrun-shared-mcp-values-hint")]).toEqual([[], null]);
  });

  it("shows a variable this machine has no value for as Not set on this machine, with a field, and saves what is typed there as a secret by reference only",
    async () => {
      await create(docs, () => undefined, [new SharedMcpVariable("DOCS_KEY", SharedMcpVariableSource.Environment, false)]);

      expect(stateOf("DOCS_KEY")).toEqual([SharedMcpVariableSource.Environment, null, Resources.sharedMcpVariableNotSetLabel, String.empty]);
      const input = secretOf("DOCS_KEY")!;
      expect([input.type, input.autocomplete, input.getAttribute("aria-label"), input.getAttribute("aria-describedby")])
        .toEqual(["password", "off", Resources.formatSharedMcpSecret("DOCS_KEY"), "nol-teamrun-shared-mcp-value-0-state"]);
      expect(element().querySelector("#nol-teamrun-shared-mcp-value-0-state")?.textContent?.trim()).toBe(Resources.sharedMcpVariableNotSetLabel);
      await enter("DOCS_KEY", value);
      expect(sourceOf("DOCS_KEY").value()).toBe(SharedMcpVariableSource.Saved);
      save().click();

      await Wait.until(() => expect(closes).toEqual([true]));
      const [reference, kept] = [...context.secretStore.values.entries()][0]!;
      expect([context.secretStore.values.size, kept, ProtocolResources.sharedMcpSecretReferencePattern.test(reference)]).toEqual([1, value, true]);
      expect(secretSets().map(t => [t.serverId, t.variable, t.reference])).toEqual([["s1", "DOCS_KEY", reference]]);
      expect(JSON.stringify(context.requests)).not.toContain(value);
    });

  it("moves the focus to the value field once Change takes its place, and to the source once Remove clears a saved secret", async () => {
    await create(tracker, () => undefined, [new SharedMcpVariable("TRACKER_TEAM", SharedMcpVariableSource.Saved, true),
      new SharedMcpVariable("TRACKER_TOKEN", SharedMcpVariableSource.Saved, true)]);
    const change = rowOf("TRACKER_TEAM").querySelector<HTMLButtonElement>(".nol-teamrun-shared-mcp-change");
    const remove = rowOf("TRACKER_TOKEN").querySelector<HTMLButtonElement>(".nol-teamrun-shared-mcp-remove");

    change?.focus();
    change?.click();
    await settle();
    const changing = document.activeElement === secretOf("TRACKER_TEAM");
    remove?.focus();
    remove?.click();
    await settle();

    expect([changing, document.activeElement === rowOf("TRACKER_TOKEN").querySelector(".nol-teamrun-shared-mcp-source .nol-select-button")]).toEqual([true, true]);
  });

  it("shows a saved secret as Saved with Change and Remove, never its value, and Change takes a new value under a new reference", async () => {
    await create(docs, () => undefined, [new SharedMcpVariable("DOCS_KEY", SharedMcpVariableSource.Saved, true)]);

    expect(stateOf("DOCS_KEY")).toEqual([SharedMcpVariableSource.Saved, Resources.sharedMcpSecretSavedLabel, null, null]);
    expect([...rowOf("DOCS_KEY").querySelectorAll(".nol-teamrun-field-row button")].map(t => t.textContent?.trim()))
      .toEqual([Resources.changeLabel, Resources.removeLabel]);
    rowOf("DOCS_KEY").querySelector<HTMLButtonElement>(".nol-teamrun-shared-mcp-change")!.click();
    await settle();
    expect(stateOf("DOCS_KEY")).toEqual([SharedMcpVariableSource.Saved, null, null, String.empty]);
    await enter("DOCS_KEY", value);
    save().click();

    await Wait.until(() => expect(closes).toEqual([true]));
    expect(secretSets().map(t => [t.variable, t.reference])).toEqual([["DOCS_KEY", [...context.secretStore.values.keys()][0]]]);
  });

  it("gives every field a visible label, and the value's label names its field", async () => {
    await create(docs, () => undefined, [new SharedMcpVariable("DOCS_KEY", SharedMcpVariableSource.Saved, false)]);
    const label = rowOf("DOCS_KEY").querySelector<HTMLLabelElement>("label.nol-teamrun-shared-mcp-value-label")!;

    expect([...element().querySelectorAll(".nol-teamrun-shared-mcp-values-head .nol-teamrun-field-label")].map(u => u.textContent?.trim()))
      .toEqual([Resources.sharedMcpVariableColumn, Resources.sharedMcpSourceColumn]);
    expect(label.textContent?.trim()).toBe(Resources.sharedMcpValueColumn);
    expect(label.control).toBe(secretOf("DOCS_KEY"));
    expect(rowOf("DOCS_KEY").getAttribute("aria-label")).toBe("DOCS_KEY");
    expect(secretOf("DOCS_KEY")?.getAttribute("aria-label")).toBe(Resources.formatSharedMcpSecret("DOCS_KEY"));
    expect(sourceOf("DOCS_KEY").label()).toBe(Resources.formatSharedMcpVariableSource("DOCS_KEY"));
  });

  it("shows when a saved secret was last updated, and nothing for one saved before TeamRun kept that", async () => {
    await create(docs, () => undefined, [new SharedMcpVariable("DOCS_KEY", SharedMcpVariableSource.Saved, true, "2026-11-01T10:00:00.000Z")]);
    await type("variables", "DOCS_KEY\nDOCS_REGION");
    const shown = rowOf("DOCS_KEY").querySelector(".nol-teamrun-shared-mcp-updated")?.textContent?.trim();

    expect(shown).toBe(Resources.formatSharedMcpSecretUpdated(TestBed.inject(TimeFormatService).dateTime("2026-11-01T10:00:00.000Z")));
    fixture.destroy();
    TestBed.resetTestingModule();
    await create(docs, () => undefined, [new SharedMcpVariable("DOCS_KEY", SharedMcpVariableSource.Saved, true)]);
    expect(rowOf("DOCS_KEY").querySelector(".nol-teamrun-shared-mcp-saved")?.textContent?.trim()).toBe(Resources.sharedMcpSecretSavedLabel);
    expect(rowOf("DOCS_KEY").querySelector(".nol-teamrun-shared-mcp-updated")).toBeNull();
  });

  it("shows and hides a value being typed, keeps it through that, and starts hidden again after Change", async () => {
    await create(docs, () => undefined, [new SharedMcpVariable("DOCS_KEY", SharedMcpVariableSource.Saved, true)]);
    const reveal = (): HTMLButtonElement => rowOf("DOCS_KEY").querySelector<HTMLButtonElement>(".nol-teamrun-shared-mcp-reveal")!;

    expect(rowOf("DOCS_KEY").querySelector(".nol-teamrun-shared-mcp-reveal")).toBeNull();
    expect(rowOf("DOCS_KEY").querySelector("input")).toBeNull();
    rowOf("DOCS_KEY").querySelector<HTMLButtonElement>(".nol-teamrun-shared-mcp-change")!.click();
    await settle();
    expect(secretOf("DOCS_KEY")?.value).toBe(String.empty);
    expect([secretOf("DOCS_KEY")?.type, reveal().textContent?.trim(), reveal().getAttribute("aria-pressed")]).toEqual(["password", Resources.sharedMcpShowValueLabel, null]);
    await enter("DOCS_KEY", value);
    reveal().click();
    await settle();
    expect([secretOf("DOCS_KEY")?.type, secretOf("DOCS_KEY")?.value, reveal().textContent?.trim(), reveal().getAttribute("aria-pressed"), reveal().getAttribute("aria-label")])
      .toEqual(["text", value, Resources.sharedMcpHideValueLabel, null, Resources.formatSharedMcpReveal("DOCS_KEY", true)]);
    expect(secretOf("DOCS_KEY")?.getAttribute("spellcheck")).toBe("false");
    expect(secretOf("DOCS_KEY")?.getAttribute("autocomplete")).toBe("off");
    reveal().click();
    await settle();
    expect([secretOf("DOCS_KEY")?.type, secretOf("DOCS_KEY")?.value]).toEqual(["password", value]);
    reveal().click();
    await settle();
    await pick("DOCS_KEY", SharedMcpVariableSource.Environment);
    await pick("DOCS_KEY", SharedMcpVariableSource.Saved);
    expect(secretOf("DOCS_KEY")).toBeNull();
    rowOf("DOCS_KEY").querySelector<HTMLButtonElement>(".nol-teamrun-shared-mcp-change")!.click();
    await settle();
    expect([secretOf("DOCS_KEY")?.type, secretOf("DOCS_KEY")?.value]).toEqual(["password", String.empty]);
  });

  it("never puts a saved value in the page, before or after Change", async () => {
    await create(docs, t => t.secretStore.values.set("teamrun.mcpSecret0123456789abcdef0123456789abcdef", value),
      [new SharedMcpVariable("DOCS_KEY", SharedMcpVariableSource.Saved, true)]);
    const expectHidden = (): void => {
      expect(document.body.innerHTML).not.toContain(value);
      expect([...document.querySelectorAll("input")].some(u => u.value === value)).toBe(false);
    };

    expectHidden();
    rowOf("DOCS_KEY").querySelector<HTMLButtonElement>(".nol-teamrun-shared-mcp-change")!.click();
    await settle();
    expect(secretOf("DOCS_KEY")?.value).toBe(String.empty);
    expectHidden();
  });

  it("announces each move to a saved secret once, and shows the note without a live region of its own", async () => {
    await create(tracker, () => undefined, [new SharedMcpVariable("TRACKER_TEAM", SharedMcpVariableSource.Environment, false)]);
    const announce = vi.spyOn(TestBed.inject(Announcer), "announce");

    await enter("TRACKER_TEAM", "a");
    await enter("TRACKER_TEAM", "ab");

    expect(announce.mock.calls).toEqual([[Resources.formatSharedMcpMovedToSaved(["TRACKER_TEAM"]), AnnouncementPoliteness.Polite]]);
    expect(element().querySelector(".nol-teamrun-shared-mcp-moved")?.getAttribute("role")).toBeNull();
  });

  it("drops the note once a moved variable's name is gone or its field is empty", async () => {
    await create(docs, () => undefined, [new SharedMcpVariable("DOCS_KEY", SharedMcpVariableSource.Environment, false)]);
    const note = (): Element | null => element().querySelector(".nol-teamrun-shared-mcp-moved");

    await enter("DOCS_KEY", value);
    expect(note()).not.toBeNull();
    await enter("DOCS_KEY", String.empty);
    expect(note()).toBeNull();
    await enter("DOCS_KEY", value);
    expect(note()).not.toBeNull();
    await type("variables", "DOCS_OTHER");
    expect(note()).toBeNull();
  });

  describe("after a save that a refusal left open", () => {
    const refusingAll = async (): Promise<void> => {
      await create(docs, t => {
        const keep = t.secretStore.saveAsync.bind(t.secretStore);
        t.secretStore.saveAsync = async (name: string, text: string): Promise<void> => {
          if (text !== value)
            throw new Error(refusal);
          await keep(name, text);
        };
      });
      await type("variables", "DOCS_KEY\nDOCS_REGION");
      await pick("DOCS_KEY", SharedMcpVariableSource.Saved);
      await pick("DOCS_REGION", SharedMcpVariableSource.Saved);
      await enter("DOCS_KEY", value);
      await enter("DOCS_REGION", "refused");
      save().click();
      await Wait.until(() => expect(rowOf("DOCS_REGION").querySelector(".nol-teamrun-field-refusal")).not.toBeNull());
      await settle();
    };

    it("takes a secret out of what it reports once Remove clears it", async () => {
      await refusingAll();
      expect(fixture.componentInstance.savedSecrets()).toEqual(["DOCS_KEY"]);

      rowOf("DOCS_KEY").querySelector<HTMLButtonElement>(".nol-teamrun-shared-mcp-remove")!.click();
      await enter("DOCS_REGION", value);
      save().click();

      await Wait.until(() => expect(closes).toEqual([true]));
      expect(fixture.componentInstance.savedSecrets()).toEqual(["DOCS_REGION"]);
    });

    it("reports a secret saved twice once", async () => {
      await refusingAll();

      rowOf("DOCS_KEY").querySelector<HTMLButtonElement>(".nol-teamrun-shared-mcp-change")!.click();
      await settle();
      await enter("DOCS_KEY", value);
      await enter("DOCS_REGION", value);
      save().click();

      await Wait.until(() => expect(closes).toEqual([true]));
      expect(fixture.componentInstance.savedSecrets()).toEqual(["DOCS_KEY", "DOCS_REGION"]);
    });

    it("takes a secret out of what it reports once its variable is no longer named", async () => {
      await refusingAll();

      await type("variables", "DOCS_REGION");
      await enter("DOCS_REGION", value);
      save().click();

      await Wait.until(() => expect(closes).toEqual([true]));
      expect(fixture.componentInstance.savedSecrets()).toEqual(["DOCS_REGION"]);
    });

    it("reports the name the server was saved under, not one typed since", async () => {
      await refusingAll();

      await type("name", "renamed");
      field<HTMLButtonElement>(".nol-teamrun-cancel").click();

      await Wait.until(() => expect(closes).toEqual([true]));
      expect(fixture.componentInstance.savedName()).toBe(docs.definition.name);
    });
  });

  it("names every variable typing moved to a saved secret", async () => {
    await create(tracker, () => undefined, [new SharedMcpVariable("TRACKER_TEAM", SharedMcpVariableSource.Environment, false),
      new SharedMcpVariable("TRACKER_TOKEN", SharedMcpVariableSource.Environment, false)]);

    await enter("TRACKER_TEAM", value);
    await enter("TRACKER_TOKEN", value);

    expect(element().querySelector(".nol-teamrun-shared-mcp-moved")?.textContent?.trim()).toBe(Resources.formatSharedMcpMovedToSaved(["TRACKER_TEAM", "TRACKER_TOKEN"]));
  });

  it("says so when typing moves a variable to a saved secret, and drops the note once the environment is chosen again", async () => {
    await create(docs, () => undefined, [new SharedMcpVariable("DOCS_KEY", SharedMcpVariableSource.Environment, false)]);
    const note = (): Element | null => element().querySelector(".nol-teamrun-shared-mcp-moved");

    expect(note()).toBeNull();
    await enter("DOCS_KEY", value);
    expect(sourceOf("DOCS_KEY").value()).toBe(SharedMcpVariableSource.Saved);
    expect(note()?.textContent?.trim()).toBe(Resources.formatSharedMcpMovedToSaved(["DOCS_KEY"]));
    await pick("DOCS_KEY", SharedMcpVariableSource.Environment);
    expect(note()).toBeNull();
  });

  it("lists the secrets it saved for the view to report, and only those", async () => {
    await create(docs, () => undefined, [new SharedMcpVariable("DOCS_KEY", SharedMcpVariableSource.Saved, true)]);
    await type("variables", "DOCS_KEY\nDOCS_REGION");
    await pick("DOCS_REGION", SharedMcpVariableSource.Saved);
    await enter("DOCS_REGION", value);
    save().click();

    await Wait.until(() => expect(closes).toEqual([true]));
    expect(fixture.componentInstance.savedSecrets()).toEqual(["DOCS_REGION"]);
    expect(fixture.componentInstance.savedName()).toBe(docs.definition.name);
  });

  it("shows Saved at once when another secret's refusal keeps it open", async () => {
    await create(docs, t => {
      const save = t.secretStore.saveAsync.bind(t.secretStore);
      t.secretStore.saveAsync = async (name: string, text: string): Promise<void> => {
        if (text !== value)
          throw new Error(refusal);
        await save(name, text);
      };
    });
    await type("variables", "DOCS_KEY\nDOCS_REGION");
    await pick("DOCS_KEY", SharedMcpVariableSource.Saved);
    await pick("DOCS_REGION", SharedMcpVariableSource.Saved);
    await enter("DOCS_KEY", value);
    await enter("DOCS_REGION", "refused");
    save().click();

    await Wait.until(() => expect(rowOf("DOCS_REGION").querySelector(".nol-teamrun-field-refusal")).not.toBeNull());
    expect(rowOf("DOCS_KEY").querySelector(".nol-teamrun-shared-mcp-saved")?.textContent?.trim()).toBe(Resources.sharedMcpSecretSavedLabel);
    expect(rowOf("DOCS_KEY").querySelector(".nol-teamrun-shared-mcp-updated")).not.toBeNull();
    expect(closes).toEqual([]);
  });

  it("keeps a saved secret when Save comes without a new value, and sends nothing for it", async () => {
    await create(docs, () => undefined, [new SharedMcpVariable("DOCS_KEY", SharedMcpVariableSource.Saved, true)]);

    rowOf("DOCS_KEY").querySelector<HTMLButtonElement>(".nol-teamrun-shared-mcp-change")!.click();
    await settle();
    save().click();

    await Wait.until(() => expect(closes).toEqual([true]));
    expect([secretSets(), context.secretStore.values.size]).toEqual([[], 0]);
  });

  it.each([
    { how: "Remove", undo: async (): Promise<void> => {
      rowOf("DOCS_KEY").querySelector<HTMLButtonElement>(".nol-teamrun-shared-mcp-remove")!.click();
      await settle();
    } },
    { how: "the environment choice", undo: (): Promise<void> => pick("DOCS_KEY", SharedMcpVariableSource.Environment) }
  ])("takes a saved secret's variable back to the environment by $how, clearing its reference on Save", async ({ undo }) => {
    await create(docs, () => undefined, [new SharedMcpVariable("DOCS_KEY", SharedMcpVariableSource.Saved, true)]);

    await undo();
    expect(stateOf("DOCS_KEY")).toEqual([SharedMcpVariableSource.Environment, null, null, null]);
    save().click();

    await Wait.until(() => expect(closes).toEqual([true]));
    expect(secretSets().map(t => [t.serverId, t.variable, t.reference])).toEqual([["s1", "DOCS_KEY", null]]);
    expect(context.secretStore.values.size).toBe(0);
  });

  it("keeps Save off while a variable chosen as a saved secret has neither a saved value nor a typed one", async () => {
    await create(docs, () => undefined, [new SharedMcpVariable("DOCS_REGION", SharedMcpVariableSource.Saved, false)]);
    await type("variables", "DOCS_KEY\nDOCS_REGION");

    expect(save().disabled).toBe(false);
    await pick("DOCS_KEY", SharedMcpVariableSource.Saved);
    expect(save().disabled).toBe(true);
    await enter("DOCS_KEY", value);
    expect(save().disabled).toBe(false);
    await enter("DOCS_KEY", String.empty);
    expect(save().disabled).toBe(true);
    await pick("DOCS_KEY", SharedMcpVariableSource.Environment);
    expect(save().disabled).toBe(false);
  });

  it("shows a field once Saved secret is chosen, and the environment choice hides it again and saves no secret", async () => {
    await create(docs);

    await pick("DOCS_KEY", SharedMcpVariableSource.Saved);
    expect(stateOf("DOCS_KEY")).toEqual([SharedMcpVariableSource.Saved, null, null, String.empty]);
    await enter("DOCS_KEY", value);
    await pick("DOCS_KEY", SharedMcpVariableSource.Environment);
    expect(stateOf("DOCS_KEY")).toEqual([SharedMcpVariableSource.Environment, null, null, null]);
    sourceOf("DOCS_KEY").valueChange.emit("Vault");
    await settle();
    expect(sourceOf("DOCS_KEY").value()).toBe(SharedMcpVariableSource.Environment);
    save().click();

    await Wait.until(() => expect(closes).toEqual([true]));
    expect([secretSets(), context.secretStore.values.size]).toEqual([[], 0]);
  });

  it("shows a saved secret that is missing from this machine as Not set on this machine, with a field", async () => {
    await create(docs, () => undefined, [new SharedMcpVariable("DOCS_KEY", SharedMcpVariableSource.Saved, false)]);

    expect(stateOf("DOCS_KEY")).toEqual([SharedMcpVariableSource.Saved, null, Resources.sharedMcpVariableNotSetLabel, String.empty]);
  });

  it("shows the secret store's refusal by the field and stays open with the server saved, and the environment choice still saves", async () => {
    await create(null, t => {
      t.secretStore.refusal = refusal;
    });
    await type("name", "docs");
    await type("command", "npx");
    await type("variables", "DOCS_KEY");
    await pick("DOCS_KEY", SharedMcpVariableSource.Saved);
    await enter("DOCS_KEY", value);
    save().click();

    await Wait.until(() => expect(rowOf("DOCS_KEY").querySelector(".nol-teamrun-field-refusal")?.textContent?.trim()).toBe(refusal));
    const input = secretOf("DOCS_KEY")!;
    expect([input.getAttribute("aria-invalid"), input.getAttribute("aria-describedby"), rowOf("DOCS_KEY").querySelector(".nol-teamrun-field-refusal")?.id])
      .toEqual(["true", "nol-teamrun-shared-mcp-value-0-message", "nol-teamrun-shared-mcp-value-0-message"]);
    expect([closes, sent(MethodName.SharedMcpServerCreate).length, secretSets(), element().querySelector(".nol-teamrun-dialog-error"), save().disabled])
      .toEqual([[], 1, [], null, false]);
    expect(element().textContent).not.toContain(value);

    await pick("DOCS_KEY", SharedMcpVariableSource.Environment);
    expect(rowOf("DOCS_KEY").querySelector(".nol-teamrun-field-refusal")).toBeNull();
    save().click();

    await Wait.until(() => expect(closes).toEqual([true]));
    expect([sent(MethodName.SharedMcpServerCreate).length, SharedMcpServerUpdateParams.fromJson(sent(MethodName.SharedMcpServerUpdate)[0]).serverId, secretSets()])
      .toEqual([1, "s9", []]);
  });

  it("removes the value it saved when the runtime part refuses its reference, shows why by the field, and reports the server saved on Close", async () => {
    const refused = "The shared MCP server docs doesn't name DOCS_KEY.";
    await create(docs, t => t.answer(MethodName.SharedMcpSecretSet, () => {
      throw new Error(refused);
    }));
    await pick("DOCS_KEY", SharedMcpVariableSource.Saved);
    await enter("DOCS_KEY", value);
    save().click();

    await Wait.until(() => expect(rowOf("DOCS_KEY").querySelector(".nol-teamrun-field-refusal")?.textContent?.trim()).toBe(refused));
    expect([context.secretStore.values.size, context.secretStore.removed.length, ProtocolResources.sharedMcpSecretReferencePattern.test(context.secretStore.removed[0]!)])
      .toEqual([0, 1, true]);
    await enter("DOCS_KEY", `${value}2`);
    expect(rowOf("DOCS_KEY").querySelector(".nol-teamrun-field-refusal")).toBeNull();
    field<HTMLButtonElement>(".nol-teamrun-cancel").click();
    expect(closes).toEqual([true]);
  });

  it("shows the runtime part's refusal of a reference by the field even when the value it saved can't be removed again", async () => {
    const refused = "The shared MCP server docs doesn't name DOCS_KEY.";
    await create(docs, t => {
      t.answer(MethodName.SharedMcpSecretSet, () => {
        throw new Error(refused);
      });
      t.secretStore.removalRefusal = refusal;
    });
    await pick("DOCS_KEY", SharedMcpVariableSource.Saved);
    await enter("DOCS_KEY", value);
    save().click();

    await Wait.until(() => expect(rowOf("DOCS_KEY").querySelector(".nol-teamrun-field-refusal")?.textContent?.trim()).toBe(refused));
    expect([closes, element().textContent?.includes(refusal), element().textContent?.includes(value)]).toEqual([[], false, false]);
  });

  it("shows why the runtime part refused to clear a saved secret by its row", async () => {
    const refused = "The shared MCP server docs no longer exists.";
    await create(docs, t => t.answer(MethodName.SharedMcpSecretSet, () => {
      throw new Error(refused);
    }), [new SharedMcpVariable("DOCS_KEY", SharedMcpVariableSource.Saved, true)]);
    rowOf("DOCS_KEY").querySelector<HTMLButtonElement>(".nol-teamrun-shared-mcp-remove")!.click();
    await settle();
    save().click();

    await Wait.until(() => expect(rowOf("DOCS_KEY").querySelector(".nol-teamrun-field-refusal")?.textContent?.trim()).toBe(refused));
    expect(closes).toEqual([]);
  });

  it("keeps a value when an input event comes from something that isn't a text field", async () => {
    await create(docs);
    await pick("DOCS_KEY", SharedMcpVariableSource.Saved);

    fixture.debugElement.query(By.css(".nol-teamrun-shared-mcp-secret")).triggerEventHandler("input", { target: document.createElement("div") });
    await settle();

    expect(stateOf("DOCS_KEY")).toEqual([SharedMcpVariableSource.Saved, null, null, String.empty]);
  });

  describe.each([
    { look: "the fixture theme", mode: ThemeMode.Light, forcedColors: "none" },
    { look: "dark", mode: ThemeMode.Dark, forcedColors: "none" },
    { look: "forced colors", mode: ThemeMode.Light, forcedColors: "active" }
  ])("in $look", ({ mode, forcedColors }) => {
    const rect = (target: Element): DOMRect => target.getBoundingClientRect();

    beforeAll(() => EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors));

    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

    afterEach(() => AppearanceFixture.reset());

    afterAll(() => EmulatedMediaFixture.resetAsync());

    it.each([
      { kind: "stdio", server: docs, names: ["name", "command", "arguments", "variables"] },
      { kind: "HTTP", server: tracker, names: ["name", "url", "headers", "bearer"] }
    ])("lines up a $kind server's fields with the type's select edge to edge, and puts Close before Save", async ({ server, names }) => {
      await create(server);
      const chooser = rect(field("nol-select.nol-teamrun-shared-mcp-transport"));

      for (const name of names) {
        const box = rect(field(`.nol-teamrun-shared-mcp-${name}`));
        AppearanceFixture.expectPixels(box.left, chooser.left);
        AppearanceFixture.expectPixels(box.right, chooser.right);
      }
      DialogActionsFixture.expectCloseThenPrimary(element(), ".nol-teamrun-save");
    });

    it("keeps a row with only its choice as dense as a Settings row, from edge to edge of the form, with its name level with its choice", async () => {
      await create(docs, () => undefined, [new SharedMcpVariable("DOCS_KEY", SharedMcpVariableSource.Environment, true)]);
      const chooser = rect(field("nol-select.nol-teamrun-shared-mcp-transport"));
      const [row, name, choice] = [rect(rowOf("DOCS_KEY")), rect(rowOf("DOCS_KEY").querySelector(".nol-teamrun-shared-mcp-variable")!), rect(rowOf("DOCS_KEY").querySelector("nol-select")!)];
      const line = Number.parseFloat(getComputedStyle(rowOf("DOCS_KEY")).borderBlockEndWidth);

      AppearanceFixture.expectPixels(row.left, chooser.left);
      AppearanceFixture.expectPixels(row.right, chooser.right);
      AppearanceFixture.expectPixels(row.height, choice.height + AppearanceFixture.measureLook("space-2") * 2 + line);
      AppearanceFixture.expectPixels(name.left, chooser.left);
      AppearanceFixture.expectPixels(choice.right, chooser.right);
      expect(name.right).toBeLessThanOrEqual(choice.left);
      AppearanceFixture.expectPixels(name.top + name.height / 2, choice.top + choice.height / 2);
      expect(rowOf("DOCS_KEY").scrollWidth).toBeLessThanOrEqual(rowOf("DOCS_KEY").clientWidth);
    });

    it("lines a value's field and Show, and Saved with Change and Remove, up under the choice, a quarter rem apart, to the form's end", async () => {
      await create(docs, () => undefined, [new SharedMcpVariable("DOCS_KEY", SharedMcpVariableSource.Saved, true, "2026-11-01T10:00:00.000Z"),
        new SharedMcpVariable("DOCS_REGION", SharedMcpVariableSource.Environment, false)]);
      await type("variables", "DOCS_KEY\nDOCS_REGION");
      const chooser = rect(field("nol-select.nol-teamrun-shared-mcp-transport"));
      const space = AppearanceFixture.measureLook("space-1");
      const inKey = (selector: string): DOMRect => rect(rowOf("DOCS_KEY").querySelector(selector)!);
      const inRegion = (selector: string): DOMRect => rect(rowOf("DOCS_REGION").querySelector(selector)!);

      for (const box of [inKey(".nol-teamrun-shared-mcp-saved"), inKey(".nol-teamrun-shared-mcp-updated"), inRegion(".nol-teamrun-shared-mcp-secret"), inRegion(".nol-teamrun-shared-mcp-not-set")])
        AppearanceFixture.expectPixels(box.left, inKey("nol-select").left);
      for (const box of [inKey(".nol-teamrun-shared-mcp-remove"), inRegion(".nol-teamrun-shared-mcp-reveal")])
        AppearanceFixture.expectPixels(box.right, chooser.right);
      for (const box of [inKey(".nol-teamrun-shared-mcp-value-label"), inRegion(".nol-teamrun-shared-mcp-value-label")])
        AppearanceFixture.expectPixels(box.left, chooser.left);
      AppearanceFixture.expectPixels(inKey(".nol-teamrun-shared-mcp-change").top - inKey("nol-select").bottom, space);
      AppearanceFixture.expectPixels(inKey(".nol-teamrun-shared-mcp-updated").top - inKey(".nol-teamrun-shared-mcp-change").bottom, space);
      AppearanceFixture.expectPixels(inRegion(".nol-teamrun-shared-mcp-secret").top - inRegion("nol-select").bottom, space);
      AppearanceFixture.expectPixels(inRegion(".nol-teamrun-shared-mcp-not-set").top - inRegion(".nol-teamrun-shared-mcp-secret").bottom, space);
      expect(inKey(".nol-teamrun-shared-mcp-saved").right).toBeLessThanOrEqual(inKey(".nol-teamrun-shared-mcp-change").left);
      expect(inKey(".nol-teamrun-shared-mcp-change").right).toBeLessThanOrEqual(inKey(".nol-teamrun-shared-mcp-remove").left);
      expect(inRegion(".nol-teamrun-shared-mcp-secret").right).toBeLessThanOrEqual(inRegion(".nol-teamrun-shared-mcp-reveal").left);
      expect(inKey(".nol-teamrun-shared-mcp-updated").height).toBeLessThanOrEqual(inKey(".nol-teamrun-shared-mcp-saved").height);
    });

    it("sets the note about a move under the rows, from the form's start edge to within its end, with no margin of its own", async () => {
      await create(docs, () => undefined, [new SharedMcpVariable("DOCS_KEY", SharedMcpVariableSource.Environment, false)]);
      await enter("DOCS_KEY", value);
      const note = field(".nol-teamrun-shared-mcp-moved");
      const [line, chooser, rows, form] = [rect(note), rect(field("nol-select.nol-teamrun-shared-mcp-transport")), rect(field(".nol-teamrun-shared-mcp-values")), rect(note.parentElement!)];

      AppearanceFixture.expectPixels(line.left, chooser.left);
      expect(line.right).toBeLessThanOrEqual(chooser.right);
      AppearanceFixture.expectPixels(line.top - rows.bottom, Number.parseFloat(getComputedStyle(note.parentElement!).rowGap));
      expect(line.bottom).toBeLessThanOrEqual(form.bottom);
      expect(getComputedStyle(note).marginBlockStart).toBe("0px");
      expect(getComputedStyle(note).marginBlockEnd).toBe("0px");
    });

    it("puts a value's refusal a quarter rem under its field, from the field's start edge, inside its row", async () => {
      await create(docs, t => {
        t.secretStore.refusal = refusal;
      });
      await pick("DOCS_KEY", SharedMcpVariableSource.Saved);
      await enter("DOCS_KEY", value);
      save().click();
      await Wait.until(() => expect(rowOf("DOCS_KEY").querySelector(".nol-teamrun-field-refusal")).not.toBeNull());
      await settle();
      const [entry, message, row] = [rect(secretOf("DOCS_KEY")!), rect(rowOf("DOCS_KEY").querySelector(".nol-teamrun-field-refusal")!), rect(rowOf("DOCS_KEY"))];

      AppearanceFixture.expectPixels(message.left, entry.left);
      AppearanceFixture.expectPixels(message.top - entry.bottom, AppearanceFixture.measureLook("space-1"));
      expect(message.bottom).toBeLessThanOrEqual(row.bottom);
      expect(message.right).toBeLessThanOrEqual(row.right);
    });

    it("puts the OAuth choice's hint a quarter rem under it, both from the address's start edge, before the next field", async () => {
      await create(null);
      await choose(SharedMcpTransport.Http);

      const url = rect(field(".nol-teamrun-shared-mcp-url"));
      const choice = rect(field("nol-checkbox.nol-teamrun-shared-mcp-signs-in"));
      const hint = rect(field("#nol-teamrun-shared-mcp-signs-in-hint"));
      AppearanceFixture.expectPixels(choice.left, url.left);
      AppearanceFixture.expectPixels(hint.left, url.left);
      expect(hint.right).toBeLessThanOrEqual(url.right);
      AppearanceFixture.expectPixels(hint.top - choice.bottom, AppearanceFixture.measureLook("space-1"));
      expect(hint.bottom).toBeLessThanOrEqual(rect(field(".nol-teamrun-shared-mcp-bearer")).top);
    });

    it("puts a field's refusal a quarter rem under its hint, from the field's start edge, before the next field", async () => {
      await create(null);
      await type("name", "Docs");
      await type("command", "npx");
      save().click();
      await settle();

      const name = rect(field(".nol-teamrun-shared-mcp-name"));
      const refusal = rect(field(".nol-teamrun-field-refusal"));
      AppearanceFixture.expectPixels(refusal.left, name.left);
      expect(refusal.right).toBeLessThanOrEqual(name.right);
      AppearanceFixture.expectPixels(refusal.top - rect(field("#nol-teamrun-shared-mcp-name-hint")).bottom, AppearanceFixture.measureLook("space-1"));
      expect(refusal.bottom).toBeLessThanOrEqual(rect(field("nol-select.nol-teamrun-shared-mcp-transport")).top);
    });
  });

  describe("under forced colours and at 200% zoom", () => {
    it("keeps every control, state and focus ring in the shared MCP server dialog visible under forced colours", async () => {
      await create(docs);
      await AccessibilityFixture.expectVisibleForcedAsync(element());
      expect(AccessibilityFixture.popups(element())).toBeGreaterThan(0);
    });

    it("neither cuts, crosses nor loses a control in the shared MCP server dialog at 200% zoom", async () => {
      await create(docs);
      await AccessibilityFixture.expectFitsZoomedAsync(element(), settle);
    });
  });

  describe("by keyboard and screen reader", () => {
    it("reaches every control in the shared MCP server dialog by keyboard, with a visible ring", async () => {
      await create(docs);
      expect(await AccessibilityFixture.expectKeyboardAsync(element())).toBeGreaterThan(0);
    });

    it("names every control, dialog, list and image in the shared MCP server dialog", async () => {
      await create(docs);
      expect(AccessibilityFixture.expectNamed(element())).toBeGreaterThan(0);
    });
  });
});
