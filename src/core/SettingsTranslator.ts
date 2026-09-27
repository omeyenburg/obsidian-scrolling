import type {
    Setting,
    SettingDefinition,
    SettingDefinitionGroup,
    SettingDefinitionItem,
    SettingDefinitionPage,
    TextComponent,
} from "obsidian";

import type { Feature } from "@core/Feature";
import type { ControlParse, FeatureSettingsDefinition, SettingItem } from "@core/settings.schema";
import { bindPredicate, resolveDesc } from "@core/settings.schema";
import type { AnyFeatureConstructor, PageLayout } from "@core/settings.layout";
import { settingsLayout } from "@core/settings.layout";
import type { SettingKey, SettingsStore } from "@core/SettingsStore";

/**
 * Marks every group this plugin renders, so `styles.css` can scope the handful of
 * adjustments we need without leaking them onto other plugins' setting rows.
 */
export const GROUP_CLASS = "scrolling-setting-group";

/**
 * A translated group, with `visible` narrowed to the thunk `bindPredicate` returns.
 *
 * The native type also permits a constant boolean, but nothing here ever produces
 * one, so declaring it precisely is what lets a page derive its own visibility by
 * calling each group's predicate.
 */
type TranslatedGroup = Omit<SettingDefinitionGroup, "visible"> & {
    visible?: () => boolean;
};

/**
 * Turns feature-owned setting definitions into Obsidian's own setting definitions.
 *
 * There is no shadow control schema here on purpose: every control is emitted as a
 * native `SettingDefinitionControl`, so Obsidian owns value binding, validation and
 * row rendering. The only imperative rows are the ones that opt out of that: a control
 * that declares `parse`, and a row that supplies its own `render`.
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
        const groups = page.features.map((Constructor) => {
            const feature = byConstructor.get(Constructor);
            if (!feature) {
                throw new Error(
                    `Settings layout references unregistered feature "${Constructor.name}".`,
                );
            }
            return this.translateFeature(feature);
        });

        return {
            type: "page",
            name: page.name,
            desc: page.desc,
            items: groups,
            // A page is offered whenever at least one of its features is. Derived here
            // rather than declared in the layout, so a feature that is inert on a
            // platform hides itself and takes its page with it. This stays a live
            // thunk delegating to the group thunks, not a one-off filter, so a page is
            // never dropped permanently.
            visible: (): boolean =>
                groups.some((group) => group.visible === undefined || group.visible()),
        };
    }

    /** A feature is one group, so this wraps rather than maps. */
    private translateFeature(feature: Feature): TranslatedGroup {
        const settings: FeatureSettingsDefinition = feature.settings;

        if (settings.items.length === 0) {
            throw new Error(
                `Feature "${feature.constructor.name}" is placed in the layout but declares no settings.`,
            );
        }

        return {
            type: "group",
            cls: GROUP_CLASS,
            heading: settings.heading,
            visible: bindPredicate(settings.visible),
            items: settings.items.map((item) => this.translateItem(item)),
        };
    }

    private translateItem(item: SettingItem): SettingDefinition {
        const visible = bindPredicate(item.visible);
        const boundDisabled = bindPredicate(item.control.disabled);

        // A row that brings its own DOM opts out of control translation entirely.
        if (item.render) {
            const { render } = item;
            const key = item.control.key as SettingKey;

            return {
                name: item.name,
                desc: resolveDesc(item.desc),
                aliases: item.aliases,
                searchable: item.searchable,
                visible,
                render: (setting: Setting) =>
                    render(setting, {
                        current: () => this.store.get(key),
                        commit: (value: unknown) => {
                            void this.store.set(key, value as never);
                        },
                        isDisabled: () => boundDisabled?.() ?? false,
                    }),
            };
        }

        // `parse`/`displayFormat` are ours, not Obsidian's: keep them out of the
        // emitted control.
        const { parse, displayFormat, disabled, ...control } = item.control;

        if (parse) {
            // `SettingDefinitionRender` has no `disabled` slot, so the predicate is
            // applied to the `Setting` inside `render` instead of being dropped.
            return {
                name: item.name,
                desc: resolveDesc(item.desc),
                aliases: item.aliases,
                searchable: item.searchable,
                visible,
                render: this.renderParsed(item, parse, boundDisabled, displayFormat),
            };
        }

        return {
            name: item.name,
            desc: resolveDesc(item.desc),
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

            const onBlur = (): void => {
                // A rejected edit is left in the field while the user is still typing
                // in it, so the field and the stored value can disagree. Restoring the
                // last accepted value on blur both re-syncs them and means an input the
                // parser refuses cannot wedge: the next keystroke starts from a value
                // that parses again.
                const shown = text.getValue();
                if (shown !== format(last)) {
                    text.setValue(format(last));
                }
            };
            text.inputEl.addEventListener("blur", onBlur);

            // Unlike the old factory, which had to defer this by a tick because the
            // control was attached after the decision was made, `addText` has already
            // registered its component by now — so applying it here is enough.
            const applyDisabled = (): void => {
                const off = disabled ? disabled() : false;
                text.setDisabled(off);
                setting.setDisabled(off);
            };
            applyDisabled();

            // A thunk description reports state, and this row is already imperative, so
            // it can be re-read on every commit instead of only when the tab is opened.
            const isLiveDesc = typeof item.desc === "function";
            const applyDesc = (): void => {
                if (isLiveDesc) {
                    setting.setDesc(resolveDesc(item.desc));
                }
            };
            applyDesc();

            const unsubscribe = this.store.onUpdate(() => {
                // Every commit re-evaluates, so a write to the gating setting greys
                // this row out without needing a re-render.
                applyDisabled();
                applyDesc();

                // Re-seed only on writes this field did not make, i.e. a write from
                // elsewhere in the plugin such as a command or a feature correcting
                // its own setting after a failure.
                const next = current();
                if (next === last) {
                    return;
                }
                last = next;
                text.setValue(format(next));
            });

            return () => {
                unsubscribe();
                text.inputEl.removeEventListener("blur", onBlur);
            };
        };
    }
}
