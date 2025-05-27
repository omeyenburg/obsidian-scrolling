import { PluginSettingTab, Setting } from "obsidian";
import type { default as ScrollingPlugin } from "./main";

export interface ScrollingPluginSettings {
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

export const DEFAULT_SETTINGS: ScrollingPluginSettings = {
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
};

export class ScrollingSettingTab extends PluginSettingTab {
    plugin: ScrollingPlugin;

    constructor(plugin: ScrollingPlugin) {
        super(plugin.app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const containerEl = this.containerEl;
        containerEl.empty();

        // Mouse scrolling settings
        new Setting(containerEl).setName("Mouse scrolling").setHeading();

        new Setting(containerEl)
            .setName("Enabled")
            .setDesc("Whether mouse scrolling settings should be applied.")
            .addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.mouseScrollEnabled).onChange(async (value) => {
                    this.plugin.settings.mouseScrollEnabled = value;
                    this.display();
                    await this.plugin.saveSettings();
                }),
            );

        // TODO: split mouse wheel and touchpad up?
        if (this.plugin.settings.mouseScrollEnabled) {
            new Setting(containerEl)
                .setName("Scroll speed")
                .setDesc("Controls how fast you scroll using your mouse wheel or trackpad.")
                .addExtraButton((button) => {
                    button
                        .setIcon("reset")
                        .setTooltip("Restore default")
                        .onClick(async () => {
                            this.plugin.settings.mouseScrollSpeed =
                                DEFAULT_SETTINGS.mouseScrollSpeed;
                            this.display();
                            await this.plugin.saveSettings();
                        });
                })
                .addSlider((slider) =>
                    slider
                        .setValue(this.plugin.settings.mouseScrollSpeed)
                        .setLimits(0, 4, 0.1)
                        .setDynamicTooltip()
                        .onChange(async (value) => {
                            this.plugin.settings.mouseScrollSpeed = value;
                            await this.plugin.saveSettings();
                        }),
                );

            new Setting(containerEl)
                .setName("Scroll smoothness")
                .setDesc("Determines how smooth scrolling should be. 0 means instant.")
                .addExtraButton((button) => {
                    button
                        .setIcon("reset")
                        .setTooltip("Restore default")
                        .onClick(async () => {
                            this.plugin.settings.mouseScrollSmoothness =
                                DEFAULT_SETTINGS.mouseScrollSmoothness;
                            this.display();
                            await this.plugin.saveSettings();
                        });
                })
                .addSlider((slider) =>
                    slider
                        .setValue(this.plugin.settings.mouseScrollSmoothness)
                        .setLimits(0, 4, 0.1)
                        .setDynamicTooltip()
                        .onChange(async (value) => {
                            this.plugin.settings.mouseScrollSmoothness = value;
                            await this.plugin.saveSettings();
                        }),
                );

            new Setting(containerEl)
                .setName("Invert scroll direction")
                .setDesc("Flips scroll direction.")
                .addToggle((toggle) =>
                    toggle
                        .setValue(this.plugin.settings.mouseScrollInvert)
                        .onChange(async (value) => {
                            this.plugin.settings.mouseScrollInvert = value;
                            await this.plugin.saveSettings();
                        }),
                );
        }

        // Centered text cursor settings
        new Setting(containerEl).setHeading();
        new Setting(containerEl)
            .setName("Centered text cursor")
            .setDesc(
                createFragment((frag) => {
                    frag.createDiv(
                        {},
                        (div) =>
                            (div.innerHTML =
                                "Keeps the text cursor within a comfortable zone while moving or editing. Behaves similarly to Vim's <code>scrolloff</code> option."),
                    );
                }),
            )
            .setHeading();

