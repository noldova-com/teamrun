/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import MenuGroup from "./menu-group.ts";
import MenuItem from "./menu-item.ts";
import MenuPlace from "./menu-place.ts";
import ModuleException from "./module.exception.ts";
import ToolbarPlacement from "./toolbar-placement.ts";

export default class ModuleMenus {
  private static readonly FILE_NAME: string = "menus.json";
  private static readonly FIELDS: readonly string[] = ["places", "groups"];
  private static readonly PLACE_FIELDS: readonly string[] = ["name", "title", "shows", "shown", "after", "before", "newRow"];
  private static readonly GROUP_FIELDS: readonly string[] = ["name", "place", "exclusive", "dynamic", "items"];
  private static readonly COMMAND_FIELDS: readonly string[] = ["command", "arguments", "label"];
  private static readonly SUBMENU_FIELDS: readonly string[] = ["submenu"];
  private static readonly CHOICE_FIELDS: readonly string[] = ["choice"];
  private static readonly SHOWS: readonly string[] = ["menu", "menuBar", "toolbar"];
  private static readonly TOOLBAR_FIELDS: readonly string[] = ["shown", "after", "before", "newRow"];
  private static readonly QUALIFIED_NAME: RegExp = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.[a-z][a-zA-Z0-9]*$/;
  private static readonly MEMBER_PATTERN: RegExp = /^[a-z][a-zA-Z0-9]*$/;

  public static readonly SHELL_PLACES: readonly string[] = ["shell.file", "shell.edit", "shell.view", "shell.window", "shell.help", "shell.tab"];
  public static readonly EMPTY: ModuleMenus = new ModuleMenus([], []);

  public readonly places: readonly MenuPlace[];
  public readonly groups: readonly MenuGroup[];

  private constructor(places: readonly MenuPlace[], groups: readonly MenuGroup[]) {
    this.places = places;
    this.groups = groups;
  }

  public static async readAsync(root: string, folder: string, id: string, declared: readonly string[]): Promise<ModuleMenus> {
    const file = `${folder}/${ModuleMenus.FILE_NAME}`;
    const fail = (problem: string): ModuleException => new ModuleException(`${file} ${problem}.`);
    if (!existsSync(path.join(root, file))) {
      if (declared.length > 0)
        throw new ModuleException(`${folder}/module.json declares menus, but ${file} does not exist.`);
      return ModuleMenus.EMPTY;
    }
    let value: unknown;
    try {
      value = JSON.parse(await readFile(path.join(root, file), "utf8"));
    }
    catch (error) {
      throw new ModuleException(`${file} could not be read as JSON.`, { cause: error });
    }
    const record = ModuleMenus.readRecord(value, ModuleMenus.FIELDS, fail, "must be a JSON object with places and groups");
    const places = ModuleMenus.readArray(record.get("places"), fail, "places").map(t => ModuleMenus.readPlace(t, declared, fail));
    const names = places.map(t => t.name);
    if (new Set(names).size < names.length)
      throw fail("describes a place more than once");
    const undescribed = declared.filter(t => !names.includes(t));
    if (undescribed.length > 0)
      throw fail(`does not describe the declared places ${undescribed.join(", ")}`);
    const groups = ModuleMenus.readArray(record.get("groups"), fail, "groups").map(t => ModuleMenus.readGroup(t, id, declared, fail));
    const groupNames = groups.map(t => t.name);
    if (new Set(groupNames).size < groupNames.length)
      throw fail("names a group more than once");
    ModuleMenus.refuseCycles(groups, fail);
    return new ModuleMenus(places, groups);
  }

  public checkReferences(id: string, places: ReadonlySet<string>, commands: ReadonlySet<string>): void {
    const file = `${id}'s ${ModuleMenus.FILE_NAME}`;
    for (const group of this.groups) {
      if (!places.has(group.place))
        throw new ModuleException(`${file} adds the group ${group.name} to ${group.place}, which is neither the shell's place nor its own or a dependency's.`);
      for (const item of group.items)
        if (item.command !== null && !commands.has(item.command))
          throw new ModuleException(`${file} runs ${item.command}, which neither it nor a module it depends on declares.`);
    }
  }

  public toJson(): Readonly<Record<string, unknown>> {
    return { places: this.places.map(t => t.toJson()), groups: this.groups.map(t => t.toJson()) };
  }

  private static readPlace(value: unknown, declared: readonly string[], fail: (problem: string) => ModuleException): MenuPlace {
    const record = ModuleMenus.readRecord(value, ModuleMenus.PLACE_FIELDS, fail, "must describe each place with a name, a title and optionally shows");
    const name = record.get("name");
    if (typeof name !== "string" || !declared.includes(name))
      throw fail(`describes the place ${String(name)}, which module.json does not declare in contributes.menus`);
    const title = record.get("title");
    if (typeof title !== "string" || title.trim().length === 0)
      throw fail(`must give the place ${name} a title`);
    const shows = record.get("shows") ?? "menu";
    if (typeof shows !== "string" || !ModuleMenus.SHOWS.includes(shows))
      throw fail(`must give the place ${name} a shows of ${ModuleMenus.SHOWS.join(", ")}`);
    if (shows !== "toolbar") {
      if (ModuleMenus.TOOLBAR_FIELDS.some(t => record.has(t)))
        throw fail(`must give shown, after, before and newRow only to a place that shows as a toolbar, not ${name}`);
      return new MenuPlace(name, title, shows === "menuBar");
    }
    return new MenuPlace(name, title, false, ModuleMenus.readToolbar(record, name, fail));
  }

