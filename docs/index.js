/******************
 * GAME CONSTANTS *
 ******************/
const HEX_RADIUS = 35;
const HEX_RADIUS_SQUARED = HEX_RADIUS ** 2;  // to avoid sqrt in distance calculations
const HEX_COLS = 3 * Math.ceil(window.innerWidth / (HEX_RADIUS * 1.5));
const HEX_ROWS = 3 * Math.ceil(window.innerHeight / (Math.sqrt(3) * HEX_RADIUS));

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
  GRIDDIRECTION: "GRIDDIRECTION",
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
  [Layers.GRID]: [Controls.COLOR, Controls.GRIDDIRECTION],
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

  // each element is {type, old, new}
  pauseUndoStack: false,  // to prevent adding actions to undo stack, during init/undo
  undoStack: [],
  redoStack: [],

  layers: {
    GRID: {
      primaryColor: "#c4b9a5",
      secondaryColor: "#000000",
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
      lastBoundaryPoint: null,
      lastHexEntry: null,
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
const SWATCHES = document.querySelectorAll(".swatch");
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
const GRID_SAMPLE_DIVS = document.querySelectorAll(".grid-sample")

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
    GLOBAL_STATE.keyState.holdingMeta = true;
    break;
  }
});

document.addEventListener("keyup", e => {
  if (e.code == "MetaLeft" || e.code == "MetaRight") GLOBAL_STATE.keyState.holdingMeta = false;
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

SWATCHES.forEach(swatch => {
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
  GLOBAL_STATE.drawing.gridDirection = GridDirection.HORIZONTAL;
  HORIZONTAL_GRID_BTN.classList.add("primaryselected");
  VERTICAL_GRID_BTN.classList.remove("primaryselected");
  svgInit();
  switchToLayer(Layers.GRID);
});

VERTICAL_GRID_BTN.addEventListener("click", (e) => {
  GLOBAL_STATE.drawing.gridDirection = GridDirection.VERTICAL;
  HORIZONTAL_GRID_BTN.classList.remove("primaryselected");
  VERTICAL_GRID_BTN.classList.add("primaryselected");
  svgInit();
  switchToLayer(Layers.GRID);
});

document.getElementById("saveBtn").addEventListener("click", (e) => {
  exportToSvg();
});

FILE_UPLOAD_INPUT.addEventListener("change", (e) => {
  FILE_UPLOAD_INPUT.files[0].text().then(uploadedSvg => importSvg(uploadedSvg));
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
      SVG.removeChild(e.target);
    }
  };

  if (GLOBAL_STATE.mouseState.holdingStdClick && e.target.classList.contains("hex")) {
    const hexAtMouse = e.target;
    handleHexInteraction(hexAtMouse.getAttribute("c"), hexAtMouse.getAttribute("r"), e.clientX, e.clientY, false);
  }
});
SVG.addEventListener("mouseup", () => {
  if (GLOBAL_STATE.layers.BOUNDARY.lastBoundaryPoint) {
    SVG.removeEventListener("mousemove", drawBoundary);
  }
  if (GLOBAL_STATE.mouseState.holdingCenterClick) {
    stopFreeDragging();
  }
  GLOBAL_STATE.mouseState.holdingStdClick = false;
  GLOBAL_STATE.mouseState.holdingCenterClick = false;
  GLOBAL_STATE.layers.BOUNDARY.lastBoundaryPoint = null;
  GLOBAL_STATE.layers.BOUNDARY.lastHexEntry = null;
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
SVG.addEventListener("drop", e => {
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
SVG.addEventListener("dragover", e => {
  e.preventDefault();
});

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
  if (GLOBAL_STATE.currentLayer == Layers.GRID) {
    setCanvasColor(GLOBAL_STATE.layers.GRID.primaryColor, color);
  }
  GLOBAL_STATE.layers[GLOBAL_STATE.currentLayer].primaryColor = color;
  CHOSEN_PRIMARY_COLOR_DIV.setAttribute("fill", color);
}

function setSecondaryColor(color) {
  if (GLOBAL_STATE.currentLayer == Layers.GRID) {
    setGridColor(GLOBAL_STATE.layers[GLOBAL_STATE.currentLayer].secondaryColor, color);
  }
  GLOBAL_STATE.layers[GLOBAL_STATE.currentLayer].secondaryColor = color;
  CHOSEN_SECONDARY_COLOR_DIV.setAttribute("fill", color);
}

function switchToLayer(layer) {
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

/*************
 * SVG UTILS *
 *************/
function freeDragScroll(e) {
  scroll(-e.movementX, -e.movementY);
}

function scroll(xdiff, ydiff) {
  const viewBox = SVG.getAttribute("viewBox") || `0 0 ${window.innerWidth} ${window.innerHeight}`;
  const [x, y, width, height] = viewBox.split(" ").map(Number);
  SVG.setAttribute("viewBox", `${x + xdiff} ${y + ydiff} ${width} ${height}`);
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
}

function hexIndexToPixel(c, r) {
  if (GLOBAL_STATE.drawing.gridDirection == GridDirection.VERTICAL) {
    const x = HEX_RADIUS * Math.sqrt(3) * (c + 0.5 * (r % 2));
    const y = HEX_RADIUS * 3/2 * r;
    return {x, y};
  }
  const x = HEX_RADIUS * 3/2 * c;
  const y = HEX_RADIUS * Math.sqrt(3) * (r + 0.5 * (c % 2));
  return {x, y};
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
    if (hexEntry.hex.getAttribute("fill") == previousCanvasColor)
      hexEntry.hex.setAttribute("fill", color);
  });
  SVG.setAttribute("canvasColor", color);
  addToUndoStack({"type": "canvasColor", "old": previousCanvasColor, "new": color});
}

function setGridColor(previousGridColor, color) {
  Object.values(GLOBAL_STATE.drawing.hexes).forEach(hexEntry => {
    hexEntry.hex.setAttribute("stroke", color);
  });
  GRID_SAMPLE_DIVS.forEach(e => e.setAttribute("stroke", color))
  SVG.setAttribute("gridColor", color);
  addToUndoStack({"type": "gridColor", "old": previousGridColor, "new": color});
}

function colorHex(c, r, fillColor=null) {
  if (!fillColor) {
    fillColor = GLOBAL_STATE.mouseState.holdingRightClick ? GLOBAL_STATE.layers.COLOR.secondaryColor : GLOBAL_STATE.layers.COLOR.primaryColor;
  }
  const oldFillColor = GLOBAL_STATE.drawing.hexes[`${c},${r}`].hex.getAttribute("fill");
  if (oldFillColor == fillColor) {
    return;
  }
  GLOBAL_STATE.drawing.hexes[`${c},${r}`].hex.setAttribute("fill", fillColor);
  // TODO: undo for floodfill
  addToUndoStack({"type": "color", "old": oldFillColor, "new": fillColor, "target": [c, r]});
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
  visited.forEach(s => fn(...s.split(",")));
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
  addToUndoStack({"type": "object", "old": oldObject, "new": objectToUse, "target": [c, r]});
}

function drawBoundary(e) {
  const pt = new DOMPoint(e.x, e.y).matrixTransform(SVG.getScreenCTM().inverse());
  const lastHexEntry = GLOBAL_STATE.layers.BOUNDARY.lastHexEntry;
  let closest = null;
  let closestDistance = Infinity;
  let closestHexEntry = null;
  getHexNeighbors(lastHexEntry.c, lastHexEntry.r).forEach(n => {
    const hexnEntry = GLOBAL_STATE.drawing.hexes[`${n[0]},${n[1]}`];
    const hexn = GLOBAL_STATE.drawing.hexes[`${n[0]},${n[1]}`].hex;
    for (let i = 0; i < hexn.points.length; i++) {
      // first, check that the point is even a neighbor - since we know it's a hex vertex, it must
      // be within HEX_RADIUS distance in both dimensions. This helps cut down how much squaring we
      // have to do
      if (Math.abs(hexn.points[i].x - pt.x) < HEX_RADIUS && Math.abs(hexn.points[i].y - pt.y) < HEX_RADIUS ) {
        const distance = (hexn.points[i].x - pt.x) ** 2 + (hexn.points[i].y - pt.y) ** 2;
        if (distance < closestDistance) {
          closest = hexn.points[i];
          closestDistance = distance;
          closestHexEntry = hexnEntry;
        }
      }
    }
  });

  // we only want to draw boundary lines on top of existing hex edges.
  // we already know that our vertices are on hex vertices. If the distance
  // is within a unit of the hex radius, that means this must be a hex edge
  const lineLength = (GLOBAL_STATE.layers.BOUNDARY.lastBoundaryPoint.x - closest.x) ** 2 + (GLOBAL_STATE.layers.BOUNDARY.lastBoundaryPoint.y - closest.y) ** 2;
  if (Math.abs(lineLength - HEX_RADIUS_SQUARED) > 5) {
    return
  }
  const strokeColor = GLOBAL_STATE.mouseState.holdingRightClick ? GLOBAL_STATE.layers.BOUNDARY.secondaryColor : GLOBAL_STATE.layers.BOUNDARY.primaryColor;
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", GLOBAL_STATE.layers.BOUNDARY.lastBoundaryPoint.x);
  line.setAttribute("y1", GLOBAL_STATE.layers.BOUNDARY.lastBoundaryPoint.y);
  line.setAttribute("x2", closest.x);
  line.setAttribute("y2", closest.y);
  line.setAttribute("stroke", strokeColor);
  line.setAttribute("stroke-width", 9);
  line.setAttribute("stroke-linecap", "round");
  line.classList.add("boundary");
  line.classList.add(`eraseable-${Layers.BOUNDARY}`);
  line.id = crypto.randomUUID();
  // line.classList.add("no-pointer-events");
  SVG.appendChild(line);
  addToUndoStack({"type": "boundary", "target": [line.id]});
  GLOBAL_STATE.layers.BOUNDARY.lastBoundaryPoint = closest;
  GLOBAL_STATE.layers.BOUNDARY.lastHexEntry = closestHexEntry;
}

function startBoundaryDrawing(hexEntry, mouseX, mouseY) {
  if (GLOBAL_STATE.layers.BOUNDARY.lastBoundaryPoint != null) {
    return;
  }
  const pt = new DOMPoint(mouseX, mouseY).matrixTransform(SVG.getScreenCTM().inverse());
  let closest = null;
  let closestDistance = Infinity;
  const hex = hexEntry.hex;
  for (let i = 0; i < hex.points.length; i++) {
    const distance = (hex.points[i].x - pt.x) ** 2 + (hex.points[i].y - pt.y) ** 2;
    if (distance < closestDistance) {
      closest = hex.points[i];
      closestDistance = distance;
    }
  }
  GLOBAL_STATE.layers.BOUNDARY.lastBoundaryPoint = closest;
  GLOBAL_STATE.layers.BOUNDARY.lastHexEntry = hexEntry;

  // our primary mouseover event isn't good enough, since it only fires once per hex
  // at the same time, having a mousemove main loop is just wasteful. so add a special
  // listened just during boundary drawing, then remove it once drawn
  SVG.addEventListener("mousemove", drawBoundary);
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

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", GLOBAL_STATE.layers.PATH.primaryColor);
  line.setAttribute("stroke-dasharray", 10);
  line.setAttribute("stroke-linecap", "round");
  line.setAttribute("stroke-linejoin", "round");
  line.setAttribute("stroke-width", 3);
  line.setAttribute("x1", lastHexEntry.x);
  line.setAttribute("y1", lastHexEntry.y);
  line.setAttribute("c1", lastHexEntry.c);
  line.setAttribute("r1", lastHexEntry.r);
  line.setAttribute("x2", hexEntry.x);
  line.setAttribute("y2", hexEntry.y);
  line.setAttribute("c2", hexEntry.c);
  line.setAttribute("r2", hexEntry.r);
  line.classList.add("path");
  line.classList.add(`eraseable-${Layers.PATH}`);
  line.id = crypto.randomUUID();
  // line.classList.add("no-pointer-events");

  const lineHighlight = document.createElementNS("http://www.w3.org/2000/svg", "line");
  lineHighlight.setAttribute("fill", "none");
  lineHighlight.setAttribute("stroke", GLOBAL_STATE.layers.PATH.secondaryColor);
  lineHighlight.setAttribute("stroke-linecap", "round");
  lineHighlight.setAttribute("stroke-linejoin", "round");
  lineHighlight.setAttribute("stroke-width", 7);
  lineHighlight.setAttribute("stroke-opacity", 0.5);
  lineHighlight.setAttribute("x1", lastHexEntry.x);
  lineHighlight.setAttribute("y1", lastHexEntry.y);
  lineHighlight.setAttribute("c1", lastHexEntry.c);
  lineHighlight.setAttribute("r1", lastHexEntry.r);
  lineHighlight.setAttribute("x2", hexEntry.x);
  lineHighlight.setAttribute("y2", hexEntry.y);
  lineHighlight.setAttribute("c2", hexEntry.c);
  lineHighlight.setAttribute("r2", hexEntry.r);
  lineHighlight.classList.add("path-highlight");
  lineHighlight.classList.add(`eraseable-${Layers.PATH}`);
  lineHighlight.id = crypto.randomUUID();
  // lineHighlight.classList.add("no-pointer-events");

  GLOBAL_STATE.layers.PATH.lastHexEntry = hexEntry;
  addToUndoStack({"type": "path", "target": [line.id, lineHighlight.id]});
  SVG.appendChild(lineHighlight);
  SVG.appendChild(line);
}

function placeTextAtPoint(pt) {
  const textInput = TEXT_INPUT_DIV.value;
  if (!textInput) {
    return;
  }
  const textbox = document.createElementNS("http://www.w3.org/2000/svg", "text");
  textbox.setAttribute("font-size", TEXT_FONT_SIZE_DIV.value);
  if (GLOBAL_STATE.layers.TEXT.bold) {
    textbox.setAttribute("stroke-width", "0.5");
  }
  if (GLOBAL_STATE.layers.TEXT.italics) {
    textbox.setAttribute("font-style", "italic");
  }
  if (GLOBAL_STATE.layers.TEXT.underline) {
    textbox.setAttribute("text-decoration", "underline");
  }

  textbox.setAttribute("x", pt.x);
  textbox.setAttribute("y", pt.y);
  textbox.setAttribute("fill", GLOBAL_STATE.layers.TEXT.primaryColor);
  textbox.textContent = textInput;
  textbox.classList.add("no-pointer-events");
  textbox.classList.add("in-image-text");
  textbox.classList.add(`eraseable-${Layers.TEXT}`);
  textbox.id = crypto.randomUUID();

  addToUndoStack({"type": "text", "target": [textbox.id]});
  SVG.appendChild(textbox);
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
      colorHex(c, r, GLOBAL_STATE.layers.GRID.primaryColor);
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
      placeTextAtPoint(pt);
    }
  } else if (GLOBAL_STATE.currentLayer == Layers.PATH) {
    if (GLOBAL_STATE.currentTool == Tools.BRUSH) {
      drawPath(hexEntry);
    }
  }
}

