/******************
 * GAME CONSTANTS *
 ******************/
const HEX_RADIUS = 35;
const HEX_RADIUS_SQUARED = HEX_RADIUS ** 2;  // to avoid sqrt in distance calculations
const DEFAULT_TEXT_FONT_SIZE = 40;

const Layers = {
  GRID: "GRID",
  COLOR: "COLOR",
  OBJECT: "OBJECT",
  BOUNDARY: "BOUNDARY",
  PATH: "PATH",
  TEXT: "TEXT",
  SETTINGS: "SETTINGS",
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

const Controls = {
  COLOR: "COLOR",
  OBJECT: "OBJECT",
  PATHTIPSYMBOL: "PATHTIPSYMBOL",
  TEXT: "TEXT",
  GRID: "GRID",
  SETTINGS: "SETTINGS",
}

const GridDirection = {
  HORIZONTAL: "HORIZONTAL",
  VERTICAL: "VERTICAL",
}

const LAYER_TOOL_COMPATIBILITY = {
  [Layers.GRID]: [Tools.ZOOM],
  [Layers.COLOR]: [Tools.BRUSH, Tools.FILL, Tools.LINE, Tools.ERASER, Tools.EYEDROPPER, Tools.ZOOM],
  [Layers.OBJECT]: [Tools.BRUSH, Tools.LINE, Tools.ERASER, Tools.EYEDROPPER, Tools.ZOOM],
  [Layers.PATH]: [Tools.BRUSH, Tools.ERASER, Tools.SELECT, Tools.ZOOM],
  [Layers.BOUNDARY]: [Tools.BRUSH, Tools.ERASER, Tools.ZOOM],
  [Layers.TEXT]: [Tools.BRUSH, Tools.ERASER, Tools.SELECT, Tools.ZOOM],
  [Layers.SETTINGS]: [Tools.ZOOM],
};

const LAYER_CONTROL_COMPATIBILITY = {
  [Layers.GRID]: [Controls.GRID],
  [Layers.COLOR]: [Controls.COLOR],
  [Layers.OBJECT]: [Controls.OBJECT],
  [Layers.PATH]: [Controls.COLOR, Controls.PATHTIPSYMBOL],
  [Layers.BOUNDARY]: [Controls.COLOR],
  [Layers.TEXT]: [Controls.COLOR, Controls.TEXT],
  [Layers.SETTINGS]: [Controls.SETTINGS],
};

/****************
 * GLOBAL STATE *
 ****************/
const GLOBAL_STATE = {
  // this is the only part affected during import - keep it that way!
  drawing: {
    name: "",
    uuid: crypto.randomUUID(),
    gridDirection: GridDirection.HORIZONTAL,
    // "c,r" -> {hex, hexObject, x, y, c, r}
    hexes: {},
  },

  // everything else is just a way to maintain the state of the active
  // session. None of it should need to be exported, or set during import
  currentLayer: Layers.COLOR,
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

  pauseUndoStack: false,  // to prevent adding actions to undo stack, during init/undo
  undoStack: [],
  redoStack: [],

  layers: {
    GRID: {
      canvasColor: "#c4b9a5",
      gridColor: "#000000",
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
      // each path has line, lineHighlight, pathTip
      paths: [],
      activePath: null,
      lastHexEntry: null,
    },

    BOUNDARY: {
      primaryColor: "#b8895f",
      secondaryColor: "#7eaaad",
      lastCRN: null,
      boundaryDrawingEvent: null,
    },

    TEXT: {
      primaryColor: "#b8895f",
      secondaryColor: "#7eaaad",
      bold: false,
      italics: false,
      underline: false,
    },

    SETTINGS: {
    },
  },
}

/************************************************************************
 * THE DOM                                                              *
 * - image listeners should only go on constant elements we know exist, *
 *   and not on sub-SVG elements. This makes for more efficient event   *
 *   handling, and also makes importing simple, since we don't have to  *
 *   manage anything extra that could break/be forgotten                *
 * - any peristent key/mouse state should go into GLOBAL_STATE.keyState *
 *   or GLOBAL_STATE.mouseState. This helps us clear and and manage it  *
 *   togther                                                            *
 ************************************************************************/
const SVG = document.getElementById("hexmap");
const MINIMAP = document.getElementById("minimap");
const MINIMAP_VIEWBOX = document.getElementById("minimapViewBox");
const COLOR_CONTROL_SWATCHES = document.querySelectorAll("#colorControlPalette .swatch");
const CANVAS_COLOR_SWATCHES = document.querySelectorAll("#canvasColor .swatch");
const GRID_COLOR_SWATCHES = document.querySelectorAll("#gridColor .swatch");
const LAYER_PICKER_BUTTONS = document.querySelectorAll(".layer-picker-btn");
const TOOL_PICKER_BUTTONS = document.querySelectorAll(".tool-picker-btn");
const LAYER_CONTROLS = document.querySelectorAll(".layer-control");
const OBJECT_BUTTONS = document.querySelectorAll(".object-btn");
const CHOSEN_PRIMARY_COLOR_DIV = document.getElementById("chosenPrimaryColor");
const CHOSEN_SECONDARY_COLOR_DIV = document.getElementById("chosenSecondaryColor");
const TEXT_INPUT_DIV = document.getElementById("textInput");
const TEXT_FONT_SIZE_DIV = document.getElementById("textFontSize");
const TEXT_BOLD_DIV = document.getElementById("textBold");
const TEXT_ITALICS_DIV = document.getElementById("textItalics");
const TEXT_UNDERLINE_DIV = document.getElementById("textUnderline");
const FILE_UPLOAD_INPUT = document.getElementById("fileUpload");
const HORIZONTAL_GRID_BTN = document.getElementById("horizontalGridBtn");
const VERTICAL_GRID_BTN = document.getElementById("verticalGridBtn");
const GRID_SAMPLE_DIVS = document.querySelectorAll(".grid-sample");
const ALL_FILES_LIST_DIVS = document.getElementById("allFilesList");
const GRID_THICKNESS_SLIDER_DIV = document.getElementById("gridThicknessSlider");

// the only event listeners not in these functions are
// - mousemove (used to improve boundary drawing)
// - the initial welcome page
// and we should keep it that way.
function registerDropUploadEventHandlers() {
  FILE_UPLOAD_INPUT.addEventListener("change", (e) => {
    FILE_UPLOAD_INPUT.files[0].text().then(uploadedSvg => importSvg(uploadedSvg));
  });

  document.addEventListener("drop", e => {
    e.preventDefault();

    if (e.dataTransfer.items) {
      [...e.dataTransfer.items].forEach((item, i) => {
        if (item.kind === "file") {
          item.getAsFile().text().then(uploadedSvg => importSvg(uploadedSvg));
        }
      });
    } else {
      [...e.dataTransfer.files].forEach((file, i) => {
        file.text().then(uploadedSvg => importSvg(uploadedSvg));
      });
    }
  });

  document.addEventListener("dragover", e => {
    e.preventDefault();
  });
}

function registerEventListeners() {
  // keyboard shortcuts
  document.addEventListener("keydown", e => {
    if (document.activeElement.tagName == "INPUT") {
      return;
    }
    if (GLOBAL_STATE.keyState.holdingMeta) {
      switch(e.code) {
      case "KeyZ":
        undoLastAction();
        break;
      }
      return;
    }
    switch(e.code) {
    case "Digit0":
      switchToLayer(Layers.GRID);
      break;
    case "Digit1":
      switchToLayer(Layers.COLOR);
      break;
    case "Digit2":
      switchToLayer(Layers.OBJECT);
      break;
    case "Digit3":
      switchToLayer(Layers.PATH);
      break;
    case "Digit4":
      switchToLayer(Layers.BOUNDARY);
      break;
    case "Digit5":
      switchToLayer(Layers.TEXT);
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
    case "MetaLeft":
    case "MetaRight":
  // TODO: use different meta keys based on OS
    case "ControlLeft":
    case "ControlRight":
      GLOBAL_STATE.keyState.holdingMeta = true;
      break;
    }
  });

  document.addEventListener("keyup", e => {
    if (e.code == "MetaLeft" || e.code == "MetaRight" || e.code == "ControlLeft" || e.code == "ControlRight") GLOBAL_STATE.keyState.holdingMeta = false;
    if (e.code == "AltLeft" || e.code == "AltRight") dropTemporaryModes();
  });

  // when window loses focus, reset - otherwise, Cmd+Tab to change windows
  // will continue having holdingMeta after coming back
  document.addEventListener("blur", e => {
    Object.keys(GLOBAL_STATE.keyState).forEach(k => GLOBAL_STATE.keyState[k] = false);
    Object.keys(GLOBAL_STATE.mouseState).forEach(k => GLOBAL_STATE.mouseState[k] = false);
    dropTemporaryModes();
    stopFreeDragging();
  });

  document.addEventListener("mouseleave", e => {
    Object.keys(GLOBAL_STATE.mouseState).forEach(k => GLOBAL_STATE.mouseState[k] = false);
    dropTemporaryModes();
    stopFreeDragging();
  });

  LAYER_PICKER_BUTTONS.forEach(layerPicker => {
    layerPicker.addEventListener("click", (e) => {
      switchToLayer(layerPicker.dataset.layer);
    });
  });

  TOOL_PICKER_BUTTONS.forEach(toolPicker => {
    toolPicker.addEventListener("click", (e) => {
      switchToTool(toolPicker.dataset.tool);
    });
  });

  COLOR_CONTROL_SWATCHES.forEach(swatch => {
    // left click - set as primary color
    swatch.addEventListener("click", (e) => {
      setPrimaryColor(swatch.dataset.color);
    });
    // right click - set as secondary color
    swatch.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      setSecondaryColor(swatch.dataset.color);
    });
  });

  CANVAS_COLOR_SWATCHES.forEach(swatch => {
    swatch.addEventListener("click", e => {
      setCanvasColor(GLOBAL_STATE.layers.GRID.canvasColor, swatch.dataset.color);
    })
  });

  GRID_COLOR_SWATCHES.forEach(swatch => {
    swatch.addEventListener("click", e => {
      setGridColor(GLOBAL_STATE.layers.GRID.gridColor, swatch.dataset.color);
    })
  });

  OBJECT_BUTTONS.forEach(btn => {
    // selecting/unselecting a object/empji/stamp
    btn.addEventListener("click", () => {
      setPrimaryObject(btn.dataset.text);
    });
    btn.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      setSecondaryObject(btn.dataset.text);
    });
  });

  TEXT_BOLD_DIV.addEventListener("click", (e) => {
    TEXT_BOLD_DIV.classList.toggle("selected");
    GLOBAL_STATE.layers.TEXT.bold = !GLOBAL_STATE.layers.TEXT.bold;
  });

  TEXT_ITALICS_DIV.addEventListener("click", (e) => {
    TEXT_ITALICS_DIV.classList.toggle("selected");
    GLOBAL_STATE.layers.TEXT.italics = !GLOBAL_STATE.layers.TEXT.italics;
  });

  TEXT_UNDERLINE_DIV.addEventListener("click", (e) => {
    TEXT_UNDERLINE_DIV.classList.toggle("selected");
    GLOBAL_STATE.layers.TEXT.underline = !GLOBAL_STATE.layers.TEXT.underline;
  });

  HORIZONTAL_GRID_BTN.addEventListener("click", (e) => {
    positionHexes(GridDirection.HORIZONTAL);
    GLOBAL_STATE.drawing.gridDirection = GridDirection.HORIZONTAL;
    HORIZONTAL_GRID_BTN.classList.add("primaryselected");
    VERTICAL_GRID_BTN.classList.remove("primaryselected");
  });

  VERTICAL_GRID_BTN.addEventListener("click", (e) => {
    positionHexes(GridDirection.VERTICAL);
    GLOBAL_STATE.drawing.gridDirection = GridDirection.VERTICAL;
    HORIZONTAL_GRID_BTN.classList.remove("primaryselected");
    VERTICAL_GRID_BTN.classList.add("primaryselected");
  });

  GRID_THICKNESS_SLIDER_DIV.addEventListener("input", e => {
    const thickness = GRID_THICKNESS_SLIDER_DIV.value;
    Object.values(GLOBAL_STATE.drawing.hexes).forEach(hexEntry => {
      hexEntry.hex.setAttribute("stroke-width", `${thickness}px`);
    });
    // addToUndoStack({type: "gridThickness", old: previousThickness, new: thickness});
  });

  document.getElementById("saveBtn").addEventListener("click", (e) => {
    exportToSvg();
  });

  // SVG events listeners
  // mousedown is the big one that coordinates most of the page
  SVG.addEventListener("mousedown", (e) => {
    e.preventDefault();
    if (GLOBAL_STATE.currentTool == Tools.ZOOM && e.buttons < 3) {
      const zoomFactor = .5 * (e.button == 2 ? 1 : -1);
      zoom(zoomFactor, e.clientX, e.clientY);
      return;
    } else if (e.buttons < 3) { // single left/right click
      GLOBAL_STATE.mouseState.holdingStdClick = true;
      // a right mouse down means paint with secondary colors
      GLOBAL_STATE.mouseState.holdingRightClick = (e.button == 2);
      if (e.target.classList.contains("hex")) {
        const hexAtMouse = e.target;
        handleHexInteraction(hexAtMouse.getAttribute("c"), hexAtMouse.getAttribute("r"), e.clientX, e.clientY, true);
      }
    } else if (e.buttons == 4) {
      GLOBAL_STATE.mouseState.holdingCenterClick = true;
      SVG.addEventListener("mousemove", freeDragScroll);
      switchToCursor("move");
    }
  });
  SVG.addEventListener("mouseover", (e) => {
    if (GLOBAL_STATE.currentTool == Tools.ERASER && GLOBAL_STATE.mouseState.holdingStdClick) {
      if (e.target.classList.contains(`eraseable-${GLOBAL_STATE.currentLayer}`)) {
        let undoData = {};
        if (e.target.classList.contains("boundary")) {
          MINIMAP.querySelectorAll(".boundary").forEach(t => {
            if (t.getAttribute("from-crn") == e.target.getAttribute("from-crn") && t.getAttribute("to-crn") == e.target.getAttribute("to-crn") && t.getAttribute("stroke") == e.target.getAttribute("stroke")) {
              MINIMAP.removeChild(t);
            }
          });

          addToUndoStack({
            type: "boundary",
            action: "erased",
            target: {
              fromCRN: e.target.getAttribute("from-crn"),
              toCRN: e.target.getAttribute("to-crn"),
              color: e.target.getAttribute("stroke"),
            },
          });
        } else if (e.target.classList.contains("in-image-text")) {
          addToUndoStack({
            type: "text",
            action: "erased",
            target: {
              pt: {
                x: e.target.getAttribute("x"),
                y: e.target.getAttribute("y"),
              },
              textInput: e.target.textContent,
              fontSize: e.target.getAttribute("font-size"),
              strokeWidth: e.target.getAttribute("stroke-width"),
              fontStyle: e.target.getAttribute("font-style"),
              textDecoration: e.target.getAttribute("text-decoration"),
              color: e.target.getAttribute("fill"),
            },
          });
        } else if (e.target.classList.contains("path-highlight")) {
          const path = SVG.getElementById(`path-${e.target.id}`);
          addToUndoStack({
            type: "path",
            action: "erased",
            target: {
              from: [e.target.getAttribute("c1"), e.target.getAttribute("r1")],
              to: [e.target.getAttribute("c2"), e.target.getAttribute("r2")],
              lineColor: path.getAttribute("stroke"),
              highlightColor: e.target.getAttribute("stroke"),
            },
          });
          SVG.removeChild(path);
        }
        SVG.removeChild(e.target);
      }
    };

    if (GLOBAL_STATE.mouseState.holdingStdClick && e.target.classList.contains("hex")) {
      const hexAtMouse = e.target;
      handleHexInteraction(hexAtMouse.getAttribute("c"), hexAtMouse.getAttribute("r"), e.clientX, e.clientY, false);
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
    GLOBAL_STATE.layers.PATH.activePath = null;
    GLOBAL_STATE.layers.PATH.lastHexEntry = null;
  });

  SVG.addEventListener("contextmenu", e => e.preventDefault());
  SVG.addEventListener("wheel", e => {
    e.preventDefault();
    if (GLOBAL_STATE.keyState.holdingMeta) {
      let scale = e.deltaY / 100;
      scale = Math.abs(scale) > .1 ? .1 * e.deltaY / Math.abs(e.deltaY) : scale;
      zoom(scale, e.clientX, e.clientY);
    } else {
      scroll(e.deltaX, e.deltaY);
    }
  });
}

