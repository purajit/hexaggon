const SVG = document.getElementById("hexmap");
const SWATCHES = document.querySelectorAll(".swatch");
const LAYER_PICKER_BUTTONS = document.querySelectorAll(".layer-picker-btn");
const TOOL_PICKER_BUTTONS = document.querySelectorAll(".tool-picker-btn");
const LAYER_CONTROLS = document.querySelectorAll(".layer-control");
const OBJECT_BUTTONS = document.querySelectorAll(".object-btn");
const PATH_TIP_SYMBOL_BUTTONS = document.querySelectorAll(".path-tip-symbol-btn");
const CHOSEN_PRIMARY_COLOR_DIV = document.getElementById("chosenPrimaryColor");
const CHOSEN_SECONDARY_COLOR_DIV = document.getElementById("chosenSecondaryColor");

// Hex map setup
const HEX_RADIUS = 35;
// used for distance calculations
const HEX_RADIUS_SQUARED = HEX_RADIUS ** 2;
const HEX_COLS = Math.ceil(window.innerWidth / (HEX_RADIUS * 1.5));
const HEX_ROWS = Math.ceil(window.innerHeight / (Math.sqrt(3) * HEX_RADIUS));
const HEXES = {};
const OBJECTS_ON_HEXES = {};

const Layers = {
  NONE: "NONE",
  BASE: "BASE",
  OBJECT: "OBJECT",
  BOUNDARY: "BOUNDARY",
  PATH: "PATH",
  TEXT: "TEXT",
};

const Tools = {
  BRUSH: "BRUSH",
  FILL: "FILL",
  EYEDROPPER: "EYEDROPPER",
  ERASER: "ERASER",
};

const Controls = {
  COLOR: "COLOR",
  OBJECT: "OBJECT",
  PATHTIPSYMBOL: "PATHTIPSYMBOL",
}

const LAYER_TOOL_COMPATIBILITY = {
  [Layers.BASE]: [Tools.BRUSH, Tools.FILL, Tools.ERASER, Tools.EYEDROPPER],
  [Layers.OBJECT]: [Tools.BRUSH, Tools.ERASER, Tools.EYEDROPPER],
  [Layers.PATH]: [Tools.BRUSH],
  [Layers.BOUNDARY]: [Tools.BRUSH, Tools.ERASER],
  [Layers.TEXT]: [Tools.BRUSH, Tools.ERASER],
};

const LAYER_CONTROL_COMPATIBILITY = {
  [Layers.BASE]: [Controls.COLOR],
  [Layers.OBJECT]: [Controls.OBJECT],
  [Layers.PATH]: [Controls.COLOR, Controls.PATHTIPSYMBOL],
  [Layers.BOUNDARY]: [Controls.COLOR],
  [Layers.TEXT]: [Controls.COLOR],
};

const GLOBAL_STATE = {
  // whether the use vertical-oriented axes (hexagon pointy up and down)
  useVerticalAxes: false,
  currentLayer: Layers.BASE,
  currentTool: Tools.BRUSH,
  keyState: {
    holdingKeyZ: false,
    holdingMeta: false,
  },
  canvasColor: "#c4b9a5",

  // brushing metadata/status
  brushingActive: false,
  usingSecondary: false,

  layers: {
    BASE: {
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
      lastHex: null,
      currentPathTipSymbol: "⚓",
      pathTip: null,
    },

    BOUNDARY: {
      primaryColor: "#b8895f",
      secondaryColor: "#7eaaad",
      lastBoundaryPoint: null,
    },

    TEXT: {
      primaryColor: "#b8895f",
      secondaryColor: "#7eaaad",
    }
  },
}

document.addEventListener("keydown", e => {
  switch(e.code) {
  case "Digit1":
    switchToLayer(Layers.BASE);
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
  case "KeyZ":
    GLOBAL_STATE.keyState.holdingKeyZ = true;
    break;
  case "MetaLeft":
    GLOBAL_STATE.keyState.holdingMeta = true;
    break;
  }
});

document.addEventListener("keyup", e => {
  if (e.code == "KeyZ") GLOBAL_STATE.keyState.holdingKeyZ = false;
  if (e.code == "MetaLeft") GLOBAL_STATE.keyState.holdingMeta = false;
});

