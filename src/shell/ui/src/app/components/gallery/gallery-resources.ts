/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AriaLivePoliteness } from "@angular/cdk/a11y";

import "@noldova/teamrun-foundation-core";

export class GalleryResources {
  public static readonly scopeClass: string = "tr-theme-scope";
  public static readonly overlayContainerClass: string = "cdk-overlay-container";
  public static readonly longAttribute: string = "long";
  public static readonly stateAttribute: string = "data-tr-state";
  public static readonly hoveredPill: string = ".tr-choice-pill[aria-checked=\"false\"]";
  public static readonly focusedPill: string = ".tr-choice-pill[aria-checked=\"true\"]";
  public static readonly focusedCheckbox: string = ".tr-checkbox-box";
  public static readonly focusedSelect: string = ".tr-select-button";
  public static readonly dialogTitleIdPrefix: string = "tr-gallery-dialog-";
  public static readonly fieldMessageIdPrefix: string = "tr-gallery-field-message-";
  public static readonly virtualListLength: number = 10_000;
  public static readonly virtualListEstimate: number = 30;
  public static readonly virtualListSelected: number = 2;
  public static readonly feedLength: number = 10_000;
  public static readonly feedRecent: number = 100;
  public static readonly feedHistoryDelay: number = 1500;
  public static readonly feedReplyInterval: number = 100;
  public static readonly feedReplyWords: number = 40;
  public static readonly feedReplyPoliteness: AriaLivePoliteness = "polite";
  public static readonly feedCodeEvery: number = 9;
  public static readonly text = {
    gallery: "Gallery",
    defaultState: "Default",
    focus: "Focus",
    hover: "Hover",
    secondaryHover: "Secondary, hover",
    longCaption: "Long text",
    secondaryDisabled: "Secondary, disabled",
    delayed: "Delayed",
    triggerCaption: "Trigger",
    openCaption: "Open",
    noHeadingCaption: "No heading",
    sample: "Sample",
    primary: "Primary",
    secondary: "Secondary",
    disabled: "Disabled",
    selected: "Selected",
    working: "Working",
    error: "Error",
    longText: "A control title that is far too long to fit the width its row gives it",
    button: "Button",
    iconButton: "Icon button",
    iconGlyph: "format_bold",
    iconLabel: "Bold",
    glyphAdd: "add",
    glyphSave: "save",
    glyphDescription: "description",
    pressed: "Pressed",
    checkbox: "Checkbox",
    checked: "Checked",
    unchecked: "Unchecked",
    textField: "Text field",
    placeholder: "Type here",
    longValue: "A value that is far too long to fit the width of its field and keeps going",
    invalidField: "Not a valid name",
    validationText: "Names have at most 20 characters.",
    select: "Select",
    selectOptions: [
      { value: "one", title: "First option" },
      { value: "two", title: "Second option" },
      { value: "long", title: "An option whose title is far too long to fit the width its select gives it, and longer still than the narrowest window can show on one line" }
    ],
    progress: "Progress",
    determinate: "Half done",
    indeterminate: "Unknown amount",
    progressDeterminate: "Determinate",
    progressIndeterminate: "Indeterminate",
    spinner: "Spinner",
    spinnerWorking: "Loading the list",
    spinnerDelayed: "Loading after a short wait",
    chip: "Badge and key chip",
    chipCount: "Count",
    chipAdded: "Added",
    chipRemoved: "Removed",
    chipLargeCount: "Large count",
    chipKeyCaption: "Key",
    chipKey: "Ctrl+K",
    choicePills: "Choice pills",
    choicePillsLabel: "Mode",
    choicePillsLong: "Choice with a long title",
    choicePillOptions: [
      { value: "system", title: "System" },
      { value: "light", title: "Light" },
      { value: "dark", title: "Dark" }
    ],
    choicePillOptionsLong: [
      { value: "short", title: "Short" },
      { value: "long", title: "An option whose title is far too long to fit the width its group gives it" }
    ],
    choicePillInitial: "light",
    configurationTable: "Configuration table",
    configurationAdd: "Add",
    configurationName: "Name",
    configurationValue: "Value",
    configurationScope: "Scope",
    configurationActions: "Actions",
    configurationEdit: "Edit",
    configurationRemove: "Remove",
    configurationWideTable: { heading: "Environment variables", label: "Environment variables", explanation: "Each variable is set for the programs the shell starts, after the system's own.", rowCount: 3, isNarrow: false, hasAdd: true },
    configurationNarrowTable: { heading: String.empty, label: "Narrow environment variables", explanation: String.empty, rowCount: 2, isNarrow: true, hasAdd: false },
    configurationUnheadedTable: { heading: String.empty, label: "Global environment variables", explanation: "These apply to every project, before the project's own variables.", rowCount: 2, isNarrow: false, hasAdd: true },
    configurationRows: [
      { name: "EDITOR", value: "code --wait", scope: "Every project", edit: "Edit EDITOR", remove: "Remove EDITOR" },
      { name: "LANG", value: "en_GB.UTF-8", scope: "Every project", edit: "Edit LANG", remove: "Remove LANG" },
      { name: "NOTES_HOME", value: "A value that is far too long to fit the width of its cell, so its row grows to hold it", scope: "This project", edit: "Edit NOTES_HOME", remove: "Remove NOTES_HOME" }
    ],
    tab: "Tab",
    tabNormal: "Notes",
    tabSelected: "Outline",
    tabPreview: "Preview",
    tabWorking: "Syncing",
    tabBadge: "Inbox",
    tabLong: "A tab title that is far too long to fit the width of its strip",
    tabNotClosable: "Pinned",
    tabPreviewCaption: "Preview",
    tabBadgeCaption: "Badge",
    tabNotClosableCaption: "Not closable",
    viewBadge: "View badge",
    menuBar: "Menu bar",
    menuBarLabel: "Gallery menus",
    menuBarHover: "Menu bar, hover",
    toolbar: "Toolbar",
    toolbarLabel: "Gallery toolbar",
    toolbarButtons: "Toolbar button",
    toolbarButtonsLabel: "Gallery toolbar buttons",
    toolbarWithLabel: "With its label",
    sash: "Sash",
    sashVertical: "Resize the side",
    sashHorizontal: "Resize the bottom",
    sashVerticalCaption: "Vertical",
    sashHorizontalCaption: "Horizontal",
    panelCard: "Panel card",
    tree: "Tree",
    treeLabel: "Gallery files",
    treeProject: "Project",
    treeSource: "Source",
    treeApp: "App",
    treeStyles: "Styles",
    treeReadme: "Readme",
    treeNotes: "Notes",
    treeLong: "A file name that is far too long to fit the width of its tree",
    virtualList: "Virtual list",
    virtualListLabel: "Gallery items",
    virtualListItem: "Item",
    virtualListLoadingCaption: "Loading",
    virtualListRefusal: "The Gallery's source refuses every read.",
    virtualFeed: "Virtual feed",
    virtualFeedLabel: "Gallery conversation",
    virtualFeedStream: "Stream a reply",
    feedAuthors: ["Ada", "Grace", "Linus"],
    feedReplyAuthor: "Assistant",
    feedWords: ["the", "build", "finished", "on", "every", "system", "and", "the", "list", "kept", "its", "place", "while", "older", "messages", "loaded", "above", "it", "so", "nothing", "in", "view", "moved"],
    sectionHeader: "Section header",
    sectionRecent: "Recent",
    sectionOlder: "Older",
    sectionRowNotes: "Meeting notes",
    sectionRowPlan: "Release plan",
    sectionRowDraft: "Draft",
    sectionRowReview: "Review",
    sectionLong: "A section name that is far too long to fit the width of its header",
    glyphFolder: "folder",
    panelShell: "On the shell surface",
    panelPanel: "On the panel surface",
    panelShellCaption: "Shell surface",
    panelPanelCaption: "Panel surface",
    menu: "Menu",
    menuTrigger: "Open a menu",
    contextMenu: "Right-click or press the context-menu key here",
    menuLabel: "Menu rows",
    menuRowsCaption: "Rows",
    contextMenuCaption: "Context menu",
    menuPlain: "A plain row",
    menuHovered: "A hovered row",
    menuIcon: "A row with an icon",
    menuShortcut: "A row with a shortcut",
    menuChecked: "A checked row",
    menuCheckbox: "A checkbox row",
    menuDisabled: "A disabled row",
    menuSubmenu: "A row that opens a submenu",
    menuLong: "A row whose label is far too long to fit the width its menu gives it",
    submenuRow: "Inside the submenu",
    file: "File",
    edit: "Edit",
    popover: "Popover",
    popoverTrigger: "Open a popover",
    popoverLabel: "Details",
    popoverTitle: "Details",
    popoverBody: "A popover holds a short list or a few actions beside the control that opened it.",
    popoverLong: "A line of text that is far too long to fit the width of the popover and keeps going",
    popoverClose: "Close",
    tooltip: "Tooltip",
    tooltipText: "What the control does",
    tooltipTrigger: "Hover or focus for a tooltip",
    tooltipLong: "A tooltip whose text is long enough to wrap onto a second line inside the width the kit gives it",
    dialog: "Dialog",
    dialogTitle: "Delete the note?",
    dialogBody: "The note and its history are removed from this device.",
    dialogCancel: "Cancel",
    dialogConfirm: "Delete",
    largeDialogTitle: "Notes",
    largeCaption: "Large",
    largeDialogBody: "A view or document shown large keeps its own layout inside the dialog's body.",
    quickInput: "Quick input",
    quickInputLabel: "Search the gallery",
    quickInputQuery: "o",
    quickInputOne: "Open the note",
    quickInputTwo: "Show the outline",
    quickInputLong: "Open a note whose title is far too long to fit the width of the search surface",
    quickInputDetail: "Notes",
    quickInputKey: "Ctrl+O",
    menuShortcutKeys: "Ctrl+K",
    tabBadgeLabel: "3 unread",
    selectInitial: "one",
    docking: "Docking guides",
    dockingGuide: "A chosen guide",
    dockingPlate: "A plate with the center chosen",
    dockingGuideCaption: "Guide",
    dockingChosenCaption: "Chosen guide",
    dockingPlateCaption: "Plate, center chosen",
    card: "Card",
    cardTitle: "Sync is paused",
    cardBody: "Changes stay on this computer until you resume.",
    cardLong: "A card wraps a name too long for its width, such as shell.notifications.fromModules.notesReminderSchedule, inside it.",
    codeBlock: "Code block",
    codeLanguage: "TypeScript",
    codeSample: "export function greet(name: string): string {\n  const message = \"Hello, \" + name + \". This line runs past the block's edge at any width the Gallery shows, so it scrolls sideways until Word wrap is on, and then it wraps onto the lines below.\";\n  return message;\n}",
    codeWrappedCaption: "Word wrap on",
    codeNoLanguageCaption: "No language",
    codeRefusedCaption: "Copy refused",
    codeShell: "Shell",
    codeCommand: "npm install --save-exact @noldova/teamrun-shell-ui",
    codeLongLanguage: "A language name far too long to fit the header",
    codeLongLine: "https://example.com/teamrun/modules/notes/settings/reminders/schedule/weekly/monday",
    inlineCode: "Inline code",
    inlinePanelCaption: "Panel text",
    inlineMessageCaption: "Message text",
    inlineBefore: "Set ",
    inlineName: "EDITOR",
    inlineAfter: " to choose the editor.",
    inlineLongName: "shell.notifications.fromModules.notesReminderSchedule"
  } as const;

  public static formatMissingPart(part: string): string {
    return `The Gallery cell has no part that matches ${part}.`;
  }

  public static formatFeedHeading(author: string, index: number): string {
    return `${author} · message ${index + 1}`;
  }

  public static formatFeedReply(heading: string, text: string): string {
    return `${heading}: ${text}`;
  }

  public static formatFeedCode(index: number): string {
    return `const message = ${index + 1};\nconsole.log(message);`;
  }

  public static formatScope(themeName: string, mode: string): string {
    return `${themeName}, ${mode.toLowerCase()} mode`;
  }
}