/*********************************
 * INTERACTING WITH GLOBAL STATE *
 *********************************/
function stopFreeDragging() {
  SVG.removeEventListener("mousemove", freeDragScroll);
  switchToCursor(GLOBAL_STATE.currentTool);
}

function setPrimaryObject(objectText) {
  GLOBAL_STATE.layers.OBJECT.primaryObject = objectText;
  OBJECT_BUTTONS.forEach(b => {
    if (b.dataset.text == objectText) {
      b.classList.add("primaryselected");
    } else {
      b.classList.remove("primaryselected")
    }
  });
}

function setSecondaryObject(objectText) {
  GLOBAL_STATE.layers.OBJECT.secondaryObject = objectText;
  OBJECT_BUTTONS.forEach(b => {
    if (b.dataset.text == objectText) {
      b.classList.add("secondaryselected");
    } else {
      b.classList.remove("secondaryselected")
    }
  });
}

function setPrimaryColor(color) {
  GLOBAL_STATE.layers[GLOBAL_STATE.currentLayer].primaryColor = color;
  CHOSEN_PRIMARY_COLOR_DIV.setAttribute("fill", color);
}

function setSecondaryColor(color) {
  GLOBAL_STATE.layers[GLOBAL_STATE.currentLayer].secondaryColor = color;
  CHOSEN_SECONDARY_COLOR_DIV.setAttribute("fill", color);
}

