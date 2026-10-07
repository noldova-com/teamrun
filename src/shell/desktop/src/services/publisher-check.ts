/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import "@noldova/teamrun-foundation-core";
import type { IWindowsProcessApi } from "@noldova/teamrun-shell-runtime";

import { Resources } from "../resources.js";

export class PublisherCheck {
  private readonly publisher: string;
  private readonly signatures: Pick<IWindowsProcessApi, "verifySignatureAsync">;
  private readonly log: (text: string) => void;
  private readonly now: () => number;

  public constructor(publisher: string, signatures: Pick<IWindowsProcessApi, "verifySignatureAsync">, log: (text: string) => void, now: () => number) {
    this.publisher = publisher;
    this.signatures = signatures;
    this.log = log;
    this.now = now;
  }

  public async checkAsync(file: string): Promise<string | null> {
    const started = this.now();
    let failure: string | null;
    try {
      failure = await this.verifyAsync(file);
    }
    catch (error) {
      failure = PublisherCheck.toLine(String(error));
    }
    this.log(Resources.formatPublisherCheck(this.now() - started, Object.isNull(failure)));
    return failure;
  }

  private async verifyAsync(file: string): Promise<string | null> {
    const signature = await this.signatures.verifySignatureAsync(file);
    if (signature.status !== Resources.validSignatureStatus)
      return Resources.formatSignatureInvalid(signature.status, PublisherCheck.toLine(signature.message));
    if (Object.isNull(signature.subject))
      return Resources.signerUnreadable;
    const signer = PublisherCheck.parseName(signature.subject);
    const publisher = PublisherCheck.parseName(this.publisher);
    return publisher.size > 0 && [...publisher].every(([key, value]) => signer.get(key) === value) ? null : Resources.formatSignedByAnother(signature.subject, this.publisher);
  }

  private static parseName(name: string): ReadonlyMap<string, string> {
    const fields = new Map<string, string>();
    const parts: string[] = [];
    let part = String.empty;
    let isQuoted = false;
    for (let index = 0; index < name.length; index++) {
      const character = name.charAt(index);
      if (character === Resources.nameEscape) {
        index++;
        part += name.charAt(index);
      }
      else if (character === Resources.nameQuote)
        isQuoted = !isQuoted;
      else if (character === Resources.nameSeparator && !isQuoted) {
        parts.push(part);
        part = String.empty;
      }
      else
        part += character;
    }
    parts.push(part);
    for (const field of parts) {
      const separator = field.indexOf(Resources.nameAssignment);
      if (separator > 0)
        fields.set(field.slice(0, separator).trim().toUpperCase(), field.slice(separator + 1).trim());
    }
    return fields;
  }

  private static toLine(text: string): string {
    return text.trim().replace(Resources.lineBreaks, Resources.lineJoin);
  }
}