  private static readToolbar(record: ReadonlyMap<string, unknown>, name: string, fail: (problem: string) => ModuleException): ToolbarPlacement {
    const isShown = record.get("shown") ?? true;
    if (typeof isShown !== "boolean")
      throw fail(`must give the toolbar ${name} a shown of true or false`);
    const startsRow = record.get("newRow") ?? false;
    if (typeof startsRow !== "boolean")
      throw fail(`must give the toolbar ${name} a newRow of true or false`);
    const anchors = ["after", "before"].filter(t => record.has(t));
    if (anchors.length + (startsRow ? 1 : 0) > 1)
      throw fail(`must give the toolbar ${name} at most one of after, before and newRow`);
    const read = (field: string): string | null => {
      if (!record.has(field))
        return null;
      const anchor = record.get(field);
      if (typeof anchor !== "string" || !ModuleMenus.QUALIFIED_NAME.test(anchor) || anchor === name)
        throw fail(`must give the toolbar ${name} an ${field} naming another toolbar as "<id>.<name>"`);
      return anchor;
    };
    return new ToolbarPlacement(isShown, read("after"), read("before"), startsRow);
  }

  private static readGroup(value: unknown, id: string, declared: readonly string[], fail: (problem: string) => ModuleException): MenuGroup {
    const record = ModuleMenus.readRecord(value, ModuleMenus.GROUP_FIELDS, fail, "must describe each group with a name, a place, its items or dynamic, and optionally exclusive");
    const name = record.get("name");
    if (typeof name !== "string" || !name.startsWith(`${id}.`) || !ModuleMenus.MEMBER_PATTERN.test(name.slice(id.length + 1)))
      throw fail(`must name each group "${id}.<name>", with a camelCase name`);
    const place = record.get("place");
    if (typeof place !== "string" || !ModuleMenus.QUALIFIED_NAME.test(place))
      throw fail(`must put the group ${name} in a place named "<id>.<name>"`);
    const exclusive = record.get("exclusive") ?? false;
    if (typeof exclusive !== "boolean")
      throw fail(`must give the group ${name} an exclusive of true or false`);
    const isDynamic = record.get("dynamic") ?? false;
    if (typeof isDynamic !== "boolean")
      throw fail(`must give the group ${name} a dynamic of true or false`);
    if (isDynamic) {
      if (record.has("items"))
        throw fail(`must not give the dynamic group ${name} items, since its window part supplies them`);
      return new MenuGroup(name, place, exclusive, [], true);
    }
    const items = ModuleMenus.readArray(record.get("items"), fail, `items of the group ${name}`);
    if (items.length === 0)
      throw fail(`must give the group ${name} at least one item`);
    return new MenuGroup(name, place, exclusive, items.map(t => ModuleMenus.readItem(t, name, declared, fail)));
  }

  private static readItem(value: unknown, group: string, declared: readonly string[], fail: (problem: string) => ModuleException): MenuItem {
    const isSubmenu = typeof value === "object" && value !== null && "submenu" in value;
    const isChoice = typeof value === "object" && value !== null && "choice" in value;
    const record = ModuleMenus.readRecord(value, isSubmenu ? ModuleMenus.SUBMENU_FIELDS : isChoice ? ModuleMenus.CHOICE_FIELDS : ModuleMenus.COMMAND_FIELDS, fail,
      `must make each item of the group ${group} either a command with optional arguments and label, a submenu, or a choice`);
    if (isChoice) {
      const choice = record.get("choice");
      if (typeof choice !== "string" || !declared.includes(choice))
        throw fail(`opens ${String(choice)} as a choice in the group ${group}, which is not one of its own places`);
      return new MenuItem(null, {}, null, null, choice);
    }
    if (isSubmenu) {
      const submenu = record.get("submenu");
      if (typeof submenu !== "string" || !declared.includes(submenu))
        throw fail(`opens ${String(submenu)} as a submenu in the group ${group}, which is not one of its own places`);
      return new MenuItem(null, {}, submenu);
    }
    const command = record.get("command");
    if (typeof command !== "string" || !ModuleMenus.QUALIFIED_NAME.test(command))
      throw fail(`must name a command "<id>.<name>" for each item of the group ${group}`);
    const commandArguments = record.has("arguments") ? record.get("arguments") : {};
    if (typeof commandArguments !== "object" || commandArguments === null || Array.isArray(commandArguments))
      throw fail(`must give the arguments of ${command} in the group ${group} as a JSON object`);
    const label = record.get("label");
    if (record.has("label") && (typeof label !== "string" || label.trim().length === 0))
      throw fail(`must give the label of ${command} in the group ${group} as text that is not blank`);
    return new MenuItem(command, { ...commandArguments }, null, typeof label === "string" ? label : null);
  }

  private static refuseCycles(groups: readonly MenuGroup[], fail: (problem: string) => ModuleException): void {
    const edges = new Map<string, string[]>();
    for (const group of groups)
      for (const item of group.items)
        if (item.submenu !== null || item.choice !== null)
          edges.set(group.place, [...edges.get(group.place) ?? [], item.submenu ?? String(item.choice)]);
    const visit = (place: string, path: readonly string[]): void => {
      if (path.includes(place))
        throw fail(`opens ${place} inside itself: ${[...path, place].join(" > ")}`);
      for (const next of edges.get(place) ?? [])
        visit(next, [...path, place]);
    };
    for (const place of edges.keys())
      visit(place, []);
  }

  private static readRecord(value: unknown, fields: readonly string[], fail: (problem: string) => ModuleException, problem: string): ReadonlyMap<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value) || Object.keys(value).some(t => !fields.includes(t)))
      throw fail(problem);
    return new Map(Object.entries(value));
  }

  private static readArray(value: unknown, fail: (problem: string) => ModuleException, field: string): readonly unknown[] {
    if (!Array.isArray(value))
      throw fail(`must list its ${field}`);
    return value;
  }
}
