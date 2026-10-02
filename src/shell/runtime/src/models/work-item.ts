/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../resources.js";

export class WorkItem implements Disposable {
  private readonly controller: AbortController = new AbortController();
  private readonly finish: (item: WorkItem) => void;

  public readonly description: string;

  public constructor(description: string, finish: (item: WorkItem) => void) {
    ArgumentException.throwIfNullOrWhitespace(description, Resources.descriptionParameterName);

    this.description = description;
    this.finish = finish;
  }

  public get signal(): AbortSignal {
    return this.controller.signal;
  }

  public cancel(): void {
    this.controller.abort();
  }

  public [Symbol.dispose](): void {
    this.finish(this);
  }
}
