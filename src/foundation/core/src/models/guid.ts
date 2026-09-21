/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "../extensions/object.extensions.js";
import { Resources } from "../resources.js";

export class Guid {
  private readonly text: string;

  public static readonly empty: Guid = new Guid(Resources.guidEmptyText);

  private constructor(text: string) {
    this.text = text;
  }

  public get version(): number {
    return Number.parseInt(this.text.charAt(Resources.guidVersionCharacterIndex), Resources.hexadecimalRadix);
  }

  public static newGuid(): Guid {
    const bytes = crypto.getRandomValues(new Uint8Array(Resources.guidByteCount));
    Guid.markVersion(new DataView(bytes.buffer), Resources.guidVersion4Marker);
    return new Guid(Guid.formatBytes(bytes));
  }

  public static createVersion7(timestamp: number = Date.now()): Guid {
    if (!Number.isInteger(timestamp) || timestamp < 0 || timestamp > Resources.guidTimestampMaximum)
      throw new RangeError(Resources.guidTimestampInvalid);

    const bytes = crypto.getRandomValues(new Uint8Array(Resources.guidByteCount));
    const view = new DataView(bytes.buffer);
    view.setUint32(0, Math.floor(timestamp / Resources.guidTimestampLowRange));
    view.setUint16(Resources.guidTimestampLowByteIndex, timestamp % Resources.guidTimestampLowRange);
    Guid.markVersion(view, Resources.guidVersion7Marker);
    return new Guid(Guid.formatBytes(bytes));
  }

  public static parse(text: string): Guid {
    const guid = Guid.tryParse(text);
    if (Object.isUndefined(guid))
      throw new SyntaxError(Resources.guidTextInvalid);

    return guid;
  }

  public static tryParse(text: string): Guid | undefined {
    return Resources.guidPattern.test(text) ? new Guid(text.toLowerCase()) : undefined;
  }

  public equals(other: Guid): boolean {
    return this.text === other.text;
  }

  public compareTo(other: Guid): number {
    if (this.text < other.text)
      return -1;

    if (this.text > other.text)
      return 1;

    return 0;
  }

  public toString(): string {
    return this.text;
  }

  private static markVersion(view: DataView, versionMarker: number): void {
    view.setUint8(Resources.guidVersionByteIndex, (view.getUint8(Resources.guidVersionByteIndex) & Resources.guidVersionMask) | versionMarker);
    view.setUint8(Resources.guidVariantByteIndex, (view.getUint8(Resources.guidVariantByteIndex) & Resources.guidVariantMask) | Resources.guidVariantMarker);
  }

  private static formatBytes(bytes: Uint8Array): string {
    const digits = Array.from(bytes, t => t.toString(Resources.hexadecimalRadix).padStart(Resources.hexadecimalByteWidth, Resources.hexadecimalPadding)).join(String.empty);
    const groups: string[] = [];
    let start = 0;
    
    for (const length of Resources.guidGroupLengths) {
      groups.push(digits.slice(start, start + length));
      start += length;
    }

    return groups.join(Resources.guidGroupSeparator);
  }
}
