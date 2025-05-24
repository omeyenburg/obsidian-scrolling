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
}


const DEFAULT_SETTINGS: ScrollingPluginSettings = {
    mouse_scroll_enabled: true,
    mouse_scroll_speed: 1,
    mouse_scroll_smoothness: 1,
    mouse_scroll_invert: false,
    center_cursor_enabled: true,
    center_cursor_editing_distance: 75,
    center_cursor_moving_distance: 25,
    center_cursor_editing_smoothness: 1,
    center_cursor_moving_smoothness: 1,
    center_cursor_enable_mouse: false,
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

        console.log("ScrollingPlugin loaded");
    }

    async onunload() {
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
        if (this.mousedown) return null;
        if (this.mouseup) {
            this.mouseup = false;
            return null;
        }

        setTimeout(() => {
            if (this.mousedown) return null;

            if (this.editing) {
                this.editing = false;
                return null;
            }

            // const editor = this.app.workspace.activeEditor?.editor;
            const editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor
            if (!editor) return null;

            // return if text got selected; we do not want to interfere with that
            if (editor.somethingSelected()) return null;

            this.scroll(editor);
        }, 10);
    }

    scroll(editor: Editor) {
        const editor_view = editor.cm;

        // cursor position on screen in pixels
        const cursor = editor_view.coordsAtPos(editor_view.state.selection.main.head);
        if (!cursor) return null;

        const current_scroll_y = editor.getScrollInfo().top;
        const cursor_y = cursor.top;
        const scrollInfo = editor_view.scrollDOM.getBoundingClientRect();
        const center = (scrollInfo.top + scrollInfo.bottom) / 2
        const center_offset = cursor_y - center;

        clearTimeout(this.smoothscroll_timeout);

        const time = 5;
        let steps = Math.round(1 + 4 * this.settings.center_cursor_editing_smoothness);
        this.smoothscroll(editor, current_scroll_y + center_offset, center_offset / steps, time, steps);
    }

    smoothscroll(editor: Editor, dest: number, step_size: number, time: number, step: number) {
        if (!step) return null;
        const move_to = dest - step_size * (step - 1);
        editor.scrollTo(null, move_to);
        this.smoothscroll_timeout = setTimeout(() => this.smoothscroll(editor, dest, step_size, time, step - 1), time);
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

        // Mouse Scrolling settings
        new Setting(containerEl)
            .setName("Mouse Scrolling")
            .setHeading();

        new Setting(containerEl)
            .setName("Enabled")
            .setDesc("Whether mouse scrolling settings should be applied.")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.mouse_scroll_enabled)
                .onChange(async (value) => {
                    this.plugin.settings.mouse_scroll_enabled = value;
                    await this.plugin.saveSettings();
                    this.display();
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
                            await this.plugin.saveSettings()
                            this.display();
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
                            await this.plugin.saveSettings()
                            this.display()
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

        // Centered cursor settings
        new Setting(containerEl)
            .setName("Centered text cursor")
            .setDesc("Keeps the text cursor within a comfortable zone while moving or editing. Behaves similarly to Vim's `scrolloff` option.")
            .setHeading();

        new Setting(containerEl)
            .setName("Enabled")
            .setDesc("Whether to enable the centered cursor feature.")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.center_cursor_enabled)
                .onChange(async (value) => {
                    this.plugin.settings.center_cursor_enabled = value;
                    await this.plugin.saveSettings();
                    this.display();
                })
            );

        if (this.plugin.settings.center_cursor_enabled) {
            const fragment0 = new DocumentFragment();
            fragment0.createDiv({}, div => div.setText("Defines how far from the screen center the cursor can move before scrolling (in \"%\")."));
            fragment0.createDiv({}, div => div.setText("0% keeps the cursor perfectly centered."));
            fragment0.createDiv({}, div => div.setText("100% effectively disables this feature."));

            new Setting(containerEl)
                .setName("Center radius while editing")
                .setDesc(fragment0)
                .addExtraButton(button => {
                    button
                        .setIcon('reset')
                        .setTooltip('Restore default')
                        .onClick(async () => {
                            this.plugin.settings.center_cursor_editing_distance = DEFAULT_SETTINGS.center_cursor_editing_distance
                            await this.plugin.saveSettings()
                            this.display();
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

            const fragment1 = new DocumentFragment();
            fragment1.createDiv({}, div => div.setText("Defines how far from the screen center the cursor can be moved before scrolling (in \"%\")."));
            fragment1.createDiv({}, div => div.setText("0% keeps the cursor perfectly centered."));
            fragment1.createDiv({}, div => div.setText("100% effectively disables this feature."));
            new Setting(containerEl)
                .setName("Center radius while moving cursor")
                .setDesc(fragment1)
                .addExtraButton(button => {
                    button
                        .setIcon('reset')
                        .setTooltip('Restore default')
                        .onClick(async () => {
                            this.plugin.settings.center_cursor_moving_distance = DEFAULT_SETTINGS.center_cursor_moving_distance
                            await this.plugin.saveSettings()
                            this.display();
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
                .setDesc("Adjusts the smoothness of scrolling when editing moves the cursor outside the central zone. 0 means instant.")
                .addExtraButton(button => {
                    button
                        .setIcon('reset')
                        .setTooltip('Restore default')
                        .onClick(async () => {
                            this.plugin.settings.center_cursor_editing_smoothness = DEFAULT_SETTINGS.center_cursor_editing_smoothness
                            await this.plugin.saveSettings()
                            this.display();
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
                .setDesc("Adjusts the smoothness of scrolling when the cursor is moved outside the center zone. 0 means instant.")
                .addExtraButton(button => {
                    button
                        .setIcon('reset')
                        .setTooltip('Restore default')
                        .onClick(async () => {
                            this.plugin.settings.center_cursor_moving_smoothness = DEFAULT_SETTINGS.center_cursor_moving_smoothness
                            await this.plugin.saveSettings()
                            this.display();
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


            const fragment2 = new DocumentFragment();
            fragment2.createDiv({}, div => div.setText("Also apply this feature when the text cursor is moved with the mouse."));
            fragment2.createDiv({}, div => div.setText("Recommended to keep disabled to avoid unexpected scrolling while using the mouse to reposition the cursor."));
            new Setting(containerEl)
                .setName("Invoke on mouse-driven cursor movement")
                .setDesc(fragment2)
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.center_cursor_enable_mouse)
                    .onChange(async (value) => {
                        this.plugin.settings.center_cursor_enable_mouse = value;
                        await this.plugin.saveSettings();
                    })
                );
        }
    }
}