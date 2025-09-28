import { CodeBlock } from "../src/codeblock";

const mockPlugin = {
    settings: {
        horizontalScrollingCodeBlockEnabled: false,
    },
    register: jest.fn(),
};

describe("CodeBlock", () => {
    let codeBlock: CodeBlock;

    beforeEach(() => {
        codeBlock = new CodeBlock(mockPlugin as any);
    });

    describe("normalizeWheelDelta", () => {
        test("Keeps delta values with DOM_DELTA_PIXEL", () => {
            const event = new WheelEvent("wheel", {
              deltaX: 3,
              deltaY: 5,
              deltaMode: WheelEvent.DOM_DELTA_PIXEL,
            });

            const result = codeBlock["normalizeWheelDelta"](event)
            expect(result.deltaX).toBe(3);
            expect(result.deltaY).toBe(5);
        });
    });

    describe("insideCodeBlock", () => {
        test("Detects code block class", () => {
            const el = document.createElement("div");
            el.classList.add("foo", "HyperMD-codeblock", "bar");

            const result = codeBlock["insideCodeBlock"](el.classList);
            expect(result).toBe(true);
        });

        test("Rejects class indicating start of code block", () => {
            const el = document.createElement("div");
            el.classList.add("foo", "HyperMD-codeblock", "bar", "HyperMD-codeblock-begin");

            const result = codeBlock["insideCodeBlock"](el.classList);
            expect(result).toBe(false);
        });

        test("Rejects class indicating end of code block", () => {
            const el = document.createElement("div");
            el.classList.add("foo", "HyperMD-codeblock", "bar", "HyperMD-codeblock-end");

            const result = codeBlock["insideCodeBlock"](el.classList);
            expect(result).toBe(false);
        });
    });

    describe("searchCodeLines", () => {
        test("Requires pivot line to be in code block", () => {
            const el = document.createElement("div");

            codeBlock["searchCodeLines"](el);

            const result = codeBlock["codeBlockLines"];
            expect(result.length).toBe(0);
        });

        test("Adds pivot line and stops without siblings", () => {
            const el = document.createElement("div");
            el.classList.add("HyperMD-codeblock");

            codeBlock["searchCodeLines"](el);

            const result = codeBlock["codeBlockLines"];
            expect(result.length).toBe(1);
        });
    });
});
