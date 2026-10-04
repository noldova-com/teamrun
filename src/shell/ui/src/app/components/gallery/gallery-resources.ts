/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class GalleryResources {
  public static readonly scopeClass: string = "tr-theme-scope";
  public static readonly focusableSelector: string = "button:not(:disabled):not([data-gallery-walk]), input:not(:disabled), [tabindex=\"0\"], [role=\"tab\"][aria-selected=\"true\"]";
  public static readonly dialogTitleIdPrefix: string = "tr-gallery-dialog-";
  public static readonly text = {
    gallery: "Gallery",
    focusFirst: "Show the keyboard focus on the first control",
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
      { value: "long", title: "An option whose title is far too long to fit the width its select gives it" }
    ],
    progress: "Progress",
    determinate: "Half done",
    indeterminate: "Unknown amount",
    tab: "Tab",
    tabNormal: "Notes",
    tabSelected: "Outline",
    tabPreview: "Preview",
    tabWorking: "Syncing",
    tabBadge: "Inbox",
    tabLong: "A tab title that is far too long to fit the width of its strip",
    tabNotClosable: "Pinned",
    viewBadge: "View badge",
    menuBar: "Menu bar",
    menuBarLabel: "Gallery menus",
    toolbar: "Toolbar",
    toolbarLabel: "Gallery toolbar",
    toolbarButtons: "Toolbar button",
    toolbarButtonsLabel: "Gallery toolbar buttons",
    toolbarWithLabel: "With its label",
    sash: "Sash",
    sashVertical: "Resize the side",
    sashHorizontal: "Resize the bottom",
    panelCard: "Panel card",
    panelShell: "On the shell surface",
    panelPanel: "On the panel surface",
    menu: "Menu",
    menuTrigger: "Open a menu",
    contextMenu: "Right-click or press the context-menu key here",
    menuLabel: "Menu rows",
    menuPlain: "A plain row",
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
    tooltip: "Tooltip",
    tooltipText: "What the control does",
    tooltipTrigger: "Hover or focus for a tooltip",
    tooltipLong: "A tooltip whose text is long enough to wrap onto a second line inside the width the kit gives it",
    dialog: "Dialog",
    dialogTitle: "Delete the note?",
    dialogBody: "The note and its history are removed from this device.",
    dialogCancel: "Cancel",
    dialogConfirm: "Delete",
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
    dockingPlate: "A plate with the center chosen"
  } as const;

  public static formatScope(themeName: string, mode: string): string {
    return `${themeName}, ${mode.toLowerCase()} mode`;
  }
}
