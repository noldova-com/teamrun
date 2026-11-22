/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { expect } from "playwright/test";

import { CodexDouble } from "./fixtures/codex-double.ts";
import { TeamRunApp, test } from "./fixtures/teamrun-app.fixture.ts";

const SANDBOX_PAGE = [
  "<!doctype html><title>Sandbox</title><pre id=\"out\">{}</pre><script>",
  "const seen = {}; const violations = []; const port = location.port;",
  "const addresses = { ownPage: location.href.split('#')[0], otherPage: 'http://127.0.0.1:' + port + '/pages/other', file: 'file:///etc/hosts',",
  "  frame: 'https://example.com', image: 'https://example.com/x.png', script: 'https://example.com/x.js', style: 'https://example.com/x.css' };",
  "const matches = (blocked, address) => blocked === address || (blocked.length > 0 && !/^https?:/u.test(blocked) && address.startsWith(blocked));",
  "const show = () => {",
  "  seen.violations = Object.fromEntries(Object.entries(addresses).map(([name, address]) => [name,",
  "    violations.filter(t => matches(t.blockedURI, address)).map(t => t.effectiveDirective).join(' ')]));",
  "  document.getElementById('out').textContent = JSON.stringify(seen);",
  "};",
  "const settle = (name, run) => Promise.resolve().then(run).then(() => { seen[name] = 'allowed'; }, () => { seen[name] = 'refused'; }).then(show);",
  "const load = (name, element, attribute, url) => new Promise((resolve, reject) => {",
  "  element.addEventListener('load', resolve); element.addEventListener('error', reject); element[attribute] = url; document.body.append(element);",
  "}).then(() => { seen[name] = 'allowed'; }, () => { seen[name] = 'refused'; }).then(show);",
  "document.addEventListener('securitypolicyviolation', t => { violations.push(t); show(); });",
  "document.body.append(Object.assign(document.createElement('iframe'), { src: addresses.frame + '/' }));",
  "Promise.all([",
  "  settle('ownPage', () => fetch(addresses.ownPage, { mode: 'no-cors' })),",
  "  settle('otherPage', () => fetch(addresses.otherPage, { mode: 'no-cors' })),",
  "  settle('file', () => fetch(addresses.file, { mode: 'no-cors' })),",
  "  settle('storage', () => localStorage.length),",
  "  settle('cookie', () => { document.cookie = 'a=1'; }),",
  "  settle('indexedDb', () => indexedDB.open('pages')),",
  "  settle('topLevel', () => { seen.isTopLevel = window.top === window && window.parent === window && window.opener === null; }),",
  "  load('image', new Image(), 'src', addresses.image),",
  "  load('script', document.createElement('script'), 'src', addresses.script),",
  "  load('style', Object.assign(document.createElement('link'), { rel: 'stylesheet' }), 'href', addresses.style)",
  "]);",
  "</script>"
].join("\n");