function drawHex(c, r) {
  const {x, y} = hexIndexToPixel(c, r);
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 3 * i;
    if (GLOBAL_STATE.drawing.gridDirection == GridDirection.VERTICAL) {
      const px = x + HEX_RADIUS * Math.sin(angle);
      const py = y + HEX_RADIUS * Math.cos(angle);
      points.push(`${px},${py}`);
    } else {
      const px = x + HEX_RADIUS * Math.cos(angle);
      const py = y + HEX_RADIUS * Math.sin(angle);
      points.push(`${px},${py}`);
    }
  }
  const hex = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  hex.setAttribute("points", points.join(" "));
  hex.setAttribute("fill", GLOBAL_STATE.layers.GRID.primaryColor);
  hex.setAttribute("stroke", "black");
  hex.setAttribute("stroke-width", "5px");
  hex.setAttribute("x", x);
  hex.setAttribute("y", y);
  hex.setAttribute("c", c);
  hex.setAttribute("r", r);
  hex.classList.add("hex");

  const hexObject = document.createElementNS("http://www.w3.org/2000/svg", "text");
  hexObject.setAttribute("x", x);
  hexObject.setAttribute("y", y);
  hexObject.setAttribute("c", c);
  hexObject.setAttribute("r", r);
  hexObject.setAttribute("text-anchor", "middle");
  hexObject.setAttribute("dominant-baseline", "central");
  hexObject.setAttribute("font-size", `${HEX_RADIUS}px`);
  hexObject.setAttribute("width", `${2*HEX_RADIUS}px`);
  hexObject.setAttribute("height", `${2*HEX_RADIUS}px`);
  hexObject.classList.add("no-pointer-events");
  hexObject.classList.add("hex-object");

  GLOBAL_STATE.drawing.hexes[`${c},${r}`] = {hex, hexObject, x, y, c, r};

  SVG.appendChild(hex);
  SVG.appendChild(hexObject);
}