function switchToLayer(layer) {
  const previousLayer = GLOBAL_STATE.currentLayer;
  GLOBAL_STATE.currentLayer = layer;
  GLOBAL_STATE.currentTool = Tools.BRUSH;
  LAYER_CONTROLS.forEach(mc => {
    if (LAYER_CONTROL_COMPATIBILITY[GLOBAL_STATE.currentLayer].includes(mc.dataset.control)) {
      mc.classList.remove("hidden");
    } else {
      mc.classList.add("hidden");
    }
  });
  TOOL_PICKER_BUTTONS.forEach(tpb => {
    if (LAYER_TOOL_COMPATIBILITY[layer].includes(tpb.dataset.tool)) {
      tpb.classList.remove("disabled-btn");
    } else {
      tpb.classList.add("disabled-btn");
    }
  });
  LAYER_PICKER_BUTTONS.forEach(b => {
    if (b.dataset.layer == layer) {
      b.classList.add("selected")
    } else {
      b.classList.remove("selected");
    }
  });
  document.querySelectorAll(`.layer-${previousLayer}`).forEach(e => {
    e.classList.add("no-pointer-events");
  });
  document.querySelectorAll(`.layer-${layer}`).forEach(e => {
    e.classList.remove("no-pointer-events");
  });
  switchToTool(LAYER_TOOL_COMPATIBILITY[layer][0]);
  setPrimaryColor(GLOBAL_STATE.layers[GLOBAL_STATE.currentLayer].primaryColor);
  setSecondaryColor(GLOBAL_STATE.layers[GLOBAL_STATE.currentLayer].secondaryColor);
}

function switchToCursor(name) {
  Object.keys(Tools).forEach(t => SVG.classList.remove(`${t.toLowerCase()}cursor`));
  SVG.classList.remove("movecursor");
  SVG.classList.add(`${name.toLowerCase()}cursor`);
}

function dropTemporaryModes() {
  if (GLOBAL_STATE.temporaryTool.active) {
    GLOBAL_STATE.temporaryTool.active = false;
    switchToTool(GLOBAL_STATE.temporaryTool.previousTool);
  }
}

