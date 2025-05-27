import { App, Editor, MarkdownView, Plugin, PluginSettingTab, Setting } from "obsidian";
import { EditorView, ViewUpdate } from "@codemirror/view";
import { Transaction } from "@codemirror/state";


interface ScrollingPluginSettings {
    centerCursorDynamicAnimation: boolean;
    centerCursorEditingRadius: number;
    centerCursorEditingSmoothness: number;
    centerCursorEnableMouse: boolean;
    centerCursorEnableMouseSelect: boolean;
    centerCursorEnabled: boolean;
    centerCursorInvert: boolean;
    centerCursorMovingDistance: number;
    centerCursorMovingSmoothness: number;
    mouseScrollEnabled: boolean;
    mouseScrollInvert: boolean;
    mouseScrollSmoothness: number;
    mouseScrollSpeed: number;
    scrollbarGlobal: boolean;
    scrollbarVisibility: string;
    scrollbarWidth: number;
}


const DEFAULT_SETTINGS: ScrollingPluginSettings = {
    centerCursorDynamicAnimation: true,
    centerCursorEditingRadius: 25,
    centerCursorEditingSmoothness: 1,
    centerCursorEnableMouse: false,
    centerCursorEnableMouseSelect: false,
    centerCursorEnabled: true,
    centerCursorInvert: false,
    centerCursorMovingDistance: 25,
    centerCursorMovingSmoothness: 1,
    mouseScrollEnabled: true,
    mouseScrollInvert: false,
    mouseScrollSmoothness: 1,
    mouseScrollSpeed: 1,
    scrollbarGlobal: false,
    scrollbarVisibility: "show",
    scrollbarWidth: 12,
}


export default class ScrollingPlugin extends Plugin {
    settings: ScrollingPluginSettings;

