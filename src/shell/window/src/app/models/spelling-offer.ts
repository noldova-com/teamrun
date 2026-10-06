/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { JsonReader } from "@noldova/teamrun-foundation-json";

import { Resources } from "../../resources";

export class SpellingOffer {
  public static readonly none: SpellingOffer = new SpellingOffer([], null);

  public readonly languages: readonly string[];
  public readonly fallback: string | null;
  public constructor(languages: readonly string[], fallback: string | null) {
    this.languages = languages;
    this.fallback = fallback;
  }

  public static fromJson(value: unknown): SpellingOffer {
    const json = JsonReader.fromValue(value);
    return new SpellingOffer(json.readStringArray(Resources.languagesField), json.readNullableString(Resources.fallbackField));
  }
}
