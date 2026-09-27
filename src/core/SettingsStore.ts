import { Debouncer, debounce } from "obsidian";
import type { Feature, ScrollingPlugin } from "@core/Feature";
import type { ScrollingPluginSettings } from "@core/feature.schema";

export type SettingKey = keyof ScrollingPluginSettings;

/** How long the vault write waits for further edits before actually running. */
const SAVE_DEBOUNCE_MS = 500;

/** The part of the setting tab the store needs. Avoids depending on the concrete class. */
export interface Refreshable {
    /** Re-evaluates `visible`/`disabled` in place. Cheap: no re-render. */
    refreshDomState(): void;
}

/**
 * Owns the one and only write path for plugin settings.
 *
 * Everything that changes a setting — the settings UI, a future command, a
 * feature reacting to a failure — goes through `set`, so persistence,
 * `onChange` handlers and the in-place DOM refresh cannot be forgotten at a call
 * site. Assigning to `plugin.settings` directly bypasses all three, so nothing
 * outside this class may do it.
 *
 * Writes reach the vault on a short debounce rather than one save per edit, which
 * keeps dragging a slider from writing the whole settings object on every frame.
 */
export class SettingsStore {
    private readonly handlers = new Map<SettingKey, (value: unknown) => void>();
    private readonly defaults = new Map<SettingKey, unknown>();
    private readonly subscribers = new Set<() => void>();
    private refresh: (() => void) | undefined;
    private saveDebouncer: Debouncer<[], void> | undefined;
    private savePending = false;

    constructor(private readonly plugin: ScrollingPlugin) {}

    /**
     * Collects the definitions of a feature. Must run before `buildDefaults`, and
     * therefore before the features' `onload`.
     */
    register(feature: Feature): void {
        for (const item of feature.settings.items) {
            // `control.key` is `string` in the schema; the map is keyed by real keys.
            const key = item.control.key as SettingKey;

            if (this.defaults.has(key)) {
                console.error(
                    `Duplicate setting key "${key}" declared by feature "${feature.constructor.name}". ` +
                        `Keeping the first declaration.`,
                );
                continue;
            }

            this.defaults.set(key, item.control.defaultValue);

            if (item.onChange) {
                const onChange = item.onChange;
                // `onChange` is typed against its own control, but a `Map` erases the
                // key/value correlation, so the stored value arrives as `unknown`.
                // `set` is the typed entry point and checks the value against the key
                // before it gets here; this is the same erasure `buildDefaults` notes.
                this.handlers.set(key, (value) =>
                    onChange(value as Parameters<typeof onChange>[0]),
                );
            }
        }
    }

    attachTab(tab: Refreshable): void {
        this.refresh = () => tab.refreshDomState();
    }

    /** The value every setting falls back to, in declaration order. */
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

    /**
     * Applies a value, then runs its `onChange` handler.
     *
     * The generic ties the value to the key at compile time only: nothing here
     * validates it at runtime, so callers must pass what the control produced.
     */
    async set<K extends SettingKey>(key: K, value: ScrollingPluginSettings[K]): Promise<void> {
        this.apply(key, value);
        this.commit();
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

    /**
     * Schedules the vault write and re-evaluates the UI in place.
     *
     * The refresh and the subscribers run immediately: they only read the in-memory
     * value, which `apply` has already updated. Only the write is deferred, and
     * `flush` forces it out on unload.
     */
    private commit(): void {
        if (!this.saveDebouncer) {
            this.saveDebouncer = debounce(
                () => {
                    this.savePending = false;
                    void this.plugin.saveData(this.plugin.settings);
                },
                SAVE_DEBOUNCE_MS,
                true,
            );
            this.plugin.register(() => this.flush());
        }

        this.savePending = true;
        this.saveDebouncer();

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

    /**
     * Writes a debounced change out now instead of waiting it out.
     *
     * Registered on unload: without this, an edit made in the last few hundred
     * milliseconds before quitting would be dropped rather than saved.
     */
    private flush(): void {
        if (!this.savePending) return;

        this.saveDebouncer?.cancel();
        this.savePending = false;
        void this.plugin.saveData(this.plugin.settings);
    }
}
