/*************
 * constants *
 *************/
const HEX_RADIUS = 35;
const HEX_RADIUS_SQUARED = HEX_RADIUS ** 2; // to avoid sqrt in distance calculations
const DEFAULT_TEXT_FONT_SIZE = 40;
const ControlSets = {
    GRID: "GRID",
    COLOR: "COLOR",
    OBJECT: "OBJECT",
    BOUNDARY: "BOUNDARY",
    PATH: "PATH",
    TEXT: "TEXT",
    // non-layer controlsets
    SETTINGS: "SETTINGS",
    FILEBROWSER: "FILEBROWSER",
};
const Tools = {
    SELECT: "SELECT",
    BRUSH: "BRUSH",
    FILL: "FILL",
    LINE: "LINE",
    EYEDROPPER: "EYEDROPPER",
    ERASER: "ERASER",
    ZOOM: "ZOOM",
};
const ControlPanels = {
    COLOR: "COLOR",
    OBJECT: "OBJECT",
    PATHTIPSYMBOL: "PATHTIPSYMBOL",
    TEXT: "TEXT",
    GRID: "GRID",
    SETTINGS: "SETTINGS",
    MINIMAP: "MINIMAP",
    FILEBROWSER: "FILEBROWSER",
};
const GridDirection = {
    HORIZONTAL: "HORIZONTAL",
    VERTICAL: "VERTICAL",
};
const LAYER_TOOL_COMPATIBILITY = {
    [ControlSets.GRID]: [Tools.ZOOM],
    [ControlSets.COLOR]: [
        Tools.BRUSH,
        Tools.FILL,
        Tools.LINE,
        Tools.ERASER,
        Tools.EYEDROPPER,
        Tools.ZOOM,
    ],
    [ControlSets.OBJECT]: [Tools.BRUSH, Tools.LINE, Tools.ERASER, Tools.EYEDROPPER, Tools.ZOOM],
    [ControlSets.PATH]: [Tools.BRUSH, Tools.ERASER, Tools.SELECT, Tools.ZOOM],
    [ControlSets.BOUNDARY]: [Tools.BRUSH, Tools.ERASER, Tools.ZOOM],
    [ControlSets.TEXT]: [Tools.BRUSH, Tools.ERASER, Tools.SELECT, Tools.ZOOM],
};
const CONTROL_PANEL_COMPATIBILITY = {
    [ControlSets.GRID]: [ControlPanels.GRID, ControlPanels.MINIMAP],
    [ControlSets.COLOR]: [ControlPanels.COLOR, ControlPanels.MINIMAP],
    [ControlSets.OBJECT]: [ControlPanels.OBJECT, ControlPanels.MINIMAP],
    [ControlSets.PATH]: [ControlPanels.COLOR, ControlPanels.PATHTIPSYMBOL, ControlPanels.MINIMAP],
    [ControlSets.BOUNDARY]: [ControlPanels.COLOR, ControlPanels.MINIMAP],
    [ControlSets.TEXT]: [ControlPanels.COLOR, ControlPanels.TEXT, ControlPanels.MINIMAP],
    [ControlSets.SETTINGS]: [ControlPanels.SETTINGS, ControlPanels.MINIMAP],
    [ControlSets.FILEBROWSER]: [ControlPanels.FILEBROWSER, ControlPanels.MINIMAP],
};
const GLOBAL_STATE = {
    drawing: {
        fileName: `Untitled${Date.now()}.svg`,
        // hexEntries[c][r] {hex, hexObject, x, y, c, r};
        hexEntries: [],
    },
    // everything else is just a way to maintain the state of the active
    // session. None of it should need to be exported, or set during import
    currentLayer: ControlSets.COLOR,
    currentTool: Tools.BRUSH,
    keyState: {
        holdingMeta: false,
    },
    mouseState: {
        holdingStdClick: false, // left or right
        holdingRightClick: false,
        holdingCenterClick: false,
    },
    temporaryTool: {
        previousTool: Tools.BRUSH,
        active: false,
    },
    undoRedo: {
        pauseUndoStack: false, // to prevent adding actions to undo stack, during init/undo
        undoStack: [],
        redoStack: [],
    },
    // temporary memory for settings in each layer - nothing that should be persisted
    layers: {
        GRID: {
            canvasColor: "#c4b9a5",
            gridColor: "#000000",
            gridDirection: GridDirection.HORIZONTAL,
            gridThickness: "5",
            cols: 34,
            rows: 20,
        },
        COLOR: {
            primaryColor: "#b8895f",
            secondaryColor: "#7eaaad",
        },
        OBJECT: {
            primaryObject: "🌽",
            secondaryObject: "🌊",
        },
        PATH: {
            primaryColor: "#000000",
            secondaryColor: "#ffffff",
            lastHexEntry: null,
        },
        BOUNDARY: {
            primaryColor: "#b8895f",
            secondaryColor: "#7eaaad",
            lastCRN: null,
        },
        TEXT: {
            primaryColor: "#b8895f",
            secondaryColor: "#7eaaad",
            bold: false,
            italics: false,
            underline: false,
        },
    },
};
const HEXAGGON_DIV = document.getElementById("hexaggon");
// the main drawing
const FILE_NAME_DIV = document.getElementById("fileName");
const SVG = document.getElementById("hexmap");
const MINIMAP = document.getElementById("minimap");
const MINIMAP_PREVIEW = document.getElementById("minimapPreview");
const MINIMAP_VIEWBOX = document.getElementById("minimapViewBox");
// global application controls
const WELCOME_DIV = document.getElementById("welcomeContainer");
const LAYER_PICKER_BUTTONS = document.getElementsByClassName("layer-picker-btn");
const NON_LAYER_CONTROL_SET_PICKER_BUTTONS = document.getElementsByClassName("non-layer-picker-btn");
const TOOL_PICKER_BUTTONS = document.getElementsByClassName("tool-picker-btn");
const CONTROL_PANEL_DIVS = document.getElementsByClassName("control-panel");
const SAVE_BUTTON = document.getElementById("saveBtn");
const FILE_UPLOAD_INPUT = document.getElementById("fileUpload");
const FILE_BROWSER_DIV = document.getElementById("fileBrowser");
// shared across many layers
const CHOSEN_PRIMARY_COLOR_DIV = document.getElementById("chosenPrimaryColor");
const CHOSEN_SECONDARY_COLOR_DIV = document.getElementById("chosenSecondaryColor");
const COLOR_CONTROL_SWATCHES = document
    .getElementById("colorControlPalette")
    .getElementsByClassName("swatch");
// grid layer
const GRID_DIRECTION_BUTTONS = document.getElementsByClassName("grid-direction-btn");
const GRID_SAMPLE_DIVS = document.getElementsByClassName("grid-sample");
const GRID_THICKNESS_SLIDER_DIV = document.getElementById("gridThicknessSlider");
const CANVAS_COLOR_SWATCHES = document
    .getElementById("canvasColor")
    .getElementsByClassName("swatch");
