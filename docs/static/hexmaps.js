const SVG = document.getElementById("hexmap");
const SWATCHES = document.querySelectorAll(".swatch");
const LAYER_PICKER_BUTTONS = document.querySelectorAll(".layer-picker-btn");
const TOOL_PICKER_BUTTONS = document.querySelectorAll(".tool-picker-btn");
const LAYER_CONTROLS = document.querySelectorAll(".layer-control");
const OBJECT_BUTTONS = document.querySelectorAll(".object-btn");
const PATH_TIP_SYMBOL_BUTTONS = document.querySelectorAll(".path-tip-symbol-btn");
const PATH_LAYER_BTN = document.getElementById("pathLayerBtn");

// Hex map setup
const HEX_RADIUS = 35;
const HEX_COLS = Math.ceil(window.innerWidth / (HEX_RADIUS * 1.5));
const HEX_ROWS = Math.ceil(window.innerHeight / (Math.sqrt(3) * HEX_RADIUS));
const HEXES = {};
const OBJECTS_ON_HEXES = {};

const Layers = {
  NONE: "NONE",
  BASE: "BASE",
  OBJECT: "OBJECT",
  PATH: "PATH",
  TEXT: "TEXT",
};

const Tools = {
  BRUSH: "BRUSH",
  FILL: "FILL",
  EYEDROPPER: "EYEDROPPER",
  ERASER: "ERASER",
};

const LAYER_TOOL_COMPATIBILITY = {
  [Layers.BASE]: [Tools.BRUSH, Tools.FILL, Tools.ERASER, Tools.EYEDROPPER],
  [Layers.OBJECT]: [Tools.BRUSH, Tools.ERASER, Tools.EYEDROPPER],
  [Layers.PATH]: [Tools.BRUSH],
  [Layers.TEXT]: [Tools.BRUSH],
};

// initial defaults

// whether the use vertical-oriented axes (hexagon pointy up and down)
let useVerticalAxes = false;
let currentLayer = Layers.BASE;
let currentTool = Tools.BRUSH;
let holdingKeyZ = false;
let holdingMeta = false;

let foregroundColor = "#b8895f";
// only changed when double-clicking a color
let canvasColor = "#c4b9a5";
let backgroundColor = "#7eaaad";

// painting layers and metadata
let painting = false;
let paintingBackground = false;
let currentObject = null;

// path layer and metadata
let lastHex = null;
let currentPathTipSymbol = "⚓";
let pathTip = null;

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
    holdingKeyZ = true;
    break;
  case "MetaLeft":
    holdingMeta = true;
    break;
  }
});

document.addEventListener("keyup", e => {

  if (e.code == "KeyZ") holdingKeyZ = false;
  if (e.code == "MetaLeft") holdingMeta = false;
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
  // left click - set as foreground color
  swatch.addEventListener("click", (e) => {
    // Meta + click changes the color of the canvas - leave non-canvas-colored tiles alone!
    if (holdingMeta) {
      previousCanvasColor = canvasColor;
      canvasColor = swatch.dataset.color;
      Object.values(HEXES).forEach(hexEntry => {
        if (hexEntry.hex.getAttribute("fill") == previousCanvasColor)
          hexEntry.hex.setAttribute("fill", swatch.dataset.color);
      });
    } else {
      setForegroundColor(swatch.dataset.color);
    }
  });
  // right click - set as background color
  swatch.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    setBackgroundColor(swatch.dataset.color);
  });
});

OBJECT_BUTTONS.forEach(btn => {
  // selecting/unselecting a object/empji/stamp
  btn.addEventListener("click", () => {
    if (btn.classList.contains("selected")) {
      currentObject = null;
      btn.classList.remove("selected");
      return;
    }
    OBJECT_BUTTONS.forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    currentObject = btn;
  });
});

PATH_TIP_SYMBOL_BUTTONS.forEach(btn => {
  btn.addEventListener("click", () => {
    if (btn.classList.contains("selected")) {
      return;
    }
    PATH_TIP_SYMBOL_BUTTONS.forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    currentPathTipSymbol = btn.dataset.text;
    if (pathTip) {
      pathTip.textContent = currentPathTipSymbol;
    }
  });
});