function switchToTool(tool, temporarily=false) {
  if (!LAYER_TOOL_COMPATIBILITY[GLOBAL_STATE.currentLayer].includes(tool)) {
    return;
  }

  if (temporarily) {
    GLOBAL_STATE.temporaryTool.previousTool = GLOBAL_STATE.currentTool;
    GLOBAL_STATE.temporaryTool.active = true;
  }

  switchToCursor(tool);
  TOOL_PICKER_BUTTONS.forEach(b => {
    if (b.dataset.tool == tool) {
      b.classList.add("selected")
    } else {
      b.classList.remove("selected");
    }
  });
  if (GLOBAL_STATE.currentLayer == Layers.TEXT) {
    SVG.querySelectorAll(".in-image-text").forEach(t => {
      if (tool == Tools.SELECT && GLOBAL_STATE.currentTool != Tools.SELECT) {
        t.classList.add("allow-pointer-events");
        t.classList.remove("no-pointer-events");
      } else if (tool != Tools.SELECT && GLOBAL_STATE.currentTool == Tools.SELECT) {
        t.classList.remove("allow-pointer-events");
        t.classList.add("no-pointer-events");
      }
    });
  }
  GLOBAL_STATE.currentTool = tool;
}

/************************************************************************
 * SVG UTILS                                                            *
 * - use indices (c,r) instead of coordinates (x,y) as much as possible *
 *   to avoid floating points. (c,r) can be exactly precise - and also  *
 *   will not change over the course of export/import, whereas coords   *
 *   might jiggle around slightly                                       *
 ************************************************************************/
function freeDragScroll(e) {
  scroll(-e.movementX, -e.movementY);
}

function scroll(xdiff, ydiff) {
  const viewBox = SVG.getAttribute("viewBox") || `0 0 ${window.innerWidth} ${window.innerHeight}`;
  const [x, y, width, height] = viewBox.split(" ").map(Number);
  const newX = x + xdiff;
  const newY = y + ydiff;
  SVG.setAttribute("viewBox", `${newX} ${newY} ${width} ${height}`);
  MINIMAP_VIEWBOX.setAttribute("x", newX);
  MINIMAP_VIEWBOX.setAttribute("y", newY);
  MINIMAP_VIEWBOX.setAttribute("width", width);
  MINIMAP_VIEWBOX.setAttribute("height", height);
  MINIMAP.removeChild(MINIMAP_VIEWBOX);
  MINIMAP.appendChild(MINIMAP_VIEWBOX);
}

function zoom(scale, mouseX, mouseY) {
  // mouse point within SVG space. Don't ask, I just copied-pasted
  const pt = new DOMPoint(mouseX, mouseY).matrixTransform(SVG.getScreenCTM().inverse());

  const viewBox = SVG.getAttribute("viewBox") || `0 0 ${window.innerWidth} ${window.innerHeight}`;

  const [x, y, width, height] = viewBox.split(" ").map(Number);

  // new viewbox
  const [width2, height2] = [width + width * scale, height + height * scale];
  // new center of the viewbox
  const [xPropW, yPropH] = [(pt.x - x) / width, (pt.y - y) / height];
  const x2 = pt.x - xPropW * width2;
  const y2 = pt.y - yPropH * height2;
  SVG.setAttribute("viewBox", `${x2} ${y2} ${width2} ${height2}`);
  MINIMAP_VIEWBOX.setAttribute("x", x2);
  MINIMAP_VIEWBOX.setAttribute("y", y2);
  MINIMAP_VIEWBOX.setAttribute("width", width2);
  MINIMAP_VIEWBOX.setAttribute("height", height2);
  MINIMAP.removeChild(MINIMAP_VIEWBOX);
  MINIMAP.appendChild(MINIMAP_VIEWBOX);
}

function getHexNeighbors(_c, _r) {
  const c = parseInt(_c);
  const r = parseInt(_r);
  if (GLOBAL_STATE.drawing.gridDirection == GridDirection.VERTICAL) {
    const offset = (r % 2 == 0) ? -1 : 1;
    return [
      // left and right
      [c-1, r],
      [c+1, r],
      // two to the top
      [c, r-1],
      [c + offset, r-1],
      // two to the bottom
      [c, r+1],
      [c + offset, r+1],
    ];
  }
  const offset = (c % 2 == 0) ? -1 : 1;
  return [
    // up and down
    [c, r-1],
    [c, r+1],
    // two to the left
    [c-1, r],
    [c-1, r + offset],
    // two to the right
    [c+1, r],
    [c+1, r + offset],
  ];
}

function setCanvasColor(previousCanvasColor, color) {
  GRID_SAMPLE_DIVS.forEach(e => e.setAttribute("fill", color));
  if (previousCanvasColor == color) {
    return;
  }
  Object.values(GLOBAL_STATE.drawing.hexes).forEach(hexEntry => {
    if (hexEntry.hex.getAttribute("fill") == previousCanvasColor) {
      hexEntry.hex.setAttribute("fill", color);
      hexEntry.minihex.setAttribute("fill", color);
      hexEntry.minihex.setAttribute("stroke", color);
    }
  });
  GLOBAL_STATE.layers.GRID.canvasColor = color;
  SVG.setAttribute("canvasColor", color);
  addToUndoStack({type: "canvasColor", old: previousCanvasColor, new: color});
}

function setGridColor(previousGridColor, color) {
  Object.values(GLOBAL_STATE.drawing.hexes).forEach(hexEntry => {
    hexEntry.hex.setAttribute("stroke", color);
    hexEntry.minihex.setAttribute("stroke", color);
  });
  GRID_SAMPLE_DIVS.forEach(e => e.setAttribute("stroke", color))
  GLOBAL_STATE.layers.GRID.gridColor = color;
  SVG.setAttribute("gridColor", color);
  addToUndoStack({type: "gridColor", old: previousGridColor, new: color});
}

function colorHex(c, r, fillColor=null, isFloodFill=false) {
  if (!fillColor) {
    fillColor = GLOBAL_STATE.mouseState.holdingRightClick ? GLOBAL_STATE.layers.COLOR.secondaryColor : GLOBAL_STATE.layers.COLOR.primaryColor;
  }
  const oldFillColor = GLOBAL_STATE.drawing.hexes[`${c},${r}`].hex.getAttribute("fill");
  if (oldFillColor == fillColor) {
    return;
  }
  GLOBAL_STATE.drawing.hexes[`${c},${r}`].hex.setAttribute("fill", fillColor);
  GLOBAL_STATE.drawing.hexes[`${c},${r}`].minihex.setAttribute("fill", fillColor);
  if (!isFloodFill) {
    addToUndoStack({type: "color", old: oldFillColor, new: fillColor, target: [c, r]});
  }
  // easy way to test hex neighbor logic
  // getHexNeighbors(c, r).forEach(h => {
  //   console.log(h)
  //   const neighborhex = GLOBAL_STATE.drawing.hexes[`${h[0]},${h[1]}`].hex;
  //   neighborhex.setAttribute("fill", "black");
  // });
}

