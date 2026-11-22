/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use strict";

const { appendFileSync, existsSync } = require("node:fs");
const path = require("node:path");

const preloadRuntime = require("./runtime-preload.cjs");

const code = process.env["TEAMRUN_GITHUB_DOUBLE_CODE"];
const log = process.env["TEAMRUN_GITHUB_DOUBLE_LOG"];
const gitHubHosts = new Set(["github.com", "api.github.com"]);
const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
const webProtocols = new Set(["http:", "https:", "ws:", "wss:"]);
const deviceCodeUrl = "https://github.com/login/device/code";
const accessTokenUrl = "https://github.com/login/oauth/access_token";
const verificationUri = process.env["TEAMRUN_GITHUB_DOUBLE_VERIFICATION"] ?? "https://github.com/login/device";
const userUrl = "https://api.github.com/user";
const login = "octo-e2e";
const realFetch = globalThis.fetch;

const answer = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

const isApproved = () => existsSync(`${log}.approved`);

const urlOf = input => Object.isString(input) ? input : input instanceof URL ? input.href : input.url;

const methodOf = (input, init) => init?.method ?? (Object.isObject(input) && !(input instanceof URL) ? input.method : "GET");

const processName = () => process.type ?? (process.env["ELECTRON_RUN_AS_NODE"] === "1" ? "runtime" : "node");

const preload = `--require "${__filename.split(path.sep).join("/")}"`;
const inherited = process.env["NODE_OPTIONS"] ?? "";

if (!Object.isUndefined(code) && !Object.isUndefined(log) && !inherited.includes(preload))
  process.env["NODE_OPTIONS"] = inherited === "" ? preload : `${inherited} ${preload}`;

if (!Object.isUndefined(code) && !Object.isUndefined(log))
  preloadRuntime(__filename);

if (!Object.isUndefined(code) && !Object.isUndefined(log)) {
  globalThis.fetch = async (input, init) => {
    const url = new URL(urlOf(input));
    const request = `${methodOf(input, init)} ${url.href}`;
    if (!webProtocols.has(url.protocol) || loopbackHosts.has(url.hostname))
      return realFetch(input, init);
    if (!gitHubHosts.has(url.hostname)) {
      appendFileSync(log, `refused ${request}\n`);
      throw new TypeError(`The GitHub double refused ${request}: an end-to-end spec reaches no host but loopback.`);
    }
    appendFileSync(log, `answered ${request}\n`);
    if (url.href === deviceCodeUrl)
      return answer(200, { device_code: "e2e-device-code", user_code: code, verification_uri: verificationUri, expires_in: 900, interval: 1 });
    if (url.href === accessTokenUrl)
      return answer(200, isApproved() ? { access_token: "e2e-double-token", token_type: "bearer", scope: "repo" } : { error: "authorization_pending" });
    if (url.href === userUrl && isApproved())
      return answer(200, { login, name: "Octo E2E", avatar_url: "https://avatars.example.invalid/u/1" }, { "x-oauth-scopes": "repo" });
    return answer(401, { message: "Bad credentials" });
  };
  appendFileSync(log, `loaded ${processName()}\n`);
}
