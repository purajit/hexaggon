const SVG = document.getElementById("hexmap");
const SWATCHES = document.querySelectorAll(".swatch");
const MODE_PICKER_BUTTONS = document.querySelectorAll(".mode-picker-btn");
const MODE_CONTROLS = document.querySelectorAll(".mode-control");
const OBJECT_BUTTONS = document.querySelectorAll(".object-btn");
const PATH_TIP_SYMBOL_BUTTONS = document.querySelectorAll(".path-tip-symbol-btn");
const PATH_MODE_BTN = document.getElementById("pathModeBtn");
const TILESETS = {
  barren: ["barren2x", "barren2x1", "barren3x", "barren3x1"],
  castle: ["castle"],
  marsh: ["cattail1", "cattail2", "cattail3", "cattail4", "cattail5", "cattail6"],
  conifer: ["conifer1x", "conifer2x", "conifer2x1", "conifer4x"],
  dune: ["dune1x", "dune2x", "dune2x1"],
  pond: ["pond"],
  house: ["house"],
  lily: ["lily3x", "lily4x"],
  mountain: ["mountainmedium", "mountainmedium2", "mountainmedium3"],
  trees: ["trees2x", "trees3x", "trees3x1", "trees4x"],
  water: ["water"],
};

// Hex map setup
const HEX_RADIUS = 35;
const HEX_COLS = Math.ceil(window.innerWidth / (HEX_RADIUS * 1.5));
const HEX_ROWS = Math.ceil(window.innerHeight / (Math.sqrt(3) * HEX_RADIUS));
const HEXES = {};
const OBJECTS_ON_HEXES = {};

const Modes = {
  NONE: "none",
  BRUSH: "brush",
  OBJECT: "object",
  PATH: "path",
  ERASER: "eraser",
};

let currentMode = Modes.BRUSH;
let previousMode = Modes.BRUSH;

// whether the use vertical-oriented axes (hexagon pointy up and down)
let useVerticalAxes = false;
let zoomingEnabled = true;

// initial defaults
let foregroundColor = "#c4b9a5";
// only changed when double-clicking a color
let defaultForegroundColor = "#c4b9a5";
let backgroundColor = "#000000";

// painting modes and metadata
let painting = false;
let paintingBackground = false;
let currentObject = null;

// path mode and metadata
let lastHex = null;
let currentPathTipSymbol = "⚓";
let pathTip = null;

document.getElementById("rotateAxesBtn").addEventListener("click", (e) => {
  useVerticalAxes = !useVerticalAxes;
  init();
});


MODE_PICKER_BUTTONS.forEach(modePicker => {
  modePicker.addEventListener("click", (e) => {
    console.log(modePicker.dataset.mode);
    switchToMode(Modes[modePicker.dataset.mode]);
  });
});

SWATCHES.forEach(swatch => {
  // left click - set as foreground color
  swatch.addEventListener("click", (e) => {
    foregroundColor = swatch.dataset.color;
    SWATCHES.forEach(b => b.classList.remove("fgselected"));
    swatch.classList.add("fgselected");
  });
  // right click - set as background color
  swatch.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    backgroundColor = swatch.dataset.color;
    SWATCHES.forEach(b => b.classList.remove("bgselected"));
    swatch.classList.add("bgselected");
  });
  // double click - fill entire page
  swatch.addEventListener("dblclick", () => {
    Object.values(HEXES).forEach(hexEntry => {
      const {hex} = hexEntry;
      defaultForegroundColor = swatch.dataset.color;
      hex.setAttribute("fill", swatch.dataset.color);
    });
  });
});

