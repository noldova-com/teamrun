/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";

import { type ElectronApplication, expect, type Locator } from "playwright/test";

import { CodexDouble } from "./fixtures/codex-double.ts";
import { LocalServer } from "./fixtures/local-server.ts";
import { TeamRunApp, test } from "./fixtures/teamrun-app.fixture.ts";

interface IKeyInput {
  readonly at: number;
  readonly contentsId: number;
  readonly isPage: boolean;
  readonly type: string;
  readonly isFocused: boolean;
}

declare global {
  var nolKeys: IKeyInput[] | undefined;
}

const SNAPSHOT: string = "browser_snapshot";
const VIEW_CLOSED: string = "browser.viewClosed";
const PAGE_NOT_CHANGED: string = "Browser page:";
const FORM_PAGE: string = "<!doctype html><title>Order</title><form method=\"post\" action=\"/sent\"><label>Name<input name=\"name\"></label>"
  + "<button>Send</button></form>";
const SENT_PAGE: string = "<!doctype html><title>Sent</title><h1>Thanks, Ada</h1>";
const SIGN_IN_PAGE: string = "<!doctype html><title>Sign in</title><form id=\"find\"><label>Query<input name=\"q\"></label></form>"
  + "<button type=\"button\" id=\"note\">Note</button>"
  + "<form method=\"post\" action=\"/sent\"><label>Password<input type=\"password\" name=\"pw\"></label><button>Sign in</button></form><script>"
  + "const send = t => { const r = new XMLHttpRequest(); r.open(\"POST\", \"/event\", false); r.send(t); };"
  + "document.addEventListener(\"keydown\", e => send(`keydown:${e.key}`), true);"
  + "document.addEventListener(\"input\", e => send(`input:${e.target.name}`), true);"
  + "document.getElementById(\"note\").addEventListener(\"click\", () => send(\"click:note\"));"
  + "document.getElementById(\"find\").addEventListener(\"submit\", e => { e.preventDefault(); send(\"submit:find\"); });</script>";
const signedInPage = (away: string): string => "<!doctype html><title>Signed in</title><h1>Signed in</h1>"
  + "<div role=\"button\" tabindex=\"0\" id=\"continue\">Continue</div>"
  + `<form id="away" method="post" action="${away}/away"><input type="password" name="pw" value="kept"></form><script>`
  + "document.getElementById(\"continue\").addEventListener(\"click\", () => {"
  + " const r = new XMLHttpRequest(); r.open(\"POST\", \"/event\", false); r.send(\"click:continue\"); document.getElementById(\"away\").submit(); });</script>";

const serveFormAsync = async (received: string[]): Promise<Server> => {
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      if (request.method === "POST")
        received.push(Buffer.concat(chunks).toString("utf8"));
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(request.method === "POST" ? SENT_PAGE : FORM_PAGE);
    });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  return server;
};

test("a teammate's Browser call, asked from the message box, opens the chat's page as a document with its tab and reaches it, and the chat's message box is empty again", async ({ app }, testInfo) => {
  const page = await app.openChatAsync();

  await app.submitAsync(`${CodexDouble.BROWSER_PREFIX}${SNAPSHOT}`);

  await expect(page.getByRole("tab", { name: "New tab", exact: true })).toBeVisible({ timeout: 60_000 });
  const answer = (): string => existsSync(app.codexLog) ? readFileSync(app.codexLog, "utf8").split("\n").find(t => t.includes(` ${SNAPSHOT}: `)) ?? "" : "";
  await expect.poll(answer, TeamRunApp.pollOf(60_000)).not.toBe("");
  await testInfo.attach("chat-page", { body: await page.screenshot(), contentType: "image/png" });
  expect([answer().includes(VIEW_CLOSED), answer().includes('"isError":true'), answer().includes('"isError":false')]).toEqual([false, false, true]);
  expect(app.unexpectedFailures.filter(t => t.includes(VIEW_CLOSED) || t.includes(PAGE_NOT_CHANGED))).toEqual([]);
  await page.getByRole("tree").locator(".nol-teamrun-conversation-row[aria-selected='true'] .nol-teamrun-conversation-title").click();
  await expect(app.composer).toHaveValue("");
  await expect(app.composer).toBeEditable();
});

