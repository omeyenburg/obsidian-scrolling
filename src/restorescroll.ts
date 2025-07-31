import {
    EditorRange,
    FileView,
    MarkdownView,
    Notice,
    TAbstractFile,
    TFile,
    debounce,
    normalizePath,
} from "obsidian";

import { default as ScrollingPlugin } from "./main";

interface EphemeralState {
    timestamp: number;
    scroll?: number;
    scrollTop?: number;
    cursor?: EditorRange;
}

export class RestoreScroll {
    private readonly plugin: ScrollingPlugin;

    private ephemeralStates: Record<string, EphemeralState> = {};

    public readonly storeStateDebounced: (file: TFile) => void;
    public readonly writeStateFileDebounced: () => void;

    // Prime numbers :)
    private static readonly STORE_INTERVAL = 97;
    private static readonly FILE_WRITE_INTERVAL = 293;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;

        this.storeStateDebounced = debounce(
            this.storeState.bind(this),
            RestoreScroll.STORE_INTERVAL,
            false,
        );
        this.writeStateFileDebounced = debounce(
            this.writeStateFile.bind(this),
            RestoreScroll.FILE_WRITE_INTERVAL,
            true,
        );
    }

    public scrollHandler(): void {
        const file = this.plugin.app.workspace.getActiveFile();
        if (file) {
            this.plugin.restoreScroll.storeStateDebounced(file);
            this.plugin.restoreScroll.writeStateFileDebounced();
        }
    }

    public viewStateHandler(): void {
        this.writeStateFileDebounced();

        const linkUsed = this.plugin.app.workspace.containerEl.querySelector("span.is-flashing");
        const view = this.plugin.app.workspace.getActiveViewOfType(FileView);
        if (linkUsed || !view || !view.file || !this.plugin.settings.restoreScrollEnabled) return;

        const ephemeralState = this.ephemeralStates[view.file.path];
        if (!ephemeralState) return;
        const { cursor, scroll, scrollTop } = ephemeralState;

        const type = view.getViewType();
        if (
            view instanceof MarkdownView &&
            view.getMode() === "source" &&
            (scroll || (cursor && this.plugin.settings.restoreScrollCursor))
        ) {
            if (cursor && this.plugin.settings.restoreScrollCursor) {
                view.setEphemeralState({
                    cursor: cursor,
                });

                view.editor.scrollIntoView(cursor, true);
            } else {
                view.setEphemeralState({
                    scroll: scroll,
                });
            }
        } else if (scrollTop && this.plugin.settings.restoreScrollAllFiles) {
            window.requestAnimationFrame(() => {
                if (type === "markdown") {
                    const scroller = view.containerEl.querySelector(".markdown-preview-view");
                    if (scroller) {
                        scroller.scrollTop = scrollTop;
                    }
                } else if (type === "pdf") {
                    const scroller = view.containerEl.querySelector(".pdf-viewer-container");
                    if (scroller) {
                        scroller.scrollTop = scrollTop;
                    }
                } else if (type === "image") {
                    const scroller =
                        view.containerEl.querySelector(".image-container")?.parentElement;
                    if (scroller) {
                        scroller.scrollTop = scrollTop;
                    }
                }
            });
        }
    }

    public deleteFileHandler(file: TAbstractFile): void {
        delete this.ephemeralStates[file.path];
    }

    public renameFileHandler(file: TAbstractFile, old: string): void {
        this.ephemeralStates[file.path] = this.ephemeralStates[old];
        delete this.ephemeralStates[old];
    }

    public quitHandler(): void {
        this.writeStateFile();
    }

    private async writeStateFile() {
        const data = JSON.stringify(this.ephemeralStates);
        this.plugin.app.vault.adapter.write(this.plugin.settings.restoreScrollStoreFile, data);
    }

    // Called on plugin load
    public async loadData(): Promise<void> {
        const exists = await this.plugin.app.vault.adapter.exists(
            this.plugin.settings.restoreScrollStoreFile,
        );

        if (exists) {
            const data = await this.plugin.app.vault.adapter.read(
                this.plugin.settings.restoreScrollStoreFile,
            );
            try {
                this.ephemeralStates = JSON.parse(data);
            } catch (e) {
                this.ephemeralStates = {};
            }
        }
    }

    // Invoked on cursor movement and mouse scroll
    private storeState(file: TFile): void {
        if (!this.plugin.settings.restoreScrollEnabled) return;

        const view = this.plugin.app.workspace.getActiveViewOfType(FileView);
        if (
            !view ||
            !view.file ||
            this.plugin.app.workspace.getActiveFile() != view.file ||
            view.file != file
        )
            return;

        let scrollTop: number;
        const timestamp = Date.now();
        if (view instanceof MarkdownView && view.getMode() == "source") {
            scrollTop = view.editor.getScrollInfo().top;
            const { cursor, scroll } = view.getEphemeralState() as {
                cursor?: EditorRange;
                scroll?: number;
            };

            this.ephemeralStates[view.file.path] = {
                timestamp,
                cursor,
                scroll,
                scrollTop,
            };
        } else if (this.plugin.settings.restoreScrollAllFiles) {
            const type = view.getViewType();
            if (type === "markdown") {
                scrollTop = view.containerEl.querySelector(".markdown-preview-view")?.scrollTop;
            } else if (type === "pdf") {
                scrollTop = view.containerEl.querySelector(".pdf-viewer-container")?.scrollTop;
            } else if (type === "image") {
                scrollTop =
                    view.containerEl.querySelector(".image-container")?.parentElement?.scrollTop;
            }

            this.ephemeralStates[view.file.path] = {
                timestamp,
                scrollTop,
            };
        }
    }

    public async renameStoreFile(newPath: string | null): Promise<string | undefined> {
        if (newPath === null) {
            new Notice("Path unchanged.");
            return;
        }

        // Check empty/invalid paths before normalizing.
        if (!newPath || newPath.trim() === "" || newPath === "." || newPath === "..") {
            new Notice("Invalid file path!");
            return;
        }

        // Assuming this.plugin.settings.restoreScrollStoreFile is valid
        const newNormalizedPath = normalizePath(newPath);
        const oldNormalizedPath = normalizePath(this.plugin.settings.restoreScrollStoreFile);

        if (!newNormalizedPath) {
            new Notice("Invalid file path!");
            return;
        }

        const adapter = this.plugin.app.vault.adapter;

        const folder = newNormalizedPath.substring(0, newNormalizedPath.lastIndexOf("/"));
        if (!folder || !(await adapter.exists(folder))) {
            new Notice(`Directory does not exist: ${folder}`);
            return;
        }

        if (await adapter.exists(newNormalizedPath)) {
            new Notice(`File already exists: ${newNormalizedPath}`);
            return;
        }

        if (oldNormalizedPath && (await adapter.exists(oldNormalizedPath))) {
            try {
                await adapter.rename(oldNormalizedPath, newNormalizedPath);
            } catch (e) {
                new Notice("Invalid file path!");
                return;
            }
        }

        new Notice(`Renamed storage file to: ${newNormalizedPath}`);
        return newNormalizedPath;
    }
}
