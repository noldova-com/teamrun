/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/teamrun-foundation-json";

import { FieldMenuRequest } from "../../../src/app/models/field-menu-request";

describe("FieldMenuRequest", () => {
  it("reads where the menu was asked for, whether by keyboard, and the misspelled word with its suggestions, which it gives the menu", () => {
    const request = FieldMenuRequest.fromJson({ x: 10, y: 20, isKeyboard: true, word: "wrold", suggestions: ["world", "wold"] });

    expect([request.x, request.y, request.isKeyboard, request.word, request.suggestions]).toEqual([10, 20, true, "wrold", ["world", "wold"]]);
    expect(request.toContext()).toEqual({ word: "wrold", suggestions: ["world", "wold"] });
  });

  it("refuses a request without them", () => {
    expect(() => FieldMenuRequest.fromJson({ x: 10, y: 20, isKeyboard: true, word: "wrold" })).toThrowError(JsonException);
    expect(() => FieldMenuRequest.fromJson({ x: "10", y: 20, isKeyboard: true, word: "", suggestions: [] })).toThrowError(JsonException);
    expect(() => FieldMenuRequest.fromJson(null)).toThrowError(JsonException);
  });
});
