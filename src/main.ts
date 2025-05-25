import { App, Editor, MarkdownView, Plugin, PluginSettingTab, Setting } from "obsidian";


interface ScrollingPluginSettings {
    mouse_scroll_enabled: boolean;
    mouse_scroll_speed: number;
    mouse_scroll_smoothness: number;
    mouse_scroll_invert: boolean;
    center_cursor_enabled: boolean;
    center_cursor_editing_distance: number;
    center_cursor_moving_distance: number;
    center_cursor_editing_smoothness: number;
    center_cursor_moving_smoothness: number;
    center_cursor_enable_mouse: boolean;
    scrollbar_global: boolean;
    scrollbar_visibility: string;
    scrollbar_width: number;
}


const DEFAULT_SETTINGS: ScrollingPluginSettings = {
    mouse_scroll_enabled: true,
    mouse_scroll_speed: 1,
    mouse_scroll_smoothness: 1,
    mouse_scroll_invert: false,
    center_cursor_enabled: true,
    center_cursor_editing_distance: 25,
    center_cursor_moving_distance: 25,
    center_cursor_editing_smoothness: 1,
    center_cursor_moving_smoothness: 1,
    center_cursor_enable_mouse: false,
    scrollbar_global: false,
    scrollbar_visibility: "show",
    scrollbar_width: 12,
}


export default class ScrollingPlugin extends Plugin {
    settings: ScrollingPluginSettings;

    editing: boolean;
    mousedown: boolean;
    mouseup: boolean;