document.addEventListener("visibilitychange", () => {
  console.log("R");
  GLOBAL_STATE.keyState.holdingKeyZ = false;
  GLOBAL_STATE.keyState.holdingMeta = false;
});

// Toolbar events listeners
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
    // Meta + click changes the color of the canvas - leave non-canvas-colored tiles alone!
    if (GLOBAL_STATE.keyState.holdingMeta) {
      const previousCanvasColor = GLOBAL_STATE.canvasColor;
      GLOBAL_STATE.canvasColor = swatch.dataset.color;
      Object.values(HEXES).forEach(hexEntry => {
        if (hexEntry.hex.getAttribute("fill") == previousCanvasColor)
          hexEntry.hex.setAttribute("fill", GLOBAL_STATE.canvasColor);
      });
    } else {
      setPrimaryColor(swatch.dataset.color);
    }
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

PATH_TIP_SYMBOL_BUTTONS.forEach(btn => {
  btn.addEventListener("click", () => {
    if (btn.classList.contains("selected")) {
      return;
    }
    PATH_TIP_SYMBOL_BUTTONS.forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    GLOBAL_STATE.layers.PATH.currentPathTipSymbol = btn.dataset.text;
    if (GLOBAL_STATE.layers.PATH.pathTip) {
      GLOBAL_STATE.layers.PATH.pathTip.textContent = GLOBAL_STATE.layers.PATH.currentPathTipSymbol;
    }
  });
});

document.getElementById("rotateAxesBtn").addEventListener("click", (e) => {
  GLOBAL_STATE.useVerticalAxes = !GLOBAL_STATE.useVerticalAxes;
  init();
});

document.getElementById("saveBtn").addEventListener("click", (e) => {
  saveSvg();
});

// SVG events listeners
SVG.addEventListener("mouseup", () => {
  GLOBAL_STATE.brushingActive = false;
  GLOBAL_STATE.layers.PATH.lastHex = null;
  GLOBAL_STATE.layers.BOUNDARY.lastBoundaryPoint = null;
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
      tpb.classList.remove("hidden");
    } else {
      tpb.classList.add("hidden");
    }
  });
  LAYER_PICKER_BUTTONS.forEach(b => {
    if (b.dataset.layer == layer) {
      b.classList.add("selected")
    } else {
      b.classList.remove("selected");
    }
  });
  switchToTool(Tools.BRUSH);
  setPrimaryColor(GLOBAL_STATE.layers[GLOBAL_STATE.currentLayer].primaryColor);
  setSecondaryColor(GLOBAL_STATE.layers[GLOBAL_STATE.currentLayer].secondaryColor);
}

function switchToTool(tool) {
  if (!LAYER_TOOL_COMPATIBILITY[GLOBAL_STATE.currentLayer].includes(tool)) {
    return;
  }
  Object.keys(Tools).forEach(t => SVG.classList.remove(`${t.toLowerCase()}cursor`));
  SVG.classList.add(`${tool.toLowerCase()}cursor`);
  GLOBAL_STATE.currentTool = tool;
  TOOL_PICKER_BUTTONS.forEach(b => {
    if (b.dataset.tool == tool) {
      b.classList.add("selected")
    } else {
      b.classList.remove("selected");
    }
  });
}

function choose(choices) {
  let index = Math.floor(Math.random() * choices.length);
  return choices[index];
}


// SVG utils
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
  if (!GLOBAL_STATE.useVerticalAxes) {
    const x = HEX_RADIUS * 3/2 * c;
    const y = HEX_RADIUS * Math.sqrt(3) * (r + 0.5 * (c % 2));
    return {x, y};
  }
  const x = HEX_RADIUS * Math.sqrt(3) * (c + 0.5 * (r % 2));
  const y = HEX_RADIUS * 3/2 * r;
  return {x, y};
}

function colorHex(c, r) {
  const fillColor = GLOBAL_STATE.usingSecondary ? GLOBAL_STATE.layers.BASE.secondaryColor : GLOBAL_STATE.layers.BASE.primaryColor;
  HEXES[`${c},${r}`].hex.setAttribute("fill", fillColor);
  // easy way to test hex neighbor logic
  // getHexNeighbors(c, r).forEach(h => {
  //   console.log(h)
  //   const neighborhex = HEXES[`${h[0]},${h[1]}`].hex;
  //   neighborhex.setAttribute("fill", "black");
  // });
}