function floodFill(startC, startR, fn) {
  const queue = [[startC, startR]];
  const visited = [`${startC},${startR}`];
  const expectedFill = GLOBAL_STATE.drawing.hexes[`${startC},${startR}`].hex.getAttribute("fill");
  while (queue.length > 0) {
    const [c, r] = queue.shift();
    getHexNeighbors(c, r).forEach(n => {
      const stringedCoords = `${n[0]},${n[1]}`;
      if (visited.includes(stringedCoords)) return;
      const nhexentry = GLOBAL_STATE.drawing.hexes[stringedCoords];
      if (nhexentry == null) return;
      const nhex = nhexentry.hex;
      if (nhex.getAttribute("fill") != expectedFill) return
      queue.push(n);
      visited.push(stringedCoords);
    });
  }
  visited.forEach(s => fn(...s.split(","), null, true));
  // addToUndoStack({type: "floodFill", old: oldFillColor, new: fillColor, target: [c, r]});
}

function placeObjectOnHex(c, r, objectToUse=null) {
  if (objectToUse === null) {
    objectToUse = GLOBAL_STATE.mouseState.holdingRightClick ? GLOBAL_STATE.layers.OBJECT.secondaryObject : GLOBAL_STATE.layers.OBJECT.primaryObject;
  }
  const oldObject = GLOBAL_STATE.drawing.hexes[`${c},${r}`].hexObject.textContent;
  if (oldObject == objectToUse) {
    return;
  }

  GLOBAL_STATE.drawing.hexes[`${c},${r}`].hexObject.textContent = objectToUse;
  addToUndoStack({type: "object", old: oldObject, new: objectToUse, target: [c, r]});
}

// to avoid using floating points in the source of truth/identification, we use
// a tuple of (c, r, n): (c, r) identifies a hex, n is the index of the vertex.
// While a single vertex could belong to three potential hexes, that doesn't
// matter - we just need any one. This also helps us avoid depending on coordinates
// during import/export, instead relying on (c, r) like we do everywhere
function drawBoundaryLine(fromCRN, toCRN, color) {
  const fromHexVertex = GLOBAL_STATE.drawing.hexes[`${fromCRN.c},${fromCRN.r}`].hex.points[fromCRN.n];
  const toHexVertex = GLOBAL_STATE.drawing.hexes[`${toCRN.c},${toCRN.r}`].hex.points[toCRN.n];
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  const fromCRNStr = `${fromCRN.c},${fromCRN.r},${fromCRN.n}`;
  const toCRNStr = `${toCRN.c},${toCRN.r},${toCRN.n}`
  line.setAttribute("x1", fromHexVertex.x);
  line.setAttribute("y1", fromHexVertex.y);
  line.setAttribute("x2", toHexVertex.x);
  line.setAttribute("y2", toHexVertex.y);
  line.setAttribute("from-crn", fromCRNStr);
  line.setAttribute("to-crn", toCRNStr);
  line.setAttribute("stroke", color);
  line.setAttribute("stroke-width", 9);
  line.setAttribute("stroke-linecap", "round");
  line.classList.add("boundary");
  line.classList.add(`eraseable-${Layers.BOUNDARY}`);
  line.classList.add(`layer-${Layers.BOUNDARY}`);
  SVG.appendChild(line);
  minimapLine = line.cloneNode(true);
  minimapLine.setAttribute("stroke-width", 20);
  MINIMAP.appendChild(minimapLine);
  addToUndoStack({type: "boundary", action: "added", target: {fromCRN: fromCRNStr, toCRN: toCRNStr, color}});
}

function drawBoundary(e) {
  const currentHex = e.target;
  const lastCRN = GLOBAL_STATE.layers.BOUNDARY.lastCRN;
  // if we're not on one of the neigh of the lastCRN, do nothing. Cuts a lot of calculations
  if (!currentHex.classList.contains("hex") || Math.abs(lastCRN.c - currentHex.getAttribute("c")) > 1 || Math.abs(lastCRN.r - currentHex.getAttribute("r")) > 1) {
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
    if (Math.abs(currentHex.points[i].x - pt.x) < HEX_RADIUS && Math.abs(currentHex.points[i].y - pt.y) < HEX_RADIUS) {
      const distance = (currentHex.points[i].x - pt.x) ** 2 + (currentHex.points[i].y - pt.y) ** 2;
      if (distance < closestDistance) {
        closestN = i;
        closestDistance = distance;
      }
    }
  }
  const closestCRN = {c: currentHex.getAttribute("c"), r: currentHex.getAttribute("r"), n: closestN};

  // we only want to draw boundary lines on top of existing hex edges.
  // we already know that our vertices are on hex vertices. If the distance
  // is within a unit of the hex radius, that means this must be a hex edge
  const lastBoundaryPoint = GLOBAL_STATE.drawing.hexes[`${lastCRN.c},${lastCRN.r}`].hex.points[lastCRN.n];
  const nextBoundaryPoint = GLOBAL_STATE.drawing.hexes[`${closestCRN.c},${closestCRN.r}`].hex.points[closestCRN.n];
  const lineLength = (lastBoundaryPoint.x - nextBoundaryPoint.x) ** 2 + (lastBoundaryPoint.y - nextBoundaryPoint.y) ** 2;
  if (Math.abs(lineLength - HEX_RADIUS_SQUARED) > 5) {
    return
  }
  const strokeColor = GLOBAL_STATE.mouseState.holdingRightClick ? GLOBAL_STATE.layers.BOUNDARY.secondaryColor : GLOBAL_STATE.layers.BOUNDARY.primaryColor;
  drawBoundaryLine(lastCRN, closestCRN, strokeColor);
  GLOBAL_STATE.layers.BOUNDARY.lastCRN = closestCRN;
}

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
  GLOBAL_STATE.layers.BOUNDARY.lastCRN = {c: hexEntry.c, r: hexEntry.r, n: closestN};

  // our primary mouseover event isn't good enough, since it only fires once per hex
  // at the same time, having a mousemove main loop is just wasteful. so add a special
  // listened just during boundary drawing, then remove it once drawn
  SVG.addEventListener("mousemove", drawBoundary);
}

