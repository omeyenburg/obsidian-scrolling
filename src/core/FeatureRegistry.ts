import type { SettingDefinitionItem } from "obsidian";

import type { ScrollingPlugin } from "@core/Feature";
import { SettingsStore } from "@core/SettingsStore";
import { SettingsTranslator } from "@core/SettingsTranslator";
import type { AnyFeatureConstructor } from "@core/settings.layout";
import { settingsLayout } from "@core/settings.layout";

type AnyFeature = InstanceType<AnyFeatureConstructor>;

/**
 * Every feature class the layout names, flattened, in layout order.
 *
 * The explicit return type is load-bearing: `flatMap` over a `readonly` tuple infers
 * the *first* page's feature type instead of the union of all of them.
 */
const constructors: readonly AnyFeatureConstructor[] = settingsLayout.flatMap(
    (page): AnyFeatureConstructor[] => [...page.features],
);

export class FeatureRegistry {
    private readonly features: readonly AnyFeature[];
    private readonly byConstructor: ReadonlyMap<AnyFeatureConstructor, AnyFeature>;
    private readonly settingsStore: SettingsStore;
    private readonly translator: SettingsTranslator;

    constructor(private readonly plugin: ScrollingPlugin) {
        const seen = new Set<AnyFeatureConstructor>();
        const duplicate = constructors.find((Constructor) => {
            if (seen.has(Constructor)) {
                return true;
            }
            seen.add(Constructor);
            return false;
        });
        if (duplicate) {
            throw new Error(
                `The settings layout places "${duplicate.name}" on more than one page; ` +
                    "each feature belongs to exactly one page.",
            );
        }

        this.features = constructors.map((Constructor) => new Constructor());
        this.byConstructor = new Map(
            constructors.map((Constructor, i) => [Constructor, this.features[i]]),
        );
        this.settingsStore = new SettingsStore(plugin);
        this.translator = new SettingsTranslator(this.settingsStore);

        // Must happen before the features load: defaults and `onChange` handlers are
        // derived from the definitions, and `onload` may read settings.
        for (const feature of this.features) {
            this.settingsStore.register(feature);
        }
    }

    get store(): SettingsStore {
        return this.settingsStore;
    }

    /** The instance of `Constructor`, narrowed to that feature's own type. */
    get<C extends AnyFeatureConstructor>(Constructor: C): InstanceType<C> | undefined {
        return this.byConstructor.get(Constructor) as InstanceType<C> | undefined;
    }

    getSettingDefinitions(): SettingDefinitionItem[] {
        return this.translator.getSettingDefinitions(this.byConstructor);
    }

    async loadAll(): Promise<void> {
        for (const feature of this.features) {
            try {
                // `onload` may be sync or async, but the sequence must wait either
                // way, so normalise it into a real promise first.
                await Promise.resolve(feature.onload(this.plugin));
            } catch (err) {
                console.error(`Failed to load feature "${feature.constructor.name}":`, err);
            }
        }
    }

    unloadAll(): void {
        for (const feature of this.features) {
            try {
                feature.onunload();
            } catch (err) {
                console.error(`Failed to unload feature "${feature.constructor.name}":`, err);
            }
        }
    }
}