        new Setting(containerEl)
            .setName("Enabled")
            .setDesc("Whether to enable the centered cursor feature.")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.centerCursorEnabled)
                    .onChange(async (value) => {
                        this.plugin.settings.centerCursorEnabled = value;
                        this.display();
                        await this.plugin.saveSettings();
                    }),
            );

        if (this.plugin.settings.centerCursorEnabled) {
            new Setting(containerEl)
                .setName("Center radius while editing")
                .setDesc(
                    createFragment((frag) => {
                        frag.createDiv(
                            {},
                            (div) =>
                                (div.innerHTML =
                                    'Defines how far from the screen center the cursor can move before scrolling (in "%").<br>' +
                                    "0% keeps the cursor perfectly centered.<br>" +
                                    "100% effectively disables this feature."),
                        );
                    }),
                )
                .addExtraButton((button) => {
                    button
                        .setIcon("reset")
                        .setTooltip("Restore default")
                        .onClick(async () => {
                            this.plugin.settings.centerCursorEditingRadius =
                                DEFAULT_SETTINGS.centerCursorEditingRadius;
                            this.display();
                            await this.plugin.saveSettings();
                        });
                })
                .addSlider((slider) =>
                    slider
                        .setValue(this.plugin.settings.centerCursorEditingRadius)
                        .setLimits(0, 100, 1)
                        .setDynamicTooltip()
                        .onChange(async (value) => {
                            this.plugin.settings.centerCursorEditingRadius = value;
                            await this.plugin.saveSettings();
                        }),
                );

            new Setting(containerEl)
                .setName("Center radius while moving cursor")
                .setDesc(
                    createFragment((frag) => {
                        frag.createDiv(
                            {},
                            (div) =>
                                (div.innerHTML =
                                    'Defines how far from the screen center the cursor can be moved before scrolling (in "%").<br>' +
                                    "0% keeps the cursor perfectly centered.<br>" +
                                    "100% effectively disables this feature."),
                        );
                    }),
                )
                .addExtraButton((button) => {
                    button
                        .setIcon("reset")
                        .setTooltip("Restore default")
                        .onClick(async () => {
                            this.plugin.settings.centerCursorMovingDistance =
                                DEFAULT_SETTINGS.centerCursorMovingDistance;
                            this.display();
                            await this.plugin.saveSettings();
                        });
                })
                .addSlider((slider) =>
                    slider
                        .setValue(this.plugin.settings.centerCursorMovingDistance)
                        .setLimits(0, 100, 1)
                        .setDynamicTooltip()
                        .onChange(async (value) => {
                            this.plugin.settings.centerCursorMovingDistance = value;
                            await this.plugin.saveSettings();
                        }),
                );

            new Setting(containerEl)
                .setName("Scroll animation when editing")
                .setDesc(
                    createFragment((frag) => {
                        frag.createDiv(
                            {},
                            (div) =>
                                (div.innerHTML =
                                    "Adjusts the smoothness of scrolling when editing moves the cursor outside the central zone.<br>" +
                                    "Set to 0 to disable smooth scroll when editing."),
                        );
                    }),
                )
                .addExtraButton((button) => {
                    button
                        .setIcon("reset")
                        .setTooltip("Restore default")
                        .onClick(async () => {
                            this.plugin.settings.centerCursorEditingSmoothness =
                                DEFAULT_SETTINGS.centerCursorEditingSmoothness;
                            this.display();
                            await this.plugin.saveSettings();
                        });
                })
                .addSlider((slider) =>
                    slider
                        .setValue(this.plugin.settings.centerCursorEditingSmoothness)
                        .setLimits(0, 4, 0.1)
                        .setDynamicTooltip()
                        .onChange(async (value) => {
                            this.plugin.settings.centerCursorEditingSmoothness = value;
                            await this.plugin.saveSettings();
                        }),
                );

            new Setting(containerEl)
                .setName("Scroll animation when moving cursor")
                .setDesc(
                    createFragment((frag) => {
                        frag.createDiv(
                            {},
                            (div) =>
                                (div.innerHTML =
                                    "Adjusts the smoothness of scrolling when the text cursor is moved outside the central zone.<br>" +
                                    "Set to 0 to disable smooth scroll when moving text cursor."),
                        );
                    }),
                )
                .addExtraButton((button) => {
                    button
                        .setIcon("reset")
                        .setTooltip("Restore default")
                        .onClick(async () => {
                            this.plugin.settings.centerCursorMovingSmoothness =
                                DEFAULT_SETTINGS.centerCursorMovingSmoothness;
                            this.display();
                            await this.plugin.saveSettings();
                        });
                })
                .addSlider((slider) =>
                    slider
                        .setValue(this.plugin.settings.centerCursorMovingSmoothness)
                        .setLimits(0, 4, 0.1)
                        .setDynamicTooltip()
                        .onChange(async (value) => {
                            this.plugin.settings.centerCursorMovingSmoothness = value;
                            await this.plugin.saveSettings();
                        }),
                );

            new Setting(containerEl)
                .setName("Invoke on mouse-driven cursor movement")
                .setDesc(
                    createFragment((frag) => {
                        frag.createDiv(
                            {},
                            (div) =>
                                (div.innerHTML =
                                    "Also apply this feature when the text cursor is moved with the mouse.<br>" +
                                    "Scrolling is triggered when you lift the mouse."),
                        );
                    }),
                )
                .addToggle((toggle) =>
                    toggle
                        .setValue(this.plugin.settings.centerCursorEnableMouse)
                        .onChange(async (value) => {
                            this.plugin.settings.centerCursorEnableMouse = value;
                            await this.plugin.saveSettings();
                        }),
                );

            if (this.plugin.settings.centerCursorEnableMouse) {
                new Setting(containerEl)
                    .setName("Invoke on selection with mouse.")
                    .setDesc(
                        createFragment((frag) => {
                            frag.createDiv(
                                {},
                                (div) =>
                                    (div.innerHTML =
                                        "Also trigger, when the mouse has selected text."),
                            );
                        }),
                    )
                    .addToggle((toggle) =>
                        toggle
                            .setValue(this.plugin.settings.centerCursorEnableMouseSelect)
                            .onChange(async (value) => {
                                this.plugin.settings.centerCursorEnableMouseSelect = value;
                                await this.plugin.saveSettings();
                            }),
                    );
            }

            new Setting(containerEl)
                .setName("Dynamic animations")
                .setDesc(
                    createFragment((frag) => {
                        frag.createDiv(
                            {},
                            (div) =>
                                (div.innerHTML =
                                    "Skip animation frames if lots of scroll events occur.<br>" +
                                    "Should make scrolling with pressed arrow keys/vim motions a lot smoother."),
                        );
                    }),
                )
                .addToggle((toggle) =>
                    toggle
                        .setValue(this.plugin.settings.centerCursorDynamicAnimation)
                        .onChange(async (value) => {
                            this.plugin.settings.centerCursorDynamicAnimation = value;
                            await this.plugin.saveSettings();
                        }),
                );

            new Setting(containerEl)
                .setName("Alternative effect: Scroll by whole pages")
                .setDesc(
                    createFragment((frag) => {
                        frag.createDiv(
                            {},
                            (div) =>
                                (div.innerHTML =
                                    "This inverts the above options to reduce overall scrolling, by scrolling by whole pages.<br>" +
                                    "Best paired with high center radius and longer animation.<br>" +
                                    "Low values of center radius might appear buggy."),
                        );
                    }),
                )
                .addToggle((toggle) =>
                    toggle
                        .setValue(this.plugin.settings.centerCursorInvert)
                        .onChange(async (value) => {
                            this.plugin.settings.centerCursorInvert = value;
                            await this.plugin.saveSettings();
                        }),
                );
        }

        // Scrollbar appearance settings
        new Setting(containerEl);
        new Setting(containerEl).setName("Scrollbar appearance").setHeading();

        new Setting(containerEl)
            .setName("Apply to all scrollbars")
            .setDesc(
                "Whether the following options should apply to all scrollbars in obsidian or only scrollbars in markdown files.",
            )
            .addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.scrollbarGlobal).onChange(async (value) => {
                    this.plugin.settings.scrollbarGlobal = value;
                    this.plugin.scrollbar.updateStyle();
                    await this.plugin.saveSettings();
                }),
            );

        // dropdown menu: hide all, hide bars (only markdown file), show bars while scrolling, show bar while scrolling (only markdown file), show all
        new Setting(containerEl)
            .setName("Scrollbar visibility")
            .setDesc("When to show scrollbars.")
            .addExtraButton((button) => {
                button
                    .setIcon("reset")
                    .setTooltip("Restore default")
                    .onClick(async () => {
                        this.plugin.settings.scrollbarVisibility =
                            DEFAULT_SETTINGS.scrollbarVisibility;
                        this.plugin.scrollbar.updateStyle();
                        await this.plugin.saveSettings();
                    });
            })
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("hide", "Always hide scrollbars")
                    .addOption("scroll", "Show scrollbars while scrolling")
                    .addOption("show", "Always show scrollbars")
                    .setValue(this.plugin.settings.scrollbarVisibility)
                    .onChange(async (value) => {
                        this.plugin.settings.scrollbarVisibility = value;
                        this.plugin.scrollbar.updateStyle();
                        this.display();
                        await this.plugin.saveSettings();
                    }),
            );

        if (this.plugin.settings.scrollbarVisibility !== "hide") {
            new Setting(containerEl)
                .setName("Scrollbar thickness")
                .setDesc("Width of scrollbars in px.")
                .addExtraButton((button) => {
                    button
                        .setIcon("reset")
                        .setTooltip("Restore default")
                        .onClick(async () => {
                            this.plugin.settings.scrollbarWidth = DEFAULT_SETTINGS.scrollbarWidth;
                            this.plugin.scrollbar.updateStyle();
                            this.display();
                            await this.plugin.saveSettings();
                        });
                })
                .addSlider((slider) =>
                    slider
                        .setValue(this.plugin.settings.scrollbarWidth)
                        .setLimits(0, 30, 1)
                        .setDynamicTooltip()
                        .onChange(async (value) => {
                            this.plugin.settings.scrollbarWidth = value;
                            this.plugin.scrollbar.updateStyle();
                            await this.plugin.saveSettings();
                        }),
                );
        }
    }
}
