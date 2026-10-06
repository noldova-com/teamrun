/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import "@noldova/teamrun-foundation-core";
import { JsonException, JsonReader } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";

export class SpellingDictionaries {
  public static install(sourceFolder: string, profileFolder: string, log: (text: string) => void): readonly string[] {
    let dictionaries: readonly JsonReader[];
    try {
      dictionaries = JsonReader.parse(readFileSync(join(sourceFolder, Resources.dictionariesFile), Resources.textEncoding)).readObjectArray(Resources.dictionariesField);
    }
    catch (error) {
      log(Resources.formatDictionariesUnread(String(error)));
      return [];
    }
    const target = join(profileFolder, Resources.dictionariesFolder);
    const languages: string[] = [];
    for (const dictionary of dictionaries)
      try {
        const language = SpellingDictionaries.read(dictionary, Resources.languageField, Resources.languageTagPattern);
        const file = SpellingDictionaries.read(dictionary, Resources.fileField, Resources.dictionaryFilePattern);
        SpellingDictionaries.copy(join(sourceFolder, file), target, file);
        languages.push(language);
      }
      catch (error) {
        log(Resources.formatDictionaryUncopied(String(error)));
      }
    return languages;
  }

  public static addressOf(profileFolder: string): string {
    return `${pathToFileURL(join(profileFolder, Resources.dictionariesFolder)).href}${Resources.urlSeparator}`;
  }

  private static read(dictionary: JsonReader, name: string, pattern: RegExp): string {
    const value = dictionary.readString(name);
    if (!pattern.test(value))
      throw new JsonException(Resources.formatDictionaryFieldInvalid(value), `${dictionary.path}.${name}`);
    return value;
  }

  private static copy(source: string, target: string, file: string): void {
    const destination = join(target, file);
    if (existsSync(destination))
      return;
    const content = readFileSync(source);
    mkdirSync(target, { recursive: true });
    writeFileSync(`${destination}${Resources.temporarySuffix}`, content);
    renameSync(`${destination}${Resources.temporarySuffix}`, destination);
  }
}