function drawLineAndHighlight(fromHexEntry, toHexEntry, lineColor, highlightColor) {
  const id = crypto.randomUUID();
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("fill", "none");
  line.setAttribute("stroke-dasharray", 10);
  line.setAttribute("stroke-linecap", "round");
  line.setAttribute("stroke-linejoin", "round");
  line.setAttribute("stroke-width", 3);
  line.setAttribute("stroke", lineColor);
  line.setAttribute("x1", fromHexEntry.x);
  line.setAttribute("y1", fromHexEntry.y);
  line.setAttribute("c1", fromHexEntry.c);
  line.setAttribute("r1", fromHexEntry.r);
  line.setAttribute("x2", toHexEntry.x);
  line.setAttribute("y2", toHexEntry.y);
  line.setAttribute("c2", toHexEntry.c);
  line.setAttribute("r2", toHexEntry.r);
  line.classList.add("path");
  line.classList.add(`layer-${Layers.PATH}`);
  line.id = `path-${id}`;

  const lineHighlight = document.createElementNS("http://www.w3.org/2000/svg", "line");
  lineHighlight.setAttribute("fill", "none");
  lineHighlight.setAttribute("stroke-linecap", "round");
  lineHighlight.setAttribute("stroke-linejoin", "round");
  lineHighlight.setAttribute("stroke-width", 7);
  lineHighlight.setAttribute("stroke-opacity", 0.5);
  lineHighlight.setAttribute("stroke", highlightColor);
  lineHighlight.setAttribute("x1", fromHexEntry.x);
  lineHighlight.setAttribute("y1", fromHexEntry.y);
  lineHighlight.setAttribute("c1", fromHexEntry.c);
  lineHighlight.setAttribute("r1", fromHexEntry.r);
  lineHighlight.setAttribute("x2", toHexEntry.x);
  lineHighlight.setAttribute("y2", toHexEntry.y);
  lineHighlight.setAttribute("c2", toHexEntry.c);
  lineHighlight.setAttribute("r2", toHexEntry.r);
  lineHighlight.classList.add("path-highlight");
  lineHighlight.classList.add(`eraseable-${Layers.PATH}`);
  lineHighlight.classList.add(`layer-${Layers.PATH}`);
  lineHighlight.id = id;

  addToUndoStack({type: "path", action: "added", target: {from: [fromHexEntry.c, fromHexEntry.r], to: [toHexEntry.c, toHexEntry.r], lineColor, highlightColor}});
  SVG.appendChild(lineHighlight);
  SVG.appendChild(line);
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

function placeTextWithConfig(pt, textInput, fontSize, strokeWidth, fontStyle, textDecoration, color) {
  const textbox = document.createElementNS("http://www.w3.org/2000/svg", "text");
  textbox.setAttribute("font-size", fontSize);
  if (strokeWidth) {
    textbox.setAttribute("stroke-width", "0.5");
  }
  if (fontStyle) {
    textbox.setAttribute("font-style", "italic");
  }
  if (textDecoration) {
    textbox.setAttribute("text-decoration", "underline");
  }

  textbox.setAttribute("x", pt.x);
  textbox.setAttribute("y", pt.y);
  textbox.setAttribute("fill", color);
  textbox.textContent = textInput;
  textbox.classList.add("in-image-text");
  textbox.classList.add(`eraseable-${Layers.TEXT}`);
  textbox.classList.add(`layer-${Layers.TEXT}`);
  addToUndoStack({
    type: "text",
    action: "added",
    target: {pt, textInput, fontSize, strokeWidth, fontStyle, textDecoration, color}
  });
  SVG.appendChild(textbox);
}

function placeText(pt) {
  const textInput = TEXT_INPUT_DIV.value;
  if (!textInput) {
    return;
  }
  const strokeWidth = GLOBAL_STATE.layers.TEXT.bold ? "0.5" : null;
  const fontStyle = GLOBAL_STATE.layers.TEXT.italics ? "italics" : null;
  const textDecoration = GLOBAL_STATE.layers.TEXT.underline ? "underline" : null;
  placeTextWithConfig(
    pt, textInput,
    TEXT_FONT_SIZE_DIV.value,
    strokeWidth, fontStyle, textDecoration,
    GLOBAL_STATE.layers.TEXT.primaryColor
  )
}

function handleHexInteraction(c, r, mouseX, mouseY, isClick) {
  const hexEntry = GLOBAL_STATE.drawing.hexes[`${c},${r}`];
  const {hex, x, y} = hexEntry;
  if (GLOBAL_STATE.currentLayer == Layers.COLOR) {
    if (GLOBAL_STATE.currentTool == Tools.BRUSH) {
      colorHex(c, r);
    } else if (GLOBAL_STATE.currentTool == Tools.FILL) {
      floodFill(c, r, colorHex);
    } else if (GLOBAL_STATE.currentTool == Tools.ERASER) {
      colorHex(c, r, GLOBAL_STATE.layers.GRID.canvasColor);
    } else if (GLOBAL_STATE.currentTool == Tools.EYEDROPPER) {
      if (GLOBAL_STATE.mouseState.holdingRightClick) {
        setSecondaryColor(hex.getAttribute("fill"));
      } else {
        setPrimaryColor(hex.getAttribute("fill"));
      }
    }
  } else if (GLOBAL_STATE.currentLayer == Layers.OBJECT) {
    if (GLOBAL_STATE.layers.OBJECT.primaryObject == null) {
      return;
    }
    if (GLOBAL_STATE.currentTool == Tools.BRUSH) {
      placeObjectOnHex(c, r);
    } else if (GLOBAL_STATE.currentTool == Tools.EYEDROPPER) {
      if (GLOBAL_STATE.mouseState.holdingRightClick) {
        setSecondaryObject(GLOBAL_STATE.drawing.hexes[`${c},${r}`].hexObject.textContent);
      } else {
        setPrimaryObject(GLOBAL_STATE.drawing.hexes[`${c},${r}`].hexObject.textContent);
      }
    } else if (GLOBAL_STATE.currentTool == Tools.ERASER) {
      placeObjectOnHex(c, r, "");
    }
  } else if (GLOBAL_STATE.currentLayer == Layers.BOUNDARY) {
    if (GLOBAL_STATE.currentTool == Tools.BRUSH) {
      startBoundaryDrawing(hexEntry, mouseX, mouseY);
    }
  } else if (GLOBAL_STATE.currentLayer == Layers.TEXT) {
    if (GLOBAL_STATE.currentTool == Tools.BRUSH) {
      const pt = new DOMPoint(mouseX, mouseY).matrixTransform(SVG.getScreenCTM().inverse());
      placeText(pt);
    }
  } else if (GLOBAL_STATE.currentLayer == Layers.PATH) {
    if (GLOBAL_STATE.currentTool == Tools.BRUSH) {
      drawPath(hexEntry);
    }
  }
}

function hexIndexToPixel(c, r, gridDirection) {
  if (gridDirection == GridDirection.VERTICAL) {
    const x = HEX_RADIUS * Math.sqrt(3) * (c + 0.5 * (r % 2));
    const y = HEX_RADIUS * 3/2 * r;
    return {x, y};
  }
  const x = HEX_RADIUS * 3/2 * c;
  const y = HEX_RADIUS * Math.sqrt(3) * (r + 0.5 * (c % 2));
  return {x, y};
}

function getHexVertixes(c, r, gridDirection) {
  const {x, y} = hexIndexToPixel(c, r, gridDirection);
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 3 * i;
    if (gridDirection == GridDirection.VERTICAL) {
      const px = x + HEX_RADIUS * Math.sin(angle);
      const py = y + HEX_RADIUS * Math.cos(angle);
      points.push(`${px},${py}`);
    } else {
      const px = x + HEX_RADIUS * Math.cos(angle);
      const py = y + HEX_RADIUS * Math.sin(angle);
      points.push(`${px},${py}`);
    }
  }
  return {x, y, points};
}

