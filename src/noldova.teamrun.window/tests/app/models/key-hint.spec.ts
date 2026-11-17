/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { KeyHint } from "../../../src/app/models/key-hint";

describe("KeyHint", () => {
  it("names each key of a default chord apart, as Windows and Linux label it", () => {
    expect([KeyHint.of("New chat", "Mod+N", false), KeyHint.of("Find", "Mod+Shift+K", false), KeyHint.of("Open", "Mod+Alt+N", false)])
      .toEqual([new KeyHint("New chat", ["Ctrl", "N"]), new KeyHint("Find", ["Ctrl", "Shift", "K"]), new KeyHint("Open", ["Ctrl", "Alt", "N"])]);
  });

  it("names each key of a default chord apart, as macOS labels it, one symbol a modifier", () => {
    expect([KeyHint.of("New chat", "Mod+N", true), KeyHint.of("Find", "Mod+Shift+K", true), KeyHint.of("Open", "Mod+Alt+N", true)])
      .toEqual([new KeyHint("New chat", ["⌘", "N"]), new KeyHint("Find", ["⇧", "⌘", "K"]), new KeyHint("Open", ["⌥", "⌘", "N"])]);
  });
});