    last_selectionchange: number;
    smoothscroll_timeout: any;

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new ScrollingSettingTab(this.app, this));

        // Callbacks for markdown changes and cursor movements
        // Will be automatically deleted on reload
        this.registerEvent(this.app.workspace.on("editor-change", (editor) => this.edit_callback(editor)));

        // this is invoked on mouse down (selection start), editing as well, wrapping/layout changes due to stuff expanding while hovering on a line with cursor
        this.registerDomEvent(document, "selectionchange", () => this.selectionchange_callback());
        this.registerDomEvent(document, "mousedown", () => this.mousedown_callback());
        this.registerDomEvent(document, "mouseup", () => this.mouseup_callback());

        this.update_scrollbar_css()
        console.log("ScrollingPlugin loaded");
    }

    async onunload() {
        this.remove_css();
        console.log("ScrollingPlugin unloaded");
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    edit_callback(editor: Editor) {
        this.editing = true;
        this.scroll(editor);
    }

    mousedown_callback() {
        this.mousedown = true;
    }

    mouseup_callback() {
        this.mousedown = false;
        this.mouseup = true;
    }

    selectionchange_callback() {
        // selectionchange will also be invoked with mouse actions; this prevents further actions.
        // maybe expose as a setting.
        if (this.mousedown) return;
        if (this.mouseup) {
            this.mouseup = false;
            return;
        }

        setTimeout(() => {
            if (this.mousedown) return;

            if (this.editing) {
                this.editing = false;
                return;
            }

            // const editor = this.app.workspace.activeEditor?.editor;
            const editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor
            if (!editor) return;

            // return if text got selected; we do not want to interfere with that
            if (editor.somethingSelected()) return;

            this.scroll(editor);
        }, 10);
    }

    scroll(editor: Editor) {
        const editor_view = editor.cm;

        // Get the cursor position using the appropriate CM5 or CM6 interface
        let cursor_coords;
        if ((editor as any).cursorCoords) {
            cursor_coords = (editor as any).cursorCoords(true, 'window');
        } else if ((editor as any).coordsAtPos) {
            const offset = editor.posToOffset(editor.getCursor());
            cursor_coords = (editor as any).cm.coordsAtPos?.(offset) ?? (editor as any).coordsAtPos(offset);
        } else {
            return;
        }

        // cursor position on screen in pixels
        // const cursor = editor_view.coordsAtPos(editor_view.state.selection.main.head);
        // if (!cursor) return;

        const current_scroll_y = editor.getScrollInfo().top;
        const cursor_y = cursor_coords.top;
        const scrollInfo = editor_view.scrollDOM.getBoundingClientRect();

        const center_zone_radius = scrollInfo.height * 0.4 * (this.settings.center_cursor_editing_distance / 100);

        const center = scrollInfo.height / 2
        const center_offset = cursor_y - center;
        console.log(center_offset, center_zone_radius)

        let goal; // center: current_scroll_y + center_offset
        let distance; // center: center_offset
        if (center_offset < -center_zone_radius) {
            goal = current_scroll_y + center_offset + center_zone_radius;
            distance = center_offset + center_zone_radius;
            console.log(0, current_scroll_y, goal, distance)
        } else if (center_offset > center_zone_radius) {
            goal = current_scroll_y + center_offset - center_zone_radius;
            distance = center_offset - center_zone_radius;
            console.log(1, current_scroll_y, goal, distance)
        } else {
            return; // we are in the center zone :)
        }

        clearTimeout(this.smoothscroll_timeout);

        const time = 5;
        let steps = Math.round(1 + 4 * this.settings.center_cursor_editing_smoothness);
        this.smoothscroll(editor, goal, distance / steps, time, steps);
    }

    smoothscroll(editor: Editor, dest: number, step_size: number, time: number, step: number) {
        if (!step) return;
        const move_to = dest - step_size * (step - 1);
        editor.scrollTo(null, move_to);
        this.smoothscroll_timeout = setTimeout(() => this.smoothscroll(editor, dest, step_size, time, step - 1), time);
    }

    update_scrollbar_css() {
        this.remove_css()

        const style = document.createElement('style');
        style.id = 'scrolling-scrollbar-style';
        const global = this.settings.scrollbar_global;

        let display: string | undefined;
        let color: string | undefined;

        const visibility = this.settings.scrollbar_visibility;
        if (visibility == "hide") {
            display = "none";
        } else if (visibility == "scroll") {
            color = "transparent";
        }

        const width = this.settings.scrollbar_width;
        if (width == 0) {
            display = "none";
        }

        if (global) {
            style.textContent = `
* {
  ${width > 0 ? `scrollbar-width: ${width}px !important;` : ""}
  ${display !== undefined ? `-ms-overflow-style: ${display};` : ""}
}
*::-webkit-scrollbar {
  ${width > 0 ? `width: ${width}px !important;` : ""}
  ${display !== undefined ? `display: ${display};` : ""}
}
*::-webkit-scrollbar-thumb {
  ${color !== undefined ? `background-color: ${color} !important;` : ""}
}
`;
        } else {
            style.textContent = `
.markdown-source-view,
.cm-scroller {
  ${width > 0 ? `scrollbar-width: ${width}px !important;` : ""}
  ${display !== undefined ? `-ms-overflow-style: ${display};` : ""}
}
.markdown-source-view::-webkit-scrollbar,
.cm-scroller::-webkit-scrollbar {
  ${width > 0 ? `width: ${width}px !important;` : ""}
  ${display !== undefined ? `display: ${display};` : ""}
}
.markdown-source-view::-webkit-scrollbar-thumb,
.cm-scroller::-webkit-scrollbar-thumb {
  ${color !== undefined ? `background-color: ${color} !important;` : ""}
}
`;
        }

        document.head.appendChild(style);
    }

    remove_css() {
        document.getElementById("scrolling-scrollbar-style")?.remove();
    }
}


class ScrollingSettingTab extends PluginSettingTab {
    plugin: ScrollingPlugin;