function positionHexes(gridDirection) {
  Object.values(GLOBAL_STATE.drawing.hexes).forEach(hexEntry => {
    const {x, y, points} = getHexVertixes(hexEntry.c, hexEntry.r, gridDirection);
    hexEntry.x = x;
    hexEntry.y = y;
    hexEntry.hex.setAttribute("x", x);
    hexEntry.hex.setAttribute("y", y);
    hexEntry.hex.setAttribute("points", points.join(" "));
    hexEntry.hexObject.setAttribute("x", x);
    hexEntry.hexObject.setAttribute("y", y);
  });
}

function drawHex(c, r) {
  const hex = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  hex.setAttribute("stroke-width", GLOBAL_STATE.layers.GRID.gridThickness);
  hex.setAttribute("c", c);
  hex.setAttribute("r", r);
  hex.classList.add("hex");

  const hexObject = document.createElementNS("http://www.w3.org/2000/svg", "text");
  hexObject.setAttribute("c", c);
  hexObject.setAttribute("r", r);
  hexObject.setAttribute("text-anchor", "middle");
  hexObject.setAttribute("dominant-baseline", "central");
  hexObject.setAttribute("font-size", `${HEX_RADIUS}px`);
  hexObject.setAttribute("width", `${2*HEX_RADIUS}px`);
  hexObject.setAttribute("height", `${2*HEX_RADIUS}px`);
  hexObject.classList.add("no-pointer-events");
  hexObject.classList.add("hex-object");
  hexObject.classList.add(`layer-${Layers.OBJECT}`);

  SVG.appendChild(hex);
  SVG.appendChild(hexObject);

  GLOBAL_STATE.drawing.hexes[`${c},${r}`] = {hex, hexObject, x: null, y: null, c, r};
}

function initMiniMap(x, y, width, height) {
  MINIMAP.querySelectorAll(".minihex").forEach(e => {
    MINIMAP.removeChild(e)
  });
  Object.values(GLOBAL_STATE.drawing.hexes).forEach(hexEntry => {
    let pointsStr = "";
    for (let i = 0; i < hexEntry.hex.points.length; i++) {
      pointsStr += `${hexEntry.hex.points[i].x},${hexEntry.hex.points[i].y} `
    }
    const minihex = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    minihex.setAttribute("stroke-width", "1px");
    minihex.setAttribute("c", hexEntry.c);
    minihex.setAttribute("r", hexEntry.r);
    minihex.setAttribute("points", pointsStr);
    minihex.setAttribute("fill", hexEntry.hex.getAttribute("fill"));
    minihex.classList.add("minihex");
    hexEntry.minihex = minihex;
    MINIMAP.appendChild(minihex);
  });
  const minibbox = MINIMAP.getBBox();
  MINIMAP.setAttribute("viewBox", `${minibbox.x} ${minibbox.y} ${minibbox.width} ${minibbox.height}`);
  MINIMAP_VIEWBOX.setAttribute("x", x);
  MINIMAP_VIEWBOX.setAttribute("y", y);
  MINIMAP_VIEWBOX.setAttribute("width", width)
  MINIMAP_VIEWBOX.setAttribute("height", height);
  MINIMAP.removeChild(MINIMAP_VIEWBOX);
  MINIMAP.appendChild(MINIMAP_VIEWBOX);
}

function svgInit() {
  GLOBAL_STATE.pauseUndoStack = true;
  SVG.setAttribute("gridDirection", GLOBAL_STATE.drawing.gridDirection);
  SVG.setAttribute("uuid", GLOBAL_STATE.drawing.uuid);
  SVG.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  for (let h in GLOBAL_STATE.drawing.hexes) delete GLOBAL_STATE.drawing.hexes[h];
  Array.prototype.slice.call(document.getElementsByTagName("polygon")).forEach(e => e.remove());

  for (let c = 0; c < GLOBAL_STATE.layers.GRID.cols; c++) {
    for (let r = 0; r < GLOBAL_STATE.layers.GRID.rows; r++) {
      drawHex(c, r);
    }
  }
  positionHexes(GLOBAL_STATE.drawing.gridDirection);
  const bbox = SVG.getBBox();
  const midX = (bbox.width - window.innerWidth) / 2;
  const midY = (bbox.height - window.innerHeight) / 2;
  SVG.setAttribute(
    "viewBox",
    `${midX} ${midY} ${window.innerWidth} ${window.innerHeight}`
  );

  initMiniMap(midX, midY, window.innerWidth, window.innerHeight);

  setCanvasColor(null, GLOBAL_STATE.layers.GRID.canvasColor);
  setGridColor(null, GLOBAL_STATE.layers.GRID.gridColor);
  setPrimaryObject(GLOBAL_STATE.layers.OBJECT.primaryObject);
  setSecondaryObject(GLOBAL_STATE.layers.OBJECT.secondaryObject);

  TEXT_FONT_SIZE_DIV.value = DEFAULT_TEXT_FONT_SIZE;
  GRID_THICKNESS_SLIDER_DIV.value = GLOBAL_STATE.layers.GRID.gridThickness;
  HORIZONTAL_GRID_BTN.classList.add("primaryselected");

  switchToLayer(Layers.COLOR);
  GLOBAL_STATE.pauseUndoStack = false;
  // smolbean grid for inspection ease
  // for (let c = 3; c < 13; c++) {
  //   for (let r = 3; r < 13; r++) {
  //     drawHex(c, r);
  //   }
  // }
}

/*************************
 * EXTRA FUNCTIONALITIES *
 *************************/
function addToUndoStack(action) {
  if (GLOBAL_STATE.pauseUndoStack) {
    return ;
  }
  GLOBAL_STATE.undoStack.push(action);
}

