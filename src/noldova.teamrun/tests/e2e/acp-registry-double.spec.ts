/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { expect } from "playwright/test";

import { TeamRunApp, test } from "./fixtures/teamrun-app.fixture.ts";

const DOUBLE: string = path.join(import.meta.dirname, "fixtures", "acp-registry-double.cjs");
const REGISTRY: string = "https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json";
const ICON: string = "https://cdn.agentclientprotocol.com/registry/v1/latest/e2e-registry-agent.svg";
const UNSERVED: string = "https://cdn.agentclientprotocol.com/registry/v1/latest/unlisted.svg";
const AGENT: string = "e2e-registry-agent";
const HOST: string = "cdn.agentclientprotocol.com";
const FETCH_SCRIPT: string = `fetch(${JSON.stringify(UNSERVED)}).then(() => console.log("fetched"), error => console.log(error.message))`;
const HTTPS_GET_SCRIPT: string = `require("node:https").get(${JSON.stringify(UNSERVED)}, () => console.log("got")).on("error", error => console.log(error.message))`;

const linesOf = (log: string): readonly string[] => readFileSync(log, "utf8").split(/\r?\n/).filter(t => t !== "");

const requestUnserved = (script: string, log: string): string => spawnSync(process.execPath, ["-r", DOUBLE, "-e", script],
  { encoding: "utf8", env: { ...process.env, TEAMRUN_ACP_REGISTRY_DOUBLE_LOG: log }, timeout: 30_000 }).stdout.trim();

test("serves the ACP registry and its icons to the app's runtime from the registry double", async ({ app }) => {
  const page = await app.startAsync();
  const providers = page.locator("nol-teamrun-providers-view");
  await expect(providers.getByRole("note", { name: "Welcome to TeamRun" })).toBeVisible({ timeout: 60_000 });

  await providers.getByRole("button", { name: "Add provider", exact: true }).click();
  await providers.getByRole("group", { name: "Provider type" }).locator("[data-kind='acp:agents']").click();
  const agent = page.getByRole("dialog").locator(`.nol-teamrun-acp-agent[data-agent="${AGENT}"]`);

  await expect(agent).toContainText("Registry double agent", { timeout: 60_000 });
  await expect(agent.locator(".nol-teamrun-acp-mark")).toBeVisible({ timeout: 30_000 });
  expect(linesOf(app.registryLog)).toEqual(expect.arrayContaining(["loaded browser", "loaded runtime", `answered GET ${REGISTRY}`, `answered GET ${ICON}`]));
  expect(TeamRunApp.liveRequestsOf(app.registryLog)).toEqual([]);
});

test("refuses a request to the live registry's host that it doesn't serve, by fetch or https.get, which the fixture's check then reports", async ({ app }, testInfo) => {
  const log = testInfo.outputPath("acp-registry.log");

  const fetched = requestUnserved(FETCH_SCRIPT, log);
  const got = requestUnserved(HTTPS_GET_SCRIPT, log);

  expect(fetched).toBe(`The ACP registry double refused GET ${UNSERVED}: an end-to-end spec reaches no live registry.`);
  expect(got).toBe(`The ACP registry double refused a TLS connection to ${HOST}: an end-to-end spec reaches no live registry.`);
  expect(TeamRunApp.liveRequestsOf(log)).toEqual([`GET ${UNSERVED}`, `TLS ${HOST}`]);
  expect(TeamRunApp.liveRequestsOf(app.registryLog)).toEqual([]);
});

test("fails a spec that passed its own checks once its run made a request the registry double refused", async ({ app }) => {
  test.fail(true, "the app fixture fails this spec after it ends, from the refused request in the app's own registry log; the spec's own checks pass");

  const got = requestUnserved(HTTPS_GET_SCRIPT, app.registryLog);

  expect(got).toBe(`The ACP registry double refused a TLS connection to ${HOST}: an end-to-end spec reaches no live registry.`);
  expect(TeamRunApp.liveRequestsOf(app.registryLog)).toEqual([`TLS ${HOST}`]);
});