OBJECT_BUTTONS.forEach(btn => {
  // const bgimg = choose(TILESETS[btn.dataset.symbol]);
  // btn.style.backgroundImage = `url({{ static_url }}/images/hexmap/${bgimg}.png)`;
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

SVG.addEventListener("mouseup", () => {
  painting = false;
  lastHex = null;
});

SVG.addEventListener("contextmenu", e => e.preventDefault());
SVG.addEventListener("wheel", zoom);

document.addEventListener("keydown", e => {
  switch(e.code) {
  case "KeyE":
    switchToMode(Modes.ERASER);
    break;
  case "KeyB":
    switchToMode(Modes.BRUSH);
    break;
  case "Digit2":
  case "KeyO":
    switchToMode(Modes.OBJECT);
    break;
  case "Digit3":
  case "KeyP":
    switchToMode(Modes.PATH);
    break;
  }
})

function switchToMode(mode) {
  currentMode = mode;
  MODE_CONTROLS.forEach(mc => {
    if (mc.dataset.mode != currentMode) {
      mc.classList.add("hidden");
    } else {
      mc.classList.remove("hidden");
    }
  })
}

function zoom(e) {
  if (!zoomingEnabled) {
    return;
  }
  e.preventDefault();

  let scale = e.deltaY / 100;
  scale = Math.abs(scale) > .1 ? .1 * e.deltaY / Math.abs(e.deltaY) : scale;

  // mouse point within SVG space. Don't ask, I just copied-pasted
  const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(SVG.getScreenCTM().inverse());

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

function choose(choices) {
  let index = Math.floor(Math.random() * choices.length);
  return choices[index];
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
  hex.setAttribute("fill", foregroundColor);
  hex.classList.add("hex");

  hex.addEventListener("mousedown", (e) => {
    e.preventDefault();
    painting = true;
    // a right mouse down means paint with background colors
    paintingBackground = (e.button == 2);
    handleHexInteraction(c, r);
  });
  hex.addEventListener("mouseover", (e) => {
    if (painting) {
      handleHexInteraction(c, r);
    }
  });

  const hexObject = document.createElementNS("http://www.w3.org/2000/svg", "text");
  hexObject.setAttribute("x", x);
  hexObject.setAttribute("y", y);
  hexObject.classList.add("hex-object");

  HEXES[`${c},${r}`] = {hex, x, y};
  OBJECTS_ON_HEXES[`${c},${r}`] = hexObject;

  SVG.appendChild(hex);
  SVG.appendChild(hexObject);
}

function handleHexInteraction(c, r) {
  const {hex, x, y} = HEXES[`${c},${r}`];
  if (currentMode == Modes.BRUSH) {
    const fillColor = paintingBackground ? backgroundColor : foregroundColor;
    hex.setAttribute("fill", fillColor);
  } else if (currentMode == Modes.OBJECT) {
    if (currentObject == null) {
      return;
    }
    OBJECTS_ON_HEXES[`${c},${r}`].textContent = currentObject.dataset.text;
  } else if (currentMode == Modes.ERASER) {
    OBJECTS_ON_HEXES[`${c},${r}`].textContent = "";
    hex.setAttribute("fill", defaultForegroundColor);
  } else if (currentMode == Modes.PATH) {
    if (lastHex) {
      console.log(pathTip.getAttribute("c"), pathTip.getAttribute("r"), c, r);
      if (lastHex.c === c && lastHex.r === r)
        return;
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", lastHex.x);
      line.setAttribute("y1", lastHex.y);
      line.setAttribute("x2", x);
      line.setAttribute("y2", y);
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
      marker.classList.add("path-marker");
      SVG.appendChild(marker);
    }
    if (pathTip) SVG.removeChild(pathTip);
    pathTip = document.createElementNS("http://www.w3.org/2000/svg", "text");
    pathTip.setAttribute("x", x);
    pathTip.setAttribute("y", y);
    pathTip.setAttribute("c", c);
    pathTip.setAttribute("r", r);
    pathTip.textContent = currentPathTipSymbol;
    pathTip.classList.add("path-tip-symbol");
    lastHex = {c, r, x, y};
    SVG.appendChild(pathTip);
  }
}

function init() {
  for (let h in HEXES) delete HEXES[h];
  Array.prototype.slice.call(document.getElementsByTagName("polygon")).forEach(e => e.remove());

  for (let c = -0.5*HEX_COLS; c < 1.5*HEX_COLS; c++) {
    for (let r = -0.5*HEX_ROWS; r < 1.5*HEX_ROWS; r++) {
      drawHex(c, r);
    }
  }
  switchToMode(Modes.BRUSH);
  // smol beans grid for inspection ease
  // for (let c = 10; c < 12; c++) {
  //   for (let r = 5; r < 7; r++) {
  //     drawHex(c, r);
  //   }
  // }
}

init();
