/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PageKeys } from "../../../../src/app/services/pages/page-keys";

describe("PageKeys", () => {
  const press = (init: KeyboardEventInit): KeyboardEvent => new KeyboardEvent("keydown", init);

  it("declares reload, zoom in, zoom out, actual size and print as webViews.json does", () => {
    expect(PageKeys.all.map(t => t.toJson())).toEqual([
      { name: "reload", keys: ["Mod+R", "F5"], macKeys: ["Mod+R"] },
      { name: "zoomIn", keys: ["Mod+Equal", "Mod+Shift+Equal"], macKeys: ["Mod+Equal", "Mod+Shift+Equal"] },
      { name: "zoomOut", keys: ["Mod+Minus"], macKeys: ["Mod+Minus"] },
      { name: "actualSize", keys: ["Mod+0"], macKeys: ["Mod+0"] },
      { name: "print", keys: ["Mod+P"], macKeys: ["Mod+P"] }
    ]);
  });

  it("names Noldova Desktop's platform from the browser's, Linux for any it doesn't know", () => {
    expect(["MacIntel", "Win32", "Linux x86_64", ""].map(t => PageKeys.platformOf(t))).toEqual(["darwin", "win32", "linux", "linux"]);
  });

  it("finds the key a press is on each platform, zoom in with or without Shift, and none for another press", () => {
    expect([
      PageKeys.find(press({ key: "r", code: "KeyR", ctrlKey: true }), "win32"),
      PageKeys.find(press({ key: "F5", code: "F5" }), "linux"),
      PageKeys.find(press({ key: "=", code: "Equal", ctrlKey: true }), "linux"),
      PageKeys.find(press({ key: "+", code: "Equal", ctrlKey: true, shiftKey: true }), "win32"),
      PageKeys.find(press({ key: "=", code: "Equal", metaKey: true }), "darwin"),
      PageKeys.find(press({ key: "-", code: "Minus", ctrlKey: true }), "win32"),
      PageKeys.find(press({ key: "0", code: "Digit0", metaKey: true }), "darwin"),
      PageKeys.find(press({ key: "p", code: "KeyP", ctrlKey: true }), "linux"),
      PageKeys.find(press({ key: "F5", code: "F5" }), "darwin"),
      PageKeys.find(press({ key: "p", code: "KeyP" }), "win32")
    ]).toEqual(["reload", "reload", "zoomIn", "zoomIn", "zoomIn", "zoomOut", "actualSize", "print", null, null]);
  });
});