const serveSignInAsync = async (events: string[], away: string): Promise<Server> => {
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      if (request.method === "POST")
        events.push(request.url === "/event" ? Buffer.concat(chunks).toString("utf8") : `${request.url ?? ""} ${Buffer.concat(chunks).toString("utf8")}`);
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(request.url === "/sent" ? signedInPage(away) : SIGN_IN_PAGE);
    });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  return server;
};

test("a teammate opens a site on this computer without a card at Low risk, reads it and fills its form after the person allows each change, and the site gets the form", async ({ app }, testInfo) => {
  const received: string[] = [];
  const server = await serveFormAsync(received);
  try {
    const address = server.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;
    expect(port).toBeGreaterThan(0);
    const origin = `http://127.0.0.1:${port}`;
    const page = await app.openChatAsync();
    await app.nameLocalSitesAsync(origin);

    await app.submitAsync(`${CodexDouble.FORM_PREFIX}${origin}/`);

    await expect(page.getByRole("tab", { name: "Order", exact: true })).toBeVisible({ timeout: 60_000 });
    await page.getByRole("tree").locator(".nol-teamrun-conversation-row[aria-selected='true'] .nol-teamrun-conversation-title").click();
    const allowOnce = (title: string): Locator => page.locator("nol-permission-card").filter({ hasText: title }).getByRole("button", { name: "Allow once", exact: true });
    await expect(allowOnce("Type into")).toBeVisible({ timeout: 60_000 });
    await expect(page.locator("nol-permission-card")).toHaveCount(1);
    await expect(page.locator(".nol-teamrun-low-risk-text")).toHaveText(new RegExp(`^Low risk, allowed without asking: .+ opened 127\\.0\\.0\\.1:${port}/`, "u"));
    await allowOnce("Type into").click();
    await expect(allowOnce("Submit a form")).toBeVisible({ timeout: 60_000 });
    expect(received).toEqual([]);
    await expect(async () => testInfo.attach("click-card", { body: await page.locator("nol-permission-card").filter({ hasText: "Submit a form" }).screenshot(), contentType: "image/png" }))
      .toPass({ timeout: 60_000 });
    await allowOnce("Submit a form").click();
    await expect.poll(() => received, TeamRunApp.pollOf(60_000)).toEqual([`name=${CodexDouble.FORM_NAME}`]);
    const lines = (): string[] => existsSync(app.codexLog) ? readFileSync(app.codexLog, "utf8").split("\n") : [];
    await expect.poll(() => lines().some(t => t.includes(" browser_snapshot: ") && t.includes("Thanks, Ada")), TeamRunApp.pollOf(60_000)).toBe(true);
    expect(received).toEqual([`name=${CodexDouble.FORM_NAME}`]);
    await testInfo.attach("form-sent", { body: await page.screenshot(), contentType: "image/png" });
    const snapshots = lines().filter(t => t.includes(" browser_snapshot: "));
    expect(snapshots[0]?.includes("textbox \\\"Name\\\"")).toBe(true);
    expect(lines().filter(t => / browser_(navigate|type|click): /u.test(t)).map(t => t.includes('"isError":false'))).toEqual([true, true, true]);
    expect(app.unexpectedFailures.filter(t => t.includes(VIEW_CLOSED) || t.includes(PAGE_NOT_CHANGED))).toEqual([]);
  }
  finally {
    await LocalServer.closeAsync(server);
  }
});

const KEY_TYPES: readonly string[] = ["rawKeyDown", "keyDown", "char", "keyUp"];
const KEY_DOWN_TYPES: readonly string[] = ["rawKeyDown", "keyDown"];
const READ_MILLISECONDS: number = 5_000;

const recordKeysAsync = async (application: ElectronApplication, address: string): Promise<void> => {
  await expect.poll(() => application.evaluate(({ webContents }, url) => webContents.getAllWebContents().some(t => t.getURL() === url && !t.isLoading()), address),
    TeamRunApp.pollOf(60_000)).toBe(true);
  await application.evaluate(async ({ webContents }, { url, types }) => {
    const record: IKeyInput[] = [];
    globalThis.nolKeys = record;
    for (const contents of webContents.getAllWebContents())
      contents.on("input-event", (_event, input) => {
        if (types.includes(input.type))
          record.push({ at: Date.now(), contentsId: contents.id, isPage: contents.getURL() === url, type: input.type, isFocused: contents.isFocused() });
      });
    await webContents.getAllWebContents().find(t => t.getURL() === url)?.executeJavaScript("window.nolKeys = []; "
      + "for (const type of ['keydown', 'keypress', 'keyup', 'focus', 'blur', 'focusin', 'visibilitychange']) window.addEventListener(type, event => "
      + "window.nolKeys.push({ at: Date.now(), type, key: event.key ?? '', active: document.activeElement?.getAttribute('name') ?? document.activeElement?.tagName, "
      + "hasFocus: document.hasFocus(), visibility: document.visibilityState }), true); true");
  }, { url: address, types: KEY_TYPES });
};