function importSvg(uploadedSvgStr) {
  GLOBAL_STATE.pauseUndoStack = true;
  const parser = new DOMParser();
  const uploadedSvg = parser.parseFromString(uploadedSvgStr, "image/svg+xml").documentElement;
  GLOBAL_STATE.drawing.gridDirection = uploadedSvg.getAttribute("gridDirection");
  GLOBAL_STATE.layers.GRID.primaryColor = uploadedSvg.getAttribute("canvasColor");
  GLOBAL_STATE.layers.GRID.secondaryColor = uploadedSvg.getAttribute("gridColor");
  SVG.innerHTML = uploadedSvg.innerHTML;

  // populate the hex metadata
  SVG.querySelectorAll(".hex").forEach(hex => {
    const c = hex.getAttribute("c");
    const r = hex.getAttribute("r");
    const x = hex.getAttribute("x");
    const y = hex.getAttribute("y");
    GLOBAL_STATE.drawing.hexes[`${c},${r}`] = {hex, x, y, c, r}
  });
  SVG.querySelectorAll(".hex-object").forEach(hexObject => {
    const c = hexObject.getAttribute("c");
    const r = hexObject.getAttribute("r");
    GLOBAL_STATE.drawing.hexes[`${c},${r}`].hexObject = hexObject;
  });
  switchToLayer(Layers.COLOR);
  GLOBAL_STATE.pauseUndoStack = false;
}

