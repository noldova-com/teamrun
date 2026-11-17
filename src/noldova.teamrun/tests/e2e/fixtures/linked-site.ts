/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createServer, type Server } from "node:http";

import { type ElectronApplication, type Page, expect } from "playwright/test";

import { LocalServer } from "./local-server.ts";
import { TeamRunApp } from "./teamrun-app.fixture.ts";

export interface ILinkStep {
  readonly from: string;
  readonly to: string;
  readonly target: string;
  readonly button: "left" | "middle";
}

export class LinkedSite {
  public static readonly FIELD: string = "nol-browser-toolbar input.nol-browser-toolbar-field";
  public static readonly STEPS: readonly ILinkStep[] = [
    { from: "One", to: "Two", target: "#blank", button: "left" },
    { from: "Two", to: "Three", target: "#open", button: "left" },
    { from: "Three", to: "Four", target: "#plain", button: "middle" }
  ];
  private static readonly OPENED_FROM: string = "Opened from";
  private static readonly ACTION: string = "nol-window-row [data-nol-item=\"teamrun.chatPage\"]";
  private static readonly TITLES: readonly string[] = ["One", "Two", "Three", "Four", "Five"];
  private readonly server: Server;
  public readonly origin: string;

  private constructor(server: Server, origin: string) {
    this.server = server;
    this.origin = origin;
  }

