/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";

import { BrowserStepPhase } from "../../../src/app/enums/browser-step-phase";
import { BrowserStep } from "../../../src/app/models/browser-step";
import { Resources } from "../../../src/resources";

describe("BrowserStep", () => {
  const step = (tool: string, fields: JsonObject = {}): BrowserStep => {
    const read = BrowserStep.of({ servedTool: tool, ...fields });
    if (Object.isNull(read))
      throw new Error(`No Browser step for ${tool}.`);
    return read;
  };
  const failure = (code: string, moduleCode: string | null = null): JsonObject => ({ failure: { code, moduleCode } });
  const cart = { page: { url: "https://shop.test/cart", title: "Cart" } };

  it("reads a step of a call TeamRun's server served to the Browser, and no other step", () => {
    expect([BrowserStep.of("text"), BrowserStep.of(["browser_click"]), BrowserStep.of({ tool: "browser_click" }), BrowserStep.of({ servedTool: "terminal_run" }),
      BrowserStep.of({ servedTool: 1 })]).toEqual([null, null, null, null, null]);
    const shot = step("browser_screenshot", { servedInput: { type: "png" }, ...cart, storedPath: "/data/images/r1-0.png" });
    expect([shot.tool, shot.input, shot.url, shot.elementName, shot.isSecret, shot.failureCode, shot.failureModuleCode, shot.storedPath])
      .toEqual(["browser_screenshot", { type: "png" }, "https://shop.test/cart", null, false, null, null, "/data/images/r1-0.png"]);
  });

  it("names an opened page by its address without its scheme, and a move through the history by where it went", () => {
    expect([
      step("browser_navigate", { servedInput: { url: "https://docs.example.com/pricing" }, page: { url: "https://docs.example.com/pricing", title: "Pricing" } }).title(BrowserStepPhase.Done),
      step("browser_navigate", { servedInput: { url: "https://docs.example.com/next" } }).title(BrowserStepPhase.Done),
      step("browser_navigate", { servedInput: {} }).title(BrowserStepPhase.Done),
      step("browser_navigate", { servedInput: { url: "https://docs.example.com/next" } }).title(BrowserStepPhase.Denied),
      step("browser_navigate", { servedInput: { action: "back" } }).title(BrowserStepPhase.Done),
      step("browser_navigate", { servedInput: { action: "forward" }, ...failure("Denied") }).title(BrowserStepPhase.Done),
      step("browser_navigate", { servedInput: { action: "reload" }, ...failure("Unavailable") }).title(BrowserStepPhase.Done),
      step("browser_navigate", { servedInput: { action: "stop" } }).title(BrowserStepPhase.Done)
    ]).toEqual([
      "Opened docs.example.com/pricing",
      "Opened docs.example.com/next",
      "Opened ",
      "Didn't open docs.example.com/next · you denied it",
      "Went back",
      "Didn't go forward · you denied it",
      "Didn't reload the page",
      "Went stop"
    ]);
  });

  it("says a site that isn't allowed couldn't be opened, by its host", () => {
    const refused = failure("Refused", "browser.originRefused");
    expect([
      step("browser_navigate", { servedInput: { url: "https://intranet.example.org/wiki" }, ...refused }).title(BrowserStepPhase.Done),
      step("browser_navigate", { servedInput: { url: "intranet" }, ...refused }).title(BrowserStepPhase.Done),
      step("browser_navigate", { servedInput: {}, ...refused }).title(BrowserStepPhase.Done)
    ]).toEqual([
      "Couldn't open intranet.example.org · not an allowed site",
      "Couldn't open intranet · not an allowed site",
      "Couldn't open  · not an allowed site"
    ]);
  });

  it("names the element a click or typing acted on, hides a secret field's typing, and says why it didn't act", () => {
    const pay = { element: { role: "button", name: "Pay", isSecret: false } };
    expect([
      step("browser_click", pay).title(BrowserStepPhase.Done),
      step("browser_click", pay).title(BrowserStepPhase.Denied),
      step("browser_click", failure("Stale")).title(BrowserStepPhase.Done),
      step("browser_click", { element: { name: " " }, ...failure("Refused", "browser.staleReference") }).title(BrowserStepPhase.Done),
      step("browser_type", { element: { role: "textbox", name: "Password", isSecret: true } }).title(BrowserStepPhase.Done),
      step("browser_type", { element: { role: "textbox", name: "Work email", isSecret: false } }).title(BrowserStepPhase.Done),
      step("browser_type", failure("Stale")).title(BrowserStepPhase.Done),
      step("browser_type", failure("Denied")).title(BrowserStepPhase.Done)
    ]).toEqual([
      "Clicked \"Pay\"",
      "Didn't click \"Pay\" · you denied it",
      "Didn't click an element · the page changed before the click, so nothing was clicked",
      "Didn't click an element · the page changed before the click, so nothing was clicked",
      "Typed into \"Password\" · hidden",
      "Typed into \"Work email\"",
      "Didn't type into an element · the page changed before the typing, so nothing was typed",
      "Didn't type into an element · you denied it"
    ]);
    expect([step("browser_type", { element: { isSecret: true } }).isSecret, step("browser_type", { element: { isSecret: "yes" } }).isSecret]).toEqual([true, false]);
  });

  it("names a pressed key, and a read of the page by what it read", () => {
    expect([
      step("browser_press_key", { servedInput: { key: "Enter" } }).title(BrowserStepPhase.Done),
      step("browser_press_key", { servedInput: {} }).title(BrowserStepPhase.Done),
      step("browser_press_key", { servedInput: { key: "Enter" }, ...failure("Unavailable") }).title(BrowserStepPhase.Done),
      step("browser_press_key", { servedInput: { key: "Enter" }, ...failure("Stale") }).title(BrowserStepPhase.Done),
      step("browser_screenshot", cart).title(BrowserStepPhase.Done),
      step("browser_snapshot").title(BrowserStepPhase.Done),
      step("browser_console", failure("TimedOut")).title(BrowserStepPhase.Done),
      step("browser_wait_for", cart).title(BrowserStepPhase.Done),
      step("browser_other", cart).title(BrowserStepPhase.Done)
    ]).toEqual([
      "Pressed Enter",
      "Pressed ",
      "Didn't press Enter",
      "Didn't press Enter · the page changed before it acted, so nothing happened",
      "Took a screenshot of shop.test/cart",
      "Read the page",
      "Couldn't read the console of the page",
      "Waited on shop.test/cart",
      "Used shop.test/cart"
    ]);
  });

  it("says what a running call is doing, and what a failed or cut-off call didn't do, without its record", () => {
    const steps = [
      step("browser_navigate", { servedInput: { url: "https://docs.example.com/pricing" } }),
      step("browser_navigate", { servedInput: { action: "back" } }),
      step("browser_navigate", { servedInput: { action: "stop" } }),
      step("browser_click", { servedInput: { ref: "e5" } }),
      step("browser_type", { servedInput: { ref: "e7" } }),
      step("browser_press_key", { servedInput: { key: "Enter" } }),
      step("browser_screenshot"),
      step("browser_other")
    ];
    expect([steps.map(t => t.title(BrowserStepPhase.Running)), steps.map(t => t.title(BrowserStepPhase.Failed))]).toEqual([
      [
        "Opening docs.example.com/pricing",
        "Going back",
        "Going stop",
        "Clicking an element",
        "Typing into an element",
        "Pressing Enter",
        "Taking a screenshot of the page",
        "Using the page"
      ],
      [
        "Didn't open docs.example.com/pricing",
        "Didn't go back",
        "Didn't go stop",
        "Didn't click an element",
        "Didn't type into an element",
        "Didn't press Enter",
        "Couldn't take a screenshot of the page",
        "Couldn't use the page"
      ]
    ]);
    expect(step("browser_click", failure("Denied")).title(BrowserStepPhase.Running)).toBe("Didn't click an element · you denied it");
  });

  it("says how its call was decided, by the request that decided it and whether the person was asked", () => {
    const pay = { element: { role: "button", name: "Pay", isSecret: false } };
    const asked = (decision: JsonValue, risk = "Medium"): JsonObject => ({ permission: { risk, decision, isRemembered: false, isAsked: true } });
    const unasked = (decision: JsonValue, risk = "Medium", isRemembered: JsonValue = false): JsonObject =>
      ({ permission: { risk, decision, isRemembered, isAsked: false } });
    expect([
      step("browser_click", { ...pay, ...asked("AllowedOnce") }).title(BrowserStepPhase.Done),
      step("browser_click", { ...pay, ...asked("AllowedAlways") }).title(BrowserStepPhase.Done),
      step("browser_click", { ...pay, ...asked("AllowedOnce", "Low") }).title(BrowserStepPhase.Done),
      step("browser_click", { ...pay, ...unasked("AllowedOnce", "Low") }).title(BrowserStepPhase.Done),
      step("browser_click", { ...pay, ...unasked("AllowedOnce") }).title(BrowserStepPhase.Done),
      step("browser_click", { ...pay, ...unasked("AllowedOnce", "High") }).title(BrowserStepPhase.Done),
      step("browser_click", { ...pay, ...unasked("AllowedAlways", "Medium", true) }).title(BrowserStepPhase.Done),
      step("browser_click", { ...pay, ...asked("Denied"), ...failure("Denied") }).title(BrowserStepPhase.Done),
      step("browser_click", { ...pay, ...asked("DeniedAlways"), ...failure("Denied") }).title(BrowserStepPhase.Done),
      step("browser_click", { ...pay, ...unasked("Denied"), ...failure("Denied") }).title(BrowserStepPhase.Done),
      step("browser_click", { ...pay, ...unasked("Denied", "Low", true), ...failure("Denied") }).title(BrowserStepPhase.Done),
      step("browser_click", { ...pay, ...asked("Expired"), ...failure("Denied") }).title(BrowserStepPhase.Done),
      step("browser_click", { ...pay, ...unasked("Withdrawn"), ...failure("Withdrawn") }).title(BrowserStepPhase.Done),
      step("browser_click", { ...pay, ...asked("AllowedOnce"), ...failure("Stale") }).title(BrowserStepPhase.Done),
      step("browser_type", { element: { name: "Password", isSecret: true }, ...asked("AllowedOnce") }).title(BrowserStepPhase.Done),
      step("browser_type", { element: { name: "Password", isSecret: true }, ...asked("TakenOver", "High"), ...failure("Denied") }).title(BrowserStepPhase.Done)
    ]).toEqual([
      "Clicked \"Pay\" · you allowed it",
      "Clicked \"Pay\" · you allowed it from now on",
      "Clicked \"Pay\" · you allowed it",
      "Clicked \"Pay\" · low risk, allowed",
      "Clicked \"Pay\" · allowed by this chat's mode",
      "Clicked \"Pay\" · allowed by this chat's mode",
      "Clicked \"Pay\" · allowed earlier",
      "Didn't click \"Pay\" · you denied it",
      "Didn't click \"Pay\" · you denied it from now on",
      "Didn't click \"Pay\" · denied without asking",
      "Didn't click \"Pay\" · denied earlier",
      "Didn't click \"Pay\" · nobody answered",
      "Didn't click \"Pay\" · stopped before an answer",
      "Didn't click \"Pay\" · the page changed before the click, so nothing was clicked",
      "Typed into \"Password\" · hidden · you allowed it",
      "Didn't type into \"Password\" · hidden · you typed it yourself"
    ]);
    expect([
      step("browser_click", pay).decisionNote,
      step("browser_click", { ...pay, permission: "AllowedOnce" }).decisionNote,
      step("browser_click", { ...pay, ...asked(1) }).decisionNote,
      step("browser_click", { ...pay, ...asked("Asked") }).decisionNote,
      step("browser_click", { ...pay, ...asked("toString") }).decisionNote,
      step("browser_click", { ...pay, permission: { risk: "Medium", decision: "AllowedOnce", isRemembered: "yes", isAsked: "yes" } }).decisionNote,
      step("browser_click", { ...pay, permission: { risk: "Low", decision: "AllowedOnce" } }).decisionNote
    ]).toEqual([null, null, null, null, null, "allowed by this chat's mode", "low risk, allowed"]);
  });

  it("counts as allowed without asking a read that raised no request and a call allowed at Low risk without a card, and no failed or otherwise decided call, and titles one without its decision on asking", () => {
    const low = (decision: string, risk = "Low", isAsked: JsonValue = false): JsonObject => ({ permission: { risk, decision, isRemembered: false, isAsked } });
    expect([
      step("browser_snapshot", cart),
      step("browser_screenshot", cart),
      step("browser_console", cart),
      step("browser_wait_for", cart),
      step("browser_click", low("AllowedOnce")),
      step("browser_navigate", low("AllowedAlways")),
      step("browser_click"),
      step("browser_navigate", cart),
      step("browser_snapshot", failure("Failed")),
      step("browser_click", { ...low("AllowedOnce"), ...failure("Stale") }),
      step("browser_click", low("AllowedOnce", "Medium")),
      step("browser_type", low("AllowedOnce", "High")),
      step("browser_click", low("Denied")),
      step("browser_click", low("Expired")),
      step("browser_click", { permission: "AllowedOnce" }),
      step("browser_click", { permission: { risk: "Low", decision: 1, isRemembered: false, isAsked: false } }),
      step("browser_click", low("AllowedOnce", "Low", true)),
      step("browser_click", { permission: { risk: "Low", decision: "AllowedOnce", isRemembered: false } })
    ].map(t => t.isAllowedWithoutAsking)).toEqual([true, true, true, true, true, true, false, false, false, false, false, false, false, false, false, false, false, false]);
    expect([true, false].map(t => step("browser_click", { element: { name: "Pay" }, ...low("AllowedOnce") }).title(BrowserStepPhase.Done, t)))
      .toEqual(["Clicked \"Pay\" · low risk, allowed", "Clicked \"Pay\""]);
  });

  it("says a step for the low-risk line with the address only when it differs from the step before, and a wait by its text", () => {
    const docs = { page: { url: "https://docs.example.com/pricing", title: "Pricing" } };
    const said = (tool: string, previousUrl: string | null, fields: JsonObject = docs): string => step(tool, fields).lineTitle(previousUrl);
    expect([
      said("browser_snapshot", null),
      said("browser_snapshot", "docs.example.com/pricing"),
      said("browser_screenshot", "docs.example.com/pricing"),
      said("browser_screenshot", "shop.test/cart"),
      said("browser_console", "docs.example.com/pricing"),
      said("browser_console", null),
      said("browser_wait_for", "docs.example.com/pricing", { ...docs, servedInput: { text: "Plans and pricing", timeoutMilliseconds: 5000 } }),
      said("browser_wait_for", null, { ...docs, servedInput: { text: "Plans and pricing", timeoutMilliseconds: 5000 } }),
      said("browser_wait_for", "docs.example.com/pricing", { ...docs, servedInput: { load: true, timeoutMilliseconds: 5000 } }),
      said("browser_wait_for", null, { ...docs, servedInput: { load: true, timeoutMilliseconds: 5000 } }),
      said("browser_snapshot", null, {}),
      said("browser_click", "docs.example.com/pricing", { ...docs, element: { name: "Search" }, permission: { risk: "Low", decision: "AllowedOnce", isRemembered: false, isAsked: false } })
    ]).toEqual([
      "read docs.example.com/pricing",
      "read the page",
      "took a screenshot",
      "took a screenshot of docs.example.com/pricing",
      "read the console",
      "read the console of docs.example.com/pricing",
      "waited for \"Plans and pricing\"",
      "waited for \"Plans and pricing\" on docs.example.com/pricing",
      "waited",
      "waited on docs.example.com/pricing",
      "read the page",
      "clicked \"Search\""
    ]);
  });

  it("reaches every phase from some call status", () => {
    expect(new Set(Object.values(Resources.browserStepPhases))).toEqual(new Set(Object.values(BrowserStepPhase)));
  });
});
