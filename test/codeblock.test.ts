import { CodeBlock } from "../src/components/codeblock";

const createMockPlugin = (settings: any = {}) => ({
    settings: {
        horizontalScrollingCodeBlockEnabled: true,
        ...settings,
    },
    register: jest.fn(),
    app: {
        workspace: {
            activeEditor: null as any,
        },
    },
    followScroll: {
        skipCursor: false,
    },
    events: {
        onScroll: jest.fn(),
        onScrollEnd: jest.fn(),
        onTouchMove: jest.fn(),
        onLeafChange: jest.fn(),
        onWheelCancelling: jest.fn(),
        onCursorUpdate: jest.fn(),
    },
});

describe("CodeBlock", () => {
    let codeBlock: CodeBlock;
    let mockPlugin: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockPlugin = createMockPlugin();
        codeBlock = new CodeBlock(mockPlugin as any);
    });

    describe("normalizeWheelDelta", () => {
        test("keeps delta values with DOM_DELTA_PIXEL", () => {
            const event = new WheelEvent("wheel", {
                deltaX: 3,
                deltaY: 5,
                deltaMode: WheelEvent.DOM_DELTA_PIXEL,
            });

            const result = codeBlock["normalizeWheelDelta"](event);
            expect(result.deltaX).toBe(3);
            expect(result.deltaY).toBe(5);
        });

        test("scales DOM_DELTA_LINE by 16", () => {
            const event = new WheelEvent("wheel", {
                deltaX: 2,
                deltaY: 3,
                deltaMode: WheelEvent.DOM_DELTA_LINE,
            });

            const result = codeBlock["normalizeWheelDelta"](event);
            expect(result.deltaX).toBe(32);
            expect(result.deltaY).toBe(48);
        });

        test("scales DOM_DELTA_PAGE by window height", () => {
            const event = new WheelEvent("wheel", {
                deltaX: 1,
                deltaY: 1,
                deltaMode: WheelEvent.DOM_DELTA_PAGE,
            });

            const result = codeBlock["normalizeWheelDelta"](event);
            expect(result.deltaX).toBe(window.innerHeight);
            expect(result.deltaY).toBe(window.innerHeight);
        });

        test("swaps axes when shift key is held and deltaY is dominant", () => {
            const event = new WheelEvent("wheel", {
                deltaX: 1,
                deltaY: 10,
                deltaMode: WheelEvent.DOM_DELTA_PIXEL,
                shiftKey: true,
            });

            const result = codeBlock["normalizeWheelDelta"](event);
            expect(result.deltaX).toBe(10);
            expect(result.deltaY).toBe(0);
        });

        test("does not swap axes when shift key is held but deltaX is dominant", () => {
            const event = new WheelEvent("wheel", {
                deltaX: 10,
                deltaY: 1,
                deltaMode: WheelEvent.DOM_DELTA_PIXEL,
                shiftKey: true,
            });

            const result = codeBlock["normalizeWheelDelta"](event);
            expect(result.deltaX).toBe(10);
            expect(result.deltaY).toBe(1);
        });
    });

    describe("insideCodeBlock", () => {
        test("detects code block class", () => {
            const el = document.createElement("div");
            el.classList.add("foo", "HyperMD-codeblock", "bar");

            const result = codeBlock["insideCodeBlock"](el.classList);
            expect(result).toBe(true);
        });

        test("returns false when element is not a code block", () => {
            const el = document.createElement("div");
            el.classList.add("foo", "bar");

            const result = codeBlock["insideCodeBlock"](el.classList);
            expect(result).toBe(false);
        });

        test("rejects code block with begin class", () => {
            const el = document.createElement("div");
            el.classList.add("foo", "HyperMD-codeblock", "bar", "HyperMD-codeblock-begin");

            const result = codeBlock["insideCodeBlock"](el.classList);
            expect(result).toBe(false);
        });

        test("rejects code block with end class", () => {
            const el = document.createElement("div");
            el.classList.add("foo", "HyperMD-codeblock", "bar", "HyperMD-codeblock-end");

            const result = codeBlock["insideCodeBlock"](el.classList);
            expect(result).toBe(false);
        });

        test("returns false for empty class list", () => {
            const el = document.createElement("div");

            const result = codeBlock["insideCodeBlock"](el.classList);
            expect(result).toBe(false);
        });
    });

    describe("searchCodeLines", () => {
        test("returns 0 when line is not in code block", () => {
            const el = document.createElement("div");

            codeBlock["searchCodeLines"](el);

            const result = codeBlock["codeBlockLines"];
            expect(result.length).toBe(0);
        });

        test("adds pivot line when it is in code block", () => {
            const el = document.createElement("div");
            el.classList.add("HyperMD-codeblock");
            // Add content to give it a natural scrollWidth
            el.innerHTML = "const x = 123; // a very long line that has some content";

            codeBlock["searchCodeLines"](el);

            const result = codeBlock["codeBlockLines"];
            expect(result.length).toBe(1);
            expect(result[0]).toBe(el);
        });

        test("finds all sibling code lines", () => {
            const parent = document.createElement("div");
            const prev1 = document.createElement("div");
            const prev2 = document.createElement("div");
            const current = document.createElement("div");
            const next1 = document.createElement("div");
            const next2 = document.createElement("div");

            [prev1, prev2, current, next1, next2].forEach((el) => {
                el.classList.add("HyperMD-codeblock");
                el.innerHTML = "some code content";
                parent.appendChild(el);
            });

            codeBlock["searchCodeLines"](current);

            const result = codeBlock["codeBlockLines"];
            expect(result.length).toBe(5);
        });
    });

    describe("updateStyle", () => {
        test("adds CSS class when enabled", () => {
            mockPlugin.settings.horizontalScrollingCodeBlockEnabled = true;
            codeBlock.updateStyle();

            expect(document.body.classList.contains("scrolling-horizontal-code-blocks")).toBe(true);
        });

        test("removes CSS class when disabled", () => {
            mockPlugin.settings.horizontalScrollingCodeBlockEnabled = false;
            codeBlock.updateStyle();

            expect(document.body.classList.contains("scrolling-horizontal-code-blocks")).toBe(
                false,
            );
        });
    });
});
