import { ImageZoom } from "../src/imagezoom";

const mockPlugin = {
    settings: {},
    register: jest.fn(),
    app: {
        workspace: {
            getActiveFileView: () => {
                return { getViewType: () => "markdown" };
            },
        },
    },
};

describe("ImageZoom", () => {
    let imageZoom: ImageZoom;

    beforeEach(() => {
        imageZoom = new ImageZoom(mockPlugin as any);
    });

    describe("getZoomFactor", () => {
        test("small positive delta", () => {
            const result = imageZoom["getZoomFactor"](1);
            expect(result).toBeCloseTo(1 / imageZoom["SMALL_ZOOM_FACTOR"]);
        });

        test("large positive delta", () => {
            const result = imageZoom["getZoomFactor"](1000);
            expect(result).toBeCloseTo(1 / imageZoom["LARGE_ZOOM_FACTOR"]);
        });

        test("small negative delta", () => {
            const result = imageZoom["getZoomFactor"](-1);
            expect(result).toBe(imageZoom["SMALL_ZOOM_FACTOR"]);
        });

        test("large negative delta", () => {
            const result = imageZoom["getZoomFactor"](-1000);
            expect(result).toBe(imageZoom["LARGE_ZOOM_FACTOR"]);
        });
    });

    describe("resetFile", () => {
        test("clears images list", () => {
            const parent = document.createElement("div");
            const child = document.createElement("div");
            parent.appendChild(child);
            imageZoom["zoomedImages"].add(child);

            expect(imageZoom["zoomedImages"].size).toBe(1);

            imageZoom["resetFile"]();

            Object.keys(child.dataset);

            expect(imageZoom["zoomedImages"].size).toBe(0);
        });

        test("clears initialized styles and dataset", () => {
            const parent = document.createElement("div");
            const target = document.createElement("div");
            parent.appendChild(target);
            imageZoom["zoomedImages"].add(target);

            imageZoom["initializeImage"](target);

            expect(Object.keys(parent.style).length).toBeGreaterThan(0);
            expect(Object.keys(target.dataset).length).toBeGreaterThan(0);

            imageZoom["resetFile"]();

            for (const key of Object.keys(parent.style)) {
                expect(parent.style[key]).toBe("");
            }

            for (const key of Object.keys(target.dataset)) {
                expect(target.dataset[key]).toBe("");
            }
        });
    });

    describe("initializeImage", () => {
        test("rejects unknown view type", () => {
            mockPlugin.app.workspace.getActiveFileView = () => {
                return { getViewType: () => "other" };
            };

            const parent = document.createElement("div");
            const target = document.createElement("div");
            parent.appendChild(target);

            const result = imageZoom["initializeImage"](target);

            expect(result).toBe(false);
        });

        test("accepts markdown view type", () => {
            mockPlugin.app.workspace.getActiveFileView = () => {
                return { getViewType: () => "markdown" };
            };

            const parent = document.createElement("div");
            const target = document.createElement("div");
            parent.appendChild(target);

            const result = imageZoom["initializeImage"](target);

            expect(result).toBe(true);
        });

        test("accepts image view type", () => {
            mockPlugin.app.workspace.getActiveFileView = () => {
                return { getViewType: () => "image" };
            };

            const parent = document.createElement("div");
            const target = document.createElement("div");
            parent.appendChild(target);

            const result = imageZoom["initializeImage"](target);

            expect(result).toBe(true);
        });
    });
});