function eraseHex(c, r) {
  OBJECTS_ON_HEXES[`${c},${r}`].textContent = "";
  HEXES[`${c},${r}`].hex.setAttribute("fill", GLOBAL_STATE.canvasColor);
}

function placeObjectOnHex(c, r) {
  const objectToUse = GLOBAL_STATE.usingSecondary ? GLOBAL_STATE.layers.OBJECT.secondaryObject : GLOBAL_STATE.layers.OBJECT.primaryObject;
  OBJECTS_ON_HEXES[`${c},${r}`].textContent = objectToUse;
}

function makeEraseable(element) {
  const expectedLayer = GLOBAL_STATE.currentLayer;
  element.addEventListener("mouseover", e => {
    if (GLOBAL_STATE.currentLayer == expectedLayer && GLOBAL_STATE.currentTool == Tools.ERASER && GLOBAL_STATE.brushingActive) SVG.removeChild(element);
  });
}

function drawBoundary(hex, mouseX, mouseY) {
  const pt = new DOMPoint(mouseX, mouseY).matrixTransform(SVG.getScreenCTM().inverse());
  let closest = hex.points[0];
  let closestDistance = Infinity;
  for (let i = 0; i < hex.points.length; i++) {
    const distance = (hex.points[i].x - pt.x) ** 2 + (hex.points[i].y - pt.y) ** 2;
    console.log(distance, closestDistance, closest, hex.points[i], pt);
    if (distance < closestDistance) {
      closest = hex.points[i];
      closestDistance = distance;
    }
  }
  // we only want to draw boundary lines on top of existing hex edges.
  // we already know that our vertices are on hex vertices. If the distance
  // is within a unit of the hex radius, that means this must be a hex edge
  if (GLOBAL_STATE.layers.BOUNDARY.lastBoundaryPoint == null) {
    console.log(closest);
    GLOBAL_STATE.layers.BOUNDARY.lastBoundaryPoint = closest;
  } else {
    const lineLength = (GLOBAL_STATE.layers.BOUNDARY.lastBoundaryPoint.x - closest.x) ** 2 + (GLOBAL_STATE.layers.BOUNDARY.lastBoundaryPoint.y - closest.y) ** 2;
    if (Math.abs(lineLength - HEX_RADIUS_SQUARED) > 5) {
      return
    }
    const strokeColor = GLOBAL_STATE.usingSecondary ? GLOBAL_STATE.layers.BOUNDARY.secondaryColor : GLOBAL_STATE.layers.BOUNDARY.primaryColor;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", GLOBAL_STATE.layers.BOUNDARY.lastBoundaryPoint.x);
    line.setAttribute("y1", GLOBAL_STATE.layers.BOUNDARY.lastBoundaryPoint.y);
    line.setAttribute("x2", closest.x);
    line.setAttribute("y2", closest.y);
    line.setAttribute("stroke", strokeColor);
    line.setAttribute("stroke-width", 9);
    makeEraseable(line);
    SVG.appendChild(line);
    GLOBAL_STATE.layers.BOUNDARY.lastBoundaryPoint = closest;
  }
}

