/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, type Signal, type WritableSignal, computed, signal } from "@angular/core";

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { DatePattern } from "@noldova/desktop.protocol";
import type { IWindowPartContext } from "@noldova/desktop.window";

import { Resources } from "../../resources";

@Injectable({ providedIn: "root" })
export class TimeFormatService {
  private static readonly timePattern: WritableSignal<string> = signal(Resources.defaultTimeFormat);
  private static readonly dateTimePattern: WritableSignal<string> = signal(Resources.defaultDateTimeFormat);
  private static readonly shortDateTimePattern: Signal<string> = computed(() => TimeFormatService.shorten(TimeFormatService.dateTimePattern(),
    Resources.yearAndWeekdayTokens));
  private static readonly shortDatePattern: Signal<string> = computed(() => TimeFormatService.shorten(TimeFormatService.dateTimePattern(),
    [...Resources.yearAndWeekdayTokens, ...Resources.timeTokens]));
  private static readonly weekdayTimePattern: Signal<string> = computed(() => Resources.formatWeekdayTimePattern(TimeFormatService.timePattern()));
  private static readonly watches: WeakMap<IWindowPartContext, readonly (() => void)[]> = new WeakMap();

  public static register(context: IWindowPartContext): void {
    TimeFormatService.watches.set(context, [
      TimeFormatService.follow(context, Resources.timeFormatSetting, TimeFormatService.timePattern, Resources.defaultTimeFormat),
      TimeFormatService.follow(context, Resources.dateTimeFormatSetting, TimeFormatService.dateTimePattern, Resources.defaultDateTimeFormat)
    ]);
  }

  public static release(context: IWindowPartContext): void {
    for (const unwatch of TimeFormatService.watches.get(context) ?? [])
      unwatch();
    TimeFormatService.watches.delete(context);
    TimeFormatService.timePattern.set(Resources.defaultTimeFormat);
    TimeFormatService.dateTimePattern.set(Resources.defaultDateTimeFormat);
  }

  public time(at: string | number): string {
    return DatePattern.format(new Date(at), TimeFormatService.timePattern());
  }

  public dateTime(at: string | number): string {
    return DatePattern.format(new Date(at), TimeFormatService.dateTimePattern());
  }

  public shortDateTime(at: string | number): string {
    return DatePattern.format(new Date(at), TimeFormatService.shortDateTimePattern());
  }

  public weekdayTime(at: string | number): string {
    return DatePattern.format(new Date(at), TimeFormatService.weekdayTimePattern());
  }

  public shortDate(at: string | number): string {
    return DatePattern.format(new Date(at), TimeFormatService.shortDatePattern());
  }

  private static shorten(pattern: string, dropped: readonly string[]): string {
    const parts: { text: string; isToken: boolean }[] = [];
    pattern.split(Resources.datePatternToken).forEach((text, index) => {
      const isToken = index % 2 === 1 && !text.startsWith(Resources.datePatternQuote);
      const last = parts.at(-1);
      if (!isToken && !Object.isUndefined(last) && !last.isToken)
        last.text += text;
      else if (isToken || text.length > 0)
        parts.push({ text, isToken });
    });
    for (let at = parts.findIndex(t => t.isToken && dropped.includes(t.text)); at >= 0; at = parts.findIndex(t => t.isToken && dropped.includes(t.text))) {
      const before = at > 0 && !parts[at - 1]!.isToken;
      const after = at + 1 < parts.length && !parts[at + 1]!.isToken;
      parts.splice(before ? at - 1 : at, before || after ? 2 : 1);
    }
    return parts.some(t => t.isToken) ? parts.map(t => t.text).join("") : Resources.defaultShortDateFormat;
  }

  private static follow(context: IWindowPartContext, name: string, pattern: WritableSignal<string>, fallback: string): () => void {
    const apply = (value: JsonValue | undefined): void => pattern.set(Object.isString(value) && value.trim().length > 0 ? value : fallback);
    apply(context.readSetting(name));
    return context.onSettingChanged(name, t => apply(t));
  }
}
