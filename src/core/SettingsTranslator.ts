import type {
    Setting,
    SettingDefinition,
    SettingDefinitionGroup,
    SettingDefinitionItem,
    SettingDefinitionPage,
    TextComponent,
} from "obsidian";

import type { Feature } from "@core/Feature";
import type { ControlParse, SettingItem } from "@core/settings.schema";
import { bindPredicate } from "@core/settings.schema";
import type { AnyFeatureConstructor, PageLayout } from "@core/settings.layout";
import { settingsLayout } from "@core/settings.layout";
import type { SettingKey, SettingsStore } from "@core/SettingsStore";

/**
 * Marks every group this plugin renders, so `styles.css` can scope the handful of
 * adjustments we need without leaking them onto other plugins' setting rows.
 */
export const GROUP_CLASS = "scrolling-setting-group";

/**
 * Turns feature-owned setting definitions into Obsidian's own setting definitions.
 *
 * There is no shadow control schema here on purpose: every control is emitted as a
 * native `SettingDefinitionControl`, so Obsidian owns value binding, validation and
 * row rendering. The only imperative row is a control that declares `parse`.
 */
export class SettingsTranslator {
    constructor(private readonly store: SettingsStore) {}

    getSettingDefinitions(
        byConstructor: ReadonlyMap<AnyFeatureConstructor, Feature>,
    ): SettingDefinitionItem[] {
        return settingsLayout.map((page) => this.translatePage(page, byConstructor));
    }

    private translatePage(
        page: PageLayout<AnyFeatureConstructor>,
        byConstructor: ReadonlyMap<AnyFeatureConstructor, Feature>,
    ): SettingDefinitionPage {
        const groups: SettingDefinitionGroup[] = [];

        for (const Constructor of page.features) {
            const feature = byConstructor.get(Constructor);
            if (!feature) {
                throw new Error(
                    `Settings layout references unregistered feature "${Constructor.name}".`,
                );
            }
            groups.push(...this.translateFeature(feature));
        }

        return {
            type: "page",
            name: page.name,
            desc: page.desc,
            items: groups,
        };
    }

    private translateFeature(feature: Feature): SettingDefinitionGroup[] {
        const { items, groups } = feature.settings;
        const translated: SettingDefinitionGroup[] = [];

        for (const group of groups ?? []) {
            translated.push(this.translateGroup(group.heading, group.items));
        }

        if (items?.length) {
            translated.push(this.translateGroup(undefined, items));
        }

        if (translated.length === 0) {
            throw new Error(
                `Feature "${feature.constructor.name}" is placed in the layout but declares no settings.`,
            );
        }

        return translated;
    }

    private translateGroup(
        heading: string | undefined,
        items: readonly SettingItem[],
    ): SettingDefinitionGroup {
        return {
            type: "group",
            cls: GROUP_CLASS,
            heading,
            items: items.map((item) => this.translateItem(item)),
        };
    }

    private translateItem(item: SettingItem): SettingDefinition {
        const visible = bindPredicate(item.visible);

        // `parse`/`displayFormat` are ours, not Obsidian's: keep them out of the
        // emitted control.
        const { parse, displayFormat, disabled, ...control } = item.control;
        const boundDisabled = bindPredicate(disabled);

        if (parse) {
            // `SettingDefinitionRender` has no `disabled` slot, so the predicate is
            // applied to the `Setting` inside `render` instead of being dropped.
            return {
                name: item.name,
                desc: item.desc,
                aliases: item.aliases,
                searchable: item.searchable,
                visible,
                render: this.renderParsed(item, parse, boundDisabled, displayFormat),
            };
        }

        return {
            name: item.name,
            desc: item.desc,
            aliases: item.aliases,
            searchable: item.searchable,
            visible,
            control: boundDisabled ? { ...control, disabled: boundDisabled } : control,
        };
    }

    /**
     * Escape hatch for controls that need to parse their own text field, which
     * Obsidian's declarative `number` control does not offer.
     *
     * The returned cleanup unsubscribes, so nothing outlives the row — the
     * alternative (a factory-wide subscriber set) leaks closures over dead components.
     */
    private renderParsed(
        item: SettingItem,
        parse: ControlParse,
        disabled: (() => boolean) | undefined,
        displayFormat?: (value: number) => string,
    ): (setting: Setting) => void | (() => void) {
        // `parse` is only ever declared on a number control, so the correlation
        // between this key and a `number` value holds; the cast restores it.
        const key = item.control.key as SettingKey;
        const current = (): number => this.store.get(key) as number;
        const format = (value: number): string =>
            displayFormat ? displayFormat(value) : String(value);
        const placeholder = "placeholder" in item.control ? item.control.placeholder : undefined;

        return (setting: Setting): (() => void) => {
            let last = current();
            // `addText` returns the `Setting`, so the component comes from the callback.
            let text!: TextComponent;

            setting.addText((component) => {
                text = component;
                component
                    .setPlaceholder(placeholder)
                    .setValue(format(last))
                    .onChange((raw: string) => {
                        const value = parse(raw);
                        if (value === null) {
                            // Rejected input: leave the stored value and the
                            // field's own state alone.
                            return;
                        }
                        last = value;
                        void this.store.set(key, value);
                    });
            });

            // Unlike the old factory, which had to defer this by a tick because the
            // control was attached after the decision was made, `addText` has already
            // registered its component by now — so applying it here is enough.
            const applyDisabled = (): void => {
                const off = disabled ? disabled() : false;
                text.setDisabled(off);
                setting.setDisabled(off);
            };
            applyDisabled();

            const unsubscribe = this.store.onUpdate(() => {
                // Every commit re-evaluates, so a write to the gating setting greys
                // this row out without needing a re-render.
                applyDisabled();

                // Re-seed only on writes this field did not make, i.e. a group reset.
                const next = current();
                if (next === last) {
                    return;
                }
                last = next;
                text.setValue(format(next));
            });

            return unsubscribe;
        };
    }
}
