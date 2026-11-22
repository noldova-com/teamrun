/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { expect, test } from "playwright/test";

import { CodexDouble } from "./fixtures/codex-double.ts";
import { LocalServer } from "./fixtures/local-server.ts";
import { ProcessStatus } from "./fixtures/process-status.ts";
import { TeamRunApp } from "./fixtures/teamrun-app.fixture.ts";

test.describe("the end-to-end fixture's environment", () => {
  test("gives the app the test's home through HOME on Linux and macOS, starts Codex's double from a shell shim, and keeps the other variables", () => {
    const platforms: readonly NodeJS.Platform[] = ["linux", "darwin"];
    for (const platform of platforms) {
      const environment = TeamRunApp.environmentOf(platform, { HOME: "/home/someone", PATH: "/usr/bin", CODEX_HOME: "/home/someone/.codex", LANG: "C", Path: "/kept" },
        { EXTRA: "1", HOME: "/ignored" }, "/tmp/tre-1/home", "/tmp/tre-1/bin", "/tmp/tre-1/codex.log");
      const shims = TeamRunApp.shimsOf(platform, "/tmp/tre-1/bin");

      expect(environment).toEqual({ LANG: "C", Path: "/kept", EXTRA: "1", HOME: "/tmp/tre-1/home", PATH: "/tmp/tre-1/bin:/usr/bin",
        [CodexDouble.LOG_VARIABLE]: "/tmp/tre-1/codex.log" });
      expect(shims.map(t => t.file)).toEqual(["/tmp/tre-1/bin/codex"]);
      expect(shims[0]?.script).toMatch(/^#!\/bin\/sh\nexec ".+" ".+codex-double\.ts" "\$@"\n$/);
    }
  });

  test("gives the app the test's home through USERPROFILE, APPDATA and LOCALAPPDATA on Windows, whatever case the inherited names have, and a .cmd shim", () => {
    const home = "C:\\Temp\\tre-1\\home";
    const environment = TeamRunApp.environmentOf("win32", { UserProfile: "C:\\Users\\someone", AppData: "C:\\Users\\someone\\AppData\\Roaming",
      LOCALAPPDATA: "C:\\Users\\someone\\AppData\\Local", Path: "C:\\Windows", Codex_Home: "C:\\Users\\someone\\.codex", SystemRoot: "C:\\Windows" },
    {}, home, "C:\\Temp\\tre-1\\bin", "C:\\Temp\\tre-1\\codex.log");
    const shims = TeamRunApp.shimsOf("win32", "C:\\Temp\\tre-1\\bin");

    expect(environment).toEqual({ SystemRoot: "C:\\Windows", HOME: home, USERPROFILE: home, APPDATA: `${home}\\AppData\\Roaming`,
      LOCALAPPDATA: `${home}\\AppData\\Local`, PATH: "C:\\Temp\\tre-1\\bin;C:\\Windows", [CodexDouble.LOG_VARIABLE]: "C:\\Temp\\tre-1\\codex.log" });
    expect(shims.map(t => t.file)).toEqual(["C:\\Temp\\tre-1\\bin\\codex.cmd"]);
    expect(shims[0]?.script).toMatch(/^@".+" ".+codex-double\.ts" %\*\r\n$/);
  });

  test("makes the folders its home variables name on the platform it runs on", async () => {
    const app = new TeamRunApp();
    try {
      expect(Object.values(TeamRunApp.homeVariablesOf(process.platform, app.home)).filter(t => !existsSync(t))).toEqual([]);
      expect(TeamRunApp.shimsOf(process.platform, path.join(app.work, "bin")).filter(t => !existsSync(t.file))).toEqual([]);
    }
    finally {
      await app.closeAsync(false);
    }
  });

  test("removes its work folder when preparing it fails, and passes the failure on", () => {
    let made = "";

    expect(() => TeamRunApp.makeWork(tmpdir(), work => {
      made = work;
      throw new Error("No room for the home folder.");
    })).toThrow("No room for the home folder.");
    expect([made === "", existsSync(made)]).toEqual([false, false]);
  });

  test("passes the preparation's failure on when removing the work folder fails too", () => {
    let made = "";
    let removed = "";

    try {
      expect(() => TeamRunApp.makeWork(tmpdir(), work => {
        made = work;
        throw new Error("No room for the home folder.");
      }, work => {
        removed = work;
        throw new Error("The folder is in use.");
      })).toThrow("No room for the home folder.");
      expect([made === "", removed]).toEqual([false, made]);
    }
    finally {
      if (made !== "")
        rmSync(made, { recursive: true, force: true });
    }
  });
});

const statusOf = (pid: number, parent: number, start: string): ProcessStatus => new ProcessStatus(pid, `p${pid}`, start, parent, -1, "", "");

test.describe("the end-to-end fixture's process checks", () => {
  test("counts a process as a child only when it started at or after its parent, since Windows keeps the parent id of a process whose parent ended", () => {
    const runtime = statusOf(100, 1, "500");
    const statuses = [runtime, statusOf(200, 100, "600"), statusOf(300, 100, "400"), statusOf(400, 200, "700"), statusOf(500, 300, "800"), statusOf(600, 100, "500")];

    expect(TeamRunApp.withChildren([runtime], statuses).map(t => t.pid)).toEqual([100, 200, 600, 400]);
  });

  test("reads a pid file that isn't there yet as not written, and passes on any other read failure", () => {
    const folder = mkdtempSync(path.join(tmpdir(), "tre-pid-"));
    try {
      expect(TeamRunApp.readPid(path.join(folder, "missing.pid"))).toBeNull();
      expect(() => TeamRunApp.readPid(folder)).toThrow(/EISDIR/);
    }
    finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });

  test("reads a pid file as not written while it isn't there, is held open, or is a deleted name a scanner still holds on Windows, and nothing else", () => {
    const failed = (code: string): Error => Object.assign(new Error(`${code}: the read failed`), { code });

    expect(["ENOENT", "EBUSY", "EPERM", "EACCES", "EISDIR"].map(t => TeamRunApp.isUnwritten(failed(t)))).toEqual([true, true, true, false, false]);
    expect([TeamRunApp.isUnwritten(new Error("No code.")), TeamRunApp.isUnwritten("EPERM")]).toEqual([false, false]);
  });
});

test.describe("the end-to-end fixture's local servers", () => {
  test("close with a connection open that has sent no request, as the app's browser on Windows keeps, and end that connection", async () => {
    const server = createServer((_request, response) => response.end());
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = Object.isObject(address) ? address.port : 0;
    const accepted = new Promise<void>(resolve => server.once("connection", () => resolve()));
    const socket = connect(port, "127.0.0.1");
    const ended = new Promise<void>(resolve => socket.once("close", () => resolve()));
    await accepted;

    await LocalServer.closeAsync(server);

    await ended;
    expect(server.listening).toBe(false);
    expect(socket.destroyed).toBe(true);
  });
});
