/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DefaultTheme, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";

import { AccessibilityFixture } from "./accessibility.fixture";
import { FocusRing } from "./focus-ring.fixture";

describe("AccessibilityFixture", () => {
  let root: HTMLElement;
  const build = (html: string): HTMLElement => {
    root.innerHTML = html;
    return root;
  };
  const onFocusedRead = (selector: string, change: (element: HTMLElement) => void): void => {
    for (const element of root.querySelectorAll<HTMLElement>(selector)) {
      const read = element.getBoundingClientRect.bind(element);
      element.addEventListener("focus", () => {
        element.getBoundingClientRect = (): DOMRect => {
          const box = read();
          change(element);
          return box;
        };
      });
    }
  };

  beforeEach(() => {
    root = document.body.appendChild(document.createElement("div"));
    AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Light);
  });

  afterEach(() => {
    root.remove();
    AppearanceFixture.reset();
  });

  it("reads the ring of each control Tab reaches in the view, in Tab order, and none outside it, and the theme's border width and a colour without leaving a probe", async () => {
    build(`<button type="button" class="first" style="outline-offset: 2px">One</button><span>text</span>
      <button type="button" class="second" style="outline-offset: -1px">Two</button>`);
    const style = document.head.appendChild(document.createElement("style"));
    style.textContent = "button:focus-visible { outline: 1px solid rgb(1, 2, 3); }";
    try {
      const rings = await AccessibilityFixture.focusRingsAsync(root);

      expect(rings.map(t => [t.element.className, t.style, t.width, t.color, t.offset])).toEqual([
        ["first", "solid", 1, "rgb(1, 2, 3)", 2],
        ["second", "solid", 1, "rgb(1, 2, 3)", -1]
      ]);
      expect([FocusRing.borderWidthOf(root), FocusRing.colorOf(root, "rgb(4, 5, 6)"), root.children.length]).toEqual([1, "rgb(4, 5, 6)", 3]);
    } finally {
      style.remove();
    }
  });

  it("emulates forced colours while its work runs and turns them off after, even when the work fails", async () => {
    const forced = (): boolean => matchMedia("(forced-colors: active)").matches;
    const during = await AccessibilityFixture.forcedAsync(async () => forced());
    await expect(AccessibilityFixture.forcedAsync(async () => {
      throw new Error("The check failed.");
    })).rejects.toThrow("The check failed.");

    expect([during, forced()]).toEqual([true, false]);
  });

  it("emulates forced colours in a light palette by default and in a dark one when asked, each giving the system's CanvasText", async () => {
    const canvasText = (): string => {
      const probe = document.body.appendChild(document.createElement("span"));
      probe.style.color = "CanvasText";
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    };
    const light = await AccessibilityFixture.forcedAsync(async () => [matchMedia("(prefers-color-scheme: dark)").matches, canvasText()] as const);
    const dark = await AccessibilityFixture.forcedAsync(async () => [matchMedia("(prefers-color-scheme: dark)").matches, canvasText()] as const, "dark");

    expect([light[0], dark[0], light[1] === dark[1], matchMedia("(prefers-color-scheme: dark)").matches]).toEqual([false, true, false, false]);
  });

  it("lays the page out as a 200% zoom of the test window while its work runs, and restores the window's size after", async () => {
    const before = [window.innerWidth, window.innerHeight];
    const during = await AccessibilityFixture.zoomedAsync(async () => [window.innerWidth, window.innerHeight]);

    expect([during, [window.innerWidth, window.innerHeight]]).toEqual([[AccessibilityFixture.zoomedWidth, AccessibilityFixture.zoomedHeight], before]);
  });

  it("passes a view whose every control keeps its look and ring under forced colours, saying how many controls Tab reached, and fails one that loses either", async () => {
    build(`
      <button class="kept">Kept</button>`);
    expect(await AccessibilityFixture.expectVisibleForcedAsync(root)).toBe(1);
    root.insertAdjacentHTML("beforeend", "<style>.lost:focus-visible { outline: none; }</style><span class=\"lost\" tabindex=\"0\">Lost</span>");

    await expect(AccessibilityFixture.expectVisibleForcedAsync(root)).rejects.toThrow("span.lost");
  });

  it("settles a view at 200% zoom before it looks for cut, crossing or lost controls, and fails one that has any", async () => {
    build("<div class=\"box\" style=\"overflow: hidden; height: 2rem\"><div class=\"tall\" style=\"height: 2rem\">Tall</div></div>");
    const tall = (): HTMLElement | null => root.querySelector<HTMLElement>(".tall");
    await AccessibilityFixture.expectFitsZoomedAsync(root, () => Promise.resolve());

    await expect(AccessibilityFixture.expectFitsZoomedAsync(root, async () => tall()?.style.setProperty("height", "10rem"))).rejects.toThrow("div.box");
  });

  it("finds content cut by a box that hides its overflow, but not text cut short with an ellipsis, content that fits, text kept for screen readers, an icon glyph, or a box the caller allows", () => {
    build(`
      <div class="cut" style="width: 3rem; overflow: hidden; white-space: nowrap">A label much longer than its box</div>
      <div class="short" style="width: 3rem; overflow: hidden; white-space: nowrap; text-overflow: ellipsis">A label much longer than its box</div>
      <div class="low" style="height: 1rem; overflow: hidden">One<br>Two<br>Three</div>
      <div class="fits" style="width: 20rem; overflow: hidden">Fits</div>
      <span class="material-symbols-rounded">expand_more</span>
      <span class="spoken" style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap">Read aloud only</span>
      <div class="kept" style="height: 1rem; overflow: hidden">One<br>Two</div>`);

    expect(AccessibilityFixture.clipped(root, [".kept"])).toEqual(["div.cut \"A label much longer than\"", "div.low \"OneTwoThree\""]);
  });

  it("finds two controls whose boxes cross, but not neighbours, a control inside another, a hidden one, one its scroller keeps out of view, or one that sits on another's padding only", () => {
    build(`
      <div style="position: relative; height: 6rem">
        <button class="first" style="position: absolute; left: 0; width: 4rem">First</button>
        <button class="second" style="position: absolute; left: 2rem; width: 4rem">Second</button>
        <button class="third" style="position: absolute; left: 8rem; width: 4rem">Third</button>
        <div role="button" tabindex="0" class="outer" style="position: absolute; top: 3rem; width: 6rem"><button class="inner">Inner</button></div>
        <button class="gone" style="position: absolute; left: 0; visibility: hidden">Gone</button>
        <div style="position: absolute; top: 4.5rem; width: 6rem; height: 1rem; overflow: auto"><div style="height: 2rem"></div><button class="under">Under</button></div>
        <button class="below" style="position: absolute; top: 6rem; left: 0">Below</button>
        <button class="above" style="position: absolute; top: 8rem; left: 8rem; height: 1rem">Above</button>
        <textarea class="padded" style="position: absolute; top: 8.5rem; left: 8rem; height: 3rem; padding-top: 1rem; border: 0"></textarea>
      </div>`);

    expect(AccessibilityFixture.overlapping(root)).toEqual(["button.first \"First\" over button.second \"Second\""]);
  });

  it("finds a control past the window's edge that nothing scrolls to, but not one a scroller or the page's own downward scroll reaches", () => {
    build(`
      <button class="lost" style="position: fixed; left: 200vw">Lost</button>
      <button class="below" style="position: absolute; top: 300vh">Below</button>
      <div style="width: 5rem; overflow: auto"><div style="width: 300vw"><button class="far" style="margin-left: 150vw">Far</button></div></div>`);

    expect(AccessibilityFixture.outside(root)).toEqual(["button.lost \"Lost\""]);
  });

  it("finds a control whose keyboard focus changes nothing on it or around it, but not one that draws a ring", async () => {
    build(`
      <style>.bare.bare:focus-visible { outline: none; }</style>
      <button class="ringed">Ringed</button>
      <button class="bare">Bare</button>`);

    expect(await AccessibilityFixture.unringedAsync(root)).toEqual(["button.bare \"Bare\""]);
  });

  it("ring-checks controls hidden until their group takes focus, once their fade ends, and finds one revealed without a ring or never revealed", async () => {
    build(`
      <style>.tools { opacity: 0; transition: opacity 200ms; } .tools:focus-within { opacity: 1; } .bare.bare:focus-visible { outline: none; }</style>
      <div class="tools"><button class="ringed">Ringed</button><button class="bare">Bare</button></div>
      <div style="opacity: 0"><button class="never">Never</button></div>`);

    expect(await AccessibilityFixture.unringedAsync(root)).toEqual(["button.bare \"Bare\"", "button.never \"Never\" [hidden while focused: div \"Never\" at opacity 0]"]);
  });

  it("ring-checks a control whose group shows a frame after it takes focus, with no fade to wait for, once it shows", async () => {
    build(`
      <style>.late { opacity: 0; } .late.shown { opacity: 1; }</style>
      <div class="late"><button class="after">After</button></div>`);
    for (const after of root.querySelectorAll(".after"))
      after.addEventListener("focus", () => requestAnimationFrame(() => after.parentElement?.classList.add("shown")));

    expect(await AccessibilityFixture.unringedAsync(root)).toEqual([]);
  });

  it("names what keeps a focused control hidden: a zero box, or its visibility turned hidden once the walk reads it", async () => {
    build(`
      <button class="flat" style="width: 0; padding: 0; border: 0">Flat</button>
      <button class="vanishing">Vanishing</button>`);
    onFocusedRead(".vanishing", t => t.style.setProperty("visibility", "hidden"));

    expect(await AccessibilityFixture.unringedAsync(root)).toEqual([
      "button.flat \"Flat\" [hidden while focused: a zero box]",
      "button.vanishing \"Vanishing\" [hidden while focused: hidden by visibility]"
    ]);
  });

  it("names a focused control that leaves the page once the walk reads it", async () => {
    build(`
      <button class="leaving">Leaving</button>`);
    onFocusedRead(".leaving", t => t.remove());

    expect(await AccessibilityFixture.unringedAsync(root)).toEqual(["button.leaving \"Leaving\" [hidden while focused: left the page]"]);
  });

  it("finds, under forced colours only, a control whose focus changes nothing but its background or its shadow", async () => {
    build(`
      <style>
        .filled.filled:focus-visible { outline: none; background-color: rgb(200, 0, 0); }
        .shaded.shaded:focus-visible { outline: none; box-shadow: 0 0 0 2px rgb(200, 0, 0); }
      </style>
      <span class="filled" tabindex="0">Filled</span>
      <span class="shaded" tabindex="0">Shaded</span>`);
    const plain = await AccessibilityFixture.unringedAsync(root);
    const forced = await AccessibilityFixture.forcedAsync(() => AccessibilityFixture.unringedAsync(root));

    expect([plain, forced]).toEqual([[], ["span.filled \"Filled\"", "span.shaded \"Shaded\""]]);
  });

  it("finds, under forced colours only, a selected item that differs from its plain neighbour only in its background", async () => {
    build(`
      <style>.item[aria-selected='true'] { background-color: rgb(200, 0, 0); }</style>
      <div><span class="item" aria-selected="true">One</span><span class="item" aria-selected="false">Two</span></div>`);
    const plain = AccessibilityFixture.stateless(root);
    const forced = await AccessibilityFixture.forcedAsync(async () => AccessibilityFixture.stateless(root));

    expect([plain, forced]).toEqual([[], ["span.item \"One\" [aria-selected]"]]);
  });

  it("says so when Tab reaches none of the view's controls, rather than finding nothing wrong", async () => {
    build("<div role=\"button\" tabindex=\"-1\">Skipped</div>");

    expect(await AccessibilityFixture.unringedAsync(root)).toEqual([AccessibilityFixture.unreached]);
  });

  it("finds a kit dialog, quick input, dialog, menu, list box or tooltip with neither a border on every side nor an outline, but not one with either or drawn within a popup with either, and counts them", () => {
    build(`
      <div role="dialog" class="bare" style="border: 0">Bare<div role="listbox" class="loose" style="border: 0">Loose</div></div>
      <nol-quick-input class="framed" style="display: block; position: relative; border: 1px solid"><div role="listbox" class="inner" style="border: 0">Inner</div><div role="listbox" class="hanging" style="position: absolute; top: 100%; left: 0; border: 0">Hanging</div></nol-quick-input>
      <div role="menu" class="edged" style="border: 1px solid">Edged</div>
      <div role="listbox" class="outlined" style="border: 0; outline: 1px solid">Outlined</div>
      <div role="tooltip" class="ruled" style="border: 0; border-top: 1px solid">Ruled</div>
      <nol-dialog class="plain" style="display: block; border: 0">Plain</nol-dialog>`);

    expect([AccessibilityFixture.borderless(root), AccessibilityFixture.popups(root)]).toEqual([["div.bare \"BareLoose\"", "div.loose \"Loose\"", "div.hanging \"Hanging\"", "div.ruled \"Ruled\"", "nol-dialog.plain \"Plain\""], 9]);
  });

  it("finds a selected, current, pressed or checked control that looks like its plain neighbour, or differs from it only by a child more, but not one that looks different or shows a mark its neighbour hides", () => {
    build(`
      <style>.marked[aria-pressed='true'] { font-weight: 700; } .item[aria-checked='false'] .check { visibility: hidden; }</style>
      <div><span class="item" aria-selected="true">One</span><span class="item" aria-selected="false">Two</span></div>
      <div><button class="marked" aria-pressed="true">Bold</button><button class="marked" aria-pressed="false">Plain</button></div>
      <div><span class="item" aria-checked="true">Yes<i class="check">✓</i></span><span class="item" aria-checked="false">No<i class="check">✓</i></span></div>
      <div><span class="item" aria-checked="true">More<i>+</i></span><span class="item" aria-checked="false">Less</span></div>
      <div><span class="item" aria-current="true">Alone</span></div>`);

    expect(AccessibilityFixture.stateless(root)).toEqual(["span.item \"One\" [aria-selected]", "span.item \"More+\" [aria-checked]"]);
  });

  it("passes a view whose every control Tab reaches with a ring, saying how many, and fails one Tab skips outside a list or draws no ring on, but not one it skips inside a list it reaches or hidden from screen readers", async () => {
    build(`
      <style>.bare.bare:focus-visible { outline: none; }</style>
      <button class="first">First</button>
      <div role="listbox" tabindex="0" aria-label="Fruit"><div role="option" tabindex="-1">Apple</div></div>
      <input role="combobox" aria-label="Find" aria-controls="found"><div role="listbox" id="found" aria-label="Found"><div role="option">Pear</div></div>
      <button disabled>Off</button>
      <span aria-hidden="true"><button tabindex="-1">Silent</button></span>`);
    const reached = await AccessibilityFixture.expectKeyboardAsync(root);
    root.insertAdjacentHTML("beforeend", "<button class=\"bare\">Bare</button><button class=\"skipped\" tabindex=\"-1\">Skipped</button>");

    await expect(AccessibilityFixture.expectKeyboardAsync(root)).rejects.toThrow(JSON.stringify({ unringed: ["button.bare \"Bare\""], untabbed: ["button.skipped \"Skipped\""] }));
    expect(reached).toBe(3);
  });

  it("passes a view whose controls, dialogs, lists and images have names, counting them, and fails one with an unnamed one, a clickable element with no control in it, or a reference to no element", () => {
    build(`
      <button aria-label="Close" class="labelled"><span class="material-symbols-rounded">close</span></button>
      <button class="spoken"><span aria-hidden="true">x</span>Send</button>
      <span id="title">Title</span><div role="dialog" aria-labelledby="title">Body</div>
      <label for="field">Name</label><input id="field">
      <div role="img" title="Chart" style="width: 1rem; height: 1rem"></div>
      <button style="cursor: pointer"><span>Inside</span></button>
      <span tabindex="0">Alice</span>
      <div style="cursor: pointer">Card <button>Open</button></div>
      <span aria-hidden="true"><button class="mute"></button></span>`);
    const named = AccessibilityFixture.expectNamed(root);
    root.insertAdjacentHTML("beforeend", `
      <button class="iconic"><span class="material-symbols-rounded">close</span></button>
      <div role="dialog" class="untitled">Body</div>
      <input class="blank" placeholder="Type">
      <div role="listbox" class="orphan" aria-labelledby="gone" style="height: 1rem"></div>
      <div class="clicky" style="cursor: pointer">Open<span>here</span></div>`);

    expect(() => AccessibilityFixture.expectNamed(root)).toThrow(JSON.stringify({
      unnamed: ["button.iconic \"close\"", "div.untitled \"Body\"", "input.blank", "div.orphan"],
      roleless: ["div.clicky \"Openhere\""],
      unresolved: ["div.orphan [aria-labelledby=gone]"]
    }));
    expect(named).toBe(9);
  });
});
