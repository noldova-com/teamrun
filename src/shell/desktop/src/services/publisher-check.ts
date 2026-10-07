/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Logger } from "electron-updater";

import "@noldova/teamrun-foundation-core";

import { Resources } from "../resources.js";

export class PublisherCheck {
  private readonly publisher: string;
  private readonly verifyAsync: (publisherNames: string[], file: string, logger: Logger) => Promise<string | null>;
  private readonly log: (text: string) => void;
  private readonly now: () => number;

  public constructor(publisher: string, verifyAsync: (publisherNames: string[], file: string, logger: Logger) => Promise<string | null>, log: (text: string) => void, now: () => number) {
    this.publisher = publisher;
    this.verifyAsync = verifyAsync;
    this.log = log;
    this.now = now;
  }

  public async checkAsync(file: string): Promise<string | null> {
    const warnings: string[] = [];
    const logger: Logger = { info: () => undefined, warn: (message: unknown) => warnings.push(String(message)), error: (message: unknown) => warnings.push(String(message)) };
    const started = this.now();
    let failure: string | null;
    try {
      failure = await this.verifyAsync([this.publisher], file, logger) ?? (warnings.length > 0 ? warnings.join(Resources.lineBreak) : null);
    }
    catch (error) {
      failure = String(error);
    }
    this.log(Resources.formatPublisherCheck(this.now() - started, failure));
    return failure;
  }
}
