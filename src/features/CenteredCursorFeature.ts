import { Editor, MarkdownView, Platform } from "obsidian";
import { syntaxTree } from "@codemirror/language";
import type { Feature, FeatureSettingsDefinition, ScrollingPlugin } from "@core/Feature";
import { getVimCursor } from "@core/util";

interface ScrollInfo {
    top: number;
    left: number;
    height: number;
}

export class CenteredCursorFeature implements Feature {
    public readonly settings = {
        items: [
            {
                name: "Enable",
                desc: "Automatically scrolls the view to keep the cursor near the center when you move it.",
                control: {
                    type: "toggle",
                    key: "followCursorEnabled",
                    defaultValue: false,
                },
            },
            {
                name: "Trigger distance",
                desc: "How far the cursor can move from the center before scrolling (%).\n0% keeps the cursor perfectly centered.",
                control: {
                    type: "slider",
                    key: "followCursorRadius",
                    defaultValue: 50,
                    min: 0,
                    max: 100,
                    step: 1,
                    disabled: (): boolean => {
                        return this.plugin.settings.followCursorEnabled === false;
                    },
                },
            },
            {
                name: "Animation smoothness",
                desc: "Duration of the scroll animation.",
                control: {
                    type: "slider",
                    key: "followCursorSmoothness",
                    defaultValue: 25,
                    min: 0,
                    max: 100,
                    step: 1,
                    disabled: (): boolean => {
                        return this.plugin.settings.followCursorEnabled === false;
                    },
                },
            },
            {
                name: "Instant scroll on edit",
                desc: "Do not scroll smoothly while editing text.",
                control: {
                    type: "toggle",
                    key: "followCursorInstantEditScroll",
                    defaultValue: true,
                    disabled: (): boolean => {
                        return this.plugin.settings.followCursorEnabled === false;
                    },
                },
            },
            {
                name: "Trigger on mouse interactions",
                desc: "Update when the cursor is moved using the mouse.",
                control: {
                    type: "toggle",
                    key: "followCursorEnableMouse",
                    defaultValue: false,
                    disabled: (): boolean => {
                        return this.plugin.settings.followCursorEnabled === false;
                    },
                },
            },
            {
                name: "Trigger on mouse selection",
                desc: "Also update when text is selected using the mouse.",
                control: {
                    type: "toggle",
                    key: "followCursorEnableSelection",
                    defaultValue: false,
                    disabled: (): boolean => {
                        return this.plugin.settings.followCursorEnabled === false;
                    },
                },
                visible: (): boolean => {
                    return this.plugin.settings.followCursorEnableMouse === true;
                },
            },
        ],
    } as const satisfies FeatureSettingsDefinition;

    private plugin!: ScrollingPlugin;

    private recentMouseUp = false;
    private animationFrame = 0;
    private scrollLastEvent = 0;

    private cachedScrollDOM: HTMLElement | null = null;
    private cachedScrollDOMRect: DOMRect | null = null;
    private cacheTimestamp = 0;
    private readonly CACHE_DURATION = 100;
    private readonly MOUSE_UP_TIMEOUT = 100;

    public onload(plugin: ScrollingPlugin): void {
        this.plugin = plugin;

        this.plugin.events.onKeyDown(this.keyDownHandler.bind(this));
        this.plugin.events.onMouseUp(this.mouseUpHandler.bind(this));
        this.plugin.events.onCursorUpdate(this.cursorUpdateHandler.bind(this));
        this.plugin.events.onLeafChange(this.leafChangeHandler.bind(this));
        this.plugin.events.onResize(this.resizeHandler.bind(this));
    }

    public onunload(): void {
        window.cancelAnimationFrame(this.animationFrame);
    }

    private leafChangeHandler(): void {
        this.invalidateCache();
    }

    private resizeHandler(): void {
        this.invalidateCache();
    }

    private invalidateCache(): void {
        this.cachedScrollDOM = null;
        this.cachedScrollDOMRect = null;
        this.cacheTimestamp = 0;
    }

    private keyDownHandler(): void {
        this.recentMouseUp = false;
    }

    private mouseUpHandler(): void {
        this.recentMouseUp = true;
        window.setTimeout(() => (this.recentMouseUp = false), this.MOUSE_UP_TIMEOUT);
    }

    private cursorUpdateHandler(
        editor: Editor,
        docChanged: boolean,
        vimModeChanged: boolean,
    ): void {
        if (!editor.hasFocus()) return;
        if (vimModeChanged) return;

        if (this.recentMouseUp && !this.plugin.settings.followCursorEnableMouse) return;

        if (!this.plugin.settings.followCursorEnableSelection && editor.somethingSelected()) return;

        this.invokeScroll(editor, docChanged);
    }

    private cursorInTable(editor: Editor): boolean {
        const { from } = editor.cm.state.selection.main;
        const tree = syntaxTree(editor.cm.state);
        let node = tree.resolve(from, -1);

        while (node) {
            if (node.name.startsWith("HyperMD-table")) {
                return true;
            }
            node = node.parent;
        }

        return false;
    }

