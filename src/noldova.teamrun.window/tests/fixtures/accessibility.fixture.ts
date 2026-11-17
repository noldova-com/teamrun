/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { page, userEvent } from "vitest/browser";

import { DefaultTheme, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";

import { EmulatedMediaFixture } from "./emulated-media.fixture";
import { FocusRing } from "./focus-ring.fixture";

export class AccessibilityFixture {
  public static readonly zoomedWidth: number = 640;
  public static readonly zoomedHeight: number = 400;
  public static readonly unreached: string = "Tab reaches no control in the view";
  private static readonly CONTROLS: string = "button, input, textarea, select, a[href], [role='button'], [role='tab'], [role='option'], [role='menuitem'], [role='treeitem'], "
    + "[role='checkbox'], [role='switch'], [role='radio'], [contenteditable='true'], [tabindex]:not([tabindex='-1'])";
  private static readonly STATES: readonly string[] = ["aria-selected", "aria-current", "aria-pressed", "aria-checked"];
  private static readonly LOOK: readonly string[] = ["outline-style", "outline-width", "outline-color", "border-top-style", "border-top-width", "border-top-color",
    "border-bottom-color", "border-left-color", "background-color", "color", "box-shadow", "text-decoration-line", "font-weight", "content"];
  private static readonly PSEUDOS: readonly (string | null)[] = [null, "::before", "::after"];
  private static readonly RING_DEPTH: number = 3;
  private static readonly TAB_LIMIT: number = 300;
  private static readonly SHOW_FRAMES: number = 60;
  private static readonly SLACK: number = 1;
  private static readonly ICONS: string = ".material-symbols-rounded";
  private static readonly COMPOSITES: string = "[role='listbox'], [role='menu'], [role='menubar'], [role='radiogroup'], [role='tablist'], [role='tree'], [role='grid'], "
    + "[role='treegrid'], [role='toolbar'], [role='feed']";
  private static readonly NAMED_ONLY: string = "[role='dialog'], [role='alertdialog'], [role='feed'], [role='listbox'], [role='menu'], [role='tree'], [role='grid'], "
    + "[role='tablist'], [role='img'], img";
  private static readonly FROM_CONTENT: string = "button, a[href], summary, [role='button'], [role='link'], [role='option'], [role='menuitem'], [role='tab'], [role='treeitem'], "
    + "[role='checkbox'], [role='radio'], [role='switch'], [role='heading'], [tabindex]:not([tabindex='-1'])";
  private static readonly SILENT: string = "[aria-hidden='true'], [hidden], .material-symbols-rounded";
  private static readonly REFERENCES: readonly string[] = ["aria-labelledby", "aria-describedby", "aria-controls", "aria-activedescendant", "aria-owns", "aria-errormessage", "for"];
  private static readonly POPUPS: string = "nol-dialog, nol-quick-input, [role='dialog'], [role='alertdialog'], [role='menu'], [role='listbox'], [role='tooltip']";
  private static readonly FORCED: string = "(forced-colors: active)";
  private static readonly CLEAR: RegExp = /^rgba\(.*,\s*0\)$/;
  private static readonly CHANNELS: RegExp = /^rgba?\(([^,]+),\s*([^,]+),\s*([^,)]+).*$/;

  public static async forcedAsync<T>(run: () => Promise<T>, scheme: "light" | "dark" = "light"): Promise<T> {
    await EmulatedMediaFixture.emulateEachAsync({ "forced-colors": "active", "prefers-color-scheme": scheme });
    try {
      return await run();
    } finally {
      await EmulatedMediaFixture.resetAsync();
    }
  }

  public static async zoomedAsync<T>(run: () => Promise<T>): Promise<T> {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    await page.viewport(AccessibilityFixture.zoomedWidth, AccessibilityFixture.zoomedHeight);
    try {
      return await run();
    } finally {
      await page.viewport(viewport.width, viewport.height);
    }
  }

  public static async expectVisibleForcedAsync(root: Element): Promise<number> {
    return await AccessibilityFixture.themedAsync(() => AccessibilityFixture.forcedAsync(async () => {
      const borderless = AccessibilityFixture.borderless(root);
      const stateless = AccessibilityFixture.stateless(root);
      const walk = await AccessibilityFixture.walkAsync(root);
      const found = { borderless, stateless, unringed: walk.found };
      expect(found, JSON.stringify(found)).toEqual({ borderless: [], stateless: [], unringed: [] });
      return walk.reached;
    }));
  }

  public static async expectKeyboardAsync(root: Element): Promise<number> {
    return await AccessibilityFixture.themedAsync(async () => {
      const walk = await AccessibilityFixture.walkAsync(root);
      const found = { unringed: walk.found, untabbed: AccessibilityFixture.untabbed(root, walk.seen) };
      expect(found, JSON.stringify(found)).toEqual({ unringed: [], untabbed: [] });
      return walk.reached;
    });
  }

  public static expectNamed(root: Element): number {
    const found = { unnamed: AccessibilityFixture.unnamed(root), roleless: AccessibilityFixture.roleless(root), unresolved: AccessibilityFixture.unresolved(root) };
    expect(found, JSON.stringify(found)).toEqual({ unnamed: [], roleless: [], unresolved: [] });
    return AccessibilityFixture.shown(root, `${AccessibilityFixture.CONTROLS}, ${AccessibilityFixture.NAMED_ONLY}`).length;
  }

  public static unnamed(root: Element): string[] {
    return AccessibilityFixture.shown(root, `${AccessibilityFixture.CONTROLS}, ${AccessibilityFixture.NAMED_ONLY}`).filter(t => !AccessibilityFixture.silenced(t) && AccessibilityFixture.nameOf(t).length === 0)
      .map(AccessibilityFixture.describe);
  }

  public static roleless(root: Element): string[] {
    return AccessibilityFixture.shown(root, "*").filter(t => {
      const parent = t.parentElement;
      return getComputedStyle(t).cursor === "pointer" && Object.isNull(t.closest(`${AccessibilityFixture.CONTROLS}, label`)) && Object.isNull(t.querySelector(AccessibilityFixture.CONTROLS))
        && (Object.isNull(parent) || getComputedStyle(parent).cursor !== "pointer");
    }).map(AccessibilityFixture.describe);
  }

  public static unresolved(root: Element): string[] {
    const found: string[] = [];
    for (const attribute of AccessibilityFixture.REFERENCES)
      for (const element of root.querySelectorAll(`[${attribute}]`))
        for (const id of AccessibilityFixture.references(element, attribute))
          if (Object.isNull(document.getElementById(id)))
            found.push(`${AccessibilityFixture.describe(element)} [${attribute}=${id}]`);
    return found;
  }

  public static async expectFitsZoomedAsync(root: Element, settle: () => Promise<unknown>, allowed: readonly string[] = []): Promise<void> {
    await AccessibilityFixture.themedAsync(() => AccessibilityFixture.zoomedAsync(async () => {
      await settle();
      const found = { clipped: AccessibilityFixture.clipped(root, allowed), overlapping: AccessibilityFixture.overlapping(root), outside: AccessibilityFixture.outside(root) };
      expect(found, JSON.stringify(found)).toEqual({ clipped: [], overlapping: [], outside: [] });
    }));
  }

  public static clipped(root: Element, allowed: readonly string[] = []): string[] {
    return AccessibilityFixture.shown(root, "*").filter(t => ![AccessibilityFixture.ICONS, ...allowed].some(u => t.matches(u)) && !AccessibilityFixture.readAloudOnly(t)).filter(t => {
      const style = getComputedStyle(t);
      const cuts = (overflow: string): boolean => overflow === "hidden" || overflow === "clip";
      const across = cuts(style.overflowX) && style.textOverflow !== "ellipsis" && t.scrollWidth > t.clientWidth + AccessibilityFixture.SLACK;
      const down = cuts(style.overflowY) && t.scrollHeight > t.clientHeight + AccessibilityFixture.SLACK;
      return across || down;
    }).map(AccessibilityFixture.describe);
  }

  public static overlapping(root: Element): string[] {
    const controls = AccessibilityFixture.shown(root, AccessibilityFixture.CONTROLS);
    const found: string[] = [];
    controls.forEach((first, index) => {
      for (const second of controls.slice(index + 1)) {
        if (first.contains(second) || second.contains(first))
          continue;
        const [a, b] = [AccessibilityFixture.seen(first), AccessibilityFixture.seen(second)];
        if (AccessibilityFixture.crosses(AccessibilityFixture.content(first, a), AccessibilityFixture.content(second, b)))
          found.push(`${AccessibilityFixture.describe(first)} over ${AccessibilityFixture.describe(second)}`);
      }
    });
    return found;
  }

  public static outside(root: Element): string[] {
    return AccessibilityFixture.shown(root, AccessibilityFixture.CONTROLS).filter(t => {
      const box = t.getBoundingClientRect();
      const across = box.left < -AccessibilityFixture.SLACK || box.right > window.innerWidth + AccessibilityFixture.SLACK;
      const down = box.top < -AccessibilityFixture.SLACK || box.bottom > window.innerHeight + AccessibilityFixture.SLACK;
      return (across && !AccessibilityFixture.scrolls(t, "x")) || (down && !AccessibilityFixture.scrolls(t, "y"));
    }).map(AccessibilityFixture.describe);
  }

  public static async unringedAsync(root: Element): Promise<string[]> {
    return (await AccessibilityFixture.walkAsync(root)).found;
  }

  public static async focusRingsAsync(root: Element): Promise<FocusRing[]> {
    AccessibilityFixture.blur();
    const start = document.createElement("button");
    root.before(start);
    const seen = new Set<Element>([start]);
    const rings: FocusRing[] = [];
    try {
      start.focus();
      for (let step = 0; step < AccessibilityFixture.TAB_LIMIT; step++) {
        await userEvent.tab();
        await AccessibilityFixture.transitionedAsync();
        const focused = document.activeElement;
        if (Object.isNull(focused) || focused === document.body || seen.has(focused))
          break;
        seen.add(focused);
        if (root.contains(focused))
          rings.push(new FocusRing(focused));
      }
    } finally {
      AccessibilityFixture.blur();
      start.remove();
    }
    return rings;
  }

  public static async framesAsync(count: number): Promise<void> {
    for (let index = 0; index < count; index++)
      await new Promise<number>(resolve => requestAnimationFrame(resolve));
  }

  private static async walkAsync(root: Element): Promise<{ readonly found: string[]; readonly reached: number; readonly seen: ReadonlySet<Element> }> {
    AccessibilityFixture.blur();
    const resting = new Map([...root.querySelectorAll(AccessibilityFixture.CONTROLS)].map(t => [t, AccessibilityFixture.ringLook(t)]));
    const start = document.createElement("button");
    root.before(start);
    const seen = new Set<Element>([start]);
    const found: string[] = [];
    try {
      start.focus();
      for (let step = 0; step < AccessibilityFixture.TAB_LIMIT; step++) {
        await userEvent.tab();
        await AccessibilityFixture.transitionedAsync();
        const focused = document.activeElement;
        if (Object.isNull(focused) || focused === document.body || seen.has(focused))
          break;
        seen.add(focused);
        const before = resting.get(focused);
        if (!root.contains(focused))
          continue;
        if (Object.isUndefined(before)) {
          found.push(`${AccessibilityFixture.describe(focused)} [no resting look]`);
          continue;
        }
        const hider = await AccessibilityFixture.hiderAsync(focused);
        if (!Object.isNull(hider))
          found.push(`${AccessibilityFixture.describe(focused)} [hidden while focused: ${hider}]`);
        else if (AccessibilityFixture.ringLook(focused) === before)
          found.push(AccessibilityFixture.describe(focused));
      }
    } finally {
      AccessibilityFixture.blur();
      start.remove();
    }
    const reached = [...seen].filter(t => root.contains(t)).length;
    if (AccessibilityFixture.shown(root, AccessibilityFixture.CONTROLS).length > 0 && reached === 0)
      found.push(AccessibilityFixture.unreached);
    return { found, reached, seen };
  }

  private static untabbed(root: Element, seen: ReadonlySet<Element>): string[] {
    const focused = [...seen];
    return AccessibilityFixture.shown(root, AccessibilityFixture.CONTROLS).filter(t => !t.matches(":disabled") && !seen.has(t) && !AccessibilityFixture.silenced(t)).filter(t => {
      const composite = t.closest(AccessibilityFixture.COMPOSITES);
      return Object.isNull(composite) || !focused.some(u => composite.contains(u) || AccessibilityFixture.references(u, "aria-controls").includes(composite.id));
    }).map(AccessibilityFixture.describe);
  }

  private static silenced(element: Element): boolean {
    return !Object.isNull(element.closest("[aria-hidden='true']"));
  }

  private static references(element: Element, attribute: string): string[] {
    return (element.getAttribute(attribute) ?? String.empty).split(/\s+/).filter(t => t.length > 0);
  }

  private static nameOf(element: Element): string {
    const labelledBy = AccessibilityFixture.references(element, "aria-labelledby");
    const labels = element.matches("input, textarea, select") ? [...document.querySelectorAll("label")].filter(t => t.control === element) : [];
    const names = [
      labelledBy.map(t => AccessibilityFixture.spoken(document.getElementById(t))).join(" "),
      element.getAttribute("aria-label") ?? String.empty,
      labels.map(t => AccessibilityFixture.spoken(t)).join(" "),
      element.getAttribute("alt") ?? String.empty,
      element.getAttribute("title") ?? String.empty,
      element.matches(AccessibilityFixture.FROM_CONTENT) ? AccessibilityFixture.spoken(element) : String.empty
    ];
    return names.map(t => t.replace(/\s+/g, " ").trim()).find(t => t.length > 0) ?? String.empty;
  }

  private static spoken(node: Node | null): string {
    if (Object.isNull(node) || (node instanceof Element && node.matches(AccessibilityFixture.SILENT)))
      return String.empty;
    if (node instanceof Text)
      return node.data;
    return [...node.childNodes].map(t => AccessibilityFixture.spoken(t)).join(String.empty);
  }

  public static stateless(root: Element): string[] {
    const found: string[] = [];
    for (const state of AccessibilityFixture.STATES)
      for (const marked of AccessibilityFixture.shown(root, `[${state}='true']`)) {
        const plain = [...marked.parentElement?.children ?? []].find(t => t !== marked && t.localName === marked.localName && t.getAttribute(state) !== "true");
        if (!Object.isUndefined(plain) && AccessibilityFixture.look(marked) === AccessibilityFixture.look(plain) && !AccessibilityFixture.showsMark(marked, plain))
          found.push(`${AccessibilityFixture.describe(marked)} [${state}]`);
      }
    return found;
  }

  public static popups(root: Element): number {
    return AccessibilityFixture.shown(root, AccessibilityFixture.POPUPS).length;
  }

  public static borderless(root: Element): string[] {
    const popups = AccessibilityFixture.shown(root, AccessibilityFixture.POPUPS);
    return popups.filter(t => !AccessibilityFixture.edged(t) && !popups.some(u => u !== t && u.contains(t) && AccessibilityFixture.edged(u) && AccessibilityFixture.within(t, u)))
      .map(AccessibilityFixture.describe);
  }

  private static async themedAsync<T>(run: () => Promise<T>): Promise<T> {
    AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Light);
    try {
      return await run();
    } finally {
      AppearanceFixture.reset();
    }
  }

  private static async transitionedAsync(): Promise<void> {
    await Promise.allSettled(document.getAnimations().filter(t => t instanceof CSSTransition).map(t => t.finished));
  }

  private static blur(): void {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
  }

  private static crosses(a: DOMRect, b: DOMRect): boolean {
    const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return width > AccessibilityFixture.SLACK && height > AccessibilityFixture.SLACK;
  }

  private static content(element: Element, seen: DOMRect): DOMRect {
    const style = getComputedStyle(element);
    const inset = (side: string): number => Number.parseFloat(style.getPropertyValue(`padding-${side}`)) + Number.parseFloat(style.getPropertyValue(`border-${side}-width`));
    const box = element.getBoundingClientRect();
    const [left, top] = [Math.max(seen.left, box.left + inset("left")), Math.max(seen.top, box.top + inset("top"))];
    const [right, bottom] = [Math.min(seen.right, box.right - inset("right")), Math.min(seen.bottom, box.bottom - inset("bottom"))];
    return new DOMRect(left, top, Math.max(0, right - left), Math.max(0, bottom - top));
  }

  private static seen(element: Element): DOMRect {
    const box = element.getBoundingClientRect();
    let [left, top, right, bottom] = [box.left, box.top, box.right, box.bottom];
    for (let at = element.parentElement; !Object.isNull(at); at = at.parentElement) {
      if (getComputedStyle(at).overflow === "visible")
        continue;
      const edge = at.getBoundingClientRect();
      [left, top, right, bottom] = [Math.max(left, edge.left), Math.max(top, edge.top), Math.min(right, edge.right), Math.min(bottom, edge.bottom)];
    }
    return new DOMRect(left, top, Math.max(0, right - left), Math.max(0, bottom - top));
  }

  private static edged(element: Element): boolean {
    const style = getComputedStyle(element);
    const drawn = (kind: string, width: string): boolean => kind !== "none" && Number.parseFloat(width) > 0;
    const framed = drawn(style.borderTopStyle, style.borderTopWidth) && drawn(style.borderRightStyle, style.borderRightWidth)
      && drawn(style.borderBottomStyle, style.borderBottomWidth) && drawn(style.borderLeftStyle, style.borderLeftWidth);
    return framed || drawn(style.outlineStyle, style.outlineWidth);
  }

  private static within(inner: Element, outer: Element): boolean {
    const [box, edge] = [inner.getBoundingClientRect(), outer.getBoundingClientRect()];
    const slack = AccessibilityFixture.SLACK;
    return box.left >= edge.left - slack && box.top >= edge.top - slack && box.right <= edge.right + slack && box.bottom <= edge.bottom + slack;
  }

  private static shown(root: Element, selector: string): Element[] {
    return [...root.querySelectorAll(selector)].filter(AccessibilityFixture.isShown);
  }

  private static async hiderAsync(element: Element): Promise<string | null> {
    let hider = AccessibilityFixture.hider(element);
    for (let frame = 0; frame < AccessibilityFixture.SHOW_FRAMES && !Object.isNull(hider); frame++) {
      await new Promise<number>(resolve => requestAnimationFrame(resolve));
      hider = AccessibilityFixture.hider(element);
    }
    return hider;
  }

  private static hider(element: Element): string | null {
    if (!element.isConnected)
      return "left the page";
    const box = element.getBoundingClientRect();
    if (box.width === 0 || box.height === 0)
      return "a zero box";
    for (let at: Element | null = element; !Object.isNull(at); at = at.parentElement)
      if (Number.parseFloat(getComputedStyle(at).opacity) === 0)
        return `${AccessibilityFixture.describe(at)} at opacity 0`;
    return element.checkVisibility({ visibilityProperty: true }) ? null : "hidden by visibility";
  }

  private static isShown(element: Element): boolean {
    return element.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0;
  }

  private static readAloudOnly(element: Element): boolean {
    return element.clientWidth <= AccessibilityFixture.SLACK && element.clientHeight <= AccessibilityFixture.SLACK;
  }

  private static scrolls(element: Element, axis: "x" | "y"): boolean {
    for (let at = element.parentElement; !Object.isNull(at); at = at.parentElement) {
      const overflow = axis === "x" ? getComputedStyle(at).overflowX : getComputedStyle(at).overflowY;
      const more = axis === "x" ? at.scrollWidth > at.clientWidth : at.scrollHeight > at.clientHeight;
      if ((overflow === "auto" || overflow === "scroll") && more)
        return true;
    }
    return axis === "y" && document.documentElement.scrollHeight > document.documentElement.clientHeight;
  }

  private static showsMark(marked: Element, plain: Element): boolean {
    const [inMarked, inPlain] = [[...marked.querySelectorAll("*")], [...plain.querySelectorAll("*")]];
    const visible = (element: Element): boolean => getComputedStyle(element).display !== "none" && getComputedStyle(element).visibility === "visible";
    return inMarked.length === inPlain.length && inMarked.every((t, index) => t.localName === inPlain[index]?.localName)
      && inMarked.some((t, index) => visible(t) && !visible(inPlain[index] ?? t));
  }

  private static look(element: Element): string {
    return AccessibilityFixture.PSEUDOS.map(t => {
      const style = getComputedStyle(element, t);
      const undrawn = (u: string): boolean => (u.startsWith("outline-") && u !== "outline-style" && style.outlineStyle === "none")
        || (u.startsWith("border-") && u !== "border-top-style" && style.borderTopStyle === "none");
      return AccessibilityFixture.LOOK.map(u => undrawn(u) ? String.empty : AccessibilityFixture.drawn(u, style.getPropertyValue(u))).join("|");
    }).join("/");
  }

  private static drawn(property: string, value: string): string {
    if (property !== "background-color" || !matchMedia(AccessibilityFixture.FORCED).matches)
      return value;
    const probe = document.body.appendChild(document.createElement("div"));
    probe.style.backgroundColor = "Canvas";
    const canvas = getComputedStyle(probe).backgroundColor;
    probe.remove();
    const channels = (color: string): string => color.replace(AccessibilityFixture.CHANNELS, "$1,$2,$3");
    return AccessibilityFixture.CLEAR.test(value) || channels(value) === channels(canvas) ? String.empty : value;
  }

  private static ringLook(element: Element): string {
    const parts: string[] = [];
    let at: Element | null = element;
    for (let depth = 0; depth <= AccessibilityFixture.RING_DEPTH && !Object.isNull(at); depth++, at = at.parentElement)
      parts.push(AccessibilityFixture.look(at));
    return parts.join("//");
  }

  private static describe(element: Element): string {
    const classes = [...element.classList].slice(0, 2).map(t => `.${t}`).join(String.empty);
    const text = (element.getAttribute("aria-label") ?? element.textContent ?? String.empty).trim().replace(/\s+/g, " ").slice(0, 24);
    return `${element.localName}${classes}${text.length > 0 ? ` "${text}"` : String.empty}`;
  }
}
