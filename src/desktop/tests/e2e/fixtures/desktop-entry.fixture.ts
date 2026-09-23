/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { app } from "electron";

// Exercise the real main process and window factory without taking desktop focus.
app.on("browser-window-created", (_event, window) => {
  window.hide();
  window.webContents.setBackgroundThrottling(false);
});

await import(new URL("../../../../../node_modules/@noldova/teamrun-desktop/main.js", import.meta.url).href);