    private invokeScroll(editor: Editor, docChanged: boolean): void {
        if (!this.plugin.settings.followCursorEnabled) return;

        const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return;

        const now = performance.now();
        const deltaTime = now - this.scrollLastEvent;
        this.scrollLastEvent = now;

        if (deltaTime < 10) return;

        editor.cm.requestMeasure({
            key: "followcursor",
            read: (_view) => {
                return this.measureCursorPosition(editor);
            },
            write: (measure, _view) => {
                if (!measure) return;

                const { signedGoalDistance, goal, isTable } = measure;

                if (signedGoalDistance === 0) return;

                if (this.animationFrame) {
                    window.cancelAnimationFrame(this.animationFrame);
                }

                if (deltaTime > 100 && !isTable) {
                    const scrollInfo = editor.getScrollInfo() as ScrollInfo;
                    const steps = this.calculateSteps(
                        Math.abs(signedGoalDistance),
                        scrollInfo.height,
                        docChanged,
                    );

                    if (steps > 1 || !Platform.isMobile || getVimCursor(editor) === null) {
                        this.animate(editor, goal, signedGoalDistance / steps, steps);
                        return;
                    }
                }

                this.animate(editor, goal, signedGoalDistance, 1);
            },
        });
    }

    private measureCursorPosition(editor: Editor): {
        signedGoalDistance: number;
        goal: number;
        isTable: boolean;
    } | null {
        const activeLineEl = editor.cm.scrollDOM.querySelector(".cm-active.cm-line");
        if (!activeLineEl) return null;

        const isTable = this.cursorInTable(editor);

        const scrollDOMRect = this.getCachedScrollDOMRect(editor.cm.scrollDOM);
        if (!scrollDOMRect) return null;

        let cursorRelativeTop: number;

        if (isTable) {
            const activeLineRect = activeLineEl.getBoundingClientRect();
            cursorRelativeTop = activeLineRect.top;
        } else {
            const cursorCoord = editor.getCursor("head");
            const lineStartOffset = editor.cm.state.doc.line(cursorCoord.line + 1).from;
            const cursorOffset = lineStartOffset + cursorCoord.ch;

            const cursorCoords = editor.cm.coordsAtPos(cursorOffset);
            cursorRelativeTop = cursorCoords?.top || 0;
        }

        cursorRelativeTop -= scrollDOMRect.top - editor.cm.defaultLineHeight;

        const scrollInfo = editor.getScrollInfo() as ScrollInfo;
        const signedGoalDistance = this.calculateGoalDistance(cursorRelativeTop, scrollInfo);
        const goal = scrollInfo.top + signedGoalDistance;

        return { signedGoalDistance, goal, isTable };
    }

    private getCachedScrollDOMRect(scrollDOM: HTMLElement): DOMRect | null {
        const now = performance.now();

        if (
            this.cachedScrollDOM === scrollDOM &&
            this.cachedScrollDOMRect &&
            now - this.cacheTimestamp < this.CACHE_DURATION
        ) {
            return this.cachedScrollDOMRect;
        }

        this.cachedScrollDOM = scrollDOM;
        this.cachedScrollDOMRect = scrollDOM.getBoundingClientRect();
        this.cacheTimestamp = now;

        return this.cachedScrollDOMRect;
    }

    private animate(editor: Editor, goal: number, stepSize: number, step: number): void {
        if (step <= 0) return;

        editor.scrollTo(null, goal - stepSize * (step - 1));
        this.animationFrame = window.requestAnimationFrame(() =>
            this.animate(editor, goal, stepSize, step - 1),
        );
    }

    private calculateGoalDistance(cursorRelativeTop: number, scrollInfo: ScrollInfo) {
        const radiusPercent = this.plugin.settings.followCursorRadius;

        const radius = ((scrollInfo.height / 2) * radiusPercent) / 100;

        const center = scrollInfo.height / 2;
        const centerOffset = cursorRelativeTop - center;

        let signedGoalDistance: number;
        if (centerOffset < -radius) {
            signedGoalDistance = centerOffset + radius;
        } else if (centerOffset > radius) {
            signedGoalDistance = centerOffset - radius;
        } else {
            return 0;
        }

        if (Math.abs(signedGoalDistance) < 1) return 0;

        return signedGoalDistance;
    }

    private calculateSteps(
        goalDistance: number,
        scrollerHeight: number,
        docChanged: boolean,
    ): number {
        if (docChanged && this.plugin.settings.followCursorInstantEditScroll) return 1;

        const SMOOTHNESS_MULTIPLIER = 0.16;
        const smoothness = this.plugin.settings.followCursorSmoothness;
        const steps = Math.max(1, Math.ceil(SMOOTHNESS_MULTIPLIER * smoothness));

        if (goalDistance > scrollerHeight) {
            return Math.ceil(Math.sqrt(steps));
        }

        return steps;
    }
}