function svgInit() {
  GLOBAL_STATE.pauseUndoStack = true;
  SVG.setAttribute("gridDirection", GLOBAL_STATE.drawing.gridDirection);
  setGridColor(GLOBAL_STATE.layers.GRID.secondaryColor, GLOBAL_STATE.layers.GRID.secondaryColor);
  setCanvasColor(GLOBAL_STATE.layers.GRID.primaryColor, GLOBAL_STATE.layers.GRID.primaryColor);
  SVG.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  for (let h in GLOBAL_STATE.drawing.hexes) delete GLOBAL_STATE.drawing.hexes[h];
  Array.prototype.slice.call(document.getElementsByTagName("polygon")).forEach(e => e.remove());

  for (let c = 0; c < HEX_COLS; c++) {
    for (let r = 0; r < HEX_ROWS; r++) {
      drawHex(c, r);
    }
  }
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
  console.log("undoing", lastAction);
  GLOBAL_STATE.pauseUndoStack = true;
  switch(lastAction["type"]) {
  case "canvasColor":
    setCanvasColor(lastAction["new"], lastAction["old"]);
    break;
  case "gridColor":
    setGridColor(lastAction["new"], lastAction["old"]);
    break;
  case "color":
    colorHex(lastAction["target"][0], lastAction["target"][1], lastAction["old"]);
    break;
  case "object":
    placeObjectOnHex(lastAction["target"][0], lastAction["target"][1], lastAction["old"]);
    break;
  case "boundary":
  case "text":
    SVG.removeChild(SVG.getElementById(lastAction["target"]));
    break;
  case "path":
    SVG.removeChild(SVG.getElementById(lastAction["target"][0]));
    SVG.removeChild(SVG.getElementById(lastAction["target"][1]));
    break;
  }
  GLOBAL_STATE.pauseUndoStack = false;
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

svgInit();