function handleHexInteraction(c, r, mouseX, mouseY) {
  const {hex, x, y} = HEXES[`${c},${r}`];
  if (GLOBAL_STATE.currentLayer == Layers.BASE) {
    if (GLOBAL_STATE.currentTool == Tools.BRUSH) {
      colorHex(c, r);
    } else if (GLOBAL_STATE.currentTool == Tools.FILL) {
      floodFill(c, r, colorHex);
    } else if (GLOBAL_STATE.currentTool == Tools.ERASER) {
      hex.setAttribute("fill", GLOBAL_STATE.canvasColor);
    } else if (GLOBAL_STATE.currentTool == Tools.EYEDROPPER) {
      if (GLOBAL_STATE.usingSecondary) {
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
      if (GLOBAL_STATE.usingSecondary) {
        setSecondaryObject(OBJECTS_ON_HEXES[`${c},${r}`].textContent);
      } else {
        setPrimaryObject(OBJECTS_ON_HEXES[`${c},${r}`].textContent);
      }
    } else if (GLOBAL_STATE.currentTool == Tools.ERASER) {
      OBJECTS_ON_HEXES[`${c},${r}`].textContent = "";
    }
  } else if (GLOBAL_STATE.currentLayer == Layers.BOUNDARY) {
    if (GLOBAL_STATE.currentTool == Tools.BRUSH) {
      drawBoundary(hex, mouseX, mouseY);
    }
  } else if (GLOBAL_STATE.currentLayer == Layers.TEXT) {
    if (GLOBAL_STATE.currentTool == Tools.BRUSH) {
      const textbox = document.createElementNS("http://www.w3.org/2000/svg", "text");
      textbox.setAttribute("x", x);
      textbox.setAttribute("y", y);
      textbox.setAttribute("fill", GLOBAL_STATE.layers.TEXT.primaryColor);
      textbox.textContent = "Here be dragons";
      textbox.addEventListener("click", e => {
        if (GLOBAL_STATE.currentTool == Tools.ERASER) SVG.removeChild(textbox);
      });
      SVG.appendChild(textbox);
      makeEraseable(textbox);
    }
  } else if (GLOBAL_STATE.currentLayer == Layers.PATH) {
    if (GLOBAL_STATE.layers.PATH.lastHex) {
      if (GLOBAL_STATE.layers.PATH.lastHex.c === c && GLOBAL_STATE.layers.PATH.lastHex.r === r)
        return;
      const lineHighlight = document.createElementNS("http://www.w3.org/2000/svg", "line");
      lineHighlight.setAttribute("x1", GLOBAL_STATE.layers.PATH.lastHex.x);
      lineHighlight.setAttribute("y1", GLOBAL_STATE.layers.PATH.lastHex.y);
      lineHighlight.setAttribute("x2", x);
      lineHighlight.setAttribute("y2", y);
      lineHighlight.setAttribute("stroke", GLOBAL_STATE.layers.PATH.secondaryColor);
      lineHighlight.setAttribute("stroke-width", 7);
      lineHighlight.setAttribute("stroke-opacity", 0.5);
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", GLOBAL_STATE.layers.PATH.lastHex.x);
      line.setAttribute("y1", GLOBAL_STATE.layers.PATH.lastHex.y);
      line.setAttribute("x2", x);
      line.setAttribute("y2", y);
      line.setAttribute("stroke", GLOBAL_STATE.layers.PATH.primaryColor);
      line.setAttribute("stroke-dasharray", 10);
      line.setAttribute("stroke-width", 3);
      SVG.appendChild(lineHighlight);
      SVG.appendChild(line);
    } else {
      // if there's an active path, we should only allow continuing the path from there
      // TODO: support multiple paths
      if (GLOBAL_STATE.layers.PATH.pathTip != null && (c != GLOBAL_STATE.layers.PATH.pathTip.getAttribute("c") || r != GLOBAL_STATE.layers.PATH.pathTip.getAttribute("r")))
        return;
      const marker = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      marker.setAttribute("cx", x);
      marker.setAttribute("cy", y);
      marker.setAttribute("r", 5);
      marker.setAttribute("fill", "red");
      marker.setAttribute("stroke", "white");
      marker.classList.add("path-marker");
      SVG.appendChild(marker);
    }
    if (GLOBAL_STATE.layers.PATH.pathTip) SVG.removeChild(GLOBAL_STATE.layers.PATH.pathTip);
    const pathTip = document.createElementNS("http://www.w3.org/2000/svg", "text");
    pathTip.setAttribute("x", x);
    pathTip.setAttribute("y", y);
    pathTip.setAttribute("c", c);
    pathTip.setAttribute("r", r);
    pathTip.setAttribute("font-size", "30px");
    pathTip.setAttribute("text-anchor", "middle");
    pathTip.setAttribute("dominant-baseline", "central");
    pathTip.textContent = GLOBAL_STATE.layers.PATH.currentPathTipSymbol;
    pathTip.classList.add("path-tip-symbol");
    GLOBAL_STATE.layers.PATH.lastHex = {c, r, x, y};
    GLOBAL_STATE.layers.PATH.pathTip = pathTip;
    SVG.appendChild(GLOBAL_STATE.layers.PATH.pathTip);
  }
}

function drawHex(c, r) {
  const {x, y} = hexIndexToPixel(c, r);
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 3 * i;
    if (!GLOBAL_STATE.useVerticalAxes) {
      const px = x + HEX_RADIUS * Math.cos(angle);
      const py = y + HEX_RADIUS * Math.sin(angle);
      points.push(`${px},${py}`);
    } else {
      const px = x + HEX_RADIUS * Math.sin(angle);
      const py = y + HEX_RADIUS * Math.cos(angle);
      points.push(`${px},${py}`);
    }
  }
  const hex = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  hex.setAttribute("points", points.join(" "));
  hex.setAttribute("fill", GLOBAL_STATE.canvasColor);
  hex.setAttribute("stroke", "black");
  hex.setAttribute("stroke-width", "5px");
  hex.classList.add("hex");

  hex.addEventListener("drag", (e) => {
    console.log("dragon")
  });

  hex.addEventListener("mousedown", (e) => {
    e.preventDefault();

    if (GLOBAL_STATE.keyState.holdingKeyZ) {
      const zoomFactor = .5 * (e.button == 2 ? 1 : -1);
      zoom(zoomFactor, e.clientX, e.clientY);
    } else {
      GLOBAL_STATE.brushingActive = true;
      // a right mouse down means paint with secondary colors
      GLOBAL_STATE.usingSecondary = (e.button == 2);
      handleHexInteraction(c, r, e.x, e.y);
    }
  });
  hex.addEventListener("mouseover", (e) => {
    if (GLOBAL_STATE.brushingActive) {
      handleHexInteraction(c, r, e.x, e.y);
    }
  });

  const hexObject = document.createElementNS("http://www.w3.org/2000/svg", "text");
  hexObject.setAttribute("x", x);
  hexObject.setAttribute("y", y);
  hexObject.setAttribute("text-anchor", "middle");
  hexObject.setAttribute("dominant-baseline", "central");
  hexObject.setAttribute("font-size", `${HEX_RADIUS}px`);
  hexObject.setAttribute("width", `${2*HEX_RADIUS}px`);
  hexObject.setAttribute("height", `${2*HEX_RADIUS}px`);
  hexObject.classList.add("hex-object");

  HEXES[`${c},${r}`] = {hex, x, y};
  OBJECTS_ON_HEXES[`${c},${r}`] = hexObject;

  SVG.appendChild(hex);
  SVG.appendChild(hexObject);
}

