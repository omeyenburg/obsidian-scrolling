import { Platform, PluginSettingTab, Setting } from "obsidian";
import type { default as ScrollingPlugin } from "./main";

export interface ScrollingPluginSettings {
    smartScrollMode: string; // disabled, follow-cursor, page-jump
    smartScrollRadius: number;
    smartScrollSmoothness: number;
    smartScrollEnableMouse: boolean;
    smartScrollEnableSelection: boolean;
    smartScrollDynamicAnimation: boolean;

    restoreScrollEnabled: boolean;
    restoreScrollPositions: Record<string, number>;

    scrollbarGlobal: boolean;
    scrollbarVisibility: string; // hide, scroll, show
    scrollbarWidth: number;
    scrollbarFileTreeHorizontal: boolean;

    mouseEnabled: boolean;
    mouseInvert: boolean;
    mouseSpeed: number;
    mouseSmoothness: number;

    touchpadEnabled: boolean;
    touchpadSmoothness: number;
    touchpadFrictionThreshold: number;
    touchpadSpeed: number;
}

export const DEFAULT_SETTINGS: ScrollingPluginSettings = {
    smartScrollMode: "follow-cursor",
    smartScrollRadius: 75,
    smartScrollSmoothness: 25,
    smartScrollDynamicAnimation: true,
    smartScrollEnableMouse: false,
    smartScrollEnableSelection: false,

    restoreScrollEnabled: false,
    restoreScrollPositions: {},

    scrollbarGlobal: false,
    scrollbarVisibility: "show",
    scrollbarWidth: 12,
    scrollbarFileTreeHorizontal: false,

    mouseEnabled: true,
    mouseInvert: false,
    mouseSpeed: 50,
    mouseSmoothness: 75,

    touchpadEnabled: true,
    touchpadSmoothness: 75,
    touchpadFrictionThreshold: 20,
    touchpadSpeed: 50,
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

        new Setting(containerEl).setName("General").setHeading();

        new Setting(containerEl)
            .setName("Remember scroll position")
            .setDesc(
                "Store scroll position before closing a file and continue where you left off when opening it again.",
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.restoreScrollEnabled)
                    .onChange(async (value) => {
                        this.plugin.settings.restoreScrollEnabled = value;
                        await this.plugin.saveSettings();
                    }),
            );

        containerEl.createEl("br");
        new Setting(containerEl).setName("Smart scrolling").setHeading();

        new Setting(containerEl)
            .setName("Mode")
            .setDesc(
                createFragment((frag) => {
                    const div = frag.createDiv();

                    div.createEl("span", {
                        text: "Follow cursor: Keep cursor smoothly near the center. (Typewriter mode)",
                    });
                    div.createEl("br");
                    div.createEl("span", {
                        text: "Page jumping: Reduce scrolling by jumping whole pages at screen edges.",
                    });
                }),
            )
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("disabled", "Disabled")
                    .addOption("follow-cursor", "Follow cursor")
                    .addOption("page-jump", "Page jumping")
                    .setValue(this.plugin.settings.smartScrollMode)
                    .onChange(async (value) => {
                        this.plugin.settings.smartScrollMode = value;
                        this.display();
                        await this.plugin.saveSettings();
                    }),
            );

        if (this.plugin.settings.smartScrollMode !== "disabled") {
            new Setting(containerEl)
                .setName("Scroll zone radius")
                .setDesc(
                    createFragment((frag) => {
                        const div = frag.createDiv();

                        if (this.plugin.settings.smartScrollMode === "follow-cursor") {
                            div.createEl("span", {
                                text: "How far the cursor can move from the center before scrolling.",
                            });
                            div.createEl("br");
                            div.createEl("span", {
                                text: "0% keeps the cursor perfectly centered, while 100% effectively disables this feature.",
                            });
                        } else {
                            div.createEl("span", {
                                text: "How far the cursor can move before jumping.",
                            });
                            div.createEl("br");
                            div.createEl("span", { text: "Lower values might appear buggy." });
                        }
                    }),
                )
                .addExtraButton((button) => {
                    button
                        .setIcon("reset")
                        .setTooltip("Restore default")
                        .onClick(async () => {
                            this.plugin.settings.smartScrollRadius =
                                DEFAULT_SETTINGS.smartScrollRadius;
                            this.display();
                            await this.plugin.saveSettings();
                        });
                })
                .addSlider((slider) =>
                    slider
                        .setValue(this.plugin.settings.smartScrollRadius)
                        .setLimits(0, 100, 1)
                        .setDynamicTooltip()
                        .onChange(async (value) => {
                            this.plugin.settings.smartScrollRadius = value;
                            await this.plugin.saveSettings();
                        }),
                );

            new Setting(containerEl)
                .setName("Scroll smoothness")
                .setDesc(
                    "How fast or slow the scrolling animation is when editing moves the cursor.",
                )
                .addExtraButton((button) => {
                    button
                        .setIcon("reset")
                        .setTooltip("Restore default")
                        .onClick(async () => {
                            this.plugin.settings.smartScrollSmoothness =
                                DEFAULT_SETTINGS.smartScrollSmoothness;
                            this.display();
                            await this.plugin.saveSettings();
                        });
                })
                .addSlider((slider) =>
                    slider
                        .setValue(this.plugin.settings.smartScrollSmoothness)
                        .setLimits(0, 100, 1)
                        .setDynamicTooltip()
                        .onChange(async (value) => {
                            this.plugin.settings.smartScrollSmoothness = value;
                            await this.plugin.saveSettings();
                        }),
                );

            new Setting(containerEl)
                .setName("Dynamic animations")
                .setDesc(
                    "Skip animation frames if lots of scroll events occur for smoother animations.",
                )
                .addToggle((toggle) =>
                    toggle
                        .setValue(this.plugin.settings.smartScrollDynamicAnimation)
                        .onChange(async (value) => {
                            this.plugin.settings.smartScrollDynamicAnimation = value;
                            await this.plugin.saveSettings();
                        }),
                );

            new Setting(containerEl)
                .setName("Invoke on mouse-driven cursor movement")
                .setDesc("Apply this feature when the text cursor is moved with the mouse.")
                .addToggle((toggle) =>
                    toggle
                        .setValue(this.plugin.settings.smartScrollEnableMouse)
                        .onChange(async (value) => {
                            this.plugin.settings.smartScrollEnableMouse = value;
                            this.display();
                            await this.plugin.saveSettings();
                        }),
                );

            if (this.plugin.settings.smartScrollEnableMouse) {
                new Setting(containerEl)
                    .setName("Invoke on mouse selection")
                    .setDesc("Also trigger, when the mouse has selected text.")
                    .addToggle((toggle) =>
                        toggle
                            .setValue(this.plugin.settings.smartScrollEnableSelection)
                            .onChange(async (value) => {
                                this.plugin.settings.smartScrollEnableSelection = value;
                                await this.plugin.saveSettings();
                            }),
                    );
            }
        }

        containerEl.createEl("br");
        new Setting(containerEl).setName("Scrollbar appearance").setHeading();

        new Setting(containerEl)
            .setName("Show horizontal scrollbar in file tree")
            .setDesc("Allow horizontal scrolling in the file tree and add a horizontal scrollbar.")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.scrollbarFileTreeHorizontal)
                    .onChange(async (value) => {
                        this.plugin.settings.scrollbarFileTreeHorizontal = value;
                        this.plugin.scrollbar.updateStyle();
                        await this.plugin.saveSettings();
                    }),
            );

        if (!Platform.isMacOS) {
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

            if (this.plugin.settings.scrollbarVisibility != "scroll") {
                new Setting(containerEl)
                    .setName("Apply appearance to all scrollbars")
                    .setDesc(
                        "Whether scrollbar appearance settings should apply to all scrollbars or only markdown files.",
                    )
                    .addToggle((toggle) =>
                        toggle
                            .setValue(this.plugin.settings.scrollbarGlobal)
                            .onChange(async (value) => {
                                this.plugin.settings.scrollbarGlobal = value;
                                this.plugin.scrollbar.updateStyle();
                                // this.display();
                                await this.plugin.saveSettings();
                            }),
                    );
            } else {
                this.plugin.settings.scrollbarGlobal = false;
                this.plugin.scrollbar.updateStyle();
            }

            if (Platform.isLinux && this.plugin.settings.scrollbarVisibility !== "hide") {
                new Setting(containerEl)
                    .setName("Scrollbar thickness")
                    .setDesc("Width in pixels.")
                    .addExtraButton((button) => {
                        button
                            .setIcon("reset")
                            .setTooltip("Restore default")
                            .onClick(async () => {
                                this.plugin.settings.scrollbarWidth =
                                    DEFAULT_SETTINGS.scrollbarWidth;
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

        containerEl.createEl("br");
        new Setting(containerEl).setName("Mouse/Touchpad scrolling (Experimental)").setHeading();

        new Setting(containerEl)
            .setName("Enabled")
            .setDesc("Whether mouse/touchpad scrolling settings are applied.")
            .addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.mouseEnabled).onChange(async (value) => {
                    this.plugin.settings.mouseEnabled = value;
                    this.display();
                    await this.plugin.saveSettings();
                }),
            );

        if (this.plugin.settings.mouseEnabled) {
            new Setting(containerEl)
                .setName("Invert scroll direction")
                .setDesc("Reverse the scroll direction.")
                .addToggle((toggle) =>
                    toggle.setValue(this.plugin.settings.mouseInvert).onChange(async (value) => {
                        this.plugin.settings.mouseInvert = value;
                        await this.plugin.saveSettings();
                    }),
                );
            new Setting(containerEl)
                .setName("Mouse scroll speed")
                .setDesc("Scroll speed multiplier for mouse wheel.")
                .addExtraButton((button) => {
                    button
                        .setIcon("reset")
                        .setTooltip("Restore default")
                        .onClick(async () => {
                            this.plugin.settings.mouseSpeed = DEFAULT_SETTINGS.mouseSpeed;
                            this.display();
                            await this.plugin.saveSettings();
                        });
                })
                .addSlider((slider) =>
                    slider
                        .setValue(this.plugin.settings.mouseSpeed)
                        .setLimits(1, 100, 1)
                        .setDynamicTooltip()
                        .onChange(async (value) => {
                            this.plugin.settings.mouseSpeed = value;
                            await this.plugin.saveSettings();
                        }),
                );

            new Setting(containerEl)
                .setName("Mouse scroll smoothness")
                .setDesc("How smooth scrolling with a mouse should be.")
                .addExtraButton((button) => {
                    button
                        .setIcon("reset")
                        .setTooltip("Restore default")
                        .onClick(async () => {
                            this.plugin.settings.mouseSmoothness = DEFAULT_SETTINGS.mouseSmoothness;
                            this.display();
                            await this.plugin.saveSettings();
                        });
                })
                .addSlider((slider) =>
                    slider
                        .setValue(this.plugin.settings.mouseSmoothness)
                        .setLimits(0, 100, 1)
                        .setDynamicTooltip()
                        .onChange(async (value) => {
                            this.plugin.settings.mouseSmoothness = value;
                            await this.plugin.saveSettings();
                        }),
                );

            new Setting(containerEl)
                .setName("Touchpad detection")
                .setDesc(
                    createFragment((frag) => {
                        const div = frag.createDiv();

                        div.createEl("span", {
                            text: "Detect touchpad input to provide smoother scrolling.",
                        });
                        div.createEl("br");
                        div.createEl("span", {
                            text: "Detection works reliably on most devices but may occasionally misidentify input type.",
                        });
                    }),
                )
                .addToggle((toggle) =>
                    toggle
                        .setValue(this.plugin.settings.touchpadEnabled)
                        .onChange(async (value) => {
                            this.plugin.settings.touchpadEnabled = value;
                            this.display();
                            await this.plugin.saveSettings();
                        }),
                );

            if (this.plugin.settings.touchpadEnabled) {
                if (this.plugin.settings.mouseEnabled) {
                    new Setting(containerEl)
                        .setName("Touchpad scroll speed")
                        .setDesc("Adjust scroll speed when using a touchpad.")
                        .addExtraButton((button) => {
                            button
                                .setIcon("reset")
                                .setTooltip("Restore default")
                                .onClick(async () => {
                                    this.plugin.settings.touchpadSpeed =
                                        DEFAULT_SETTINGS.touchpadSpeed;
                                    this.display();
                                    await this.plugin.saveSettings();
                                });
                        })
                        .addSlider((slider) =>
                            slider
                                .setValue(this.plugin.settings.touchpadSpeed)
                                .setLimits(1, 100, 1)
                                .setDynamicTooltip()
                                .onChange(async (value) => {
                                    this.plugin.settings.touchpadSpeed = value;
                                    await this.plugin.saveSettings();
                                }),
                        );

                    new Setting(containerEl)
                        .setName("Touchpad smoothness")
                        .setDesc("Control the smoothness of touchpads.")
                        .addExtraButton((button) => {
                            button
                                .setIcon("reset")
                                .setTooltip("Restore default")
                                .onClick(async () => {
                                    this.plugin.settings.touchpadSmoothness =
                                        DEFAULT_SETTINGS.touchpadSmoothness;
                                    this.display();
                                    await this.plugin.saveSettings();
                                });
                        })
                        .addSlider((slider) =>
                            slider
                                .setValue(this.plugin.settings.touchpadSmoothness)
                                .setLimits(0, 100, 1)
                                .setDynamicTooltip()
                                .onChange(async (value) => {
                                    this.plugin.settings.touchpadSmoothness = value;
                                    await this.plugin.saveSettings();
                                }),
                        );

                    new Setting(containerEl)
                        .setName("Touchpad friction threshold")
                        .setDesc(
                            "The minimum scroll strength below which increased friction is applied for finer control.",
                        )
                        .addExtraButton((button) => {
                            button
                                .setIcon("reset")
                                .setTooltip("Restore default")
                                .onClick(async () => {
                                    this.plugin.settings.touchpadFrictionThreshold =
                                        DEFAULT_SETTINGS.touchpadFrictionThreshold;
                                    this.display();
                                    await this.plugin.saveSettings();
                                });
                        })
                        .addSlider((slider) =>
                            slider
                                .setValue(this.plugin.settings.touchpadFrictionThreshold)
                                .setLimits(1, 100, 1)
                                .setDynamicTooltip()
                                .onChange(async (value) => {
                                    this.plugin.settings.touchpadFrictionThreshold = value;
                                    await this.plugin.saveSettings();
                                }),
                        );
                }
            }
        }
    }
}
