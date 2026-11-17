/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type BigIntStats, closeSync, fstatSync, openSync, readSync, realpathSync, statSync } from "node:fs";
import { basename, isAbsolute, relative, sep } from "node:path";
import "@noldova/context.core";
import { AttachmentContent, ErrorCode, MessageAttachment, Resources as ProtocolResources } from "@noldova/teamrun.protocol";
import { ServiceException } from "@noldova/teamrun.services";
import { Resources } from "../../resources.js";
import { FileSystemErrors } from "./file-system-errors.js";
import { ImageSizeReader } from "./image-size.reader.js";
import type { SharedImages } from "./shared-images.js";

export class ProjectImageReader {
  public static read(rootPath: string, path: string): AttachmentContent {
    const image = ProjectImageReader.load(rootPath, path);
    return new AttachmentContent(basename(path), image.mediaType, image.bytes.length, image.bytes.toString(Resources.base64Encoding));
  }

  public static share(rootPath: string, path: string, copies: SharedImages | null): MessageAttachment {
    const image = ProjectImageReader.load(rootPath, path);
    if (!Resources.sharedImageExtensions.has(image.mediaType))
      throw new ServiceException(ErrorCode.NotFound, Resources.writtenImageNotShared, [path]);
    return new MessageAttachment(basename(path), image.mediaType, image.bytes.length, copies?.keep(image.bytes, image.mediaType) ?? image.target);
  }

  private static load(rootPath: string, path: string): { readonly target: string; readonly mediaType: string; readonly bytes: Buffer } {
    const root = ProjectImageReader.orGone(path, () => realpathSync(rootPath));
    const target = isAbsolute(path) ? ProjectImageReader.orGone(path, () => realpathSync(path)) : null;
    if (Object.isNull(target) || ProjectImageReader.isOutside(root, target))
      throw new ServiceException(ErrorCode.NotFound, Resources.writtenImageOutsideProject, [path]);
    const file = ProjectImageReader.orGone(path, () => openSync(target, Resources.nonBlockingReadFlags));
    try {
      const stat = fstatSync(file, { bigint: true });
      if (!ProjectImageReader.stillLeadsTo(path, target, stat))
        throw new ServiceException(ErrorCode.NotFound, Resources.writtenImageGone, [path]);
      const size = Number(stat.size);
      if (size > ProtocolResources.maximumAttachmentReadBytes)
        throw new ServiceException(ErrorCode.TooLarge,
          Resources.formatWrittenImageTooLargeToRead(size, ProtocolResources.maximumAttachmentReadBytes), [path]);
      const data = Buffer.alloc(size + 1);
      let length = 0;
      let read = 0;
      do {
        read = ProjectImageReader.orGone(path, () => readSync(file, data, length, data.length - length, null));
        length += read;
      } while (read > 0 && length < data.length);
      if (!stat.isFile() || length !== size || !ProjectImageReader.stillLeadsTo(path, target, stat))
        throw new ServiceException(ErrorCode.NotFound, Resources.writtenImageGone, [path]);
      const bytes = data.subarray(0, length);
      const mediaType = ImageSizeReader.mediaTypeOf(bytes);
      if (Object.isNull(mediaType))
        throw new ServiceException(ErrorCode.NotFound, Resources.writtenImageNotAnImage, [path]);
      return { target, mediaType, bytes };
    }
    finally {
      closeSync(file);
    }
  }

  private static stillLeadsTo(path: string, target: string, opened: BigIntStats): boolean {
    if (ProjectImageReader.orGone(path, () => realpathSync(path)) !== target)
      return false;
    const current = ProjectImageReader.orGone(path, () => statSync(target, { bigint: true }));
    return current.dev === opened.dev && current.ino === opened.ino;
  }

  private static orGone<T>(path: string, action: () => T): T {
    try {
      return action();
    }
    catch (error) {
      if (!FileSystemErrors.isFileSystemError(error))
        throw error;
      throw new ServiceException(ErrorCode.NotFound, Resources.writtenImageGone, [path]);
    }
  }

  private static isOutside(directory: string, path: string): boolean {
    const child = relative(directory, path);
    return isAbsolute(child) || child === Resources.parentDirectory || child.startsWith(Resources.parentDirectory + sep);
  }
}
