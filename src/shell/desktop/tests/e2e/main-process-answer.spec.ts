/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect, test } from "@playwright/test";

import MainProcessAnswer from "./fixtures/main-process-answer.ts";

test.describe("the harness's account of the last call the main process answered", () => {
  const asked = 1_000_000;

  test("a main process that answered none of the harness's calls is said to have answered none", () => {
    expect(MainProcessAnswer.describeLast(null, asked)).toBe("It had answered none of the harness's own calls before; the workflow's own calls are not counted.");
  });

  test("an answer before the unanswered call was asked is given as that many milliseconds before it", () => {
    expect(MainProcessAnswer.describeLast({ action: "read the window's bounds", at: asked - 40 }, asked))
      .toBe("The last of the harness's own calls it answered was to read the window's bounds, 40 ms before this one was asked; the workflow's own calls are not counted.");
  });

  test("an answer to an earlier call that came after the unanswered one was asked is given as that many milliseconds after it, never a negative gap", () => {
    expect(MainProcessAnswer.describeLast({ action: "move the window", at: asked + 25 }, asked))
      .toBe("The last of the harness's own calls it answered was to move the window, 25 ms after this one was asked; the workflow's own calls are not counted.");
  });
});