  public static async startAsync(): Promise<LinkedSite> {
    const server = createServer((request, response) => {
      const index = LinkedSite.TITLES.findIndex(t => `/${t.toLowerCase()}` === request.url);
      response.writeHead(index < 0 ? 404 : 200, { "content-type": "text/html; charset=utf-8" });
      response.end(index < 0 ? "" : LinkedSite.pageOf(LinkedSite.TITLES[index] ?? "", LinkedSite.TITLES[index + 1] ?? ""));
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;
    expect(port).toBeGreaterThan(0);
    return new LinkedSite(server, `http://127.0.0.1:${port}`);
  }

  public static openedNameOf(step: ILinkStep): string {
    return `${step.to}, ${LinkedSite.OPENED_FROM} ${step.from}`;
  }

  public urlOf(title: string): string {
    return `${this.origin}/${title.toLowerCase()}`;
  }

  public closeAsync(): Promise<void> {
    return LocalServer.closeAsync(this.server);
  }

  public static async openAsync(page: Page, url: string, title: string): Promise<void> {
    await page.locator(LinkedSite.ACTION).click();
    await expect(page.getByRole("tab", { name: "New tab", exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(page.locator(`${LinkedSite.FIELD}:visible`)).toBeFocused({ timeout: 30_000 });
    await page.keyboard.type(url);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("tab", { name: title, exact: true })).toBeVisible({ timeout: 60_000 });
  }

  public openFirstAsync(page: Page, title: string = "One"): Promise<void> {
    return LinkedSite.openAsync(page, this.urlOf(title), title);
  }

  public isLoadedAsync(application: ElectronApplication, title: string): Promise<boolean> {
    return application.evaluate(({ webContents }, url) => webContents.getAllWebContents().some(t => t.getURL() === url && !t.isLoading()), this.urlOf(title));
  }

  public async pressAsync(application: ElectronApplication, step: ILinkStep): Promise<void> {
    await expect.poll(() => this.isLoadedAsync(application, step.from), { message: `${step.from}'s page is loaded`, ...TeamRunApp.pollOf(30_000) }).toBe(true);
    const url = this.urlOf(step.from);
    const centreAsync = (): Promise<readonly number[]> => application.evaluate(async ({ webContents }, { address, target }) => {
      const contents = webContents.getAllWebContents().find(t => t.getURL() === address);
      if (contents === undefined)
        return [];
      contents.focus();
      const centre: unknown = await contents.executeJavaScript(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => { `
        + `const element = document.querySelector(${JSON.stringify(target)}); `
        + "const box = element.getBoundingClientRect(); const [x, y] = [Math.round(box.left + box.width / 2), Math.round(box.top + box.height / 2)]; "
        + "if (window.nolPresses === undefined) { window.nolPresses = []; document.addEventListener('mousedown', event => window.nolPresses.push(event.button), true); } "
        + "resolve(document.visibilityState === 'visible' && document.hasFocus() && element.contains(document.elementFromPoint(x, y)) ? [x, y] : []); })))");
      return Array.isArray(centre) ? centre.map(Number) : [];
    }, { address: url, target: step.target });
    const pressesAsync = (): Promise<number> => application.evaluate(async ({ webContents }, address) =>
      Number(await webContents.getAllWebContents().find(t => t.getURL() === address)?.executeJavaScript("(window.nolPresses ?? []).length") ?? 0), url);
    await expect.poll(async () => (await centreAsync()).length, { message: `${step.from}'s ${step.target} can take a click`, ...TeamRunApp.pollOf(30_000) }).toBe(2);
    const [x = 0, y = 0] = await centreAsync();
    await application.evaluate(async ({ webContents }, { address, at, button }) => {
      const contents = webContents.getAllWebContents().find(t => t.getURL() === address);
      const record: unknown[] = [];
      Reflect.set(globalThis, "nolInput", record);
      contents?.on("input-event", (_event, input) => record.push([Date.now(), input.type]));
      await contents?.executeJavaScript("window.nolEvents = []; for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click', 'auxclick', 'blur', 'focus', 'visibilitychange']) "
        + "window.addEventListener(type, event => window.nolEvents.push([Date.now(), type, event.isTrusted]), true); true");
      record.push([Date.now(), "sending"]);
      contents?.sendInputEvent({ type: "mouseMove", x: at.x, y: at.y });
      contents?.sendInputEvent({ type: "mouseDown", x: at.x, y: at.y, button, clickCount: 1 });
      contents?.sendInputEvent({ type: "mouseUp", x: at.x, y: at.y, button, clickCount: 1 });
    }, { address: url, at: { x, y }, button: step.button });
    const stateAsync = (): Promise<unknown> => application.evaluate(async ({ webContents, BrowserWindow }, address) => {
      const contents = webContents.getAllWebContents().find(t => t.getURL() === address);
      return {
        input: Reflect.get(globalThis, "nolInput"),
        isFocused: contents?.isFocused(),
        windows: BrowserWindow.getAllWindows().map(t => ({ isFocused: t.isFocused(), isVisible: t.isVisible(), bounds: t.getContentBounds() })),
        page: await contents?.executeJavaScript("({ events: window.nolEvents, visibility: document.visibilityState, hasFocus: document.hasFocus(), size: [innerWidth, innerHeight] })")
      };
    }, url);
    await expect.poll(pressesAsync, { message: `${step.from}'s page got the press at ${x}, ${y}`, ...TeamRunApp.pollOf(10_000) }).toBeGreaterThan(0)
      .catch(async (error: unknown) => {
        throw new Error(`${error instanceof Error ? error.message : String(error)}\nWhat the app and the page saw: ${JSON.stringify(await stateAsync())}`, { cause: error });
      });
  }

  public async expectShownAsync(application: ElectronApplication, page: Page, title: string, name: string = title): Promise<void> {
    const tab = page.getByRole("tab", { name, exact: true });
    await expect(tab, `${title}'s tab`).toBeVisible({ timeout: 60_000 });
    await tab.click();
    await expect(page.locator(`${LinkedSite.FIELD}:visible`), `${title}'s address field`).toHaveValue(this.urlOf(title), { timeout: 30_000 });
    await expect.poll(() => this.isLoadedAsync(application, title), { message: `${title}'s page loaded`, ...TeamRunApp.pollOf(30_000) }).toBe(true);
  }

  private static pageOf(title: string, next: string): string {
    const path = `/${next.toLowerCase()}`;
    return `<!doctype html><title>${title}</title><h1>${title}</h1>`
      + `<a id="blank" href="${path}" target="_blank" style="display: block; height: 40px">In a new tab</a>`
      + `<button id="open" type="button" onclick="window.open('${path}')" style="display: block; height: 40px">window.open</button>`
      + `<a id="plain" href="${path}" style="display: block; height: 40px">Plain link</a>`;
  }
}