const GRID_COLOR_SWATCHES = document.getElementById("gridColor").getElementsByClassName("swatch");
// object layer
const OBJECT_BUTTONS = document.getElementsByClassName("object-btn");
// text layer
const TEXT_INPUT_DIV = document.getElementById("textInput");
const TEXT_FONT_SIZE_DIV = document.getElementById("textFontSize");
const TEXT_BOLD_DIV = document.getElementById("textBold");
const TEXT_ITALICS_DIV = document.getElementById("textItalics");
const TEXT_UNDERLINE_DIV = document.getElementById("textUnderline");
function dropKeyMouseState(keys, mouse) {
    if (keys) {
        GLOBAL_STATE.keyState.holdingMeta = false;
    }
    if (mouse) {
        GLOBAL_STATE.mouseState.holdingStdClick = false;
        GLOBAL_STATE.mouseState.holdingRightClick = false;
        GLOBAL_STATE.mouseState.holdingCenterClick = false;
    }
}
function registerDropUploadEventHandlers() {
    FILE_UPLOAD_INPUT.addEventListener("change", () => {
        const file = FILE_UPLOAD_INPUT.files[0];
        file.text().then((uploadedSvg) => importSvg(file.name, uploadedSvg));
    });
    document.addEventListener("drop", (e) => {
        e.preventDefault();
        if (e.dataTransfer.files) {
            [...e.dataTransfer.files].forEach((file) => {
                file.text().then((uploadedSvg) => importSvg(file.name, uploadedSvg));
            });
        }
    });
    document.addEventListener("dragover", (e) => {
        e.preventDefault();
    });
}
function registerEventListeners() {
    // keyboard shortcuts
    document.addEventListener("keydown", (e) => {
        const target = document.activeElement;
        if (!(target instanceof HTMLElement)) {
            return;
        }
        if (target instanceof HTMLInputElement && target.type != "range") {
            // TODO: allow Cmd+Scroll zoom even when in textbox
            // TODO: allow Cmd+Scroll zoom even when in textbox
            return;
        }
        if (target.id == "fileName") {
            if (e.code == "Enter") {
                target.blur();
            }
            return;
        }
        if (GLOBAL_STATE.keyState.holdingMeta) {
            switch (e.code) {
                case "KeyS":
                    saveNow();
                    e.preventDefault();
                    break;
                case "KeyZ":
                    undoLastAction();
                    break;
            }
            return;
        }
        switch (e.code) {
            case "Digit0":
                switchToControlSet(ControlSets.GRID);
                break;
            case "Digit1":
                switchToControlSet(ControlSets.COLOR);
                break;
            case "Digit2":
                switchToControlSet(ControlSets.OBJECT);
                break;
            case "Digit3":
                switchToControlSet(ControlSets.PATH);
                break;
            case "Digit4":
                switchToControlSet(ControlSets.BOUNDARY);
                break;
            case "Digit5":
                switchToControlSet(ControlSets.TEXT);
                break;
            case "KeyB":
                switchToTool(Tools.BRUSH);
                break;
            case "KeyG":
                switchToTool(Tools.FILL);
                break;
            case "KeyI":
                switchToTool(Tools.EYEDROPPER);
                break;
            case "KeyE":
                switchToTool(Tools.ERASER);
                break;
            case "KeyF":
                toggleFullscreen();
                break;
            case "KeyL":
                switchToTool(Tools.LINE);
                break;
            case "KeyM":
                switchToTool(Tools.SELECT);
                break;
            case "KeyZ":
                switchToTool(Tools.ZOOM);
                break;
            case "AltLeft":
            case "AltRight":
                switchToTool(Tools.EYEDROPPER, true);
                break;
            // TODO: use different meta keys based on OS?
            case "MetaLeft":
            case "MetaRight":
            case "ControlLeft":
            case "ControlRight":
                GLOBAL_STATE.keyState.holdingMeta = true;
                break;
        }
    });
    document.addEventListener("keyup", (e) => {
        if (e.code == "MetaLeft" ||
            e.code == "MetaRight" ||
            e.code == "ControlLeft" ||
            e.code == "ControlRight") {
            GLOBAL_STATE.keyState.holdingMeta = false;
        }
        if (e.code == "AltLeft" || e.code == "AltRight") {
            dropTemporaryModes();
        }
    });
    // when window loses focus, reset - otherwise, Cmd+Tab to change windows
    // will continue having holdingMeta after coming back
    document.addEventListener("blur", () => {
        dropKeyMouseState(true, true);
        dropTemporaryModes();
        stopFreeDragging();
    });
    document.addEventListener("mouseleave", () => {
        dropKeyMouseState(false, true);
        dropTemporaryModes();
        stopFreeDragging();
    });
    // global controls
    WELCOME_DIV.addEventListener("click", clearWelcomeScreen);
    for (const layerPicker of LAYER_PICKER_BUTTONS) {
        layerPicker.addEventListener("click", () => {
            switchToControlSet(layerPicker.dataset["controlset"]);
        });
    }
    for (const controlSetPicker of NON_LAYER_CONTROL_SET_PICKER_BUTTONS) {
        controlSetPicker.addEventListener("click", () => {
            switchToControlSet(controlSetPicker.dataset["controlset"], false);
        });
    }
    for (const toolPicker of TOOL_PICKER_BUTTONS) {
        toolPicker.addEventListener("click", () => {
            switchToTool(toolPicker.dataset["tool"]);
        });
    }
    SAVE_BUTTON.addEventListener("click", () => {
        exportToSvg();
    });
    document.getElementById("fullscreenBtn").addEventListener("click", () => {
        toggleFullscreen();
    });
    FILE_BROWSER_DIV.addEventListener("click", (e) => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }
        if (target.classList.contains("loaded-file-name")) {
            const fileName = target.dataset["imagename"];
            loadSvg(fileName, localStorage.getItem(`image-${fileName}`));
            setFileBrowserView(target.dataset["imagename"]);
        }
        else if (target.classList.contains("delete-file-btn")) {
            localStorage.removeItem(`image-${target.dataset["imagename"]}`);
            setFileBrowserView(GLOBAL_STATE.drawing.fileName);
        }
    });
    FILE_NAME_DIV.addEventListener("focusout", () => {
        if (FILE_NAME_DIV.textContent != GLOBAL_STATE.drawing.fileName) {
            localStorage.removeItem(`image-${GLOBAL_STATE.drawing.fileName}`);
            saveToLocalStorage(FILE_NAME_DIV.textContent, SVG.outerHTML, true);
            setFileBrowserView(FILE_NAME_DIV.textContent);
        }
    });
    // shared across many layers
    for (const swatch of COLOR_CONTROL_SWATCHES) {
        // left click - set as primary color
        swatch.addEventListener("click", () => {
            if (!(swatch instanceof HTMLElement)) {
                return;
            }
            setPrimaryColor(swatch.dataset["color"]);
        });
        // right click - set as secondary color
        swatch.addEventListener("contextmenu", (e) => {
            if (!(swatch instanceof HTMLElement)) {
                return;
            }
            e.preventDefault();
            setSecondaryColor(swatch.dataset["color"]);
        });
    }
    // grid layer buttons
    for (const swatch of CANVAS_COLOR_SWATCHES) {
        swatch.addEventListener("click", () => {
            if (!(swatch instanceof HTMLElement)) {
                return;
            }
            setCanvasColor(GLOBAL_STATE.layers.GRID.canvasColor, swatch.dataset["color"]);
        });
    }
    for (const swatch of GRID_COLOR_SWATCHES) {
        swatch.addEventListener("click", () => {
            if (!(swatch instanceof HTMLElement)) {
                return;
            }
            setGridColor(GLOBAL_STATE.layers.GRID.gridColor, swatch.dataset["color"]);
        });
    }
    for (const b of GRID_DIRECTION_BUTTONS) {
        b.addEventListener("click", () => {
            positionHexes(b.dataset["direction"]);
            repositionPaths();
            setGridDirection(b.dataset["direction"]);
            const bbox = SVG.getBBox();
            initMiniMap(bbox.x, bbox.y, bbox.width, bbox.height);
            const viewBox = SVG.getAttribute("viewBox");
            const [x, y, width, height] = viewBox.split(" ");
            MINIMAP_VIEWBOX.setAttribute("x", x);
            MINIMAP_VIEWBOX.setAttribute("y", y);
            MINIMAP_VIEWBOX.setAttribute("width", width);
            MINIMAP_VIEWBOX.setAttribute("height", height);
        });
    }
    GRID_THICKNESS_SLIDER_DIV.addEventListener("input", () => {
        const thickness = GRID_THICKNESS_SLIDER_DIV.value;
        setGridThickness(thickness);
    });
    // object layer buttons
    for (const btn of OBJECT_BUTTONS) {
        btn.addEventListener("click", () => {
            setPrimaryObject(btn.dataset["text"]);
        });
        btn.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            setSecondaryObject(btn.dataset["text"]);
        });
    }
    // text layer buttons
    TEXT_BOLD_DIV.addEventListener("click", () => {
        TEXT_BOLD_DIV.classList.toggle("selected");
        GLOBAL_STATE.layers.TEXT.bold = !GLOBAL_STATE.layers.TEXT.bold;
    });
    TEXT_ITALICS_DIV.addEventListener("click", () => {
        TEXT_ITALICS_DIV.classList.toggle("selected");
        GLOBAL_STATE.layers.TEXT.italics = !GLOBAL_STATE.layers.TEXT.italics;
    });
    TEXT_UNDERLINE_DIV.addEventListener("click", () => {
        TEXT_UNDERLINE_DIV.classList.toggle("selected");
        GLOBAL_STATE.layers.TEXT.underline = !GLOBAL_STATE.layers.TEXT.underline;
    });
    // SVG events listeners
    // mousedown is the big one that coordinates most of the page
    SVG.addEventListener("mousedown", (e) => {
        const target = e.target;
        if (!(target instanceof SVGElement)) {
            return;
        }
        if (GLOBAL_STATE.currentTool == Tools.ZOOM && e.buttons < 3) {
            const zoomFactor = 0.5 * (e.button == 2 ? 1 : -1);
            zoomSvg(zoomFactor, e.clientX, e.clientY);
            return;
        }
        else if (e.buttons < 3) {
            // single left/right click
            GLOBAL_STATE.mouseState.holdingStdClick = true;
            // a right mouse down means paint with secondary colors
            GLOBAL_STATE.mouseState.holdingRightClick = e.button == 2;
            if (target.classList.contains("hex")) {
                const hexAtMouse = target;
                handleHexInteraction(parseInt(hexAtMouse.dataset["c"]), parseInt(hexAtMouse.dataset["r"]), e.clientX, e.clientY);
            }
        }
        else if (e.buttons == 4) {
            GLOBAL_STATE.mouseState.holdingCenterClick = true;
            SVG.addEventListener("mousemove", freeDragScroll);
            switchToCursor("move");
        }
    });
    SVG.addEventListener("mouseover", (e) => {
        const target = e.target;
        if (!(target instanceof SVGElement)) {
            return;
        }
        if (GLOBAL_STATE.currentTool == Tools.ERASER && GLOBAL_STATE.mouseState.holdingStdClick) {
            if (target.classList.contains(`eraseable-${GLOBAL_STATE.currentLayer}`)) {
                if (target.classList.contains("path-highlight")) {
                    if (!(target instanceof SVGLineElement)) {
                        return;
                    }
                    const path = SVG.getElementById(`path-${target.id}`);
                    getSvgLayer(ControlSets.PATH).removeChild(target);
                    getSvgLayer(ControlSets.PATH).removeChild(path);
                    addToUndoStack({
                        type: "path",
                        action: "erased",
                        target: {
                            fromCR: {
                                c: parseInt(target.dataset["c1"]),
                                r: parseInt(target.dataset["r1"]),
                            },
                            toCR: {
                                c: parseInt(target.dataset["c2"]),
                                r: parseInt(target.dataset["r2"]),
                            },
                            lineColor: path.getAttribute("stroke"),
                            highlightColor: target.getAttribute("stroke"),
                        },
                    });
                }
                if (target.classList.contains("boundary")) {
                    if (!(target instanceof SVGLineElement)) {
                        return;
                    }
                    getSvgLayer(ControlSets.BOUNDARY).removeChild(target);
                    MINIMAP_PREVIEW.querySelectorAll(".miniboundary").forEach((t) => {
                        if (t instanceof SVGLineElement &&
                            t.dataset["fromcrn"] == target.dataset["fromcrn"] &&
                            t.dataset["tocrn"] == target.dataset["tocrn"] &&
                            t.getAttribute("stroke") == target.getAttribute("stroke")) {
                            MINIMAP_PREVIEW.removeChild(t);
                        }
                    });
                    addToUndoStack({
                        type: "boundary",
                        action: "erased",
                        target: {
                            fromCRN: target.dataset["fromcrn"],
                            toCRN: target.dataset["tocrn"],
                            color: target.getAttribute("stroke"),
                        },
                    });
                }
                else if (target.classList.contains("in-image-text")) {
                    if (!(target instanceof SVGTextElement)) {
                        return;
                    }
                    getSvgLayer(ControlSets.TEXT).removeChild(target);
                    const pt = new DOMPoint();
                    pt.x = parseFloat(target.getAttribute("x"));
                    pt.y = parseFloat(target.getAttribute("y"));
                    addToUndoStack({
                        type: "text",
                        action: "erased",
                        target: {
                            pt: pt,
                            textInput: target.textContent,
                            fontSize: target.getAttribute("font-size"),
                            strokeWidth: target.getAttribute("stroke-width"),
                            fontStyle: target.getAttribute("font-style"),
                            textDecoration: target.getAttribute("text-decoration"),
                            color: target.getAttribute("fill"),
                        },
                    });
                }
            }
        }
        if (GLOBAL_STATE.mouseState.holdingStdClick &&
            target instanceof SVGPolygonElement &&
            target.classList.contains("hex")) {
            const hexAtMouse = target;
            handleHexInteraction(parseInt(hexAtMouse.dataset["c"]), parseInt(hexAtMouse.dataset["r"]), e.clientX, e.clientY);
        }
    });
    SVG.addEventListener("mouseup", () => {
        if (GLOBAL_STATE.layers.BOUNDARY.lastCRN) {
            SVG.removeEventListener("mousemove", drawBoundary);
        }
        if (GLOBAL_STATE.mouseState.holdingCenterClick) {
            stopFreeDragging();
        }
        GLOBAL_STATE.mouseState.holdingStdClick = false;
        GLOBAL_STATE.mouseState.holdingCenterClick = false;
        GLOBAL_STATE.layers.BOUNDARY.lastCRN = null;
        GLOBAL_STATE.layers.PATH.lastHexEntry = null;
    });
    SVG.addEventListener("contextmenu", (e) => e.preventDefault());
    SVG.addEventListener("wheel", (e) => {
        e.preventDefault();
        if (GLOBAL_STATE.keyState.holdingMeta || e.ctrlKey) {
            let scale = e.deltaY / 100;
            scale = Math.abs(scale) > 0.1 ? (0.1 * e.deltaY) / Math.abs(e.deltaY) : scale;
            zoomSvg(scale, e.clientX, e.clientY);
        }
        else {
            scrollSvg(e.deltaX, e.deltaY);
        }
    });
}
function logUnexpectedError(msg) {
    console.log(`Unexpected error: ${msg}`);
}
/************************************
 * COORDINATING GLOBAL STATE AND UI *
 ************************************/
