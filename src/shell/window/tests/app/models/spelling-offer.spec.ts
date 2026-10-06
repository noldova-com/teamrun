/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/teamrun-foundation-json";

import { SpellingOffer } from "../../../src/app/models/spelling-offer";

describe("SpellingOffer", () => {
  it("reads the languages offered, the one used when none of the device's languages is offered, and whether words can be added", () => {
    const offer = SpellingOffer.fromJson({ languages: ["en-US", "de-DE"], fallback: "en-US" });
    const plain = SpellingOffer.fromJson({ languages: ["en-US"], fallback: null });

    expect([offer.languages, offer.fallback, plain.fallback]).toEqual([["en-US", "de-DE"], "en-US", null]);
    expect([SpellingOffer.none.languages, SpellingOffer.none.fallback]).toEqual([[], null]);
  });

  it("refuses an offer without them", () => {
    expect(() => SpellingOffer.fromJson({ languages: ["en-US"] })).toThrowError(JsonException);
    expect(() => SpellingOffer.fromJson({ languages: ["en-US"], fallback: null })).toThrowError(JsonException);
    expect(() => SpellingOffer.fromJson(null)).toThrowError(JsonException);
  });
});
