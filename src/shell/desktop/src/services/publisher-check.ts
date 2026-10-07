/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { JsonReader } from "@noldova/teamrun-foundation-json";
import type { SystemCommand } from "@noldova/teamrun-shell-runtime";

import { Resources } from "../resources.js";

export class PublisherCheck {
  private readonly publisher: string;
  private readonly command: Pick<SystemCommand, "runAsync">;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly log: (text: string) => void;
  private readonly now: () => number;

  public constructor(publisher: string, command: Pick<SystemCommand, "runAsync">, environment: NodeJS.ProcessEnv, log: (text: string) => void, now: () => number) {
    this.publisher = publisher;
    this.command = command;
    this.environment = environment;
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
    const systemRoot = this.environment[Resources.systemRootVariable];
    if (Object.isUndefined(systemRoot) || String.isNullOrWhitespace(systemRoot))
      return Resources.systemRootMissing;
    const environment = Object.fromEntries(Object.entries(this.environment).filter(([key]) => key.toLowerCase() !== Resources.moduleSearchPathVariable));
    const script = Buffer.from(Resources.formatSignatureScript(file.replaceAll(Resources.singleQuote, Resources.singleQuote.repeat(2))), Resources.utf16Encoding)
      .toString(Resources.base64Encoding);
    const output = await this.command.runAsync(path.win32.join(systemRoot, ...Resources.powerShellSegments), [...Resources.powerShellArguments, script], environment);
    let signature: JsonReader;
    try {
      signature = JsonReader.parse(output);
    }
    catch {
      return Resources.formatSignatureUnreadable(PublisherCheck.toLine(output));
    }
    if (signature.readNumber(Resources.signatureStatusField) !== Resources.validSignatureStatus)
      return Resources.formatSignatureInvalid(PublisherCheck.toLine(signature.readString(Resources.signatureMessageField)));
    const checked = signature.readString(Resources.signaturePathField);
    if (path.win32.normalize(checked).toLowerCase() !== path.win32.normalize(file).toLowerCase())
      return Resources.formatSignatureOfAnotherFile(checked);
    const subject = signature.readString(Resources.signatureSubjectField);
    const signer = PublisherCheck.parseName(subject);
    const publisher = PublisherCheck.parseName(this.publisher);
    return publisher.size > 0 && [...publisher].every(([key, value]) => signer.get(key) === value) ? null : Resources.formatSignedByAnother(subject, this.publisher);
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