function undoLastAction() {
  const lastAction = GLOBAL_STATE.undoStack.pop();
  if (!lastAction) {
    return;
  }
  GLOBAL_STATE.pauseUndoStack = true;
  switch(lastAction.type) {
  // {type: "canvasColor", old, new}
  case "canvasColor":
    setCanvasColor(lastAction.new, lastAction.old);
    break;
  // {type: "gridColor", old, new}
  case "gridColor":
    setGridColor(lastAction.new, lastAction.old);
    break;
  // {type: "color", old, new, target: [c, r]}
  case "color":
    colorHex(lastAction.target[0], lastAction.target[1], lastAction.old);
    break;
  // {type: "object", old, new, target: [c, r]}
  case "object":
    placeObjectOnHex(lastAction.target[0], lastAction.target[1], lastAction.old);
    break;
  // {type: "boundary", target: {fromCRN, toCRN, color}}
  case "boundary": {
    const action = lastAction.action;
    const target = lastAction.target;
    if (action == "added") {
      SVG.querySelectorAll(".boundary").forEach(t => {
        if (t.getAttribute("from-crn") == target.fromCRN && t.getAttribute("to-crn") == target.toCRN && t.getAttribute("stroke") == target.color) {
          SVG.removeChild(t);
        }
      });
      MINIMAP.querySelectorAll(".boundary").forEach(t => {
        if (t.getAttribute("from-crn") == target.fromCRN && t.getAttribute("to-crn") == target.toCRN && t.getAttribute("stroke") == target.color) {
          MINIMAP.removeChild(t);
        }
      });
    } else if (action == "erased") {
      const fromCRNArr = target.fromCRN.split(",");
      const toCRNArr = target.toCRN.split(",");
      drawBoundaryLine(
        {c: fromCRNArr[0], r: fromCRNArr[1], n: fromCRNArr[2]},
        {c: toCRNArr[0], r: toCRNArr[1], n: toCRNArr[2]},
        target.color,
      );
    }
    break;
  }
  // {type: "text", target: {pt, textInput, fontSize, strokeWidth, fontStyle, textDecoration, color}}
  case "text": {
    const action = lastAction.action;
    const target = lastAction.target;
    if (action == "added") {
      SVG.querySelectorAll(".in-image-text").forEach(t => {
        if (t.getAttribute("x") == target.pt.x && t.getAttribute("y") == target.pt.y && t.getAttribute("fill") == target.color && t.textContent == target.textInput) {
          SVG.removeChild(t);
        }
      });
    } else if (action == "erased") {
      placeTextWithConfig(target.pt, target.textInput, target.fontSize, target.strokeWidth, target.fontStyle, target.textDecoration, target.color);
    }
    break;
  }
  // {type: "path", target: {from: [c, r], to: [c, r], lineColor, highlightColor}}
  case "path": {
    const action = lastAction.action;
    const target = lastAction.target;
    if (action == "added") {
      SVG.querySelectorAll(".path-highlight, .path").forEach(e => {
        if (e.getAttribute("c1") == target.from[0] && e.getAttribute("r1") == target.from[1]
          && e.getAttribute("c2") == target.to[0] && e.getAttribute("r2") == target.to[1]) {
            if ((e.classList.contains("path") && e.getAttribute("stroke") == target.lineColor)
              || (e.classList.contains("path-highlight") && e.getAttribute("stroke") == target.highlightColor)) {
                SVG.removeChild(e);
              }
          }
      });
    } else if (action == "erased") {
      drawLineAndHighlight(
        GLOBAL_STATE.drawing.hexes[`${target.from[0]},${target.from[1]}`],
        GLOBAL_STATE.drawing.hexes[`${target.to[0]},${target.to[1]}`],
        target.lineColor, target.highlightColor
      );
    }
    break;
  }
  }
  GLOBAL_STATE.pauseUndoStack = false;
}

function saveToLocalStorage() {
  localStorage.setItem(`image-${GLOBAL_STATE.drawing.uuid}`, SVG.outerHTML);
}

function loadFromLocalStorage(uuid) {
  importSvg(localStorage.getItem(`image-${uuid}`), false);
}

function importSvg(svgStr, shouldPersist=true) {
  const parser = new DOMParser();
  const uploadedSvg = parser.parseFromString(svgStr, "image/svg+xml").documentElement;
  GLOBAL_STATE.drawing.uuid = uploadedSvg.getAttribute("uuid");
  GLOBAL_STATE.drawing.gridDirection = uploadedSvg.getAttribute("gridDirection");
  SVG.innerHTML = uploadedSvg.innerHTML;

  let numRows = 0;
  let numCols = 0;

  // populate the hex metadata
  SVG.querySelectorAll(".hex").forEach(hex => {
    const c = hex.getAttribute("c");
    const r = hex.getAttribute("r");
    const x = hex.getAttribute("x");
    const y = hex.getAttribute("y");
    numRows = Math.max(numRows, r + 1);
    numCols = Math.max(numCols, c + 1);
    GLOBAL_STATE.drawing.hexes[`${c},${r}`] = {hex, x, y, c, r};
  });
  SVG.querySelectorAll(".hex-object").forEach(hexObject => {
    const c = hexObject.getAttribute("c");
    const r = hexObject.getAttribute("r");
    GLOBAL_STATE.drawing.hexes[`${c},${r}`].hexObject = hexObject;
  });
  GLOBAL_STATE.layers.GRID.rows = numRows;
  GLOBAL_STATE.layers.GRID.cols = numCols;

  initMiniMap(SVG.viewBox.baseVal.x, SVG.viewBox.baseVal.y, SVG.viewBox.baseVal.width, SVG.viewBox.baseVal.height);
  setCanvasColor(null, uploadedSvg.getAttribute("canvasColor"));
  setGridColor(null, uploadedSvg.getAttribute("gridColor"));
  switchToLayer(Layers.COLOR);
  clearWelcomeScreen();
  // if (shouldPersist) {
  //   saveToLocalStorage()
  // }
}

function exportToSvg() {
  const clonedSvg = SVG.cloneNode(true);
  const bbox = SVG.getBBox();
  clonedSvg.setAttribute("viewBox", `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
  const svgData = clonedSvg.outerHTML;
  const preface = '<?xml version="1.0" standalone="no"?>\r\n';
  const svgBlob = new Blob([preface, svgData], {type:"image/svg+xml;charset=utf-8"});
  const svgUrl = URL.createObjectURL(svgBlob);
  const downloadLink = document.createElement("a");
  downloadLink.href = svgUrl;
  downloadLink.download = name;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
}

function clearWelcomeScreen() {
  document.getElementById("welcomeContainer").classList.add("hidden");
  document.getElementById("hexaggon").classList.remove("frosted");
}

function start(e) {
  clearWelcomeScreen();
  document.removeEventListener("click", start);
  registerEventListeners();
}

registerDropUploadEventHandlers();
svgInit();
document.addEventListener("click", start);
// Object.keys(localStorage).forEach(k => {
//   if (k.startsWith("image-")) {
//     const div = document.createElement('div');
//     div.textContent = k;
//     ALL_FILES_LIST_DIVS.appendChild(div);
//   }
// })
