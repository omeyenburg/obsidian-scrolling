import { MouseScroll } from "../src/mousescroll";

// Mock the ScrollingPlugin
const mockPlugin = {
    settings: {
        mouseEnabled: true,
        touchpadEnabled: true,
    },
    registerDomEvent: jest.fn(),
};

// Mock performance.now
let now = 0;
beforeAll(() => {
    jest.spyOn(performance, "now").mockImplementation(() => now);
});

describe("MouseScroll", () => {
    let mouseScroll: MouseScroll;

    beforeEach(() => {
        mouseScroll = new MouseScroll(mockPlugin as any);
    });

    describe("isTouchpad", () => {
        test("should return false for deltaMode != PIXEL", () => {
            const e = new WheelEvent("wheel", {
                deltaMode: WheelEvent.DOM_DELTA_LINE,
                deltaY: 10,
            });

            const result = mouseScroll["isTouchpad"](e);
            expect(result).toBe(false);
        });

        test("should return false for common mouse delta", () => {
            const e = new WheelEvent("wheel", {
                deltaMode: WheelEvent.DOM_DELTA_PIXEL,
                deltaY: 120,
            });

            const result = mouseScroll["isTouchpad"](e);
            expect(result).toBe(false);
        });

        test("should detect touchpad via diagonal movement", () => {
            const e = new WheelEvent("wheel", {
                deltaMode: WheelEvent.DOM_DELTA_PIXEL,
                deltaX: 5,
                deltaY: 8,
            });

            const result = mouseScroll["isTouchpad"](e);
            expect(result).toBe(true);
        });

        test("should detect touchpad via fractional small delta", () => {
            const e = new WheelEvent("wheel", {
                deltaMode: WheelEvent.DOM_DELTA_PIXEL,
                deltaY: 5.2,
            });

            const result = mouseScroll["isTouchpad"](e);
            expect(result).toBe(true);
        });

        test("should detect touchpad via grace period", () => {
            const e1 = new WheelEvent("wheel", {
                deltaMode: WheelEvent.DOM_DELTA_PIXEL,
                deltaY: 5.1,
            });

            const e2 = new WheelEvent("wheel", {
                deltaMode: WheelEvent.DOM_DELTA_PIXEL,
                deltaY: 55,
            });

            expect(mouseScroll["isTouchpad"](e1)).toBe(true); // sets touchpadLastUse
            now += 1;
            expect(mouseScroll["isTouchpad"](e2)).toBe(true); // grace period active
        });

        test("should return false if grace period expired", () => {
            const e1 = new WheelEvent("wheel", {
                deltaMode: WheelEvent.DOM_DELTA_PIXEL,
                deltaY: 5.1,
            });

            const e2 = new WheelEvent("wheel", {
                deltaMode: WheelEvent.DOM_DELTA_PIXEL,
                deltaY: 100,
            });

            expect(mouseScroll["isTouchpad"](e1)).toBe(true);
            now += 1 + MouseScroll["TOUCHPAD_GRACE_PERIOD"];
            expect(mouseScroll["isTouchpad"](e2)).toBe(false);
        });
    });
});
