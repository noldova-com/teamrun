/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use strict";

const Module = require("node:module");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..", "..", "..", "..");
require(path.join(root, ..."electron" in process.versions ? ["app"] : [], "node_modules", "@noldova", "context.core", "api", "index.js"));

module.exports = filename => {
  const load = Module._extensions[".node"];
  Module._extensions[".node"] = (module, file) => {
    load(module, file);
    const addon = module.exports;
    if (!Object.isObject(addon) || !Object.isFunction(addon.startDetached))
      return;
    const start = addon.startDetached;
    const preloaded = (executable, launchArguments) => executable === process.execPath && !launchArguments.includes(filename)
      ? ["--require", filename, ...launchArguments]
      : launchArguments;
    module.exports = { ...addon, startDetached: (executable, launchArguments, ...rest) => start(executable, preloaded(executable, launchArguments), ...rest) };
  };
};