// Hex neighbors, filling, graph logic
function floodFill(startC, startR, fn) {
  const queue = [[startC, startR]];
  const visited = [`${startC},${startR}`];
  const expectedFill = HEXES[`${startC},${startR}`].hex.getAttribute("fill");
  while (queue.length > 0) {
    console.log(queue);
    const [c, r] = queue.shift();
    getHexNeighbors(c, r).forEach(n => {
      const stringedCoords = `${n[0]},${n[1]}`;
      if (visited.includes(stringedCoords)) return;
      const nhexentry = HEXES[stringedCoords];
      if (nhexentry == null) return;
      const nhex = nhexentry.hex;
      if (nhex.getAttribute("fill") != expectedFill) return
      queue.push(n);
      visited.push(stringedCoords);
    });
  }
  visited.forEach(s => fn(...s.split(",")));
}

function getHexNeighbors(c, r) {
  if (GLOBAL_STATE.useVerticalAxes) {
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

function saveSvg() {
  const svgData = SVG.outerHTML;
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

function init() {
  SVG.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  for (let h in HEXES) delete HEXES[h];
  GLOBAL_STATE.layers.PATH.pathTip = null;
  Array.prototype.slice.call(document.getElementsByTagName("polygon")).forEach(e => e.remove());

  for (let c = 0; c < 3*HEX_COLS; c++) {
    for (let r = 0; r < 3*HEX_ROWS; r++) {
      drawHex(c, r);
    }
  }
  switchToLayer(Layers.BASE);
  // smolbean grid for inspection ease
  // for (let c = 3; c < 13; c++) {
  //   for (let r = 3; r < 13; r++) {
  //     drawHex(c, r);
  //   }
  // }
}

init();
