import type { Feature, ScrollingPlugin } from "@core/Feature";
import type { ScrollingPluginSettings } from "@core/feature.schema";
import { itemsOf, type SettingOwner } from "@core/settings.schema";

export type SettingKey = keyof ScrollingPluginSettings;

/** The part of the setting tab the store needs. Avoids depending on the concrete class. */
export interface Refreshable {
    /** Re-evaluates `visible`/`disabled` in place. Cheap: no re-render. */
    refreshDomState(): void;
}

/**
 * Owns the one and only write path for plugin settings.
 *
 * Everything that changes a setting — the settings UI, a group reset button, a
 * future command — goes through `set`/`reset`, so persistence, `onChange`
 * handlers and the in-place DOM refresh cannot be forgotten at a call site.
 */
export class SettingsStore {
    private readonly handlers = new Map<SettingKey, (value: unknown) => void>();
    private readonly defaults = new Map<SettingKey, unknown>();
    private readonly subscribers = new Set<() => void>();
    private refresh: (() => void) | undefined;

    constructor(private readonly plugin: ScrollingPlugin) {}

    /**
     * Collects the definitions of a feature. Must run before `buildDefaults`, and
     * therefore before the features' `onload`.
     */
    register(feature: Feature): void {
        const owner = feature as unknown as SettingOwner;

        for (const item of itemsOf(feature.settings)) {
            // `control.key` is `string` in the schema; the map is keyed by real keys.
            const key = item.control.key as SettingKey;

            if (this.defaults.has(key)) {
                console.error(
                    `Duplicate setting key "${key}" declared by feature "${feature.id}". ` +
                        `Keeping the first declaration.`,
                );
                continue;
            }

            this.defaults.set(key, item.control.defaultValue);

            if (item.onChange) {
                const onChange = item.onChange;
                this.handlers.set(key, (value) => onChange.call(owner, value));
            }
        }
    }

    attachTab(tab: Refreshable): void {
        this.refresh = () => tab.refreshDomState();
    }

    /** Every key declared by any feature, in declaration order. */
    keys(): SettingKey[] {
        return [...this.defaults.keys()];
    }

    buildDefaults(): ScrollingPluginSettings {
        const defaults: Record<string, unknown> = {};
        for (const [key, value] of this.defaults) {
            defaults[key] = value;
        }
        // A `Map` erases the key/value correlation, so this is the one place that
        // has to assert it. `register` guarantees every key came from a definition.
        return defaults as ScrollingPluginSettings;
    }

    get<K extends SettingKey>(key: K): ScrollingPluginSettings[K] {
        return this.plugin.settings[key];
    }

    async set<K extends SettingKey>(key: K, value: ScrollingPluginSettings[K]): Promise<void> {
        this.apply(key, value);
        await this.commit();
    }

    /** Restores every listed key that declares a default. One save, one refresh. */
    async reset(keys: readonly SettingKey[]): Promise<void> {
        let changed = false;

        for (const key of keys) {
            const value = this.defaults.get(key);
            if (value === undefined) {
                continue;
            }
            this.apply(key, value);
            changed = true;
        }

        if (changed) {
            await this.commit();
        }
    }

    /**
     * Subscribes to writes from outside the row's own control, e.g. a reset button.
     * Returns an unsubscribe function, which the row's `render` should return as its
     * cleanup so nothing outlives the DOM it points at.
     */
    onUpdate(fn: () => void): () => void {
        this.subscribers.add(fn);
        return () => {
            this.subscribers.delete(fn);
        };
    }

    private apply(key: SettingKey, value: unknown): void {
        // `set` is the typed public entry point and checks the value against the key.
        // This private path exists for `reset`, which reads defaults out of a `Map`
        // that has lost the key/value correlation.
        this.plugin.settings[key] = value as never;

        const handler = this.handlers.get(key);
        if (!handler) {
            return;
        }

        try {
            handler(value);
        } catch (err) {
            // A broken handler must not cost the user their edit.
            console.error(`onChange handler for setting "${key}" threw:`, err);
        }
    }

    private async commit(): Promise<void> {
        await this.plugin.saveData(this.plugin.settings);

        // Re-evaluate `visible`/`disabled`. Never `update()`: the definitions are
        // static, so a full re-render would only interrupt running animations.
        this.refresh?.();

        for (const subscriber of this.subscribers) {
            try {
                subscriber();
            } catch (err) {
                console.error("Settings update subscriber threw:", err);
            }
        }
    }
}