    constructor(app: App, plugin: ScrollingPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const containerEl = this.containerEl;
        containerEl.empty();

        // Mouse scrolling settings
        new Setting(containerEl)
            .setName("Mouse scrolling")
            .setHeading();

        new Setting(containerEl)
            .setName("Enabled")
            .setDesc("Whether mouse scrolling settings should be applied.")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.mouse_scroll_enabled)
                .onChange(async (value) => {
                    this.plugin.settings.mouse_scroll_enabled = value;
                    this.display();
                    await this.plugin.saveSettings();
                })
            );

        // TODO: split mouse wheel and touchpad up?
        if (this.plugin.settings.mouse_scroll_enabled) {
            new Setting(containerEl)
                .setName("Scroll speed")
                .setDesc("Controls how fast you scroll using your mouse wheel or trackpad.")
                .addExtraButton(button => {
                    button
                        .setIcon('reset')
                        .setTooltip('Restore default')
                        .onClick(async () => {
                            this.plugin.settings.mouse_scroll_speed = DEFAULT_SETTINGS.mouse_scroll_speed
                            this.display();
                            await this.plugin.saveSettings()
                        });
                })
                .addSlider(slider => slider
                    .setValue(this.plugin.settings.mouse_scroll_speed)
                    .setLimits(0, 4, 0.1)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.mouse_scroll_speed = value;
                        await this.plugin.saveSettings();
                    })
                );

            new Setting(containerEl)
                .setName("Scroll smoothness")
                .setDesc("Determines how smooth scrolling should be. 0 means instant.")
                .addExtraButton(button => {
                    button
                        .setIcon('reset')
                        .setTooltip('Restore default')
                        .onClick(async () => {
                            this.plugin.settings.mouse_scroll_smoothness = DEFAULT_SETTINGS.mouse_scroll_smoothness
                            this.display()
                            await this.plugin.saveSettings()
                        })
                })
                .addSlider(slider => slider
                    .setValue(this.plugin.settings.mouse_scroll_smoothness)
                    .setLimits(0, 4, 0.1)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.mouse_scroll_smoothness = value;
                        await this.plugin.saveSettings();
                    })
                );

            new Setting(containerEl)
                .setName("Invert scroll direction")
                .setDesc("Flips scroll direction.")
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.mouse_scroll_invert)
                    .onChange(async (value) => {
                        this.plugin.settings.mouse_scroll_invert = value;
                        await this.plugin.saveSettings();
                    })
                );
        }

        // Centered text cursor settings
        new Setting(containerEl).setHeading();
        new Setting(containerEl)
            .setName("Centered text cursor")
            .setDesc(createFragment(frag => {
                frag.createDiv({}, div => div.innerHTML =
                    "Keeps the text cursor within a comfortable zone while moving or editing. Behaves similarly to Vim's <code>scrolloff</code> option."
                );
            }))
            .setHeading();

        new Setting(containerEl)
            .setName("Enabled")
            .setDesc("Whether to enable the centered cursor feature.")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.center_cursor_enabled)
                .onChange(async (value) => {
                    this.plugin.settings.center_cursor_enabled = value;
                    this.display();
                    await this.plugin.saveSettings();
                })
            );

        if (this.plugin.settings.center_cursor_enabled) {
            new Setting(containerEl)
                .setName("Center radius while editing")
                .setDesc(createFragment(frag => {
                    frag.createDiv({}, div => div.innerHTML =
                        "Defines how far from the screen center the cursor can move before scrolling (in \"%\").<br>" +
                        "0% keeps the cursor perfectly centered.<br>" +
                        "100% effectively disables this feature."
                    );
                }))
                .addExtraButton(button => {
                    button
                        .setIcon('reset')
                        .setTooltip('Restore default')
                        .onClick(async () => {
                            this.plugin.settings.center_cursor_editing_distance = DEFAULT_SETTINGS.center_cursor_editing_distance
                            this.display();
                            await this.plugin.saveSettings()
                        });
                })
                .addSlider(slider => slider
                    .setValue(this.plugin.settings.center_cursor_editing_distance)
                    .setLimits(0, 100, 1)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.center_cursor_editing_distance = value;
                        await this.plugin.saveSettings();
                    })
                );

            new Setting(containerEl)
                .setName("Center radius while moving cursor")
                .setDesc(createFragment(frag => {
                    frag.createDiv({}, div => div.innerHTML =
                        "Defines how far from the screen center the cursor can be moved before scrolling (in \"%\").<br>" +
                        "0% keeps the cursor perfectly centered.<br>" +
                        "100% effectively disables this feature."
                    );
                }))
                .addExtraButton(button => {
                    button
                        .setIcon('reset')
                        .setTooltip('Restore default')
                        .onClick(async () => {
                            this.plugin.settings.center_cursor_moving_distance = DEFAULT_SETTINGS.center_cursor_moving_distance
                            this.display();
                            await this.plugin.saveSettings()
                        });
                })
                .addSlider(slider => slider
                    .setValue(this.plugin.settings.center_cursor_moving_distance)
                    .setLimits(0, 100, 1)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.center_cursor_moving_distance = value;
                        await this.plugin.saveSettings();
                    })
                );

            new Setting(containerEl)
                .setName("Scroll animation when editing")
                .setDesc(createFragment(frag => {
                    frag.createDiv({}, div => div.innerHTML =
                        "Adjusts the smoothness of scrolling when editing moves the cursor outside the central zone.<br>" +
                        "Set to 0 to disable smooth scroll when editing."
                    );
                }))
                .addExtraButton(button => {
                    button
                        .setIcon('reset')
                        .setTooltip('Restore default')
                        .onClick(async () => {
                            this.plugin.settings.center_cursor_editing_smoothness = DEFAULT_SETTINGS.center_cursor_editing_smoothness
                            this.display();
                            await this.plugin.saveSettings()
                        });
                })
                .addSlider(slider => slider
                    .setValue(this.plugin.settings.center_cursor_editing_smoothness)
                    .setLimits(0, 4, 0.1)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.center_cursor_editing_smoothness = value;
                        await this.plugin.saveSettings();
                    })
                );

            new Setting(containerEl)
                .setName("Scroll animation when moving cursor")
                .setDesc(createFragment(frag => {
                    frag.createDiv({}, div => div.innerHTML =
                        "Adjusts the smoothness of scrolling when the text cursor is moved outside the central zone.<br>" +
                        "Set to 0 to disable smooth scroll when moving text cursor."
                    );
                }))
                .addExtraButton(button => {
                    button
                        .setIcon('reset')
                        .setTooltip('Restore default')
                        .onClick(async () => {
                            this.plugin.settings.center_cursor_moving_smoothness = DEFAULT_SETTINGS.center_cursor_moving_smoothness
                            this.display();
                            await this.plugin.saveSettings()
                        });
                })
                .addSlider(slider => slider
                    .setValue(this.plugin.settings.center_cursor_moving_smoothness)
                    .setLimits(0, 4, 0.1)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.center_cursor_moving_smoothness = value;
                        await this.plugin.saveSettings();
                    })
                );

            new Setting(containerEl)
                .setName("Invoke on mouse-driven cursor movement")
                .setDesc(createFragment(frag => {
                    frag.createDiv({}, div => div.innerHTML =
                        "Also apply this feature when the text cursor is moved with the mouse.<br>" +
                        "Recommended to keep disabled to avoid unexpected scrolling while using the mouse to reposition the cursor."
                    );
                }))
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.center_cursor_enable_mouse)
                    .onChange(async (value) => {
                        this.plugin.settings.center_cursor_enable_mouse = value;
                        await this.plugin.saveSettings();
                    })
                );
        }

        // Scrollbar appearance settings
        new Setting(containerEl);
        new Setting(containerEl)
            .setName("Scrollbar appearance")
            .setHeading();

        new Setting(containerEl)
            .setName("Apply to all scrollbars")
            .setDesc("Whether the following options should apply to all scrollbars in obsidian or only scrollbars in markdown files.")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.scrollbar_global)
                .onChange(async (value) => {
                    this.plugin.settings.scrollbar_global = value;
                    this.plugin.update_scrollbar_css()
                    await this.plugin.saveSettings();
                })
            );

        // dropdown menu: hide all, hide bars (only markdown file), show bars while scrolling, show bar while scrolling (only markdown file), show all
        new Setting(containerEl)
            .setName("Scrollbar visibility")
            .setDesc("When to show scrollbars.")
            .addExtraButton(button => {
                button
                    .setIcon('reset')
                    .setTooltip('Restore default')
                    .onClick(async () => {
                        this.plugin.settings.scrollbar_visibility = DEFAULT_SETTINGS.scrollbar_visibility
                        this.plugin.update_scrollbar_css()
                        await this.plugin.saveSettings()
                    });
            })
            .addDropdown(dropdown => dropdown
                .addOption("hide", "Always hide scrollbars")
                .addOption("scroll", "Show scrollbars while scrolling")
                .addOption("show", "Always show scrollbars")
                .setValue(this.plugin.settings.scrollbar_visibility)
                .onChange(async (value) => {
                    this.plugin.settings.scrollbar_visibility = value;
                    this.plugin.update_scrollbar_css()
                    this.display()
                    await this.plugin.saveSettings();
                })
            )

        if (this.plugin.settings.scrollbar_visibility !== "hide") {
            new Setting(containerEl)
                .setName("Scrollbar thickness")
                .setDesc("Width of scrollbars in px.")
                .addExtraButton(button => {
                    button
                        .setIcon('reset')
                        .setTooltip('Restore default')
                        .onClick(async () => {
                            this.plugin.settings.scrollbar_width = DEFAULT_SETTINGS.scrollbar_width
                            this.plugin.update_scrollbar_css()
                            this.display()
                            await this.plugin.saveSettings()
                        });
                })
                .addSlider(slider => slider
                    .setValue(this.plugin.settings.scrollbar_width)
                    .setLimits(0, 30, 1)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.scrollbar_width = value;
                        this.plugin.update_scrollbar_css()
                        await this.plugin.saveSettings();
                    })
                );
        }

    }
}