const sawEnterAsync = (application: ElectronApplication, address: string): Promise<{ main: boolean; page: boolean }> =>
  application.evaluate(async ({ webContents }, { url, types }) => ({
    main: (globalThis.nolKeys ?? []).some(t => t.isPage && types.includes(t.type)),
    page: await webContents.getAllWebContents().find(t => t.getURL() === url)?.executeJavaScript(
      "(window.nolKeys ?? []).some(t => t.type === 'keydown' && t.key === 'Enter')") === true
  }), { url: address, types: KEY_DOWN_TYPES });

const readKeysAsync = (application: ElectronApplication, address: string): Promise<unknown> => application.evaluate(async ({ webContents, BrowserWindow }, { url, milliseconds }) => {
  const contents = webContents.getAllWebContents().find(t => t.getURL() === url);
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<string>(resolve => {
    timer = setTimeout(() => resolve(`not read in ${String(milliseconds)} ms`), milliseconds);
  });
  try {
    const keys: unknown = contents === undefined ? null : await Promise.race([contents.executeJavaScript("window.nolKeys ?? null"), late]);
    return {
      input: globalThis.nolKeys ?? null,
      page: contents === undefined ? null : { id: contents.id, isFocused: contents.isFocused(), keys },
      windows: BrowserWindow.getAllWindows().map(t => ({ isFocused: t.isFocused(), isVisible: t.isVisible() }))
    };
  }
  finally {
    clearTimeout(timer);
  }
}, { url: address, milliseconds: READ_MILLISECONDS });

const readWithinAsync = async (read: Promise<unknown>): Promise<unknown> => {
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<string>(resolve => {
    timer = setTimeout(() => resolve(`not read in ${String(2 * READ_MILLISECONDS)} ms`), 2 * READ_MILLISECONDS);
  });
  try {
    return await Promise.race([read.catch((failure: unknown) => `not read: ${failure instanceof Error ? failure.message : String(failure)}`), late]);
  }
  finally {
    clearTimeout(timer);
  }
};

