/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable } from "@angular/core";

import { Resources } from "../resources";

@Injectable({ providedIn: "root" })
export class DateFormatter {
  public format(iso: string, pattern: string): string {
    const date = new Date(iso);
    return pattern.replace(Resources.formatTokenPattern, token => DateFormatter.token(date, token));
  }

  private static token(date: Date, token: string): string {
    if (token.startsWith(Resources.quoteMark))
      return token.slice(1, -1);
    switch (token) {
      case "yyyy":
        return String(date.getFullYear());
      case "yy":
        return DateFormatter.pad(date.getFullYear() % 100);
      case "MMMM":
        return date.toLocaleString(Resources.dateTimeLocale, { month: "long" });
      case "MMM":
        return date.toLocaleString(Resources.dateTimeLocale, { month: "short" });
      case "MM":
        return DateFormatter.pad(date.getMonth() + 1);
      case "M":
        return String(date.getMonth() + 1);
      case "dd":
        return DateFormatter.pad(date.getDate());
      case "d":
        return String(date.getDate());
      case "EEEE":
        return date.toLocaleString(Resources.dateTimeLocale, { weekday: "long" });
      case "EEE":
        return date.toLocaleString(Resources.dateTimeLocale, { weekday: "short" });
      case "HH":
        return DateFormatter.pad(date.getHours());
      case "H":
        return String(date.getHours());
      case "hh":
        return DateFormatter.pad(DateFormatter.twelveHour(date));
      case "h":
        return String(DateFormatter.twelveHour(date));
      case "mm":
        return DateFormatter.pad(date.getMinutes());
      case "ss":
        return DateFormatter.pad(date.getSeconds());
      default:
        return date.getHours() < 12 ? Resources.morningMarker : Resources.afternoonMarker;
    }
  }

  private static twelveHour(date: Date): number {
    const hour = date.getHours() % 12;
    return hour === 0 ? 12 : hour;
  }

  private static pad(value: number): string {
    return String(value).padStart(2, "0");
  }
}