function stopFreeDragging() {
    SVG.removeEventListener("mousemove", freeDragScroll);
    switchToCursor(GLOBAL_STATE.currentTool);
}
function setPrimaryObject(objectText) {
    GLOBAL_STATE.layers.OBJECT.primaryObject = objectText;
    for (const b of OBJECT_BUTTONS) {
        if (b.dataset["text"] == objectText) {
            b.classList.add("primaryselected");
        }
        else {
            b.classList.remove("primaryselected");
        }
    }
}
function setSecondaryObject(objectText) {
    GLOBAL_STATE.layers.OBJECT.secondaryObject = objectText;
    for (const b of OBJECT_BUTTONS) {
        if (b.dataset["text"] == objectText) {
            b.classList.add("secondaryselected");
        }
        else {
            b.classList.remove("secondaryselected");
        }
    }
}
function setPrimaryColor(color) {
    // @ts-expect-error: both layer and color access are problematic. Find a better way.
    GLOBAL_STATE.layers[GLOBAL_STATE.currentLayer].primaryColor = color;
    CHOSEN_PRIMARY_COLOR_DIV.setAttribute("fill", color);
}
function setSecondaryColor(color) {
    // @ts-expect-error: both layer and color access are problematic. Find a better way.
    GLOBAL_STATE.layers[GLOBAL_STATE.currentLayer].secondaryColor = color;
    CHOSEN_SECONDARY_COLOR_DIV.setAttribute("fill", color);
}
function switchToCursor(name) {
    Object.keys(Tools).forEach((t) => SVG.classList.remove(`${t.toLowerCase()}cursor`));
    SVG.classList.remove("movecursor");
    SVG.classList.add(`${name.toLowerCase()}cursor`);
}
function setFileBrowserView(fileName) {
    populateFileBrowser();
    GLOBAL_STATE.drawing.fileName = fileName;
    FILE_NAME_DIV.textContent = fileName;
    const fileNameDivs = FILE_BROWSER_DIV.getElementsByClassName("loaded-file-name");
    for (const b of fileNameDivs) {
        if (b.dataset["imagename"] == fileName) {
            b.classList.add("selected");
        }
        else {
            b.classList.remove("selected");
        }
    }
}
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        HEXAGGON_DIV.requestFullscreen();
    }
    else {
        document.exitFullscreen();
    }
}
function clearWelcomeScreen() {
    WELCOME_DIV.remove();
    HEXAGGON_DIV.classList.remove("frosted");
}
/************************
 * GLOBAL FUNCTIONALITY *
 ************************/
