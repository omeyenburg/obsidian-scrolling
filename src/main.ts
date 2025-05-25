import { App, Editor, MarkdownView, Plugin, PluginSettingTab, Setting } from "obsidian";
import { EditorView, ViewUpdate } from "@codemirror/view";
import { Transaction } from "@codemirror/state";


interface ScrollingPluginSettings {
    mouseScrollEnabled: boolean;
    mouseScrollSpeed: number;
    mouseScrollSmoothness: number;
    mouseScrollInvert: boolean;
    centerCursorEnabled: boolean;
    centerCursorEditingDistance: number;
    centerCursorMovingDistance: number;
    centerCursorEditingSmoothness: number;
    centerCursorMovingSmoothness: number;
    center_cursor_enable_mouse: boolean;
    scrollbarGlobal: boolean;
    scrollbarVisibility: string;
    scrollbarWidth: number;
}


const DEFAULT_SETTINGS: ScrollingPluginSettings = {
    mouseScrollEnabled: true,
    mouseScrollSpeed: 1,
    mouseScrollSmoothness: 1,
    mouseScrollInvert: false,
    centerCursorEnabled: true,
    centerCursorEditingDistance: 25,
    centerCursorMovingDistance: 25,
    centerCursorEditingSmoothness: 1,
    centerCursorMovingSmoothness: 1,
    center_cursor_enable_mouse: false,
    scrollbarGlobal: false,
    scrollbarVisibility: "show",
    scrollbarWidth: 12,
}


export default class ScrollingPlugin extends Plugin {
    settings: ScrollingPluginSettings;

