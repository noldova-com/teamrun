/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { closeSync, mkdirSync, openSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";

import { Guid } from "@noldova/teamrun-foundation-core";
import { ServiceException } from "@noldova/teamrun-foundation-services";
import { type AttachmentInput, ErrorCode, MessageAttachment, Resources as ProtocolResources } from "@noldova/teamrun-protocol";

import { Resources } from "../../resources.js";

export class AttachmentStore {
  private readonly directory: string;
  private readonly drafts: string;

  public constructor(dataDirectory: string) {
    this.directory = join(dataDirectory, Resources.attachmentsDirectoryName);
    this.drafts = join(this.directory, Resources.attachmentDraftsDirectoryName);

    rmSync(this.drafts, { recursive: true, force: true });
  }

  public prepare(input: AttachmentInput): MessageAttachment {
    return this.write(input, this.read(input), this.drafts);
  }

  public discardPrepared(attachment: MessageAttachment): void {
    if (!isAbsolute(attachment.path) || dirname(resolve(attachment.path)) !== resolve(this.drafts))
      throw new ServiceException(ErrorCode.InvalidParams, Resources.attachmentOutsideStore, []);

    rmSync(join(this.drafts, basename(attachment.path)), { force: true });
  }

  public save(inputs: readonly AttachmentInput[]): readonly MessageAttachment[] {
    if (inputs.length > ProtocolResources.maximumAttachments)
      throw new ServiceException(ErrorCode.InvalidParams, Resources.attachmentLimitExceeded, []);
    const saved: MessageAttachment[] = [];
    try {
      for (const input of inputs) {
        const data = this.read(input);
        saved.push(this.write(input, data, this.directory));
      }
      return saved;
    }
    catch (error) {
      this.discard(saved);
      throw error;
    }
  }

  public discard(attachments: readonly MessageAttachment[]): void {
    for (const attachment of attachments)
      rmSync(attachment.path, { force: true });
  }

  public static formatPrompt(text: string, attachments: readonly MessageAttachment[]): string {
    return attachments.length === 0 ? text : Resources.formatAttachmentPrompt(text, attachments.map(t => JSON.stringify({ name: t.name, path: t.path })));
  }

  private read(input: AttachmentInput): Buffer {
    const maximum = ProtocolResources.attachmentImageMediaTypes.includes(input.mediaType)
      ? ProtocolResources.maximumAttachmentImageBytes : ProtocolResources.maximumAttachmentBytes;
    if (!Object.isNull(input.data)) {
      if (input.data.length > Resources.maximumAttachmentEncodedLength)
        throw new ServiceException(ErrorCode.InvalidParams, Resources.attachmentLimitExceeded, []);
      const data = Buffer.from(input.data, Resources.base64Encoding);
      if (data.toString(Resources.base64Encoding) !== input.data)
        throw new ServiceException(ErrorCode.InvalidParams, Resources.attachmentInvalidBase64, []);
      if (data.length > maximum)
        throw new ServiceException(ErrorCode.InvalidParams, Resources.attachmentLimitExceeded, []);
      return data;
    }

    const path = realpathSync(input.path as string);
    const child = relative(realpathSync(this.directory), path);
    if (!isAbsolute(input.path as string) || isAbsolute(child) || child === Resources.parentDirectory || child.startsWith(Resources.parentDirectory + sep))
      throw new ServiceException(ErrorCode.InvalidParams, Resources.attachmentOutsideStore, []);
    const stat = statSync(path);
    if (!stat.isFile() || stat.size > maximum)
      throw new ServiceException(ErrorCode.InvalidParams, Resources.attachmentLimitExceeded, []);
    return readFileSync(path);
  }

  private write(input: AttachmentInput, data: Buffer, directory: string): MessageAttachment {
    const extension = Resources.attachmentImageExtensions[input.mediaType] ?? extname(input.name);
    const suffix = Resources.attachmentExtensionPattern.test(extension) ? extension : String.empty;
    mkdirSync(directory, { recursive: true });
    const path = join(directory, Guid.createVersion7().toString() + suffix);
    const file = openSync(path, Resources.exclusiveWriteFlag);
    try {
      try {
        writeFileSync(file, data);
      }
      finally {
        closeSync(file);
      }
    }
    catch (error) {
      rmSync(path, { force: true });
      throw error;
    }
    return new MessageAttachment(input.name, input.mediaType, data.length, path);
  }
}
