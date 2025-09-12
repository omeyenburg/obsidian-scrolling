import { MouseScroll } from "../src/mousescroll";

// Mock the ScrollingPlugin
const mockPlugin = {
    settings: {
        mouseEnabled: true,
        touchpadEnabled: true,
    },
    registerDomEvent: jest.fn(),
    register: jest.fn(),
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
        test("should not crash when deltaTime is 0", () => {
            const e = new WheelEvent("wheel", {
                deltaMode: WheelEvent.DOM_DELTA_PIXEL,
                deltaY: 0,
            });

            const now = 0;
            const deltaTime = 0;
            const isStart = false;

            expect(() => mouseScroll["isTouchpad"](e, now, deltaTime, isStart)).not.toThrow();
        });

        test("should return false for delta mode line", () => {
            const e = new WheelEvent("wheel", {
                deltaMode: WheelEvent.DOM_DELTA_LINE,
                deltaY: 10,
            });

            const now = 0;
            const deltaTime = 8;
            const isStart = false;

            const result = mouseScroll["isTouchpad"](e, now, deltaTime, isStart);
            expect(result).toBe(false);
        });

        test("should return false for delta mode page", () => {
            const e = new WheelEvent("wheel", {
                deltaMode: WheelEvent.DOM_DELTA_PAGE,
                deltaY: 1,
            });

            const now = 0;
            const deltaTime = 8;
            const isStart = false;

            const result = mouseScroll["isTouchpad"](e, now, deltaTime, isStart);
            expect(result).toBe(false);
        });

        test("should detect touchpad via diagonal movement", () => {
            const e = new WheelEvent("wheel", {
                deltaMode: WheelEvent.DOM_DELTA_PIXEL,
                deltaX: 5,
                deltaY: 8,
            });

            const now = 0;
            const deltaTime = 8;
            const isStart = false;

            const result = mouseScroll["isTouchpad"](e, now, deltaTime, isStart);
            expect(result).toBe(true);
        });

        test("should detect touchpad via fractional small delta", () => {
            const e = new WheelEvent("wheel", {
                deltaMode: WheelEvent.DOM_DELTA_PIXEL,
                deltaY: 5.2,
            });

            const now = 0;
            const deltaTime = 8;
            const isStart = false;

            const result = mouseScroll["isTouchpad"](e, now, deltaTime, isStart);
            expect(result).toBe(true);
        });

        test("should detect touchpad via grace period", () => {
            const e1 = new WheelEvent("wheel", {
                deltaMode: WheelEvent.DOM_DELTA_PIXEL,
                deltaY: 5.1,
            });

            const e2 = new WheelEvent("wheel", {
                deltaMode: WheelEvent.DOM_DELTA_PIXEL,
                deltaY: 200,
            });

            let now = 0;
            let deltaTime = 8;
            const isStart = false;

            const result1 = mouseScroll["isTouchpad"](e1, now, deltaTime, isStart);
            now = 8;
            deltaTime += 8;
            const result2 = mouseScroll["isTouchpad"](e2, now, deltaTime, isStart);

            expect(result1).toBe(true); // sets touchpadLastUse
            expect(result2).toBe(true); // grace period active
            expect(result1);
        });

        test("should return false if grace period expired", () => {
            const e1 = new WheelEvent("wheel", {
                deltaMode: WheelEvent.DOM_DELTA_PIXEL,
                deltaY: 5.1,
            });

            const e2 = new WheelEvent("wheel", {
                deltaMode: WheelEvent.DOM_DELTA_PIXEL,
                deltaY: 200,
            });

            let now = 0;
            let deltaTime = 200;
            const isStart = false;

            const result1 = mouseScroll["isTouchpad"](e1, now, deltaTime, isStart);
            now += MouseScroll["TOUCHPAD_GRACE_PERIOD"];
            deltaTime += MouseScroll["TOUCHPAD_GRACE_PERIOD"];
            const result2 = mouseScroll["isTouchpad"](e2, now, deltaTime, isStart);

            expect(result1).toBe(true); // sets touchpadLastUse
            expect(result2).toBe(false); // grace period active
        });
    });

    describe("getIntensity", () => {
        test("should not crash or return NaN when deltaY is 0", () => {
            const intensity = mouseScroll["getIntensity"](10, 0);
            expect(Number.isFinite(intensity)).toBe(true);
        });

        test("should return large but finite number on zero deltaTime and high deltaY", () => {
            const intensity = mouseScroll["getIntensity"](0, 9999);
            expect(Number.isFinite(intensity)).toBe(true);
        });

        test("should not crash when deltaY is NaN", () => {
            const intensity = mouseScroll["getIntensity"](10, NaN);
            expect(Number.isFinite(intensity)).toBe(false);
        });

        test("should not return NaN if intervalSum manually set to 0", () => {
            mouseScroll["intervalSum"] = 0;
            const intensity = mouseScroll["getIntensity"](10, 5);
            expect(Number.isFinite(intensity)).toBe(true);
            expect(intensity).toBeGreaterThanOrEqual(0);
        });

        test("should not return Infinity for very large deltaY", () => {
            const intensity = mouseScroll["getIntensity"](10, 1e6);
            expect(Number.isFinite(intensity)).toBe(true);
        });

        test("should reset if deltaTime exceeds max interval", () => {
            mouseScroll["intervalSum"] = 42;
            const intensity = mouseScroll["getIntensity"](
                MouseScroll["MAX_INTENSITY_INTERVAL"] + 1,
                2,
            );
            expect(intensity).toBeCloseTo(Math.log2(4) / 20);
        });
    });

    describe("getIsStart", () => {
        test("returns true when deltaTime > threshold + avgDelay", () => {
            mouseScroll["avgDelay"] = 10;
            const result = mouseScroll.analyzeDelay(mouseScroll["MIN_START_THRESHOLD"] + 11);
            expect(result).toBe(true);
        });

        test("returns false when deltaTime < threshold + avgDelay", () => {
            mouseScroll["avgDelay"] = 10;
            const result = mouseScroll.analyzeDelay(mouseScroll["MIN_START_THRESHOLD"] + 9);
            expect(result).toBe(false);
        });

        test("avgDelay is capped", () => {
            mouseScroll["avgDelay"] = 1000;
            const deltaTime = mouseScroll["MIN_START_THRESHOLD"] + 500;
            const result = mouseScroll["getIsStart"](deltaTime);
            expect(result).toBe(true);
        });
    })

    describe("analyzeDelay", () => {
        test("appends to delays and updates avgDelay", () => {
            mouseScroll["delays"] = [10, 12];
            const result = mouseScroll.analyzeDelay(14); // should not be start
            expect(result).toBe(false);
            expect(mouseScroll["delays"]).toEqual([10, 12, 14]);
            expect(mouseScroll["avgDelay"]).toBeCloseTo((10 + 12 + 14) / 3);
        });

        test("keeps delays array bounded", () => {
            (mouseScroll as any)["MAX_DELAY_SAMPLES"] = 5;
            mouseScroll["delays"] = [1, 2, 3, 4, 5];
            const result = mouseScroll.analyzeDelay(6); // triggers shift
            expect(result).toBe(false);
            expect(mouseScroll["delays"].length).toBeLessThanOrEqual(
                mouseScroll["MAX_DELAY_SAMPLES"],
            );
            expect(mouseScroll["delays"]).toEqual([2, 3, 4, 5, 6]);
        });

        test("updates batch size on scroll start", () => {
            mouseScroll["delays"] = [10, 10, 10];
            mouseScroll["batchSizes"] = [3, 4];
            const result = mouseScroll.analyzeDelay(300);
            expect(result).toBe(true);
            expect(mouseScroll["batchSizes"]).toContain(3);
            expect(mouseScroll["delays"]).toEqual([]);
        });
    });
});
