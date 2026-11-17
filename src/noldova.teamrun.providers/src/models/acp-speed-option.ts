/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import type { ProviderSpeed } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";
import type { AcpConfigOption } from "./acp-config-option.js";

export class AcpSpeedOption {
  public readonly id: string;
  public readonly speeds: readonly ProviderSpeed[];
  public readonly values: readonly string[];
  private readonly choices: readonly (readonly [ProviderSpeed, string])[];

  public constructor(id: string, choices: readonly (readonly [ProviderSpeed, string])[]) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);
    if (choices.length === 0 || new Set(choices.map(t => t[1])).size !== choices.length)
      throw new ArgumentException(Resources.speedValuesMismatch, Resources.choicesParameterName);

    this.id = id;
    this.choices = [...choices];
    this.speeds = choices.map(t => t[0]);
    this.values = choices.map(t => t[1]);
  }

  public find(options: readonly AcpConfigOption[]): AcpConfigOption | undefined {
    return options.find(t => t.id === this.id && this.values.every(v => t.values.includes(v)));
  }

  public valueOf(speed: string): string | null {
    return this.choices.find(t => t[0].id === speed)?.[1] ?? null;
  }

  public servedIn(options: readonly AcpConfigOption[]): string | null {
    const option = this.find(options);
    return Object.isUndefined(option) ? null : this.speedOf(option.currentValue);
  }

  public speedOf(value: string): string | null {
    return this.choices.find(t => t[1] === value)?.[0].id ?? null;
  }
}