    private recentEdit: boolean = false;
    private recentMouseUp: boolean = false;
    private centeringTimeout: number;
    private centeringLastTime: number = 0;
    private centeringScrollIntensity: number = 0;

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new ScrollingSettingTab(this.app, this));

        // Callbacks for markdown changes and cursor movements
        // Will be automatically deleted on reload
        this.registerEvent(this.app.workspace.on("editor-change", (editor) => this.editHandler(editor)));
        this.registerDomEvent(document, "mouseup", () => this.mouseUpHandler());
        this.registerDomEvent(document, "keydown", () => this.keyHandler());

        // This is specific to CodeMirror 6.
        /*
        Event order when using mouse:
        1. cursorActivity (cm6, with select.pointer)
        2. mousedown (dom)
        3. selectionchange (dom)
        4. mouseup (dom)
        5. cursorActivity (cm6, without select.pointer)

        Event order when editing:
        1. editor-change (workspace)
        2. docChanged (cm6)
        3. cursorActivity (cm6)
        4. selectionchange (dom)

        Event order when editing, but single character replace with vim:
        1. editor-change (workspace)
        2. docChanged (cm6)
        3. cursorActivity (cm6)
        */

        this.registerEditorExtension(EditorView.updateListener.of((update: ViewUpdate) => {
            // This checks if this update was caused by a mouse down event.
            let mouseDown = false
            for (const tr of update.transactions) {
                const event = tr.annotation(Transaction.userEvent);
                if (event === "select.pointer") {
                    mouseDown = true
                }
            }

            // Only procceed if its a cursor event.
            if (!update.selectionSet) return;

            // We want to return if this event was caused by a mouse.
            if (mouseDown) return;
            if (this.recentMouseUp) return; // <- Later maybe create a setting for this.

            this.cursorHandler();
        }));

        // Initializes css to style scroll bars.
        this.updateScrollbarCSS();

        console.log("ScrollingPlugin loaded");
    }

    async onunload() {
        this.removeScrollbarCSS();

        console.log("ScrollingPlugin unloaded");
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    keyHandler() {
        this.recentMouseUp = false;
    }

    mouseUpHandler() {
        this.recentMouseUp = true;

        // recentMouseUp will be reset either when a key is pressed or 100 ms pass.
        // This timeout is needed, because the keydown event is not reliable,
        // in normal mode of vim, keydown events are pretty much inaccessible.
        // Already wasted too much time with this.
        setTimeout(() => {
            this.recentMouseUp = false;
        }, 100);
    }

    editHandler(editor: Editor) {
        this.recentEdit = true; // Will be reset by cursorHandler
        this.invokeScroll(editor);
    }

    cursorHandler() {
        if (this.recentEdit) {
            this.recentEdit = false;
            return;
        }

        const editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor
        if (!editor) return;

        this.invokeScroll(editor);
    }

    calculateScrollIntensity() {
        const decayRate = 0.02;
        const time = performance.now();
        const elapsed = time - this.centeringLastTime;
        this.centeringLastTime = time;
        this.centeringScrollIntensity = Math.max(0, this.centeringScrollIntensity - elapsed * decayRate) + 1;
    }

    invokeScroll(editor: Editor) {
        // Invert the scroll effect: 1 or -1
        const invertCenteringScroll = 1;

        // If scrolling fast, skip animation steps.
        // (Only if not scrolling inverted and if recent edit occured, run this later)
        if (invertCenteringScroll === 1 && this.recentEdit === false) {
            this.calculateScrollIntensity()
        }

        // Get cursor position. (Specific to CodeMirror 6)
        const cursor_as_offset = editor.posToOffset(editor.getCursor());
        const cursor = (editor as any).cm.coordsAtPos?.(cursor_as_offset) ?? (editor as any).coordsAtPos(cursor_as_offset);
        const viewOffset = editor.cm.scrollDOM.getBoundingClientRect().top;
        const cursorVerticalPosition = cursor.top + editor.cm.defaultLineHeight - viewOffset;

        const scrollInfo = editor.getScrollInfo();
        const currentVerticalPosition = scrollInfo.top;
        let centerZoneRadius = (scrollInfo.height / 2) * (this.settings.centerCursorEditingDistance / 100);

        // Decrease center zone radius slightly to ensure that:
        // - cursor stays on the screen.
        // - we scroll before cursor gets to close to the edge and obsidian takes over scrolling.
        if (invertCenteringScroll === -1) {
            centerZoneRadius *= 0.95;
        }

        const center = scrollInfo.height / 2
        const centerOffset = cursorVerticalPosition - center;

        let goal;
        let distance;
        if (centerOffset < -centerZoneRadius) {
            goal = currentVerticalPosition + centerOffset + centerZoneRadius * invertCenteringScroll;
            distance = centerOffset + centerZoneRadius * invertCenteringScroll;
        } else if (centerOffset > centerZoneRadius) {
            goal = currentVerticalPosition + centerOffset - centerZoneRadius * invertCenteringScroll;
            distance = centerOffset - centerZoneRadius * invertCenteringScroll;
        } else {
            return;
        }

        // Can't scroll by fractions, so return early.
        if (Math.abs(distance) < 1) return;

        if (invertCenteringScroll === 1 && this.recentEdit === true) {
            this.calculateScrollIntensity()
        }

        cancelAnimationFrame(this.centeringTimeout)

        // let steps = Math.max(1, Math.round(2 + 4 * this.settings.centerCursorEditingSmoothness - this.centeringScrollIntensity ** 0.5));
        let steps = Math.round(1 + 4 * this.settings.centerCursorEditingSmoothness);
        if (invertCenteringScroll === 1 && this.centeringScrollIntensity > 5) steps = 1;

        this.smoothScroll(editor, goal, distance / steps, steps);
    }

    smoothScroll(editor: Editor, dest: number, step_size: number, step: number) {
        if (!step) return;

        editor.scrollTo(null, dest - step_size * (step - 1));
        this.centeringTimeout = requestAnimationFrame(() => this.smoothScroll(editor, dest, step_size, step - 1))
    }

    updateScrollbarCSS() {
        this.removeScrollbarCSS()

        const style = document.createElement('style');
        style.id = 'scrolling-scrollbar-style';
        const global = this.settings.scrollbarGlobal;

        let display: string | undefined;
        let color: string | undefined;

        const visibility = this.settings.scrollbarVisibility;
        if (visibility == "hide") {
            display = "none";
        } else if (visibility == "scroll") {
            color = "transparent";
        }

        const width = this.settings.scrollbarWidth;
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

    removeScrollbarCSS() {
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
                .setValue(this.plugin.settings.mouseScrollEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.mouseScrollEnabled = value;
                    this.display();
                    await this.plugin.saveSettings();
                })
            );

        // TODO: split mouse wheel and touchpad up?
        if (this.plugin.settings.mouseScrollEnabled) {
            new Setting(containerEl)
                .setName("Scroll speed")
                .setDesc("Controls how fast you scroll using your mouse wheel or trackpad.")
                .addExtraButton(button => {
                    button
                        .setIcon('reset')
                        .setTooltip('Restore default')
                        .onClick(async () => {
                            this.plugin.settings.mouseScrollSpeed = DEFAULT_SETTINGS.mouseScrollSpeed
                            this.display();
                            await this.plugin.saveSettings()
                        });
                })
                .addSlider(slider => slider
                    .setValue(this.plugin.settings.mouseScrollSpeed)
                    .setLimits(0, 4, 0.1)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.mouseScrollSpeed = value;
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
                            this.plugin.settings.mouseScrollSmoothness = DEFAULT_SETTINGS.mouseScrollSmoothness
                            this.display()
                            await this.plugin.saveSettings()
                        })
                })
                .addSlider(slider => slider
                    .setValue(this.plugin.settings.mouseScrollSmoothness)
                    .setLimits(0, 4, 0.1)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.mouseScrollSmoothness = value;
                        await this.plugin.saveSettings();
                    })
                );

            new Setting(containerEl)
                .setName("Invert scroll direction")
                .setDesc("Flips scroll direction.")
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.mouseScrollInvert)
                    .onChange(async (value) => {
                        this.plugin.settings.mouseScrollInvert = value;
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
                .setValue(this.plugin.settings.centerCursorEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.centerCursorEnabled = value;
                    this.display();
                    await this.plugin.saveSettings();
                })
            );

        if (this.plugin.settings.centerCursorEnabled) {
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
                            this.plugin.settings.centerCursorEditingDistance = DEFAULT_SETTINGS.centerCursorEditingDistance
                            this.display();
                            await this.plugin.saveSettings()
                        });
                })
                .addSlider(slider => slider
                    .setValue(this.plugin.settings.centerCursorEditingDistance)
                    .setLimits(0, 100, 1)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.centerCursorEditingDistance = value;
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
                            this.plugin.settings.centerCursorMovingDistance = DEFAULT_SETTINGS.centerCursorMovingDistance
                            this.display();
                            await this.plugin.saveSettings()
                        });
                })
                .addSlider(slider => slider
                    .setValue(this.plugin.settings.centerCursorMovingDistance)
                    .setLimits(0, 100, 1)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.centerCursorMovingDistance = value;
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
                            this.plugin.settings.centerCursorEditingSmoothness = DEFAULT_SETTINGS.centerCursorEditingSmoothness
                            this.display();
                            await this.plugin.saveSettings()
                        });
                })
                .addSlider(slider => slider
                    .setValue(this.plugin.settings.centerCursorEditingSmoothness)
                    .setLimits(0, 4, 0.1)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.centerCursorEditingSmoothness = value;
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
                            this.plugin.settings.centerCursorMovingSmoothness = DEFAULT_SETTINGS.centerCursorMovingSmoothness
                            this.display();
                            await this.plugin.saveSettings()
                        });
                })
                .addSlider(slider => slider
                    .setValue(this.plugin.settings.centerCursorMovingSmoothness)
                    .setLimits(0, 4, 0.1)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.centerCursorMovingSmoothness = value;
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
                .setValue(this.plugin.settings.scrollbarGlobal)
                .onChange(async (value) => {
                    this.plugin.settings.scrollbarGlobal = value;
                    this.plugin.updateScrollbarCSS();
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
                        this.plugin.settings.scrollbarVisibility = DEFAULT_SETTINGS.scrollbarVisibility
                        this.plugin.updateScrollbarCSS();
                        await this.plugin.saveSettings();
                    });
            })
            .addDropdown(dropdown => dropdown
                .addOption("hide", "Always hide scrollbars")
                .addOption("scroll", "Show scrollbars while scrolling")
                .addOption("show", "Always show scrollbars")
                .setValue(this.plugin.settings.scrollbarVisibility)
                .onChange(async (value) => {
                    this.plugin.settings.scrollbarVisibility = value;
                    this.plugin.updateScrollbarCSS();
                    this.display();
                    await this.plugin.saveSettings();
                })
            )

        if (this.plugin.settings.scrollbarVisibility !== "hide") {
            new Setting(containerEl)
                .setName("Scrollbar thickness")
                .setDesc("Width of scrollbars in px.")
                .addExtraButton(button => {
                    button
                        .setIcon('reset')
                        .setTooltip('Restore default')
                        .onClick(async () => {
                            this.plugin.settings.scrollbarWidth = DEFAULT_SETTINGS.scrollbarWidth
                            this.plugin.updateScrollbarCSS();
                            this.display();
                            await this.plugin.saveSettings();
                        });
                })
                .addSlider(slider => slider
                    .setValue(this.plugin.settings.scrollbarWidth)
                    .setLimits(0, 30, 1)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.scrollbarWidth = value;
                        this.plugin.updateScrollbarCSS();
                        await this.plugin.saveSettings();
                    })
                );
        }
    }
}