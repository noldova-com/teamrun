/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use strict";

const { appendFileSync, readFileSync } = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const tls = require("node:tls");

const preloadRuntime = require("./runtime-preload.cjs");

const log = process.env["TEAMRUN_ACP_REGISTRY_DOUBLE_LOG"];
const registryHost = "cdn.agentclientprotocol.com";
const registryUrl = "https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json";
const registry = readFileSync(path.join(__dirname, "acp-registry.json"), "utf8");
const icon = readFileSync(path.join(__dirname, "acp-registry-icon.svg"), "utf8");
const icons = new Set(JSON.parse(registry).agents.map(t => t.icon));
const realFetch = globalThis.fetch;
const realConnect = tls.connect;

const urlOf = input => Object.isString(input) ? input : input instanceof URL ? input.href : input.url;

const methodOf = (input, init) => init?.method ?? (Object.isObject(input) && !(input instanceof URL) ? input.method : "GET");

const hostOf = args => {
  const options = args.find(t => Object.isObject(t)) ?? {};
  return options.servername ?? options.host ?? (Object.isString(args[1]) ? args[1] : undefined);
};

const processName = () => process.type ?? (process.env["ELECTRON_RUN_AS_NODE"] === "1" ? "runtime" : "node");

const preload = `--require "${__filename.split(path.sep).join("/")}"`;
const inherited = process.env["NODE_OPTIONS"] ?? "";

if (!Object.isUndefined(log) && !inherited.includes(preload))
  process.env["NODE_OPTIONS"] = inherited === "" ? preload : `${inherited} ${preload}`;

if (!Object.isUndefined(log))
  preloadRuntime(__filename);

if (!Object.isUndefined(log)) {
  globalThis.fetch = async (input, init) => {
    const url = new URL(urlOf(input));
    if (url.hostname !== registryHost)
      return realFetch(input, init);
    const request = `${methodOf(input, init)} ${url.href}`;
    if (methodOf(input, init) === "GET" && url.href === registryUrl) {
      appendFileSync(log, `answered ${request}\n`);
      return new Response(registry, { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (methodOf(input, init) === "GET" && icons.has(url.href)) {
      appendFileSync(log, `answered ${request}\n`);
      return new Response(icon, { status: 200, headers: { "Content-Type": "image/svg+xml" } });
    }
    appendFileSync(log, `refused ${request}\n`);
    throw new TypeError(`The ACP registry double refused ${request}: an end-to-end spec reaches no live registry.`);
  };
  tls.connect = function (...args) {
    if (hostOf(args) !== registryHost)
      return realConnect.apply(this, args);
    appendFileSync(log, `refused TLS ${registryHost}\n`);
    const socket = new net.Socket();
    process.nextTick(() => socket.destroy(new Error(`The ACP registry double refused a TLS connection to ${registryHost}: an end-to-end spec reaches no live registry.`)));
    return socket;
  };
  appendFileSync(log, `loaded ${processName()}\n`);
}