    private recentEdit: boolean = false;
    private recentMouseUp: boolean = false;
    private centeringScrollIntensity: number = 0;

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new ScrollingSettingTab(this.app, this));

        this.registerEvent(this.app.workspace.on("editor-change", this.editHandler.bind(this)));

        this.registerDomEvent(document, "mouseup", this.mouseUpHandler.bind(this));
        this.registerDomEvent(document, "keydown", this.keyHandler.bind(this));
        this.registerDomEvent(document, "wheel", this.wheelHandler.bind(this), { passive: false })

        this.registerEditorExtension(EditorView.updateListener.of(this.cursorHandler.bind(this)));

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
        */

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

    cursorHandler(update: ViewUpdate) {
        // This checks if this update was caused by a mouse down event.
        let mouseDown = false
        for (const tr of update.transactions) {
            const event = tr.annotation(Transaction.userEvent);
            if (event === "select.pointer") {
                mouseDown = true
            }
        }

        // Reset recentEdit, which was set by editHandler
        if (this.recentEdit) {
            this.recentEdit = false;
            return;
        }

        // Only procceed if its a cursor event.
        if (!update.selectionSet) return;

        // Always cancel if event was caused by mouse down/movement.
        if (mouseDown) return;

        // Get the editor
        const editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor
        if (!editor) return;

        // Also cancel if mouse up, unless this setting allows it.
        if (!this.settings.centerCursorEnableMouseSelect && editor.somethingSelected()) return;
        if (this.recentMouseUp && !this.settings.centerCursorEnableMouse) return;

        this.invokeScroll(editor);
    }

    private centeringLastTime: number = 0;
    calculateScrollIntensity() {
        if (!this.settings.centerCursorDynamicAnimation) return;
        const decayRate = 0.02;
        const time = performance.now();
        const elapsed = time - this.centeringLastTime;
        this.centeringLastTime = time;
        this.centeringScrollIntensity = Math.max(0, this.centeringScrollIntensity - elapsed * decayRate) + 1;
    }

    private centeringTimeout: number;
    invokeScroll(editor: Editor) {
        if (!this.settings.centerCursorEnabled) return;

        let centerRadius;
        let smoothness;
        if (this.recentEdit) {
            centerRadius = this.settings.centerCursorEditingRadius;
            smoothness = this.settings.centerCursorEditingSmoothness;
        } else {
            centerRadius = this.settings.centerCursorMovingDistance;
            smoothness = this.settings.centerCursorMovingSmoothness;
        }

        // Invert the scroll effect
        let invertCenteringScroll = 1;
        if (this.settings.centerCursorInvert) {
            invertCenteringScroll = -1;
        }

        // If scrolling fast, skip animation steps.
        // (Only if not scrolling inverted and scrolling without edit (otherwise run later))
        if (!this.settings.centerCursorInvert && !this.recentEdit) {
            this.calculateScrollIntensity()
        }

        // Get cursor position. (Specific to CodeMirror 6)
        const cursor_as_offset = editor.posToOffset(editor.getCursor());
        const cursor = (editor as any).cm.coordsAtPos?.(cursor_as_offset) ?? (editor as any).coordsAtPos(cursor_as_offset);
        const viewOffset = editor.cm.scrollDOM.getBoundingClientRect().top;
        const cursorVerticalPosition = cursor.top + editor.cm.defaultLineHeight - viewOffset;

        const scrollInfo = editor.getScrollInfo() as { top: number; left: number; height: number };
        const currentVerticalPosition = scrollInfo.top;
        let centerZoneRadius = (scrollInfo.height / 2) * (centerRadius / 100);

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

        // If scrolling fast, skip animation steps.
        if (this.settings.centerCursorDynamicAnimation && !this.settings.centerCursorInvert && this.recentEdit) {
            this.calculateScrollIntensity()
        }

        cancelAnimationFrame(this.centeringTimeout)

        // let steps = Math.max(1, Math.round(2 + 4 * smoothness - this.centeringScrollIntensity ** 0.5));
        let steps = Math.round(1 + 4 * smoothness);
        if (!this.settings.centerCursorInvert && this.centeringScrollIntensity > 5) steps = 1;


        const animate = (editor: Editor, dest: number, step_size: number, step: number) => {
            if (!step) return;

            editor.scrollTo(null, dest - step_size * (step - 1));
            this.centeringTimeout = requestAnimationFrame(() => animate(editor, dest, step_size, step - 1))
        }

        animate(editor, goal, distance / steps, steps);
    }

    wheelHandler(event: WheelEvent) {
        if (!this.settings.mouseScrollEnabled) return;
        if (!event.deltaY) return;

        let el: HTMLElement | null = event.target as HTMLElement;

        while (el && el != document.body) {
            const { overflowY } = getComputedStyle(el);
            const allowsScrollY = (overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight;

            if (allowsScrollY) {
                var delta = event.deltaY;
                if (event.deltaMode == event.DOM_DELTA_LINE) {
                    delta *= 20;
                }

                if (this.isTrackpad(event)) {
                    this.scrollWithTrackpad(el, delta)
                } else {
                    this.scrollWithMouse(el, delta)
                }

                event.preventDefault();
                return;
            }

            el = el.parentElement;
        }
    }

    private lastTrackpadUse: number = 0;
    isTrackpad(event: WheelEvent): boolean {
        if (event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) {
            this.lastTrackpadUse = 0;
            return false;
        }

        const commonDeltas = [120, 197.18010794176823];
        for (const delta of commonDeltas) {
            if ((event.deltaY / delta) % 1 == 0) {
                this.lastTrackpadUse = 0;
                return false;
            }
        }

        const now = performance.now()

        // Movement on both axes
        if (event.deltaX !== 0 && event.deltaY !== 0) {
            this.lastTrackpadUse = now;
            return true;
        }

        // Small, fractional, non-zero delta
        if (event.deltaY % 1 !== 0 && Math.abs(event.deltaY) < 50) {
            this.lastTrackpadUse = now;
            return true;
        }

        // Grace period
        if (now - this.lastTrackpadUse < 1000) {
            this.lastTrackpadUse = now;
            return true;
        }

        return false;
    }

    // This works exactly as in Obsidian!
    // Call with `this.scrollWithMouseNotTrackpad(el, event.deltaY)`
    // No additional multiplier for deltaY needed. Default duration is 150!
    private mouseScrollAnimation: number;
    private mouseScrollTarget: number;
    private lastMouseScroll: number;
    scrollWithMouse(el: HTMLElement, change: number) {
        if (!el) return;
        cancelAnimationFrame(this.mouseScrollAnimation);

        const duration = 150;
        const startTime = performance.now()
        if (this.lastMouseScroll && startTime - this.lastMouseScroll < duration) {
            el.scrollTop = this.mouseScrollTarget
        }
        this.lastMouseScroll = startTime;

        let start = el.scrollTop;
        this.mouseScrollTarget = start + change

        const easeOut = (t: number) => 1 - (1 - t) ** 2;

        const animateScroll = (now: number) => {
            now = performance.now()
            let t = Math.min(1, (now - startTime) / duration);
            t = easeOut(t);

            el.scrollTop = start + change * t

            if (t < 1) {
                this.mouseScrollAnimation = requestAnimationFrame(animateScroll);
            } else {
                el.scrollTop = start + change;
            }
        }

        this.mouseScrollAnimation = requestAnimationFrame(animateScroll);
    }

    private trackpadScrolling = false;
    private trackpadScrollVelocity = 0;
    private trackpadScrollFriction = 0;
    scrollWithTrackpad(el: HTMLElement, change: number) {
        const defaultFriction = 0.75;
        const maxFriction = 0.98
        const fullFrictionThreshold = 20;
        const multiplier = 0.25;
        const minVelocity = 0.1;

        if (this.trackpadScrollVelocity * change < 0) {
            this.trackpadScrolling = false
        }

        this.trackpadScrollVelocity += change * multiplier;

        const animate = () => {
            if (Math.abs(this.trackpadScrollVelocity) > minVelocity) {
                el.scrollTop += this.trackpadScrollVelocity;
                this.trackpadScrollVelocity *= this.trackpadScrollFriction;
                this.trackpadScrollFriction = Math.max(0, Math.min(maxFriction, this.trackpadScrollFriction + 0.05))
                requestAnimationFrame(animate);
            } else {
                this.trackpadScrolling = false;
                this.trackpadScrollVelocity = 0;
            }
        };

        this.trackpadScrollFriction = Math.min(1, (Math.abs(change) / fullFrictionThreshold) ** 3) * defaultFriction;

        if (!this.trackpadScrolling) {
            this.trackpadScrolling = true;
            animate();
        }
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
                            this.plugin.settings.centerCursorEditingRadius = DEFAULT_SETTINGS.centerCursorEditingRadius
                            this.display();
                            await this.plugin.saveSettings()
                        });
                })
                .addSlider(slider => slider
                    .setValue(this.plugin.settings.centerCursorEditingRadius)
                    .setLimits(0, 100, 1)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.centerCursorEditingRadius = value;
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
                        "Scrolling is triggered when you lift the mouse."
                    );
                }))
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.centerCursorEnableMouse)
                    .onChange(async (value) => {
                        this.plugin.settings.centerCursorEnableMouse = value;
                        await this.plugin.saveSettings();
                    })
                );

            if (this.plugin.settings.centerCursorEnableMouse) {
                new Setting(containerEl)
                    .setName("Invoke on selection with mouse.")
                    .setDesc(createFragment(frag => {
                        frag.createDiv({}, div => div.innerHTML =
                            "Also trigger, when the mouse has selected text."
                        );
                    }))
                    .addToggle(toggle => toggle
                        .setValue(this.plugin.settings.centerCursorEnableMouseSelect)
                        .onChange(async (value) => {
                            this.plugin.settings.centerCursorEnableMouseSelect = value;
                            await this.plugin.saveSettings();
                        })
                    );

            }

            new Setting(containerEl)
                .setName("Dynamic animations")
                .setDesc(createFragment(frag => {
                    frag.createDiv({}, div => div.innerHTML =
                        "Skip animation frames if lots of scroll events occur.<br>" +
                        "Should make scrolling with pressed arrow keys/vim motions a lot smoother."
                    );
                }))
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.centerCursorDynamicAnimation)
                    .onChange(async (value) => {
                        this.plugin.settings.centerCursorDynamicAnimation = value;
                        await this.plugin.saveSettings();
                    })
                );

            new Setting(containerEl)
                .setName("Alternative effect: Scroll by whole pages")
                .setDesc(createFragment(frag => {
                    frag.createDiv({}, div => div.innerHTML =
                        "This inverts the above options to reduce overall scrolling, by scrolling by whole pages.<br>" +
                        "Best paired with high center radius and longer animation.<br>" +
                        "Low values of center radius might appear buggy."
                    );
                }))
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.centerCursorInvert)
                    .onChange(async (value) => {
                        this.plugin.settings.centerCursorInvert = value;
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