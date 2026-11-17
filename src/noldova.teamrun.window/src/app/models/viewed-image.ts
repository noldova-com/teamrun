/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type MessageAttachment, Resources as ProtocolResources } from "@noldova/teamrun.protocol";
import { Resources } from "../../resources";
import { ImageHeader } from "./image-header";

export class ViewedImage {
  public readonly key: string;
  public readonly conversationId: string | null;
  public readonly name: string;
  public readonly mediaType: string;
  public readonly path: string | null;
  public readonly data: string | null;
  public readonly messageId: string | null;

  public constructor(key: string, conversationId: string | null, name: string, mediaType: string, path: string | null, data: string | null,
    messageId: string | null = null) {
    this.key = key;
    this.conversationId = conversationId;
    this.name = name;
    this.mediaType = mediaType;
    this.path = path;
    this.data = data;
    this.messageId = messageId;
  }

  public static of(conversationId: string, attachment: MessageAttachment): ViewedImage {
    return new ViewedImage(attachment.path, conversationId, attachment.name, attachment.mediaType, attachment.path, null);
  }

  public static written(conversationId: string, messageId: string, path: string, sequence: number | null = null): ViewedImage {
    const name = ViewedImage.nameOf(path);
    const extension = Resources.imageExtensionPattern.exec(name)![0].toLowerCase();
    const version = Object.isNull(sequence) ? String.empty : `${sequence}${Resources.imageKeySeparator}`;
    return new ViewedImage(`${messageId}${Resources.imageKeySeparator}${version}${path}`, conversationId, name,
      Resources.writtenImageMediaTypes[extension]!, path, null, messageId);
  }

  public static fromData(key: string, conversationId: string, name: string, mediaType: string, data: string): ViewedImage {
    return new ViewedImage(key, conversationId, name, mediaType, null, data);
  }

  public static fromDataUrl(conversationId: string, messageId: string, index: number, url: string): ViewedImage | null {
    const match = Resources.dataImageUrlPattern.exec(url.replace(Resources.whitespacePattern, String.empty));
    if (Object.isNull(match))
      return null;
    const mediaType = match[1]!.toLowerCase();
    const data = match[2]!;
    const bytes = Math.floor(data.replaceAll(Resources.base64PaddingCharacter, String.empty).length * 3 / 4);
    if (bytes > ProtocolResources.maximumAttachmentImageBytes || !ViewedImage.isWithinPixelLimit(mediaType, data))
      return null;
    return ViewedImage.fromData([messageId, Resources.markdownImageKey, index].join(Resources.imageKeySeparator), conversationId,
      Resources.markdownImageName, mediaType, data);
  }

  public static stored(conversationId: string, messageId: string, path: string, savedPath: string | null): ViewedImage {
    const image = ViewedImage.written(conversationId, messageId, path);
    return new ViewedImage(image.key, conversationId, ViewedImage.generatedNameOf(savedPath), image.mediaType, path, null, messageId);
  }

  public static generated(conversationId: string, messageId: string, sequence: number, savedPath: string | null, mediaType: string,
    data: string): ViewedImage {
    return ViewedImage.fromData(`${messageId}${Resources.imageKeySeparator}${sequence}`, conversationId, ViewedImage.generatedNameOf(savedPath),
      mediaType, data);
  }

  public static fromInstance(instance: string): ViewedImage | null {
    try {
      const value: unknown = JSON.parse(instance);
      if (!Object.isObject(value) || Array.isArray(value))
        return null;
      const { key, conversationId: legacyChatId, chatId = legacyChatId, name, mediaType, path, messageId = null } = value as Record<string, unknown>;
      if (!Object.isString(key) || !Object.isString(name) || !Object.isString(mediaType)
        || !(Object.isNull(chatId) || Object.isString(chatId)) || !(Object.isNull(path) || Object.isString(path))
        || !(Object.isNull(messageId) || Object.isString(messageId)))
        return null;
      return new ViewedImage(key, chatId, name, mediaType, path, null, messageId);
    }
    catch {
      return null;
    }
  }

  public toInstance(): string {
    return JSON.stringify({ key: this.key, chatId: this.conversationId, name: this.name, mediaType: this.mediaType, path: this.path, messageId: this.messageId });
  }

  private static isWithinPixelLimit(mediaType: string, data: string): boolean {
    if (mediaType === Resources.svgMediaType)
      return true;
    const size = ImageHeader.sizeOf(mediaType, data);
    return !Object.isNull(size) && size.width * size.height <= Resources.dataImagePixelLimit;
  }

  private static nameOf(path: string): string {
    return path.slice(Math.max(path.lastIndexOf(Resources.slash), path.lastIndexOf(Resources.backslash)) + 1);
  }

  private static generatedNameOf(savedPath: string | null): string {
    return Object.isNull(savedPath) ? Resources.generatedImageName : ViewedImage.nameOf(savedPath);
  }
}
