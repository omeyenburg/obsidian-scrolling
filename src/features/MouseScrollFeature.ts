import { Platform } from "obsidian";
import type { Feature, FeatureSettingsDefinition, ScrollingPlugin } from "@core/Feature";

/**
 * Settings for the mouse wheel, with no runtime behind them.
 *
 * The engine that used to live here was unreachable: it was registered by calling
 * `events.onWheelExtended`, and the only thing that did so was `followscroll.ts`,
 * which commit 1d28b14 deleted. Nothing has subscribed to `onWheelExtended` before
 * or since, so neither the native nor the simulated path ran — every setting below
 * was stored, surfaced in this menu, and then never read.
 *
 * The native keys are kept so that a value chosen in the meantime survives a future
 * engine, and so removing the dead code is not a config-breaking change for anyone
 * who set them. The simulated keys are gone, because their behaviour lived entirely
 * in the deleted code and no prefix of it can be reinstated from the settings alone.
 *
 * Restoring behaviour means re-registering an extended-wheel event and porting the
 * heuristics across; it is not a matter of re-enabling anything in here.
 */
export class MouseScrollFeature implements Feature {
    private plugin!: ScrollingPlugin;

    public readonly settings = {
        visible: (): boolean => !Platform.isMobile,
        items: [
            {
                name: "Mode",
                desc: [
                    "Native scroll provides simplicity and stability; Simulated scroll is configurable.",
                    "Nothing is applied to the wheel yet: the engine behind this menu is",
                    "currently unwired, so this setting is recorded and otherwise inert.",
                ].join(" "),
                control: {
                    type: "dropdown",
                    key: "scrollMode",
                    defaultValue: "disabled",
                    options: {
                        disabled: "Disabled",
                        native: "Native",
                        simulated: "Simulated (experimental)",
                    },
                },
            },
            {
                name: "Scroll speed multiplier",
                desc: "Increase the scroll speed. Values below one disable smooth scrolling.",
                control: {
                    type: "slider",
                    key: "nativeScrollMultiplier",
                    defaultValue: 1,
                    min: 0.1,
                    max: 3,
                    step: 0.1,
                },
                visible: (): boolean => {
                    return this.plugin.settings.scrollMode === "native";
                },
            },
            {
                name: "Alt speed multiplier",
                desc: "Speed multiplier while holding the alt key.",
                control: {
                    type: "slider",
                    key: "nativeAltMultiplier",
                    defaultValue: 1,
                    min: 0.1,
                    max: 3,
                    step: 0.1,
                },
                visible: (): boolean => {
                    return this.plugin.settings.scrollMode === "native";
                },
            },
            {
                name: "Disable smooth scrolling",
                desc: "Scroll instantly without transition effect.",
                control: {
                    type: "toggle",
                    key: "nativeScrollInstant",
                    defaultValue: false,
                },
                visible: (): boolean => {
                    return this.plugin.settings.scrollMode === "native";
                },
            },
        ],
    } as const satisfies FeatureSettingsDefinition;

    public onload(plugin: ScrollingPlugin): void {
        this.plugin = plugin;
    }

    onunload(): void {}
}