document.getElementById("rotateAxesBtn").addEventListener("click", (e) => {
  useVerticalAxes = !useVerticalAxes;
  init();
});

document.getElementById("saveBtn").addEventListener("click", (e) => {
  saveSvg();
});

// SVG events listeners
SVG.addEventListener("mouseup", () => {
  painting = false;
  lastHex = null;
});

SVG.addEventListener("contextmenu", e => e.preventDefault());
SVG.addEventListener("wheel", e => {
  e.preventDefault();
  if (holdingMeta) {
    let scale = e.deltaY / 100;
    scale = Math.abs(scale) > .1 ? .1 * e.deltaY / Math.abs(e.deltaY) : scale;
    zoom(scale, e.clientX, e.clientY);
  } else {
    scroll(e.deltaX, e.deltaY);
  }
});

// from text
function setCurrentObject(objectText) {
  OBJECT_BUTTONS.forEach(b => {
    if (b.dataset.text == objectText) {
      b.classList.add("selected");
      currentObject = b;
    } else {
      b.classList.remove("selected")
    }
  });
}

function setBackgroundColor(color) {
  backgroundColor = color;
  SWATCHES.forEach(b => {
    if (b.dataset.color == color)
      b.classList.add("bgselected")
    else
      b.classList.remove("bgselected")
  });
}

function setForegroundColor(color) {
  foregroundColor = color;
  SWATCHES.forEach(b => {
    if (b.dataset.color == color)
      b.classList.add("fgselected")
    else
      b.classList.remove("fgselected")
  });
}