test("a page a teammate shows opens as its own document with the page in its view, the teammate's edit and a show again of the page each show there as its next version, "
  + "and the page's sandbox refuses it its own address, other pages, files, storage, other sources and leaving its address, and runs it at the top level with no opener",
  async ({ app }, testInfo) => {
    const page = await app.openChatAsync();
    const folder = path.join(app.work, "site");
    mkdirSync(folder);
    writeFileSync(path.join(folder, "options.html"), "<!doctype html><title>Options</title><h1>Draft</h1>");
    const opened = app.run(["teamrun", "open-folder", folder, "--json"]);
    const projectId = /"id":"([0-9a-f-]{36})"/.exec(opened)?.[1];
    expect(projectId, opened).toBeDefined();
    const created = app.run(["teamrun", "new-chat", String(projectId), "--title", "Onboarding", "--json"]);
    const chatId = /"id":"([0-9a-f-]{36})"/.exec(created)?.[1];
    expect(chatId, created).toBeDefined();
    await page.getByRole("treeitem", { name: /Onboarding/ }).first().click({ timeout: 60_000 });
    const panel = page.getByRole("tabpanel", { name: "Onboarding", exact: true });
    await expect(panel.getByRole("combobox", { name: "Message", exact: true })).toBeEditable({ timeout: 60_000 });
    const shownText = (): Promise<readonly string[]> => app.electronApp.evaluate(({ webContents }) => Promise.all(webContents.getAllWebContents()
      .filter(t => /^http:\/\/127\.0\.0\.1:\d+\/pages\//u.test(t.getURL()) && !t.isLoading())
      .map(async t => String(await t.executeJavaScript("document.body.innerText")))));

    await app.submitAsync(`${CodexDouble.PAGE_PREFIX}options.html`);

    await expect(page.getByRole("tab", { name: CodexDouble.PAGE_TITLE, exact: true })).toBeVisible({ timeout: 60_000 });
    const pageDocument = page.locator("nol-teamrun-page-document");
    await expect(pageDocument.locator(".nol-teamrun-page-name")).toHaveText(CodexDouble.PAGE_TITLE);
    await expect(pageDocument.locator(".nol-teamrun-page-authors")).toHaveText(/^v1 · Made by \S/u);
    await expect.poll(shownText, TeamRunApp.pollOf(60_000)).toEqual(["Draft"]);
    await testInfo.attach("page-document", { body: await page.screenshot(), contentType: "image/png" });

    await TeamRunApp.showTabAsync(page, "Onboarding");
    await expect(panel.getByRole("combobox", { name: "Message", exact: true })).toBeEditable();
    await app.sendAsync(`${CodexDouble.EDIT_PAGE_PREFIX}Draft => Final`);

    await TeamRunApp.showTabAsync(page, CodexDouble.PAGE_TITLE);
    await expect(pageDocument.locator(".nol-teamrun-page-bar-message")).toHaveText(/^\S.* updated this page to v2 just now\.$/u, { timeout: 60_000 });
    await expect(pageDocument.locator(".nol-teamrun-page-authors")).toHaveText(/^v2 · Made by \S/u);
    await expect.poll(shownText, TeamRunApp.pollOf(60_000)).toEqual(["Final"]);
    await testInfo.attach("page-updated", { body: await page.screenshot(), contentType: "image/png" });

    writeFileSync(path.join(folder, "options.html"), "<!doctype html><title>Options</title><h1>Shown again</h1>");
    await TeamRunApp.showTabAsync(page, "Onboarding");
    await expect(panel.getByRole("combobox", { name: "Message", exact: true })).toBeEditable();
    await app.submitAsync(`${CodexDouble.RESHOW_PAGE_PREFIX}options.html`);

    await TeamRunApp.showTabAsync(page, CodexDouble.PAGE_TITLE);
    await expect(pageDocument.locator(".nol-teamrun-page-bar-message")).toHaveText(/^\S.* updated this page to v3 just now\.$/u, { timeout: 60_000 });
    await expect.poll(shownText, TeamRunApp.pollOf(60_000)).toEqual(["Shown again"]);

    writeFileSync(path.join(folder, "sandbox.html"), SANDBOX_PAGE);
    await TeamRunApp.showTabAsync(page, "Onboarding");
    await expect(panel.getByRole("combobox", { name: "Message", exact: true })).toBeEditable();
    await app.submitAsync(`${CodexDouble.PAGE_PREFIX}sandbox.html`);
    const sandboxText = (): Promise<string> => app.electronApp.evaluate(async ({ webContents }) => String(await webContents.getAllWebContents()
      .find(t => t.getTitle() === "Sandbox" && !t.isLoading())?.executeJavaScript("document.getElementById('out').textContent") ?? "{}"));
    const seen = async (): Promise<unknown> => JSON.parse(await sandboxText());
    await expect.poll(seen, TeamRunApp.pollOf(60_000)).toEqual({
      ownPage: "refused", otherPage: "refused", file: "refused", storage: "refused", cookie: "refused", indexedDb: "refused",
      topLevel: "allowed", isTopLevel: true, image: "refused", script: "refused", style: "refused", violations: {
        ownPage: "connect-src", otherPage: "connect-src", file: "connect-src", frame: "frame-src", image: "img-src", script: "script-src-elem",
        style: "style-src-elem"
      }
    });
    const address = await app.electronApp.evaluate(({ webContents }) => webContents.getAllWebContents().find(t => t.getTitle() === "Sandbox")?.getURL() ?? "");
    await app.electronApp.evaluate(({ webContents }, shown) => {
      const contents = webContents.getAllWebContents().find(t => t.getURL() === shown);
      Object.assign(globalThis, { sandboxLeave: contents?.getURL() ?? "no page" });
      contents?.on("will-frame-navigate", event => {
        if (event.isMainFrame && event.url === "https://example.com/")
          Object.assign(globalThis, { sandboxLeave: event.defaultPrevented ? "refused" : "allowed" });
      });
      void contents?.executeJavaScript("location.href = 'https://example.com/'; true").then(undefined, () => Object.assign(globalThis, { sandboxLeave: "unreachable" }));
    }, address);
    const leave = (): Promise<string> => app.electronApp.evaluate(() => String(Reflect.get(globalThis, "sandboxLeave")));
    const kept = (): Promise<string[]> => app.electronApp.evaluate(async ({ webContents }) => {
      const contents = webContents.getAllWebContents().find(t => t.getTitle() === "Sandbox");
      return [contents?.getURL() ?? "", String(await contents?.executeJavaScript("location.href") ?? "")];
    });

    expect(address).toMatch(/^http:\/\/127\.0\.0\.1:\d+\//u);
    await expect.poll(leave, TeamRunApp.pollOf(30_000)).toBe("refused");
    await expect.poll(kept, TeamRunApp.pollOf(30_000)).toEqual([address, address]);
    expect(app.unexpectedFailures).toEqual([]);
  });