const serveAwayAsync = async (reached: string[]): Promise<Server> => {
  const server = createServer((request, response) => {
    reached.push(`${request.method ?? ""} ${request.url ?? ""}`);
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end("<!doctype html><title>Away</title>");
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  return server;
};

const originOf = (server: Server): string => {
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  expect(port).toBeGreaterThan(0);
  return `http://127.0.0.1:${port}`;
};

test("a teammate's click, key, typing into a password field and submit of the form that holds it each reach the page only after the person allows its card, "
  + "a script's submit asks at medium risk and can't leave for a site not allowed, and a new site asks before it opens", async ({ app }, testInfo) => {
  const events: string[] = [];
  const reached: string[] = [];
  const awayServer = await serveAwayAsync(reached);
  const away = originOf(awayServer);
  const server = await serveSignInAsync(events, away).catch(async (error: unknown) => {
    await LocalServer.closeAsync(awayServer);
    throw error;
  });
  try {
    const origin = originOf(server);
    const page = await app.openChatAsync();
    await app.nameLocalSitesAsync(origin);

    await app.submitAsync(`${CodexDouble.SIGN_IN_PREFIX}${origin}/`);

    await expect(page.getByRole("tab", { name: "Sign in", exact: true })).toBeVisible({ timeout: 60_000 });
    await page.getByRole("tree").locator(".nol-teamrun-conversation-row[aria-selected='true'] .nol-teamrun-conversation-title").click();
    const cards = page.locator("nol-permission-card");
    const lines = (): string[] => existsSync(app.codexLog) ? readFileSync(app.codexLog, "utf8").split("\n") : [];
    await recordKeysAsync(app.electronApp, `${origin}/`);
    const steps: readonly (readonly [string, string, string, string])[] = [
      ["find", "Type into", "Medium risk", "input:q"],
      ["search", "Submit a form", "Medium risk", "keydown:Enter"],
      ["note", "Click", "Medium risk", "click:note"],
      ["secret", "Type into", "High risk", "input:pw"],
      ["signin", "Submit a form", "High risk", `/sent pw=${CodexDouble.SIGN_IN_SECRET}`],
      ["continue", "Click", "Medium risk", "click:continue"]
    ];
    for (const [item, title, risk, event] of steps) {
      for (const answer of ["Deny", "Allow once"]) {
        const card = cards.filter({ hasText: title });
        await expect(card).toBeVisible({ timeout: 60_000 });
        await expect(cards).toHaveCount(1);
        await expect(card.locator(".nol-permission-card-risk")).toContainText(risk);
        await expect(card).not.toContainText(CodexDouble.SIGN_IN_SECRET);
        if (event === "input:pw")
          await expect(card.locator(".nol-permission-card-code")).toContainText(`Text: ${CodexDouble.SIGN_IN_SECRET.length} characters, hidden`);
        expect(events).not.toContain(event);
        if (answer === "Allow once")
          await expect(async () => testInfo.attach(`card-${event}`, { body: await card.screenshot(), contentType: "image/png" })).toPass({ timeout: 60_000 });
        const answered = await card.getAttribute("data-nol-teamrun-approval");
        expect(answered).toMatch(/.+/u);
        await card.getByRole("button", { name: answer, exact: true }).click();
        await expect(page.locator(`nol-permission-card[data-nol-teamrun-approval="${String(answered)}"]`)).toHaveCount(0, { timeout: 60_000 });
        if (answer === "Deny") {
          await expect.poll(() => lines().some(t => t.endsWith(` ${CodexDouble.SIGN_IN_PREFIX}${item} ${CodexDouble.SIGN_IN_DENIED}`)), TeamRunApp.pollOf(60_000)).toBe(true);
          expect(events).not.toContain(event);
        }
      }
      await expect.poll(() => events, TeamRunApp.pollOf(60_000)).toContain(event).catch(async (error: unknown) => {
        const seen: unknown = await readWithinAsync(readKeysAsync(app.electronApp, `${origin}/`));
        const calls: string[] = lines().filter(t => t.includes(" browser_")).slice(-4).map(t => t.slice(0, 400));
        throw new Error(`${error instanceof Error ? error.message : String(error)}\nWhat the app and the page saw: ${JSON.stringify({ seen, calls, events })}`, { cause: error });
      });
      if (event === "keydown:Enter")
        expect(await sawEnterAsync(app.electronApp, `${origin}/`)).toEqual({ main: true, page: true });
    }
    const leave = cards.filter({ has: page.getByRole("button", { name: "Allow this site for the workspace", exact: true }) });
    await expect(leave).toBeVisible({ timeout: 60_000 });
    await expect(cards).toHaveCount(1);
    await expect(leave.locator(".nol-permission-card-risk")).toContainText("Medium risk");
    await expect(leave.getByRole("button", { name: "Allow this site for the workspace", exact: true })).toBeVisible();
    await expect(leave.getByRole("button", { name: "Allow once", exact: true })).toHaveCount(0);
    await expect(async () => testInfo.attach("card-new-site", { body: await leave.screenshot(), contentType: "image/png" })).toPass({ timeout: 60_000 });
    await leave.getByRole("button", { name: "Deny", exact: true }).click();
    await expect.poll(() => lines().some(t => t.endsWith(` ${CodexDouble.SIGN_IN_PREFIX}away ${CodexDouble.SIGN_IN_DENIED}`)), TeamRunApp.pollOf(60_000)).toBe(true);
    expect([reached, events.filter(t => t.startsWith("/"))]).toEqual([[], [`/sent pw=${CodexDouble.SIGN_IN_SECRET}`]]);
    await expect.poll(() => events, TeamRunApp.pollOf(60_000)).toContain("submit:find");
    await expect.poll(() => lines().some(t => t.includes(" browser_wait_for: ") && t.includes('"isError":false')), TeamRunApp.pollOf(60_000)).toBe(true);
    expect(app.unexpectedFailures.filter(t => t.includes(VIEW_CLOSED) || t.includes(PAGE_NOT_CHANGED))).toEqual([]);
  }
  finally {
    await LocalServer.closeAsync(server);
    await LocalServer.closeAsync(awayServer);
  }
});