function switchToLayer(layer) {
  currentLayer = layer;
  currentTool = Tools.BRUSH;
  LAYER_CONTROLS.forEach(mc => {
    if (mc.dataset.layer != currentLayer) {
      mc.classList.add("hidden");
    } else {
      mc.classList.remove("hidden");
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
}

function switchToTool(tool) {
  if (!LAYER_TOOL_COMPATIBILITY[currentLayer].includes(tool)) {
    return;
  }
  Object.keys(Tools).forEach(t => SVG.classList.remove(`${t.toLowerCase()}cursor`));
  SVG.classList.add(`${tool.toLowerCase()}cursor`);
  currentTool = tool;
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
  if (!useVerticalAxes) {
    const x = HEX_RADIUS * 3/2 * c;
    const y = HEX_RADIUS * Math.sqrt(3) * (r + 0.5 * (c % 2));
    return {x, y};
  }
  const x = HEX_RADIUS * Math.sqrt(3) * (c + 0.5 * (r % 2));
  const y = HEX_RADIUS * 3/2 * r;
  return {x, y};
}

function colorHex(c, r) {
  const {hex, x, y} = HEXES[`${c},${r}`];
  const fillColor = paintingBackground ? backgroundColor : foregroundColor;
  hex.setAttribute("fill", fillColor);
  // each way to test hex neighbor logic
  // getHexNeighbors(c, r).forEach(h => {
  //   console.log(h)
  //   const neighborhex = HEXES[`${h[0]},${h[1]}`].hex;
  //   neighborhex.setAttribute("fill", "black");
  // });
}

function eraseHex(c, r) {
  OBJECTS_ON_HEXES[`${c},${r}`].textContent = "";
  HEXES[`${c},${r}`].hex.setAttribute("fill", canvasColor);
}

function placeObjectOnHex(c, r) {
  OBJECTS_ON_HEXES[`${c},${r}`].textContent = currentObject.dataset.text;
}

function handleHexInteraction(c, r) {
  const {hex, x, y} = HEXES[`${c},${r}`];
  if (currentLayer == Layers.BASE) {
    if (currentTool == Tools.BRUSH) {
      colorHex(c, r);
    } else if (currentTool == Tools.FILL) {
      floodFill(c, r, colorHex);
    } else if (currentTool == Tools.ERASER) {
      hex.setAttribute("fill", canvasColor);
    } else if (currentTool == Tools.EYEDROPPER) {
      if (paintingBackground) {
        setBackgroundColor(hex.getAttribute("fill"));
      } else {
        setForegroundColor(hex.getAttribute("fill"));
      }
    }
  } else if (currentLayer == Layers.OBJECT) {
    if (currentObject == null) {
      return;
    }
    if (currentTool == Tools.BRUSH) {
      placeObjectOnHex(c, r);
    } else if (currentTool == Tools.EYEDROPPER) {
      setCurrentObject(OBJECTS_ON_HEXES[`${c},${r}`].textContent);
    } else if (currentTool == Tools.ERASER) {
      OBJECTS_ON_HEXES[`${c},${r}`].textContent = "";
    }
  } else if (currentLayer == Layers.TEXT) {
    const textbox = document.createElementNS("http://www.w3.org/2000/svg", "text");
    textbox.setAttribute("x", x);
    textbox.setAttribute("y", y);
    textbox.textContent = "Here be dragons";
    SVG.appendChild(textbox);
  } else if (currentLayer == Layers.PATH) {
    if (lastHex) {
      if (lastHex.c === c && lastHex.r === r)
        return;
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", lastHex.x);
      line.setAttribute("y1", lastHex.y);
      line.setAttribute("x2", x);
      line.setAttribute("y2", y);
      line.setAttribute("stroke", "#000");
      line.setAttribute("stroke-dasharray", 10);
      line.setAttribute("stroke-width", 5);
      line.classList.add("path-line");
      SVG.appendChild(line);
    } else {
      // if there's an active path, we should only allow continuing the path from there
      // TODO: support multiple paths
      if (pathTip != null && (c != pathTip.getAttribute("c") || r != pathTip.getAttribute("r")))
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
    if (pathTip) SVG.removeChild(pathTip);
    pathTip = document.createElementNS("http://www.w3.org/2000/svg", "text");
    pathTip.setAttribute("x", x);
    pathTip.setAttribute("y", y);
    pathTip.setAttribute("c", c);
    pathTip.setAttribute("r", r);
    pathTip.setAttribute("font-size", "30px");
    pathTip.setAttribute("text-anchor", "middle");
    pathTip.setAttribute("dominant-baseline", "central");
    pathTip.textContent = currentPathTipSymbol;
    pathTip.classList.add("path-tip-symbol");
    lastHex = {c, r, x, y};
    SVG.appendChild(pathTip);
  }
}

function drawHex(c, r) {
  const {x, y} = hexIndexToPixel(c, r);
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 3 * i;
    if (!useVerticalAxes) {
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
  hex.setAttribute("fill", canvasColor);
  hex.setAttribute("stroke", "black");
  hex.setAttribute("stroke-width", "5px");
  hex.classList.add("hex");

  hex.addEventListener("mousedown", (e) => {
    e.preventDefault();
    if (holdingKeyZ) {
      const zoomFactor = .5 * (e.button == 2 ? 1 : -1);
      zoom(zoomFactor, e.clientX, e.clientY);
    } else {
      painting = true;
      // a right mouse down means paint with background colors
      paintingBackground = (e.button == 2);
      handleHexInteraction(c, r);
    }
  });
  hex.addEventListener("mouseover", (e) => {
    if (painting) {
      handleHexInteraction(c, r);
    }
  });

  const hexObject = document.createElementNS("http://www.w3.org/2000/svg", "text");
  hexObject.setAttribute("x", x);
  hexObject.setAttribute("y", y);
  hexObject.setAttribute("text-anchor", "middle");
  hexObject.setAttribute("dominant-baseline", "central");
  /* depends on HEX_RADIUS */
  hexObject.setAttribute("font-size", "35px");
  hexObject.setAttribute("width", "70px");
  hexObject.setAttribute("height", "70px");
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
  if (useVerticalAxes) {
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
  pathTip = null;
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
