/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  closeSync, existsSync, fstatSync, lstatSync, mkdirSync, openSync, readdirSync, readFileSync, readlinkSync, readSync, realpathSync, rmSync, type Stats,
  statSync, writeFileSync
} from "node:fs";
import { type FileHandle, open, rm } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";

import "@noldova/context.core";
import { ServiceException } from "@noldova/teamrun.services";
import { type AttachmentInput, ErrorCode, MessageAttachment, Resources as ProtocolResources } from "@noldova/teamrun.protocol";

import type { IOpenedFile } from "../../interfaces/i-opened-file.js";
import { Guid } from "../../models/guid.js";
import { Resources } from "../../resources.js";
import { ImageSizeReader } from "./image-size.reader.js";

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

  public async prepareOpenedAsync(input: AttachmentInput, source: IOpenedFile): Promise<MessageAttachment> {
    const maximum = ProtocolResources.attachmentImageMediaTypes.includes(input.mediaType)
      ? ProtocolResources.maximumAttachmentImageBytes : ProtocolResources.maximumAttachmentBytes;
    const before = await AttachmentStore.attemptAsync(() => source.stat());
    if (!before.isFile())
      throw new ServiceException(ErrorCode.InvalidParams, Resources.attachmentUnreadable, [input.name]);
    if (before.size > maximum)
      throw new ServiceException(ErrorCode.InvalidParams, Resources.attachmentLimitExceeded, []);
    const path = await this.createAsync(input.name, input.mediaType, this.drafts, target => AttachmentStore.copyAsync(source, target, before));
    const size = ProtocolResources.attachmentImageMediaTypes.includes(input.mediaType) ? ImageSizeReader.readFile(path) : null;
    return new MessageAttachment(input.name, input.mediaType, before.size, path, size?.width ?? null, size?.height ?? null);
  }

  public discardPrepared(attachment: MessageAttachment): void {
    if (!isAbsolute(attachment.path) || dirname(resolve(attachment.path)) !== resolve(this.drafts))
      throw new ServiceException(ErrorCode.InvalidParams, Resources.attachmentOutsideStore, []);

    if (!this.leadsAway(this.drafts))
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

  public saveDraft(conversationId: string, inputs: readonly AttachmentInput[]): readonly MessageAttachment[] {
    return this.saveInto(this.draftDirectory(conversationId), inputs);
  }

  public saveWaiting(chatId: string, waitingId: string, inputs: readonly AttachmentInput[]): readonly MessageAttachment[] {
    return this.saveInto(this.waitingDirectory(chatId, waitingId), inputs);
  }

  public removeDraftFiles(conversationId: string, keep: readonly MessageAttachment[] = []): void {
    this.removeExcept(this.draftDirectory(conversationId), keep);
  }

  public removeWaitingFiles(chatId: string, waitingId: string | null = null, keep: readonly MessageAttachment[] = []): void {
    this.removeExcept(Object.isNull(waitingId) ? this.waitingDirectory(chatId) : this.waitingDirectory(chatId, waitingId), keep);
  }

  public listDraftFolders(): readonly string[] {
    const directory = join(this.directory, Resources.attachmentDraftFilesDirectoryName);
    if (this.leadsAway(directory) || !existsSync(directory))
      return [];
    return readdirSync(directory, { withFileTypes: true }).filter(t => t.isDirectory()).map(t => t.name);
  }

  public listWaitingFolders(): readonly (readonly [string, string])[] {
    const directory = join(this.directory, Resources.attachmentWaitingFilesDirectoryName);
    if (this.leadsAway(directory) || !existsSync(directory))
      return [];
    return readdirSync(directory, { withFileTypes: true }).filter(t => t.isDirectory()).flatMap(t => readdirSync(join(directory, t.name), { withFileTypes: true })
      .filter(u => u.isDirectory()).map((u): readonly [string, string] => [t.name, u.name]));
  }

  public exists(attachment: MessageAttachment): boolean {
    return !this.leadsAway(attachment.path) && (statSync(attachment.path, { throwIfNoEntry: false })?.isFile() ?? false);
  }

  public static formatPrompt(text: string, attachments: readonly MessageAttachment[]): string {
    return attachments.length === 0 ? text : Resources.formatAttachmentPrompt(text, attachments.map(t => JSON.stringify({ name: t.name, path: t.path })));
  }

  public load(attachment: MessageAttachment): Buffer {
    if (attachment.size > ProtocolResources.maximumAttachmentReadBytes)
      throw new ServiceException(ErrorCode.TooLarge,
        Resources.formatAttachmentTooLargeToRead(attachment.size, ProtocolResources.maximumAttachmentReadBytes), [attachment.path]);
    if (4 * Math.ceil(attachment.size / 3) + JSON.stringify(attachment.name).length + JSON.stringify(attachment.mediaType).length
      > Resources.attachmentReadFrameCharacters)
      throw new ServiceException(ErrorCode.TooLarge, Resources.attachmentNameTooLongToRead, [attachment.path]);
    if (this.leadsAway(attachment.path))
      throw new ServiceException(ErrorCode.NotFound, Resources.attachmentLinkRefused, [attachment.path]);
    const path = this.resolveSaved(attachment.path);
    if (!AttachmentStore.orNotFound(attachment.path, () => statSync(path)).isFile())
      throw new ServiceException(ErrorCode.NotFound, Resources.attachmentChanged, [attachment.path]);
    const file = AttachmentStore.orNotFound(attachment.path, () => openSync(path, Resources.nonBlockingReadFlags));
    try {
      const stat = fstatSync(file);
      const data = Buffer.alloc(attachment.size + 1);
      let length = 0;
      let read = 0;
      do {
        read = AttachmentStore.orNotFound(attachment.path, () => readSync(file, data, length, data.length - length, null));
        length += read;
      } while (read > 0 && length < data.length);
      if (!stat.isFile() || stat.size !== attachment.size || length !== attachment.size || this.resolveSaved(attachment.path) !== path)
        throw new ServiceException(ErrorCode.NotFound, Resources.attachmentChanged, [attachment.path]);
      return data.subarray(0, length);
    }
    finally {
      closeSync(file);
    }
  }

  public locateSaved(attachment: MessageAttachment): MessageAttachment {
    if (this.leadsAway(attachment.path))
      throw new ServiceException(ErrorCode.NotFound, Resources.attachmentLinkRefused, [attachment.path]);
    const path = this.resolveSaved(attachment.path);
    const stat = AttachmentStore.orNotFound(attachment.path, () => statSync(path));
    if (!stat.isFile() || stat.size !== attachment.size)
      throw new ServiceException(ErrorCode.NotFound, Resources.attachmentChanged, [attachment.path]);
    return new MessageAttachment(attachment.name, attachment.mediaType, attachment.size, path, attachment.width, attachment.height);
  }

  private saveInto(directory: string, inputs: readonly AttachmentInput[]): readonly MessageAttachment[] {
    if (inputs.length > ProtocolResources.maximumAttachments)
      throw new ServiceException(ErrorCode.InvalidParams, Resources.attachmentLimitExceeded, []);
    const saved: MessageAttachment[] = [];
    const written: MessageAttachment[] = [];
    try {
      for (const input of inputs) {
        if (!Object.isNull(input.path)) {
          if (!isAbsolute(input.path) || AttachmentStore.isOutside(resolve(this.directory), resolve(input.path)))
            throw new ServiceException(ErrorCode.InvalidParams, Resources.attachmentOutsideStore, []);
          if (this.leadsAway(input.path))
            throw new ServiceException(ErrorCode.InvalidParams, Resources.attachmentLinkRefused, [input.name]);
          if (!existsSync(input.path))
            throw new ServiceException(ErrorCode.NotFound, Resources.formatDraftFileNotFound(input.name), [input.name]);
          if (dirname(resolve(input.path)) === directory) {
            const kept = this.locate(input);
            const size = ProtocolResources.attachmentImageMediaTypes.includes(input.mediaType) ? ImageSizeReader.readFile(kept.path) : null;
            saved.push(new MessageAttachment(input.name, input.mediaType, kept.size, resolve(input.path), size?.width ?? null, size?.height ?? null));
            continue;
          }
        }
        const attachment = this.write(input, this.read(input), directory);
        written.push(attachment);
        saved.push(attachment);
      }
      return saved;
    }
    catch (error) {
      this.discard(written);
      throw error;
    }
  }

  private removeExcept(directory: string, keep: readonly MessageAttachment[]): void {
    if (this.leadsAway(directory) || !existsSync(directory))
      return;
    if (keep.length === 0) {
      rmSync(directory, { recursive: true, force: true });
      return;
    }
    const kept = new Set(keep.map(t => basename(t.path)));
    for (const name of readdirSync(directory))
      if (!kept.has(name))
        rmSync(join(directory, name), { recursive: true, force: true });
  }

  private read(input: AttachmentInput): Buffer {
    if (!Object.isNull(input.grant))
      throw new ServiceException(ErrorCode.InvalidParams, Resources.attachmentGrantRefused, [input.name]);
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

    return readFileSync(this.locate(input).path);
  }

  private locate(input: AttachmentInput): { path: string; size: number } {
    const maximum = ProtocolResources.attachmentImageMediaTypes.includes(input.mediaType)
      ? ProtocolResources.maximumAttachmentImageBytes : ProtocolResources.maximumAttachmentBytes;
    if (!isAbsolute(input.path as string) || AttachmentStore.isOutside(resolve(this.directory), resolve(input.path as string)))
      throw new ServiceException(ErrorCode.InvalidParams, Resources.attachmentOutsideStore, []);
    if (this.leadsAway(input.path as string))
      throw new ServiceException(ErrorCode.InvalidParams, Resources.attachmentLinkRefused, [input.name]);
    const path = realpathSync(input.path as string);
    if (AttachmentStore.isOutside(realpathSync(this.directory), path))
      throw new ServiceException(ErrorCode.InvalidParams, Resources.attachmentOutsideStore, []);
    const stat = statSync(path);
    if (!stat.isFile() || stat.size > maximum)
      throw new ServiceException(ErrorCode.InvalidParams, Resources.attachmentLimitExceeded, []);
    return { path, size: stat.size };
  }

  private leadsAway(path: string): boolean {
    if (path.split(Resources.attachmentPathSeparatorsPattern).some(t => t === Resources.currentDirectory || t === Resources.parentDirectory))
      return true;
    const target = resolve(path);
    let current = AttachmentStore.isOutside(resolve(this.directory), target) ? parse(target).root : resolve(this.directory);
    const names = AttachmentStore.namesBetween(current, target);
    let links = 0;
    try {
      for (let name = names.shift(); !Object.isUndefined(name); name = names.shift()) {
        const next = join(current, name);
        if (!(lstatSync(next, { throwIfNoEntry: false })?.isSymbolicLink() ?? false)) {
          current = next;
          continue;
        }
        const link = resolve(current, readlinkSync(next));
        if (++links > Resources.maximumAttachmentLinks || !Resources.attachmentLinkRootPattern.test(parse(link).root))
          return true;
        current = parse(link).root;
        names.unshift(...AttachmentStore.namesBetween(current, link));
      }
    }
    catch {
      return true;
    }
    return false;
  }

  private static namesBetween(folder: string, path: string): string[] {
    return relative(folder, path).split(sep).filter(t => t.length > 0);
  }

  private resolveSaved(attachmentPath: string): string {
    const path = isAbsolute(attachmentPath) ? AttachmentStore.orNotFound(attachmentPath, () => realpathSync(attachmentPath)) : null;
    if (Object.isNull(path) || AttachmentStore.isOutside(AttachmentStore.orNotFound(attachmentPath, () => realpathSync(this.directory)), path))
      throw new ServiceException(ErrorCode.NotFound, Resources.attachmentChanged, [attachmentPath]);
    return path;
  }

  private draftDirectory(conversationId: string): string {
    return resolve(this.directory, Resources.attachmentDraftFilesDirectoryName, AttachmentStore.folderName(conversationId));
  }

  private waitingDirectory(...names: readonly string[]): string {
    return resolve(this.directory, Resources.attachmentWaitingFilesDirectoryName, ...names.map(t => AttachmentStore.folderName(t)));
  }

  private static folderName(name: string): string {
    if (basename(name) !== name || [String.empty, Resources.currentDirectory, Resources.parentDirectory].includes(name))
      throw new ServiceException(ErrorCode.InvalidParams, Resources.attachmentOutsideStore, []);
    return name;
  }

  private write(input: AttachmentInput, data: Buffer, directory: string): MessageAttachment {
    const path = this.create(input.name, input.mediaType, directory, file => writeFileSync(file, data));
    const size = ProtocolResources.attachmentImageMediaTypes.includes(input.mediaType) ? ImageSizeReader.readBuffer(data) : null;
    return new MessageAttachment(input.name, input.mediaType, data.length, path, size?.width ?? null, size?.height ?? null);
  }

  private create(name: string, mediaType: string, directory: string, fill: (file: number) => void): string {
    const path = this.reserve(name, mediaType, directory);
    const file = openSync(path, Resources.exclusiveWriteFlag);
    try {
      try {
        fill(file);
      }
      finally {
        closeSync(file);
      }
    }
    catch (error) {
      rmSync(path, { force: true });
      throw error;
    }
    return path;
  }

  private async createAsync(name: string, mediaType: string, directory: string, fill: (file: FileHandle) => Promise<void>): Promise<string> {
    const path = this.reserve(name, mediaType, directory);
    const file = await open(path, Resources.exclusiveWriteFlag);
    try {
      try {
        await fill(file);
      }
      finally {
        await file.close();
      }
    }
    catch (error) {
      await rm(path, { force: true });
      throw error;
    }
    return path;
  }

  private reserve(name: string, mediaType: string, directory: string): string {
    if (this.leadsAway(directory))
      throw new ServiceException(ErrorCode.InvalidParams, Resources.attachmentLinkRefused, [name]);
    const extension = Resources.attachmentImageExtensions[mediaType] ?? extname(name);
    const suffix = Resources.attachmentExtensionPattern.test(extension) ? extension : String.empty;
    mkdirSync(directory, { recursive: true });
    return join(directory, Guid.createVersion7().toString() + suffix);
  }

  private static async copyAsync(source: IOpenedFile, target: FileHandle, before: Pick<Stats, "size" | "mtimeMs">): Promise<void> {
    const chunk = Buffer.alloc(Resources.attachmentCopyChunkBytes);
    const next = async (position: number): Promise<number> =>
      (await AttachmentStore.attemptAsync(() => source.read(chunk, 0, chunk.length, position))).bytesRead;
    let copied = 0;
    for (let read = await next(copied); read > 0 && copied <= before.size; read = await next(copied)) {
      await target.writeFile(chunk.subarray(0, read));
      copied += read;
    }
    const after = await AttachmentStore.attemptAsync(() => source.stat());
    if (copied !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs)
      throw new ServiceException(ErrorCode.InvalidParams, Resources.attachmentSourceChanged, []);
  }

  private static async attemptAsync<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    }
    catch {
      throw new ServiceException(ErrorCode.InvalidParams, Resources.attachmentUnreadable, []);
    }
  }

  private static orNotFound<T>(attachmentPath: string, action: () => T): T {
    try {
      return action();
    }
    catch {
      throw new ServiceException(ErrorCode.NotFound, Resources.attachmentChanged, [attachmentPath]);
    }
  }

  private static isOutside(directory: string, path: string): boolean {
    const child = relative(directory, path);
    return isAbsolute(child) || child === Resources.parentDirectory || child.startsWith(Resources.parentDirectory + sep);
  }
}