function switchToControlSet(controlSet, isLayer = true) {
    const previousLayer = GLOBAL_STATE.currentLayer;
    GLOBAL_STATE.currentLayer = isLayer ? controlSet : null;
    for (const mc of CONTROL_PANEL_DIVS) {
        if (CONTROL_PANEL_COMPATIBILITY[controlSet].includes(mc.dataset["control"])) {
            mc.classList.remove("hidden");
        }
        else {
            mc.classList.add("hidden");
        }
    }
    for (const tpb of TOOL_PICKER_BUTTONS) {
        if (isLayer && LAYER_TOOL_COMPATIBILITY[controlSet].includes(tpb.dataset["tool"])) {
            tpb.classList.remove("disabled-btn");
        }
        else {
            tpb.classList.add("disabled-btn");
        }
    }
    for (const b of LAYER_PICKER_BUTTONS) {
        if (b.dataset["controlset"] == controlSet) {
            b.classList.add("selected");
        }
        else {
            b.classList.remove("selected");
        }
    }
    if (previousLayer) {
        document.querySelectorAll(`.eraseable-${previousLayer}`).forEach((e) => {
            e.classList.add("no-pointer-events");
        });
    }
    if (isLayer) {
        switchToTool(LAYER_TOOL_COMPATIBILITY[controlSet][0]);
        document.querySelectorAll(`.eraseable-${controlSet}`).forEach((e) => {
            e.classList.remove("no-pointer-events");
        });
        // @ts-expect-error: both layer and color access are problematic. Find a better way.
        setPrimaryColor(GLOBAL_STATE.layers[controlSet].primaryColor);
        // @ts-expect-error: both layer and color access are problematic. Find a better way.
        setSecondaryColor(GLOBAL_STATE.layers[controlSet].secondaryColor);
    }
}
function switchToTool(tool, temporarily = false) {
    if (!LAYER_TOOL_COMPATIBILITY[GLOBAL_STATE.currentLayer].includes(tool)) {
        return;
    }
    if (temporarily) {
        GLOBAL_STATE.temporaryTool.previousTool = GLOBAL_STATE.currentTool;
        GLOBAL_STATE.temporaryTool.active = true;
    }
    switchToCursor(tool);
    for (const b of TOOL_PICKER_BUTTONS) {
        if (b.dataset["tool"] == tool) {
            b.classList.add("selected");
        }
        else {
            b.classList.remove("selected");
        }
    }
    if (GLOBAL_STATE.currentLayer == ControlSets.TEXT) {
        SVG.querySelectorAll(".in-image-text").forEach((t) => {
            if (tool == Tools.SELECT && GLOBAL_STATE.currentTool != Tools.SELECT) {
                t.classList.add("allow-pointer-events");
                t.classList.remove("no-pointer-events");
            }
            else if (tool != Tools.SELECT && GLOBAL_STATE.currentTool == Tools.SELECT) {
                t.classList.remove("allow-pointer-events");
                t.classList.add("no-pointer-events");
            }
        });
    }
    GLOBAL_STATE.currentTool = tool;
}
function dropTemporaryModes() {
    if (GLOBAL_STATE.temporaryTool.active) {
        GLOBAL_STATE.temporaryTool.active = false;
        switchToTool(GLOBAL_STATE.temporaryTool.previousTool);
    }
}
function exportToSvg() {
    const clonedSvg = SVG.cloneNode(true);
    const bbox = SVG.getBBox();
    clonedSvg.setAttribute("viewBox", `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
    const svgData = clonedSvg.outerHTML;
    const preface = '<?xml version="1.0" standalone="no"?>\r\n';
    const svgBlob = new Blob([preface, svgData], {
        type: "image/svg+xml;charset=utf-8",
    });
    const svgUrl = URL.createObjectURL(svgBlob);
    const downloadLink = document.createElement("a");
    downloadLink.href = svgUrl;
    downloadLink.download = GLOBAL_STATE.drawing.fileName;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}
// the function the coordinates the entire interaction with the map
function handleHexInteraction(c, r, mouseX, mouseY) {
    const hexEntry = GLOBAL_STATE.drawing.hexEntries[c][r];
    if (GLOBAL_STATE.currentLayer == ControlSets.COLOR) {
        if (GLOBAL_STATE.currentTool == Tools.BRUSH) {
            colorHex(c, r);
        }
        else if (GLOBAL_STATE.currentTool == Tools.FILL) {
            floodFill(c, r, colorHex);
        }
        else if (GLOBAL_STATE.currentTool == Tools.ERASER) {
            colorHex(c, r, GLOBAL_STATE.layers.GRID.canvasColor);
        }
        else if (GLOBAL_STATE.currentTool == Tools.EYEDROPPER) {
            if (GLOBAL_STATE.mouseState.holdingRightClick) {
                setSecondaryColor(hexEntry.hex.getAttribute("fill"));
            }
            else {
                setPrimaryColor(hexEntry.hex.getAttribute("fill"));
            }
        }
    }
    else if (GLOBAL_STATE.currentLayer == ControlSets.OBJECT) {
        if (GLOBAL_STATE.layers.OBJECT.primaryObject == null) {
            return;
        }
        if (GLOBAL_STATE.currentTool == Tools.BRUSH) {
            placeObjectOnHex(c, r);
        }
        else if (GLOBAL_STATE.currentTool == Tools.EYEDROPPER && hexEntry.hexObject != null) {
            if (GLOBAL_STATE.mouseState.holdingRightClick) {
                setSecondaryObject(hexEntry.hexObject.textContent);
            }
            else {
                setPrimaryObject(hexEntry.hexObject.textContent);
            }
        }
        else if (GLOBAL_STATE.currentTool == Tools.ERASER) {
            placeObjectOnHex(c, r, "");
        }
    }
    else if (GLOBAL_STATE.currentLayer == ControlSets.BOUNDARY) {
        if (GLOBAL_STATE.currentTool == Tools.BRUSH) {
            startBoundaryDrawing(hexEntry, mouseX, mouseY);
        }
    }
    else if (GLOBAL_STATE.currentLayer == ControlSets.TEXT) {
        if (GLOBAL_STATE.currentTool == Tools.BRUSH) {
            const pt = new DOMPoint(mouseX, mouseY).matrixTransform(SVG.getScreenCTM().inverse());
            placeText(pt);
        }
    }
    else if (GLOBAL_STATE.currentLayer == ControlSets.PATH) {
        if (GLOBAL_STATE.currentTool == Tools.BRUSH) {
            drawPath(hexEntry);
        }
    }
}
/*************
 * UNDO/REDO *
 *************/
function addToUndoStack(action) {
    // this is the cleanest single point of knowing when the map is edited
    updateModifiedTime();
    if (GLOBAL_STATE.undoRedo.pauseUndoStack) {
        return;
    }
    GLOBAL_STATE.undoRedo.undoStack.push(action);
}
function undoLastAction() {
    const lastAction = GLOBAL_STATE.undoRedo.undoStack.pop();
    if (!lastAction) {
        return;
    }
    GLOBAL_STATE.undoRedo.pauseUndoStack = true;
    try {
        switch (lastAction.type) {
            // {type: "canvasColor", old, new}
            case "canvasColor":
                setCanvasColor(lastAction.new, lastAction.old);
                break;
            // {type: "gridColor", old, new}
            case "gridColor":
                setGridColor(lastAction.new, lastAction.old);
                break;
            // {type: "color", old, new, target: [c, r]}
            case "gridThickness":
                setGridThickness(lastAction.old);
                break;
            case "color":
                colorHex(lastAction.target.cr.c, lastAction.target.cr.r, lastAction.old);
                break;
            // {type: floodFill, old, target: {floodTargets: ["c1,r2", ...]}}
            case "floodFill": {
                const floodTargets = lastAction.target.floodTargets;
                for (const floodTarget of floodTargets) {
                    const cr = floodTarget.split(",").map(Number);
                    colorHex(cr[0], cr[1], lastAction.old, true);
                }
                break;
            }
            // {type: "object", old, new, target: [c, r]}
            case "object":
                placeObjectOnHex(lastAction.target.cr.c, lastAction.target.cr.r, lastAction.old);
                break;
            // {type: "boundary", target: {fromCRN, toCRN, color}}
            case "boundary": {
                const action = lastAction.action;
                const target = lastAction.target;
                if (action == "added") {
                    SVG.querySelectorAll(".boundary").forEach((t) => {
                        if (t instanceof SVGLineElement &&
                            t.dataset["fromcrn"] == target.fromCRN &&
                            t.dataset["tocrn"] == target.toCRN &&
                            t.getAttribute("stroke") == target.color) {
                            getSvgLayer(ControlSets.BOUNDARY).removeChild(t);
                        }
                    });
                    MINIMAP_PREVIEW.querySelectorAll(".miniboundary").forEach((t) => {
                        if (t instanceof SVGLineElement &&
                            t.dataset["fromcrn"] == target.fromCRN &&
                            t.dataset["tocrn"] == target.toCRN &&
                            t.getAttribute("stroke") == target.color) {
                            MINIMAP_PREVIEW.removeChild(t);
                        }
                    });
                }
                else if (action == "erased") {
                    const fromCRNArr = target.fromCRN.split(",");
                    const toCRNArr = target.toCRN.split(",");
                    drawBoundaryLine({
                        c: parseInt(fromCRNArr[0]),
                        r: parseInt(fromCRNArr[1]),
                        n: parseInt(fromCRNArr[2]),
                    }, { c: parseInt(toCRNArr[0]), r: parseInt(toCRNArr[1]), n: parseInt(toCRNArr[2]) }, target.color);
                }
                break;
            }
            // {type: "text", target: {pt, textInput, fontSize, strokeWidth, fontStyle, textDecoration, color}}
            case "text": {
                const action = lastAction.action;
                const target = lastAction.target;
                if (action == "added") {
                    SVG.querySelectorAll(".in-image-text").forEach((t) => {
                        if (parseFloat(t.getAttribute("x")) == target.pt.x &&
                            parseFloat(t.getAttribute("y")) == target.pt.y &&
                            t.getAttribute("fill") == target.color &&
                            t.textContent == target.textInput) {
                            getSvgLayer(ControlSets.TEXT).removeChild(t);
                        }
                    });
                }
                else if (action == "erased") {
                    placeTextWithConfig(target.pt, target.textInput, target.fontSize, target.strokeWidth, target.fontStyle, target.textDecoration, target.color);
                }
                break;
            }
            // {type: "path", target: {from: [c, r], to: [c, r], lineColor, highlightColor}}
            case "path": {
                const action = lastAction.action;
                const target = lastAction.target;
                if (action == "added") {
                    SVG.querySelectorAll(".path-highlight, .path").forEach((e) => {
                        if (e instanceof SVGLineElement &&
                            parseInt(e.dataset["c1"]) == target.fromCR.c &&
                            parseInt(e.dataset["r1"]) == target.fromCR.r &&
                            parseInt(e.dataset["c2"]) == target.toCR.c &&
                            parseInt(e.dataset["r2"]) == target.toCR.r) {
                            if ((e.classList.contains("path") && e.getAttribute("stroke") == target.lineColor) ||
                                (e.classList.contains("path-highlight") &&
                                    e.getAttribute("stroke") == target.highlightColor)) {
                                getSvgLayer(ControlSets.PATH).removeChild(e);
                            }
                        }
                    });
                }
                else if (action == "erased") {
                    drawLineAndHighlight(GLOBAL_STATE.drawing.hexEntries[target.fromCR.c][target.fromCR.r], GLOBAL_STATE.drawing.hexEntries[target.toCR.c][target.toCR.r], target.lineColor, target.highlightColor);
                }
                break;
            }
        }
    }
    finally {
        GLOBAL_STATE.undoRedo.pauseUndoStack = false;
    }
}
/****************************
 * GRID LAYER FUNCTIONALITY *
 ****************************/
function setCanvasColor(previousCanvasColor, color) {
    for (const e of GRID_SAMPLE_DIVS) {
        e.setAttribute("fill", color);
    }
    if (previousCanvasColor == color) {
        return;
    }
    for (const hexEntriesRow of GLOBAL_STATE.drawing.hexEntries) {
        for (const hexEntry of hexEntriesRow) {
            if (hexEntry.hex.getAttribute("fill") == previousCanvasColor) {
                hexEntry.hex.setAttribute("fill", color);
                hexEntry.minihex.setAttribute("fill", color);
                hexEntry.minihex.setAttribute("stroke", color);
            }
        }
    }
    HEXAGGON_DIV.style.background = color;
    GLOBAL_STATE.layers.GRID.canvasColor = color;
    SVG.dataset["canvasColor"] = color;
    addToUndoStack({
        type: "canvasColor",
        old: previousCanvasColor,
        new: color,
    });
}
function setGridColor(previousGridColor, color) {
    for (const hexEntriesRow of GLOBAL_STATE.drawing.hexEntries) {
        for (const hexEntry of hexEntriesRow) {
            hexEntry.hex.setAttribute("stroke", color);
            hexEntry.minihex.setAttribute("stroke", color);
        }
    }
    for (const e of GRID_SAMPLE_DIVS) {
        e.setAttribute("stroke", color);
    }
    GLOBAL_STATE.layers.GRID.gridColor = color;
    SVG.dataset["gridColor"] = color;
    addToUndoStack({ type: "gridColor", old: previousGridColor, new: color });
}
function setGridThickness(thickness) {
    const previousThickness = GLOBAL_STATE.layers.GRID.gridThickness;
    for (const hexEntriesRow of GLOBAL_STATE.drawing.hexEntries) {
        for (const hexEntry of hexEntriesRow) {
            hexEntry.hex.setAttribute("stroke-width", `${thickness}px`);
        }
    }
    GLOBAL_STATE.layers.GRID.gridThickness = thickness;
    GRID_THICKNESS_SLIDER_DIV.value = thickness;
    addToUndoStack({
        type: "gridThickness",
        old: previousThickness,
        new: thickness,
    });
}
function setGridDirection(gridDirection) {
    GLOBAL_STATE.layers.GRID.gridDirection = gridDirection;
    SVG.dataset["griddirection"] = gridDirection;
    for (const b of GRID_DIRECTION_BUTTONS) {
        if (b.dataset["direction"] == gridDirection) {
            b.classList.add("primaryselected");
        }
        else {
            b.classList.remove("primaryselected");
        }
    }
}
/*****************************
 * COLOR LAYER FUNCTIONALITY *
 *****************************/
function colorHex(c, r, fillColor = null, isFloodFill = false) {
    if (!fillColor) {
        fillColor = GLOBAL_STATE.mouseState.holdingRightClick
            ? GLOBAL_STATE.layers.COLOR.secondaryColor
            : GLOBAL_STATE.layers.COLOR.primaryColor;
    }
    const oldFillColor = GLOBAL_STATE.drawing.hexEntries[c][r].hex.getAttribute("fill");
    if (oldFillColor == fillColor) {
        return;
    }
    GLOBAL_STATE.drawing.hexEntries[c][r].hex.setAttribute("fill", fillColor);
    GLOBAL_STATE.drawing.hexEntries[c][r].minihex.setAttribute("fill", fillColor);
    if (!isFloodFill) {
        addToUndoStack({
            type: "color",
            old: oldFillColor,
            new: fillColor,
            target: { cr: { c, r } },
        });
    }
}
function floodFill(startC, startR, fn) {
    const queue = [[startC, startR]];
    const visited = [`${startC},${startR}`];
    const oldFillColor = GLOBAL_STATE.drawing.hexEntries[startC][startR].hex.getAttribute("fill");
    while (queue.length > 0) {
        const [c, r] = queue.shift();
        getHexNeighbors(c, r, SVG.dataset["griddirection"]).forEach((n) => {
            const stringedCoords = `${n[0]},${n[1]}`;
            if (n[0] < 0 ||
                n[1] < 0 ||
                n[0] >= GLOBAL_STATE.layers.GRID.cols ||
                n[1] >= GLOBAL_STATE.layers.GRID.rows)
                return;
            if (visited.includes(stringedCoords))
                return;
            const nhexentry = GLOBAL_STATE.drawing.hexEntries[n[0]][n[1]];
            if (nhexentry == null)
                return;
            const nhex = nhexentry.hex;
            if (nhex.getAttribute("fill") != oldFillColor)
                return;
            queue.push(n);
            visited.push(stringedCoords);
        });
    }
    visited.forEach((s) => {
        const cr = s.split(",").map(Number);
        fn(cr[0], cr[1], null, true);
    });
    addToUndoStack({
        type: "floodFill",
        old: oldFillColor,
        target: { floodTargets: visited },
    });
}
/******************************
 * OBJECT LAYER FUNCTIONALITY *
 ******************************/
function placeObjectOnHex(c, r, objectToUse = null) {
    // if objectToUse = "" empty string, empty/delete the text
    // we create/delete instead of keeping a permanent text element because this
    // takes up literally 60% of the space of even a well-populated map
    if (objectToUse === null) {
        objectToUse = GLOBAL_STATE.mouseState.holdingRightClick
            ? GLOBAL_STATE.layers.OBJECT.secondaryObject
            : GLOBAL_STATE.layers.OBJECT.primaryObject;
    }
    const hexEntry = GLOBAL_STATE.drawing.hexEntries[c][r];
    const oldObject = hexEntry.hexObject;
    const oldObjectText = oldObject ? oldObject.textContent : "";
    if (oldObjectText === objectToUse) {
        return;
    }
    // we didn't have an object here before
    if (!oldObject) {
        const hexObject = document.createElementNS("http://www.w3.org/2000/svg", "text");
        hexObject.dataset["c"] = c.toString();
        hexObject.dataset["r"] = r.toString();
        hexObject.setAttribute("x", hexEntry.hex.getAttribute("x"));
        hexObject.setAttribute("y", hexEntry.hex.getAttribute("y"));
        hexObject.classList.add("no-pointer-events", "hex-object", `layer-${ControlSets.OBJECT}`);
        getSvgLayer(ControlSets.OBJECT).appendChild(hexObject);
        GLOBAL_STATE.drawing.hexEntries[c][r].hexObject = hexObject;
    }
    if (objectToUse === "") {
        const hexObject = GLOBAL_STATE.drawing.hexEntries[c][r].hexObject;
        getSvgLayer(ControlSets.OBJECT).removeChild(hexObject);
        GLOBAL_STATE.drawing.hexEntries[c][r].hexObject = null;
    }
    else {
        GLOBAL_STATE.drawing.hexEntries[c][r].hexObject.textContent = objectToUse;
    }
    addToUndoStack({
        type: "object",
        old: oldObjectText,
        new: objectToUse,
        target: { cr: { c, r } },
    });
}
/****************************
 * PATH LAYER FUNCTIONALITY *
 ****************************/
function repositionPaths() {
    for (const path of SVG.getElementsByClassName("path")) {
        if (!(path instanceof SVGLineElement)) {
            logUnexpectedError("non-line path element");
            continue;
        }
        const hexEntry1 = GLOBAL_STATE.drawing.hexEntries[parseInt(path.dataset["c1"])][parseInt(path.dataset["r1"])];
        const hexEntry2 = GLOBAL_STATE.drawing.hexEntries[parseInt(path.dataset["c2"])][parseInt(path.dataset["r2"])];
        path.setAttribute("x1", hexEntry1.x.toString());
        path.setAttribute("y1", hexEntry1.y.toString());
        path.setAttribute("x2", hexEntry2.x.toString());
        path.setAttribute("y2", hexEntry2.y.toString());
    }
    for (const path of SVG.getElementsByClassName("path-highlight")) {
        if (!(path instanceof SVGLineElement)) {
            logUnexpectedError("non-line path-highlight element");
            continue;
        }
        const hexEntry1 = GLOBAL_STATE.drawing.hexEntries[parseInt(path.dataset["c1"])][parseInt(path.dataset["r1"])];
        const hexEntry2 = GLOBAL_STATE.drawing.hexEntries[parseInt(path.dataset["c2"])][parseInt(path.dataset["r2"])];
        path.setAttribute("x1", hexEntry1.x.toString());
        path.setAttribute("y1", hexEntry1.y.toString());
        path.setAttribute("x2", hexEntry2.x.toString());
        path.setAttribute("y2", hexEntry2.y.toString());
    }
}
function drawLineAndHighlight(fromHexEntry, toHexEntry, lineColor, highlightColor) {
    const id = crypto.randomUUID();
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("stroke", lineColor);
    line.setAttribute("x1", fromHexEntry.x.toString());
    line.setAttribute("y1", fromHexEntry.y.toString());
    line.dataset["c1"] = fromHexEntry.c.toString();
    line.dataset["r1"] = fromHexEntry.r.toString();
    line.setAttribute("x2", toHexEntry.x.toString());
    line.setAttribute("y2", toHexEntry.y.toString());
    line.dataset["c2"] = toHexEntry.c.toString();
    line.dataset["r2"] = toHexEntry.r.toString();
    line.classList.add("path", `layer-${ControlSets.PATH}`);
    line.id = `path-${id}`;
    const lineHighlight = document.createElementNS("http://www.w3.org/2000/svg", "line");
    lineHighlight.setAttribute("stroke", highlightColor);
    lineHighlight.setAttribute("x1", fromHexEntry.x.toString());
    lineHighlight.setAttribute("y1", fromHexEntry.y.toString());
    lineHighlight.dataset["c1"] = fromHexEntry.c.toString();
    lineHighlight.dataset["r1"] = fromHexEntry.r.toString();
    lineHighlight.setAttribute("x2", toHexEntry.x.toString());
    lineHighlight.setAttribute("y2", toHexEntry.y.toString());
    lineHighlight.dataset["c2"] = toHexEntry.c.toString();
    lineHighlight.dataset["r2"] = toHexEntry.r.toString();
    lineHighlight.classList.add("path-highlight", `layer-${ControlSets.PATH}`, `eraseable-${ControlSets.PATH}`);
    lineHighlight.id = id;
    addToUndoStack({
        type: "path",
        action: "added",
        target: {
            fromCR: { c: fromHexEntry.c, r: fromHexEntry.r },
            toCR: { c: toHexEntry.c, r: toHexEntry.r },
            lineColor,
            highlightColor,
        },
    });
    getSvgLayer(ControlSets.PATH).appendChild(lineHighlight);
    getSvgLayer(ControlSets.PATH).appendChild(line);
}
function drawPath(hexEntry) {
    if (!GLOBAL_STATE.layers.PATH.lastHexEntry) {
        GLOBAL_STATE.layers.PATH.lastHexEntry = hexEntry;
        return;
    }
    const lastHexEntry = GLOBAL_STATE.layers.PATH.lastHexEntry;
    if (lastHexEntry.c == hexEntry.c && lastHexEntry.r == hexEntry.r) {
        return;
    }
    GLOBAL_STATE.layers.PATH.lastHexEntry = hexEntry;
    drawLineAndHighlight(lastHexEntry, hexEntry, GLOBAL_STATE.layers.PATH.primaryColor, GLOBAL_STATE.layers.PATH.secondaryColor);
}
/***************************************************************************************
 * BOUNDARY LAYER FUNCTIONALITY                                                        *
 * - to avoid using floating points in the source of truth/identification of the ends  *
 *   of the boundary lines, we use a tuple of (c, r, n): (c, r) identifies a hex, n is *
 *   the index of the vertex.                                                          *
 *   While a single vertex could belong to three potential hexes, that doesn't         *
 *   matter - we just need any one. This also helps us avoid depending on coordinates  *
 *   during import/export, instead relying on (c, r) like we do everywhere else        *
 ***************************************************************************************/
function startBoundaryDrawing(hexEntry, mouseX, mouseY) {
    if (GLOBAL_STATE.layers.BOUNDARY.lastCRN != null) {
        return;
    }
    const pt = new DOMPoint(mouseX, mouseY).matrixTransform(SVG.getScreenCTM().inverse());
    let closestN = null;
    let closestDistance = Infinity;
    const hex = hexEntry.hex;
    for (let i = 0; i < hex.points.length; i++) {
        const distance = (hex.points[i].x - pt.x) ** 2 + (hex.points[i].y - pt.y) ** 2;
        if (distance < closestDistance) {
            closestN = i;
            closestDistance = distance;
        }
    }
    GLOBAL_STATE.layers.BOUNDARY.lastCRN = {
        c: hexEntry.c,
        r: hexEntry.r,
        n: closestN,
    };
    // our primary mouseover event isn't good enough, since it only fires once per hex
    // at the same time, having a mousemove main loop is just wasteful. so add a special
    // listened just during boundary drawing, then remove it once drawn
    SVG.addEventListener("mousemove", drawBoundary);
}
function drawBoundary(e) {
    const currentHex = e.target;
    if (!(currentHex instanceof SVGPolygonElement)) {
        return;
    }
    const lastCRN = GLOBAL_STATE.layers.BOUNDARY.lastCRN;
    // if we're not on one of the neigh of the lastCRN, do nothing. Cuts a lot of calculations
    if (!currentHex.classList.contains("hex") ||
        Math.abs(lastCRN.c - parseInt(currentHex.dataset["c"])) > 1 ||
        Math.abs(lastCRN.r - parseInt(currentHex.dataset["r"])) > 1) {
        return;
    }
    const pt = new DOMPoint(e.x, e.y).matrixTransform(SVG.getScreenCTM().inverse());
    let closestN = null;
    let closestDistance = Infinity;
    for (let i = 0; i < currentHex.points.length; i++) {
        // first, check that the point is even a neighbor - since we know it's a hex vertex, it must
        // be within HEX_RADIUS distance in both dimensions. This helps cut down how much squaring we
        // have to do
        // TODO: There's probably some basic arithmetic we can do to instantly get the list of the three CRN neighbors
        // and just check if we're close to one of them
        if (Math.abs(currentHex.points[i].x - pt.x) < HEX_RADIUS &&
            Math.abs(currentHex.points[i].y - pt.y) < HEX_RADIUS) {
            const distance = (currentHex.points[i].x - pt.x) ** 2 + (currentHex.points[i].y - pt.y) ** 2;
            if (distance < closestDistance) {
                closestN = i;
                closestDistance = distance;
            }
        }
    }
    const closestCRN = {
        c: parseInt(currentHex.dataset["c"]),
        r: parseInt(currentHex.dataset["r"]),
        n: closestN,
    };
    // we only want to draw boundary lines on top of existing hex edges.
    // we already know that our vertices are on hex vertices. If the distance
    // is within a unit of the hex radius, that means this must be a hex edge
    const lastBoundaryPoint = GLOBAL_STATE.drawing.hexEntries[lastCRN.c][lastCRN.r].hex.points[lastCRN.n];
    const nextBoundaryPoint = GLOBAL_STATE.drawing.hexEntries[closestCRN.c][closestCRN.r].hex.points[closestCRN.n];
    const lineLength = (lastBoundaryPoint.x - nextBoundaryPoint.x) ** 2 +
        (lastBoundaryPoint.y - nextBoundaryPoint.y) ** 2;
    console.log(currentHex, lineLength, closestCRN, lastBoundaryPoint, nextBoundaryPoint);
    // this looks like a large difference, but keep in mind these are square numbers
    // and we're at 35^2
    if (Math.abs(lineLength - HEX_RADIUS_SQUARED) > 75) {
        return;
    }
    const strokeColor = GLOBAL_STATE.mouseState.holdingRightClick
        ? GLOBAL_STATE.layers.BOUNDARY.secondaryColor
        : GLOBAL_STATE.layers.BOUNDARY.primaryColor;
    drawBoundaryLine(lastCRN, closestCRN, strokeColor);
    GLOBAL_STATE.layers.BOUNDARY.lastCRN = closestCRN;
}
function drawBoundaryLine(fromCRN, toCRN, color) {
    const fromHexVertex = GLOBAL_STATE.drawing.hexEntries[fromCRN.c][fromCRN.r].hex.points[fromCRN.n];
    const toHexVertex = GLOBAL_STATE.drawing.hexEntries[toCRN.c][toCRN.r].hex.points[toCRN.n];
    const fromCRNStr = `${fromCRN.c},${fromCRN.r},${fromCRN.n}`;
    const toCRNStr = `${toCRN.c},${toCRN.r},${toCRN.n}`;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    const minimapLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", fromHexVertex.x.toString());
    minimapLine.setAttribute("x1", fromHexVertex.x.toString());
    line.setAttribute("y1", fromHexVertex.y.toString());
    minimapLine.setAttribute("y1", fromHexVertex.y.toString());
    line.setAttribute("x2", toHexVertex.x.toString());
    minimapLine.setAttribute("x2", toHexVertex.x.toString());
    line.setAttribute("y2", toHexVertex.y.toString());
    minimapLine.setAttribute("y2", toHexVertex.y.toString());
    line.dataset["fromcrn"] = fromCRNStr;
    minimapLine.dataset["fromcrn"] = fromCRNStr;
    line.dataset["tocrn"] = toCRNStr;
    minimapLine.dataset["tocrn"] = toCRNStr;
    line.setAttribute("stroke", color);
    minimapLine.setAttribute("stroke", color);
    line.classList.add("boundary", `layer-${ControlSets.BOUNDARY}`, `eraseable-${ControlSets.BOUNDARY}`);
    minimapLine.classList.add("miniboundary");
    getSvgLayer(ControlSets.BOUNDARY).appendChild(line);
    MINIMAP_PREVIEW.appendChild(minimapLine);
    addToUndoStack({
        type: "boundary",
        action: "added",
        target: { fromCRN: fromCRNStr, toCRN: toCRNStr, color },
    });
}
/****************************
 * TEXT LAYER FUNCTIONALITY *
 ****************************/
function placeText(pt) {
    const textInput = TEXT_INPUT_DIV.value;
    if (!textInput) {
        return;
    }
    const strokeWidth = GLOBAL_STATE.layers.TEXT.bold ? "0.5" : null;
    const fontStyle = GLOBAL_STATE.layers.TEXT.italics ? "italics" : null;
    const textDecoration = GLOBAL_STATE.layers.TEXT.underline ? "underline" : null;
    placeTextWithConfig(pt, textInput, TEXT_FONT_SIZE_DIV.value, strokeWidth, fontStyle, textDecoration, GLOBAL_STATE.layers.TEXT.primaryColor);
}
function placeTextWithConfig(pt, textInput, fontSize, strokeWidth, fontStyle, textDecoration, color) {
    const textbox = document.createElementNS("http://www.w3.org/2000/svg", "text");
    textbox.setAttribute("font-size", fontSize);
    if (strokeWidth) {
        textbox.setAttribute("stroke-width", strokeWidth);
    }
    if (fontStyle) {
        textbox.setAttribute("font-style", fontStyle);
    }
    if (textDecoration) {
        textbox.setAttribute("text-decoration", textDecoration);
    }
    textbox.setAttribute("x", pt.x.toString());
    textbox.setAttribute("y", pt.y.toString());
    textbox.setAttribute("fill", color);
    textbox.textContent = textInput;
    textbox.classList.add("in-image-text", `layer-${ControlSets.TEXT}`, `eraseable-${ControlSets.TEXT}`);
    addToUndoStack({
        type: "text",
        action: "added",
        target: {
            pt,
            textInput,
            fontSize,
            strokeWidth,
            fontStyle,
            textDecoration,
            color,
        },
    });
    getSvgLayer(ControlSets.TEXT).appendChild(textbox);
}
/***************
 * ZOOM/SCROLL *
 ***************/
function freeDragScroll(e) {
    scrollSvg(-e.movementX, -e.movementY);
}
function scrollSvg(xdiff, ydiff) {
    const viewBox = SVG.getAttribute("viewBox");
    const [x, y, width, height] = viewBox.split(" ").map(Number);
    const scale = width / window.innerWidth;
    const newX = x + Math.round(xdiff * scale);
    const newY = y + Math.round(ydiff * scale);
    SVG.setAttribute("viewBox", `${newX} ${newY} ${width} ${height}`);
    MINIMAP_VIEWBOX.setAttribute("x", newX.toString());
    MINIMAP_VIEWBOX.setAttribute("y", newY.toString());
    MINIMAP_VIEWBOX.setAttribute("width", width.toString());
    MINIMAP_VIEWBOX.setAttribute("height", height.toString());
}
function zoomSvg(scale, mouseX, mouseY) {
    // mouse point within SVG space. Don't ask, I just copied-pasted
    const pt = new DOMPoint(mouseX, mouseY).matrixTransform(SVG.getScreenCTM().inverse());
    const viewBox = SVG.getAttribute("viewBox");
    const [x, y, width, height] = viewBox.split(" ").map(Number);
    // new viewbox
    const [width2, height2] = [Math.min(width + width * scale), Math.min(height + height * scale)];
    // new corner of the viewbox
    const [xPropW, yPropH] = [(pt.x - x) / width, (pt.y - y) / height];
    const x2 = pt.x - xPropW * width2;
    const y2 = pt.y - yPropH * height2;
    SVG.setAttribute("viewBox", `${x2} ${y2} ${width2} ${height2}`);
    MINIMAP_VIEWBOX.setAttribute("x", x2.toString());
    MINIMAP_VIEWBOX.setAttribute("y", y2.toString());
    MINIMAP_VIEWBOX.setAttribute("width", width2.toString());
    MINIMAP_VIEWBOX.setAttribute("height", height2.toString());
}
/*************
 * HEX UTILS *
 *************/
function getHexNeighbors(c, r, gridDirection) {
    if (gridDirection == GridDirection.VERTICAL) {
        const offset = r % 2 == 0 ? -1 : 1;
        return [
            // left and right
            [c - 1, r],
            [c + 1, r],
            // two to the top
            [c, r - 1],
            [c + offset, r - 1],
            // two to the bottom
            [c, r + 1],
            [c + offset, r + 1],
        ];
    }
    const offset = c % 2 == 0 ? -1 : 1;
    return [
        // up and down
        [c, r - 1],
        [c, r + 1],
        // two to the left
        [c - 1, r],
        [c - 1, r + offset],
        // two to the right
        [c + 1, r],
        [c + 1, r + offset],
    ];
}
function hexIndexToPixel(c, r, gridDirection) {
    if (gridDirection == GridDirection.VERTICAL) {
        const x = HEX_RADIUS * Math.sqrt(3) * (c + 0.5 * (r % 2));
        const y = ((HEX_RADIUS * 3) / 2) * r;
        return { x, y };
    }
    const x = ((HEX_RADIUS * 3) / 2) * c;
    const y = HEX_RADIUS * Math.sqrt(3) * (r + 0.5 * (c % 2));
    return { x, y };
}
function roundForHex(num) {
    return Math.ceil(num);
}
function getHexVertixes(c, r, gridDirection) {
    const { x, y } = hexIndexToPixel(c, r, gridDirection);
    const points = [];
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        if (gridDirection == GridDirection.VERTICAL) {
            const px = roundForHex(x + HEX_RADIUS * Math.sin(angle));
            const py = roundForHex(y + HEX_RADIUS * Math.cos(angle));
            points.push(`${px},${py}`);
        }
        else {
            const px = roundForHex(x + HEX_RADIUS * Math.cos(angle));
            const py = roundForHex(y + HEX_RADIUS * Math.sin(angle));
            points.push(`${px},${py}`);
        }
    }
    return { x, y, points };
}
/***********
 * DRAWING *
 ***********/
function getSvgLayer(layer) {
    return SVG.getElementById(`${layer}Layer`) || SVG;
}
function positionHexes(gridDirection) {
    for (const hexEntriesRow of GLOBAL_STATE.drawing.hexEntries) {
        for (const hexEntry of hexEntriesRow) {
            const { x, y, points } = getHexVertixes(hexEntry.c, hexEntry.r, gridDirection);
            hexEntry.x = x;
            hexEntry.y = y;
            hexEntry.hex.setAttribute("x", x.toString());
            hexEntry.hex.setAttribute("y", y.toString());
            hexEntry.hex.setAttribute("points", points.join(" "));
            if (hexEntry.hexObject) {
                hexEntry.hexObject.setAttribute("x", x.toString());
                hexEntry.hexObject.setAttribute("y", y.toString());
            }
            if (hexEntry.minihex) {
                hexEntry.minihex.setAttribute("points", points.join(" "));
            }
        }
    }
}
function drawHex(c, r) {
    const hex = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    hex.setAttribute("stroke-width", `${GLOBAL_STATE.layers.GRID.gridThickness}px`);
    hex.dataset["c"] = c.toString();
    hex.dataset["r"] = r.toString();
    hex.classList.add("hex");
    getSvgLayer("HEX").appendChild(hex);
    const hexEntry = { hex, minihex: null, hexObject: null, x: null, y: null, c, r };
    return hexEntry;
}
function initMiniMap(x, y, width, height) {
    MINIMAP_PREVIEW.innerHTML = "";
    for (const hexEntriesRow of GLOBAL_STATE.drawing.hexEntries) {
        for (const hexEntry of hexEntriesRow) {
            let pointsStr = "";
            for (const hexPoint of hexEntry.hex.points) {
                pointsStr += `${hexPoint.x},${hexPoint.y} `;
            }
            const minihex = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
            minihex.dataset["c"] = hexEntry.c.toString();
            minihex.dataset["r"] = hexEntry.r.toString();
            minihex.setAttribute("points", pointsStr);
            minihex.setAttribute("fill", hexEntry.hex.getAttribute("fill"));
            minihex.classList.add("minihex");
            hexEntry.minihex = minihex;
            MINIMAP_PREVIEW.appendChild(minihex);
        }
    }
    for (const boundary of SVG.getElementsByClassName("boundary")) {
        if (!(boundary instanceof SVGLineElement)) {
            logUnexpectedError("non-line boundary element");
            return;
        }
        const miniboundary = document.createElementNS("http://www.w3.org/2000/svg", "line");
        miniboundary.setAttribute("x1", boundary.getAttribute("x1"));
        miniboundary.setAttribute("y1", boundary.getAttribute("y1"));
        miniboundary.setAttribute("x2", boundary.getAttribute("x2"));
        miniboundary.setAttribute("y2", boundary.getAttribute("y2"));
        miniboundary.dataset["fromcrn"] = boundary.dataset["fromcrn"];
        miniboundary.dataset["tocrn"] = boundary.dataset["fromcrn"];
        miniboundary.setAttribute("stroke", boundary.getAttribute("stroke"));
        miniboundary.classList.add("miniboundary");
        MINIMAP_PREVIEW.appendChild(miniboundary);
    }
    const minibbox = MINIMAP_PREVIEW.getBBox();
    MINIMAP.setAttribute("viewBox", `${minibbox.x} ${minibbox.y} ${minibbox.width} ${minibbox.height}`);
    MINIMAP_VIEWBOX.setAttribute("x", x.toString());
    MINIMAP_VIEWBOX.setAttribute("y", y.toString());
    MINIMAP_VIEWBOX.setAttribute("width", width.toString());
    MINIMAP_VIEWBOX.setAttribute("height", height.toString());
}
function svgInit() {
    GLOBAL_STATE.undoRedo.pauseUndoStack = true;
    SVG.dataset["griddirection"] = GLOBAL_STATE.layers.GRID.gridDirection;
    SVG.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    GLOBAL_STATE.drawing.hexEntries = [];
    Array.prototype.slice.call(document.getElementsByTagName("polygon")).forEach((e) => {
        if (!(e instanceof SVGPolygonElement)) {
            return;
        }
        e.remove();
    });
    for (let c = 0; c < GLOBAL_STATE.layers.GRID.cols; c++) {
        const hexColEntries = [];
        for (let r = 0; r < GLOBAL_STATE.layers.GRID.rows; r++) {
            hexColEntries.push(drawHex(c, r));
        }
        GLOBAL_STATE.drawing.hexEntries.push(hexColEntries);
    }
    positionHexes(SVG.dataset["griddirection"]);
    const bbox = SVG.getBBox();
    const midX = (bbox.width - window.innerWidth) / 2;
    const midY = (bbox.height - window.innerHeight) / 2;
    SVG.setAttribute("viewBox", `${midX} ${midY} ${window.innerWidth} ${window.innerHeight}`);
    initMiniMap(midX, midY, window.innerWidth, window.innerHeight);
    setCanvasColor(null, GLOBAL_STATE.layers.GRID.canvasColor);
    setGridColor(null, GLOBAL_STATE.layers.GRID.gridColor);
    setPrimaryObject(GLOBAL_STATE.layers.OBJECT.primaryObject);
    setSecondaryObject(GLOBAL_STATE.layers.OBJECT.secondaryObject);
    TEXT_FONT_SIZE_DIV.value = DEFAULT_TEXT_FONT_SIZE.toString();
    GRID_THICKNESS_SLIDER_DIV.value = GLOBAL_STATE.layers.GRID.gridThickness;
    setGridDirection(GridDirection.HORIZONTAL);
    SVG.dataset["lastmodified"] = "-1";
    switchToControlSet(ControlSets.COLOR);
    GLOBAL_STATE.undoRedo.pauseUndoStack = false;
    // smolbean grid for inspection ease
    // for (let c = 3; c < 13; c++) {
    //   for (let r = 3; r < 13; r++) {
    //     drawHex(c, r);
    //   }
    // }
}
function loadSvg(fileName, svgStr) {
    GLOBAL_STATE.undoRedo.undoStack = [];
    GLOBAL_STATE.undoRedo.redoStack = [];
    GLOBAL_STATE.undoRedo.pauseUndoStack = true;
    const parser = new DOMParser();
    const uploadedSvg = parser.parseFromString(svgStr, "image/svg+xml").documentElement;
    for (const c of uploadedSvg.getElementsByTagName("style")) {
        uploadedSvg.removeChild(c);
    }
    setGridDirection(uploadedSvg.dataset["griddirection"] || GridDirection.HORIZONTAL);
    const styleElement = SVG.getElementsByTagName("style")[0];
    GLOBAL_STATE.drawing.fileName = fileName;
    FILE_NAME_DIV.textContent = fileName;
    SVG.innerHTML = uploadedSvg.innerHTML;
    SVG.appendChild(styleElement);
    // extract hex metadata
    const hexesMap = new Map();
    for (const hex of SVG.getElementsByClassName("hex")) {
        if (!(hex instanceof SVGPolygonElement)) {
            logUnexpectedError("hex not polygon in uploaded svg");
            return;
        }
        const c = parseInt(hex.dataset["c"]);
        const r = parseInt(hex.dataset["r"]);
        const x = parseFloat(hex.getAttribute("x"));
        const y = parseFloat(hex.getAttribute("y"));
        if (!hexesMap.has(c)) {
            hexesMap.set(c, new Map());
        }
        hexesMap.get(c).set(r, { hex, minihex: null, hexObject: null, x, y, c, r });
    }
    GLOBAL_STATE.drawing.hexEntries = [];
    GLOBAL_STATE.layers.GRID.cols = hexesMap.size;
    GLOBAL_STATE.layers.GRID.rows = hexesMap.get(0).size;
    setGridThickness(hexesMap.get(0).get(0).hex.getAttribute("stroke-width").slice(0, -2));
    for (let c = 0; c < GLOBAL_STATE.layers.GRID.cols; c++) {
        const hexColEntries = [];
        for (let r = 0; r < GLOBAL_STATE.layers.GRID.rows; r++) {
            hexColEntries.push(hexesMap.get(c).get(r));
        }
        GLOBAL_STATE.drawing.hexEntries.push(hexColEntries);
    }
    for (const hexObject of SVG.getElementsByClassName("hex-object")) {
        if (!(hexObject instanceof SVGTextElement)) {
            logUnexpectedError("hex object not text in uploaded svg");
            return;
        }
        const c = parseInt(hexObject.dataset["c"]);
        const r = parseInt(hexObject.dataset["r"]);
        const hexEntry = GLOBAL_STATE.drawing.hexEntries[c]?.[r];
        if (hexEntry === undefined) {
            logUnexpectedError("cr of hex object doesn't exist");
            return;
        }
        hexEntry.hexObject = hexObject;
    }
    const bbox = SVG.getBBox();
    const midX = (bbox.width - window.innerWidth) / 2;
    const midY = (bbox.height - window.innerHeight) / 2;
    SVG.setAttribute("viewBox", `${midX} ${midY} ${window.innerWidth} ${window.innerHeight}`);
    initMiniMap(midX, midY, window.innerWidth, window.innerHeight);
    const canvasColor = uploadedSvg.dataset["canvasColor"];
    const gridColor = uploadedSvg.dataset["gridColor"];
    if (canvasColor) {
        setCanvasColor(null, canvasColor);
    }
    if (gridColor) {
        setGridColor(null, gridColor);
    }
    switchToControlSet(ControlSets.COLOR);
    clearWelcomeScreen();
    GLOBAL_STATE.undoRedo.pauseUndoStack = false;
}
function importSvg(fileName, svgStr) {
    loadSvg(fileName, svgStr);
    saveToLocalStorage(fileName, svgStr, true);
    setFileBrowserView(fileName);
}
/*************************************
 * STATE PERSISTENCE/FILE MANAGEMENT *
 *************************************/
function updateModifiedTime() {
    SVG.dataset["lastmodified"] = Date.now().toString();
}
function saveNow() {
    saveToLocalStorage(GLOBAL_STATE.drawing.fileName, SVG.outerHTML);
}
function saveToLocalStorage(fileName, svgStr, isNew = false) {
    const k = `image-${fileName}`;
    if (!isNew || localStorage.getItem(k) == null) {
        try {
            localStorage.setItem(k, svgStr);
        }
        catch {
            alert("Browser storage exceeded - this file will be not autosaved. Delete other files and reupload.");
        }
    }
    else {
        alert("Image with same name already exists!");
    }
}
function populateFileBrowser() {
    FILE_BROWSER_DIV.innerHTML = "";
    Object.keys(localStorage).forEach((k) => {
        if (k.startsWith("image-")) {
            const imageName = k.slice(6);
            const nameDiv = document.createElement("div");
            nameDiv.textContent = imageName;
            nameDiv.dataset["imagename"] = imageName;
            nameDiv.classList.add("loaded-file-name");
            const deleteBtnDiv = document.createElement("div");
            deleteBtnDiv.dataset["imagename"] = imageName;
            deleteBtnDiv.textContent = "❌";
            deleteBtnDiv.classList.add("delete-file-btn");
            const div = document.createElement("div");
            div.appendChild(nameDiv);
            div.appendChild(deleteBtnDiv);
            div.classList.add("flex-row", "loaded-file-entry", "gappy");
            FILE_BROWSER_DIV.appendChild(div);
        }
    });
}
function svgToPng(svgString) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
    };
    img.classList.add("loaded-file-preview");
    img.src = url;
    return img;
}
function populateWelcomeScreenFiles() {
    Object.keys(localStorage).forEach((k) => {
        if (k.startsWith("image-")) {
            const imageName = k.slice(6);
            const nameDiv = document.createElement("div");
            nameDiv.textContent = imageName;
            nameDiv.dataset["imagename"] = imageName;
            nameDiv.classList.add("loaded-file-name");
            const div = document.createElement("div");
            div.appendChild(nameDiv);
            div.append(svgToPng(localStorage.getItem(k)));
            div.classList.add("flex-column", "loaded-file-entry", "gappy");
            document.getElementById("welcomeContainerFileBrowser").appendChild(div);
            div.addEventListener("click", () => {
                loadSvg(imageName, localStorage.getItem(k));
            });
        }
    });
}
/********
 * MAIN *
 ********/
registerEventListeners();
registerDropUploadEventHandlers();
setFileBrowserView(GLOBAL_STATE.drawing.fileName);
svgInit();
setInterval(() => {
    if (parseInt(SVG.dataset["lastmodified"]) > 0) {
        const clonedSvg = SVG.cloneNode(true);
        const bbox = SVG.getBBox();
        clonedSvg.setAttribute("viewBox", `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
        saveToLocalStorage(FILE_NAME_DIV.textContent, clonedSvg.outerHTML, false);
    }
}, 5000);
populateWelcomeScreenFiles();
