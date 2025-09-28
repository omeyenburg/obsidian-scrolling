import { clamp } from "../src/utility";

describe("clamp", () => {
    test("does not exceed maximum", () => {
        const result = clamp(10, 0, 5);
        expect(result).toBe(5)
    });

    test("does not exceed minimum", () => {
        const result = clamp(-10, 0, 5);
        expect(result).toBe(0)
    });
});
