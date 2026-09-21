/*************
 * CONSTANTS *
 *************/
const HEX_RADIUS = 35;
const HEX_RADIUS_SQUARED = HEX_RADIUS ** 2; // to avoid sqrt in distance calculations
const DEFAULT_TEXT_FONT_SIZE = 40;
const SVG_NS = "http://www.w3.org/2000/svg";
const STORAGE_PREFIX = "image-";
const AUTOSAVE_INTERVAL_MS = 5000;
const MAX_UNDO_STACK = 500;
const MAX_GRID_DIMENSION = 1000;
const MIN_VIEW_WIDTH = 50;
const MAX_VIEW_WIDTH = 200000;

const Layers = {
  GRID: "GRID",
  COLOR: "COLOR",
  OBJECT: "OBJECT",
  PATH: "PATH",
  BOUNDARY: "BOUNDARY",
  TEXT: "TEXT",
} as const;
type LayerName = (typeof Layers)[keyof typeof Layers];

const ControlSets = {
  ...Layers,
  // non-layer controlsets
  SETTINGS: "SETTINGS",
  FILEBROWSER: "FILEBROWSER",
} as const;
type ControlSetName = (typeof ControlSets)[keyof typeof ControlSets];

const Tools = {
  BRUSH: "BRUSH",
  FILL: "FILL",
  EYEDROPPER: "EYEDROPPER",
  ERASER: "ERASER",
  ZOOM: "ZOOM",
} as const;
type ToolName = (typeof Tools)[keyof typeof Tools];

const ControlPanels = {
  COLOR: "COLOR",
  OBJECT: "OBJECT",
  TEXT: "TEXT",
  GRID: "GRID",
  SETTINGS: "SETTINGS",
  MINIMAP: "MINIMAP",
  FILEBROWSER: "FILEBROWSER",
} as const;

const GridDirection = {
  HORIZONTAL: "HORIZONTAL",
  VERTICAL: "VERTICAL",
} as const;
type GridDirectionName = (typeof GridDirection)[keyof typeof GridDirection];

const LAYER_TOOL_COMPATIBILITY: Record<LayerName, readonly ToolName[]> = {
  [Layers.GRID]: [Tools.ZOOM],
  [Layers.COLOR]: [Tools.BRUSH, Tools.FILL, Tools.ERASER, Tools.EYEDROPPER, Tools.ZOOM],
  [Layers.OBJECT]: [Tools.BRUSH, Tools.ERASER, Tools.EYEDROPPER, Tools.ZOOM],
  [Layers.PATH]: [Tools.BRUSH, Tools.ERASER, Tools.ZOOM],
  [Layers.BOUNDARY]: [Tools.BRUSH, Tools.ERASER, Tools.ZOOM],
  [Layers.TEXT]: [Tools.BRUSH, Tools.ERASER, Tools.ZOOM],
};

const CONTROL_PANEL_COMPATIBILITY: Record<ControlSetName, readonly string[]> = {
  [ControlSets.GRID]: [ControlPanels.GRID, ControlPanels.MINIMAP],
  [ControlSets.COLOR]: [ControlPanels.COLOR, ControlPanels.MINIMAP],
  [ControlSets.OBJECT]: [ControlPanels.OBJECT, ControlPanels.MINIMAP],
  [ControlSets.PATH]: [ControlPanels.COLOR, ControlPanels.MINIMAP],
  [ControlSets.BOUNDARY]: [ControlPanels.COLOR, ControlPanels.MINIMAP],
  [ControlSets.TEXT]: [ControlPanels.COLOR, ControlPanels.TEXT, ControlPanels.MINIMAP],
  [ControlSets.SETTINGS]: [ControlPanels.SETTINGS, ControlPanels.MINIMAP],
  [ControlSets.FILEBROWSER]: [ControlPanels.FILEBROWSER, ControlPanels.MINIMAP],
};

// maps a layer to the SVG <g> that holds its content. GRID and COLOR both
// operate on the hex polygons, hence share HEXLayer.
const LAYER_TO_GROUP: Record<string, string> = {
  [Layers.GRID]: "HEXLayer",
  [Layers.COLOR]: "HEXLayer",
  [Layers.OBJECT]: "OBJECTLayer",
  [Layers.PATH]: "PATHLayer",
  [Layers.BOUNDARY]: "BOUNDARYLayer",
  [Layers.TEXT]: "TEXTLayer",
  HEX: "HEXLayer",
};

/****************
 * GLOBAL STATE *
 ****************/
interface CRN {
  c: number;
  r: number;
  n: number;
}

interface CR {
  c: number;
  r: number;
}

interface HexEntry {
  hex: SVGPolygonElement;
  minihex: SVGPolygonElement | null;
  hexObject: SVGTextElement | null;
  x: number;
  y: number;
  c: number;
  r: number;
}

type ActionType =
  | "canvasColor"
  | "gridColor"
  | "gridThickness"
  | "color"
  | "floodFill"
  | "object"
  | "boundary"
  | "text"
  | "path";

interface Action {
  type: ActionType;
  action?: "added" | "erased";
  target: {
    old?: string | null;
    new?: string | null;
    // color/object action
    cr?: CR;
    floodTargets?: string[];
    // boundary action
    fromCRN?: string;
    toCRN?: string;
    color?: string | null;
    // path action
    fromCR?: CR;
    toCR?: CR;
    lineColor?: string | null;
    highlightColor?: string | null;
    // text action
    pt?: DOMPoint;
    textDecoration?: string | null;
    fontStyle?: string | null;
    strokeWidth?: string | null;
    fontSize?: string | null;
    textInput?: string | null;
  };
}

interface GridLayerState {
  canvasColor: string;
  gridColor: string;
  gridDirection: GridDirectionName;
  gridThickness: string;
  cols: number;
  rows: number;
}

interface ColorLayerState {
  primaryColor: string;
  secondaryColor: string;
}

interface ObjectLayerState {
  primaryObject: string;
  secondaryObject: string;
}

interface PathLayerState {
  primaryColor: string;
  secondaryColor: string;
  lastHexEntry: HexEntry | null;
}

interface BoundaryLayerState {
  primaryColor: string;
  secondaryColor: string;
  lastCRN: CRN | null;
}

interface TextLayerState {
  primaryColor: string;
  secondaryColor: string;
  bold: boolean;
  italics: boolean;
  underline: boolean;
}

interface LayersState {
  GRID: GridLayerState;
  COLOR: ColorLayerState;
  OBJECT: ObjectLayerState;
  PATH: PathLayerState;
  BOUNDARY: BoundaryLayerState;
  TEXT: TextLayerState;
}

interface GlobalState {
  drawing: {
    fileName: string;
    // hexEntries[c][r] {hex, minihex, hexObject, x, y, c, r};
    hexEntries: (HexEntry | null)[][];
  };
  currentLayer: LayerName | null;
  currentTool: ToolName;
  mouseState: {
    holdingStdClick: boolean; // left or right
    holdingRightClick: boolean;
    holdingCenterClick: boolean;
  };
  temporaryTool: {
    previousTool: ToolName;
    active: boolean;
  };
  undoRedo: {
    pauseUndoStack: boolean; // to prevent adding actions to undo stack, during init/undo
    undoStack: Action[];
    redoStack: Action[];
  };
  layers: LayersState;
}

const GLOBAL_STATE: GlobalState = {
  drawing: {
    fileName: `Untitled${Date.now()}.svg`,
    hexEntries: [],
  },

  // everything else is just a way to maintain the state of the active
  // session. None of it should need to be exported, or set during import
  currentLayer: Layers.COLOR,
  currentTool: Tools.BRUSH,
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

// true whenever the in-memory drawing differs from what is in localStorage
let isDirty = false;
let quotaAlertShown = false;

/************************************************************************
 * THE DOM                                                              *
 * - image listeners should only go on constant elements we know exist, *
 *   and not on sub-SVG elements. This makes for more efficient event   *
 *   handling, and also makes importing simple, since we don't have to  *
 *   manage anything extra that could break/be forgotten.               *
 * - any persistent key/mouse state should go into GLOBAL_STATE so it   *
 *   can be cleared together.                                           *
 ************************************************************************/
function byId<T extends Element = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Hexaggon: expected element #${id} to exist`);
  }
  return el as unknown as T;
}

function elementsByClass(className: string): HTMLElement[] {
  return Array.from(document.getElementsByClassName(className)) as HTMLElement[];
}

const HEXAGGON_DIV = byId<HTMLDivElement>("hexaggon");
// the main drawing
const FILE_NAME_DIV = byId<HTMLDivElement>("fileName");
const SVG = byId<SVGSVGElement>("hexmap");
const SVG_STYLE = SVG.querySelector("style");
const MINIMAP = byId<SVGSVGElement>("minimap");
const MINIMAP_PREVIEW = byId<SVGGElement>("minimapPreview");
const MINIMAP_VIEWBOX = byId<SVGRectElement>("minimapViewBox");
// global application controls
const WELCOME_DIV = byId<HTMLDivElement>("welcomeContainer");
const WELCOME_FILE_BROWSER_DIV = byId<HTMLDivElement>("welcomeContainerFileBrowser");
const LAYER_PICKER_BUTTONS = elementsByClass("layer-picker-btn");
const NON_LAYER_CONTROL_SET_PICKER_BUTTONS = elementsByClass("non-layer-picker-btn");
const TOOL_PICKER_BUTTONS = elementsByClass("tool-picker-btn");
const CONTROL_PANEL_DIVS = elementsByClass("control-panel");
const SAVE_BUTTON = byId<HTMLButtonElement>("saveBtn");
const FILE_UPLOAD_INPUT = byId<HTMLInputElement>("fileUpload");
const FILE_BROWSER_DIV = byId<HTMLDivElement>("fileBrowser");
// shared across many layers
const CHOSEN_PRIMARY_COLOR_DIV = byId<SVGRectElement>("chosenPrimaryColor");
const CHOSEN_SECONDARY_COLOR_DIV = byId<SVGRectElement>("chosenSecondaryColor");
const COLOR_CONTROL_SWATCHES = Array.from(
  byId("colorControlPalette").getElementsByClassName("swatch"),
);
// grid layer
const GRID_DIRECTION_BUTTONS = elementsByClass("grid-direction-btn");
const GRID_SAMPLE_DIVS = Array.from(document.getElementsByClassName("grid-sample"));
const GRID_THICKNESS_SLIDER_DIV = byId<HTMLInputElement>("gridThicknessSlider");
const GRID_ROWS_INPUT = byId<HTMLInputElement>("gridRows");
const GRID_COLS_INPUT = byId<HTMLInputElement>("gridCols");
const CANVAS_COLOR_SWATCHES = Array.from(byId("canvasColor").getElementsByClassName("swatch"));
const GRID_COLOR_SWATCHES = Array.from(byId("gridColor").getElementsByClassName("swatch"));
// object layer
const OBJECT_BUTTONS = elementsByClass("object-btn");
// text layer
const TEXT_INPUT_DIV = byId<HTMLInputElement>("textInput");
const TEXT_FONT_SIZE_DIV = byId<HTMLInputElement>("textFontSize");
const TEXT_BOLD_DIV = byId<HTMLButtonElement>("textBold");
const TEXT_ITALICS_DIV = byId<HTMLButtonElement>("textItalics");
const TEXT_UNDERLINE_DIV = byId<HTMLButtonElement>("textUnderline");

/***********
 * HELPERS *
 ***********/
function logUnexpectedError(msg: string) {
  console.warn(`Hexaggon: unexpected state: ${msg}`);
}

function getSvgLayer(layer: string): Element {
  const groupId = LAYER_TO_GROUP[layer] ?? `${layer}Layer`;
  return document.getElementById(groupId) ?? SVG;
}

function getHexEntry(c: number, r: number): HexEntry | null {
  return GLOBAL_STATE.drawing.hexEntries[c]?.[r] ?? null;
}

function getHexPoint(hex: SVGPolygonElement, index: number): { x: number; y: number } | null {
  const points = hex.points;
  if (index < 0 || index >= points.numberOfItems) {
    return null;
  }
  return points.getItem(index);
}

function pointsToString(points: SVGPointList): string {
  const parts: string[] = [];
  for (let i = 0; i < points.numberOfItems; i++) {
    const p = points.getItem(i);
    parts.push(`${p.x},${p.y}`);
  }
  return parts.join(" ");
}

function getViewBox(): { x: number; y: number; width: number; height: number } | null {
  const viewBox = SVG.getAttribute("viewBox");
  if (!viewBox) {
    return null;
  }
  const parts = viewBox
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const [x, y, width, height] = parts;
  if (x === undefined || y === undefined || width === undefined || height === undefined) {
    return null;
  }
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return null;
  }
  return { x, y, width, height };
}

function setViewBox(x: number, y: number, width: number, height: number) {
  SVG.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
  syncMinimapViewBoxFromSvg();
}

function syncMinimapViewBoxFromSvg() {
  const viewBox = getViewBox();
  if (!viewBox) {
    return;
  }
  MINIMAP_VIEWBOX.setAttribute("x", viewBox.x.toString());
  MINIMAP_VIEWBOX.setAttribute("y", viewBox.y.toString());
  MINIMAP_VIEWBOX.setAttribute("width", viewBox.width.toString());
  MINIMAP_VIEWBOX.setAttribute("height", viewBox.height.toString());
}

function screenToSvg(clientX: number, clientY: number): DOMPoint | null {
  const ctm = SVG.getScreenCTM();
  if (!ctm) {
    return null;
  }
  try {
    return new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  } catch {
    return null;
  }
}

function parseCRN(str: string | undefined): CRN | null {
  if (!str) {
    return null;
  }
  const [c, r, n] = str.split(",").map(Number);
  if (
    c === undefined ||
    r === undefined ||
    n === undefined ||
    !Number.isInteger(c) ||
    !Number.isInteger(r) ||
    !Number.isInteger(n)
  ) {
    return null;
  }
  return { c, r, n };
}

function crnToString(crn: CRN): string {
  return `${crn.c},${crn.r},${crn.n}`;
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function parsePx(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const num = parseFloat(value);
  return Number.isFinite(num) ? String(num) : null;
}

/*************************
 * TRANSIENT MOUSE STATE *
 *************************/
function resetInteractionState() {
  window.removeEventListener("mousemove", drawBoundary);
  window.removeEventListener("mousemove", freeDragScroll);
  GLOBAL_STATE.layers.BOUNDARY.lastCRN = null;
  GLOBAL_STATE.layers.PATH.lastHexEntry = null;
  GLOBAL_STATE.mouseState.holdingStdClick = false;
  GLOBAL_STATE.mouseState.holdingRightClick = false;
  GLOBAL_STATE.mouseState.holdingCenterClick = false;
  switchToCursor(GLOBAL_STATE.currentTool);
}

function dropTemporaryModes() {
  if (GLOBAL_STATE.temporaryTool.active) {
    GLOBAL_STATE.temporaryTool.active = false;
    switchToTool(GLOBAL_STATE.temporaryTool.previousTool);
  }
}

function switchToCursor(name: string) {
  for (const tool of Object.values(Tools)) {
    SVG.classList.remove(`${tool.toLowerCase()}cursor`);
  }
  SVG.classList.remove("movecursor");
  SVG.classList.add(`${name.toLowerCase()}cursor`);
}

/************************************
 * COORDINATING GLOBAL STATE AND UI *
 ************************************/
function setPrimaryObject(objectText: string | undefined) {
  if (!objectText) {
    return;
  }
  GLOBAL_STATE.layers.OBJECT.primaryObject = objectText;
  for (const b of OBJECT_BUTTONS) {
    b.classList.toggle("primaryselected", b.dataset["text"] === objectText);
  }
}

function setSecondaryObject(objectText: string | undefined) {
  if (!objectText) {
    return;
  }
  GLOBAL_STATE.layers.OBJECT.secondaryObject = objectText;
  for (const b of OBJECT_BUTTONS) {
    b.classList.toggle("secondaryselected", b.dataset["text"] === objectText);
  }
}

function getColorState(
  layer: LayerName,
): ColorLayerState | PathLayerState | BoundaryLayerState | TextLayerState | null {
  switch (layer) {
    case Layers.COLOR:
      return GLOBAL_STATE.layers.COLOR;
    case Layers.PATH:
      return GLOBAL_STATE.layers.PATH;
    case Layers.BOUNDARY:
      return GLOBAL_STATE.layers.BOUNDARY;
    case Layers.TEXT:
      return GLOBAL_STATE.layers.TEXT;
    default:
      return null;
  }
}

function setPrimaryColor(color: string | null | undefined) {
  if (color == null) {
    return;
  }
  const layer = GLOBAL_STATE.currentLayer;
  if (layer) {
    const colorState = getColorState(layer);
    if (colorState) {
      colorState.primaryColor = color;
    }
  }
  CHOSEN_PRIMARY_COLOR_DIV.setAttribute("fill", color);
}

function setSecondaryColor(color: string | null | undefined) {
  if (color == null) {
    return;
  }
  const layer = GLOBAL_STATE.currentLayer;
  if (layer) {
    const colorState = getColorState(layer);
    if (colorState) {
      colorState.secondaryColor = color;
    }
  }
  CHOSEN_SECONDARY_COLOR_DIV.setAttribute("fill", color);
}

function setFileBrowserView(fileName: string) {
  GLOBAL_STATE.drawing.fileName = fileName;
  FILE_NAME_DIV.textContent = fileName;
  populateFileBrowser();
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    HEXAGGON_DIV.requestFullscreen().catch(() => {
      logUnexpectedError("fullscreen request was rejected");
    });
  } else {
    document.exitFullscreen().catch(() => {
      logUnexpectedError("exiting fullscreen failed");
    });
  }
}

const welcomePreviewUrls: string[] = [];
let welcomeScreenCleared = false;

function clearWelcomeScreen() {
  if (welcomeScreenCleared) {
    return;
  }
  welcomeScreenCleared = true;
  for (const url of welcomePreviewUrls) {
    URL.revokeObjectURL(url);
  }
  welcomePreviewUrls.length = 0;
  WELCOME_DIV.remove();
  HEXAGGON_DIV.classList.remove("frosted");
}

/************************
 * GLOBAL FUNCTIONALITY *
 ************************/
function switchToControlSet(controlSet: string, isLayer = true) {
  const panels = CONTROL_PANEL_COMPATIBILITY[controlSet as ControlSetName];
  if (!panels) {
    return;
  }

  // switching layers mid-interaction would leave transient listeners alive
  resetInteractionState();

  const previousLayer = GLOBAL_STATE.currentLayer;
  GLOBAL_STATE.currentLayer = isLayer ? (controlSet as LayerName) : null;

  for (const panel of CONTROL_PANEL_DIVS) {
    panel.classList.toggle("hidden", !panels.includes(panel.dataset["control"] ?? ""));
  }
  // the file list can change behind our back (autosave, another tab), so
  // refresh it whenever the browser panel is opened
  if (controlSet === ControlSets.FILEBROWSER) {
    populateFileBrowser();
  }
  for (const tpb of TOOL_PICKER_BUTTONS) {
    const tool = tpb.dataset["tool"] ?? "";
    const compatible =
      isLayer && LAYER_TOOL_COMPATIBILITY[controlSet as LayerName]?.includes(tool as ToolName);
    tpb.classList.toggle("disabled-btn", !compatible);
  }
  for (const b of LAYER_PICKER_BUTTONS) {
    b.classList.toggle("selected", b.dataset["controlset"] === controlSet);
  }
  if (previousLayer) {
    document.querySelectorAll(`.eraseable-${previousLayer}`).forEach((e) => {
      e.classList.add("no-pointer-events");
    });
  }
  if (isLayer) {
    const layer = controlSet as LayerName;
    const tools = LAYER_TOOL_COMPATIBILITY[layer];
    const firstTool = tools?.[0];
    if (firstTool) {
      switchToTool(firstTool);
    }
    document.querySelectorAll(`.eraseable-${layer}`).forEach((e) => {
      e.classList.remove("no-pointer-events");
    });
    const colorState = getColorState(layer);
    if (colorState) {
      setPrimaryColor(colorState.primaryColor);
      setSecondaryColor(colorState.secondaryColor);
    }
  }
}

function switchToTool(tool: string, temporarily = false) {
  const layer = GLOBAL_STATE.currentLayer;
  const compatibleTools = layer ? LAYER_TOOL_COMPATIBILITY[layer] : undefined;
  if (!compatibleTools || !compatibleTools.includes(tool as ToolName)) {
    return;
  }

  if (temporarily) {
    GLOBAL_STATE.temporaryTool.previousTool = GLOBAL_STATE.currentTool;
    GLOBAL_STATE.temporaryTool.active = true;
  }

  switchToCursor(tool);
  for (const b of TOOL_PICKER_BUTTONS) {
    b.classList.toggle("selected", b.dataset["tool"] === tool);
  }
  GLOBAL_STATE.currentTool = tool as ToolName;
}

/****************
 * SERIALIZATION *
 ****************/
// produces an SVG string with the viewBox set to the drawing's bounding box,
// so that saved/exported files are framed on their content rather than the
// current pan/zoom of the editor.
function serializeSvg(): string {
  const clonedSvg = SVG.cloneNode(true) as SVGSVGElement;
  try {
    const bbox = SVG.getBBox();
    if (bbox.width > 0 && bbox.height > 0) {
      clonedSvg.setAttribute("viewBox", `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
    }
  } catch {
    // getBBox can fail if the SVG is not rendered; keep the existing viewBox
  }
  return clonedSvg.outerHTML;
}

function exportToSvg() {
  const preface = '<?xml version="1.0" standalone="no"?>\r\n';
  const svgBlob = new Blob([preface, serializeSvg()], {
    type: "image/svg+xml;charset=utf-8",
  });
  const svgUrl = URL.createObjectURL(svgBlob);
  const downloadLink = document.createElement("a");
  downloadLink.href = svgUrl;
  downloadLink.download = GLOBAL_STATE.drawing.fileName || "map.svg";
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  // give the browser a chance to start the download before revoking
  setTimeout(() => URL.revokeObjectURL(svgUrl), 1000);
}

// the function that coordinates the entire interaction with the map
function handleHexInteraction(c: number, r: number, mouseX: number, mouseY: number) {
  const hexEntry = getHexEntry(c, r);
  if (!hexEntry) {
    return;
  }
  const layer = GLOBAL_STATE.currentLayer;
  if (layer === Layers.COLOR) {
    switch (GLOBAL_STATE.currentTool) {
      case Tools.BRUSH:
        colorHex(c, r);
        break;
      case Tools.FILL:
        floodFill(c, r);
        break;
      case Tools.ERASER:
        colorHex(c, r, GLOBAL_STATE.layers.GRID.canvasColor);
        break;
      case Tools.EYEDROPPER:
        if (GLOBAL_STATE.mouseState.holdingRightClick) {
          setSecondaryColor(hexEntry.hex.getAttribute("fill"));
        } else {
          setPrimaryColor(hexEntry.hex.getAttribute("fill"));
        }
        break;
    }
  } else if (layer === Layers.OBJECT) {
    switch (GLOBAL_STATE.currentTool) {
      case Tools.BRUSH:
        placeObjectOnHex(c, r);
        break;
      case Tools.ERASER:
        placeObjectOnHex(c, r, "");
        break;
      case Tools.EYEDROPPER: {
        const objectText = hexEntry.hexObject?.textContent;
        if (objectText != null) {
          if (GLOBAL_STATE.mouseState.holdingRightClick) {
            setSecondaryObject(objectText);
          } else {
            setPrimaryObject(objectText);
          }
        }
        break;
      }
    }
  } else if (layer === Layers.BOUNDARY) {
    if (GLOBAL_STATE.currentTool === Tools.BRUSH) {
      startBoundaryDrawing(hexEntry, mouseX, mouseY);
    }
  } else if (layer === Layers.TEXT) {
    if (GLOBAL_STATE.currentTool === Tools.BRUSH) {
      const pt = screenToSvg(mouseX, mouseY);
      if (pt) {
        placeText(pt);
      }
    }
  } else if (layer === Layers.PATH) {
    if (GLOBAL_STATE.currentTool === Tools.BRUSH) {
      drawPath(hexEntry);
    }
  }
}

/*************
 * UNDO/REDO *
 *************/
function markDirty() {
  isDirty = true;
  SVG.dataset["lastmodified"] = Date.now().toString();
}

function addToUndoStack(action: Action) {
  // this is the cleanest single point of knowing when the map is edited
  markDirty();
  if (GLOBAL_STATE.undoRedo.pauseUndoStack) {
    return;
  }
  GLOBAL_STATE.undoRedo.undoStack.push(action);
  // any new action invalidates the redo history
  GLOBAL_STATE.undoRedo.redoStack.length = 0;
  if (GLOBAL_STATE.undoRedo.undoStack.length > MAX_UNDO_STACK) {
    GLOBAL_STATE.undoRedo.undoStack.shift();
  }
}

function undoLastAction() {
  const action = GLOBAL_STATE.undoRedo.undoStack.pop();
  if (!action) {
    return;
  }
  applyAction(action, true);
  GLOBAL_STATE.undoRedo.redoStack.push(action);
}

function redoLastAction() {
  const action = GLOBAL_STATE.undoRedo.redoStack.pop();
  if (!action) {
    return;
  }
  applyAction(action, false);
  GLOBAL_STATE.undoRedo.undoStack.push(action);
}

// applies an action in either direction. `undo` = true reverts it, false redoes it.
function applyAction(action: Action, undo: boolean) {
  GLOBAL_STATE.undoRedo.pauseUndoStack = true;
  try {
    switch (action.type) {
      case "canvasColor": {
        const oldColor = action.target.old;
        const newColor = action.target.new;
        if (oldColor == null || newColor == null) {
          break;
        }
        if (undo) {
          setCanvasColor(newColor, oldColor);
        } else {
          setCanvasColor(oldColor, newColor);
        }
        break;
      }
      case "gridColor": {
        const oldColor = action.target.old;
        const newColor = action.target.new;
        if (oldColor == null || newColor == null) {
          break;
        }
        if (undo) {
          setGridColor(newColor, oldColor);
        } else {
          setGridColor(oldColor, newColor);
        }
        break;
      }
      case "gridThickness": {
        const thickness = undo ? action.target.old : action.target.new;
        if (thickness != null) {
          setGridThickness(thickness);
        }
        break;
      }
      case "color": {
        const cr = action.target.cr;
        const color = undo ? action.target.old : action.target.new;
        if (cr && color != null) {
          colorHex(cr.c, cr.r, color);
        }
        break;
      }
      case "floodFill": {
        const targets = action.target.floodTargets ?? [];
        const color = undo ? action.target.old : action.target.new;
        if (color == null) {
          break;
        }
        for (const target of targets) {
          const [c, r] = target.split(",").map(Number);
          if (c !== undefined && r !== undefined && Number.isInteger(c) && Number.isInteger(r)) {
            colorHex(c, r, color, true);
          }
        }
        break;
      }
      case "object": {
        const cr = action.target.cr;
        const objectText = undo ? action.target.old : action.target.new;
        if (cr && objectText != null) {
          placeObjectOnHex(cr.c, cr.r, objectText);
        }
        break;
      }
      case "boundary": {
        const fromCRN = parseCRN(action.target.fromCRN);
        const toCRN = parseCRN(action.target.toCRN);
        const color = action.target.color;
        if (!fromCRN || !toCRN || color == null) {
          break;
        }
        if (shouldAddAction(action, undo)) {
          drawBoundaryLine(fromCRN, toCRN, color);
        } else {
          removeBoundary(fromCRN, toCRN, color);
        }
        break;
      }
      case "text": {
        const pt = action.target.pt;
        if (!pt) {
          break;
        }
        if (shouldAddAction(action, undo)) {
          placeTextWithConfig(
            pt,
            action.target.textInput ?? "",
            action.target.fontSize ?? String(DEFAULT_TEXT_FONT_SIZE),
            action.target.strokeWidth ?? null,
            action.target.fontStyle ?? null,
            action.target.textDecoration ?? null,
            action.target.color ?? "",
          );
        } else {
          removeText(pt, action.target.textInput ?? "", action.target.color ?? null);
        }
        break;
      }
      case "path": {
        const fromCR = action.target.fromCR;
        const toCR = action.target.toCR;
        if (!fromCR || !toCR) {
          break;
        }
        if (shouldAddAction(action, undo)) {
          const fromEntry = getHexEntry(fromCR.c, fromCR.r);
          const toEntry = getHexEntry(toCR.c, toCR.r);
          if (fromEntry && toEntry) {
            drawLineAndHighlight(
              fromEntry,
              toEntry,
              action.target.lineColor ?? "",
              action.target.highlightColor ?? "",
            );
          }
        } else {
          removePath(
            fromCR,
            toCR,
            action.target.lineColor ?? null,
            action.target.highlightColor ?? null,
          );
        }
        break;
      }
    }
  } finally {
    GLOBAL_STATE.undoRedo.pauseUndoStack = false;
  }
  // the underlying setters may not have marked us dirty (e.g. grid thickness)
  markDirty();
}

// "added" actions are applied when redoing, "erased" actions when undoing
function shouldAddAction(action: Action, undo: boolean): boolean {
  return (action.action === "added") !== undo;
}

/****************************
 * GRID LAYER FUNCTIONALITY *
 ****************************/
function setCanvasColor(previousCanvasColor: string | null, color: string) {
  if (previousCanvasColor === color) {
    return;
  }
  for (const e of GRID_SAMPLE_DIVS) {
    e.setAttribute("fill", color);
  }
  for (const hexEntriesRow of GLOBAL_STATE.drawing.hexEntries) {
    for (const hexEntry of hexEntriesRow) {
      if (!hexEntry) {
        continue;
      }
      if (hexEntry.hex.getAttribute("fill") === previousCanvasColor) {
        hexEntry.hex.setAttribute("fill", color);
        hexEntry.minihex?.setAttribute("fill", color);
        hexEntry.minihex?.setAttribute("stroke", color);
      }
    }
  }
  HEXAGGON_DIV.style.background = color;
  GLOBAL_STATE.layers.GRID.canvasColor = color;
  SVG.dataset["canvasColor"] = color;
  addToUndoStack({
    type: "canvasColor",
    target: { old: previousCanvasColor, new: color },
  });
}

function setGridColor(previousGridColor: string | null, color: string) {
  if (previousGridColor === color) {
    return;
  }
  for (const hexEntriesRow of GLOBAL_STATE.drawing.hexEntries) {
    for (const hexEntry of hexEntriesRow) {
      if (!hexEntry) {
        continue;
      }
      hexEntry.hex.setAttribute("stroke", color);
      hexEntry.minihex?.setAttribute("stroke", color);
    }
  }
  for (const e of GRID_SAMPLE_DIVS) {
    e.setAttribute("stroke", color);
  }
  GLOBAL_STATE.layers.GRID.gridColor = color;
  SVG.dataset["gridColor"] = color;
  addToUndoStack({ type: "gridColor", target: { old: previousGridColor, new: color } });
}

// pure state/DOM update - undo entries are added by the slider handler so that
// dragging the slider produces a single undo step instead of hundreds.
function setGridThickness(thickness: string) {
  GLOBAL_STATE.layers.GRID.gridThickness = thickness;
  for (const hexEntriesRow of GLOBAL_STATE.drawing.hexEntries) {
    for (const hexEntry of hexEntriesRow) {
      hexEntry?.hex.setAttribute("stroke-width", `${thickness}px`);
    }
  }
  GRID_THICKNESS_SLIDER_DIV.value = thickness;
}

function setGridDirection(gridDirection: GridDirectionName) {
  GLOBAL_STATE.layers.GRID.gridDirection = gridDirection;
  SVG.dataset["griddirection"] = gridDirection;
  for (const b of GRID_DIRECTION_BUTTONS) {
    b.classList.toggle("primaryselected", b.dataset["direction"] === gridDirection);
  }
}

function updateGridDimensionInputs() {
  GRID_ROWS_INPUT.value = GLOBAL_STATE.layers.GRID.rows.toString();
  GRID_COLS_INPUT.value = GLOBAL_STATE.layers.GRID.cols.toString();
}

function clampGridDimension(value: string): number | null {
  const parsed = parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    return null;
  }
  return Math.min(Math.max(parsed, 1), MAX_GRID_DIMENSION);
}

// grows/shrinks the hex grid. Existing hexes keep their content; hexes that
// fall outside the new bounds (and the paths/boundaries/objects that depend on
// them) are removed.
function resizeGrid(newCols: number, newRows: number) {
  const oldCols = GLOBAL_STATE.layers.GRID.cols;
  const oldRows = GLOBAL_STATE.layers.GRID.rows;
  if (newCols === oldCols && newRows === oldRows) {
    return;
  }

  const removedHexKeys = new Set<string>();
  for (let c = 0; c < oldCols; c++) {
    for (let r = 0; r < oldRows; r++) {
      if (c >= newCols || r >= newRows) {
        removedHexKeys.add(`${c},${r}`);
      }
    }
  }

  if (removedHexKeys.size > 0) {
    const confirmed = confirm(
      "Shrinking the grid will delete any content outside the new bounds. Continue?",
    );
    if (!confirmed) {
      updateGridDimensionInputs();
      return;
    }
    removeContentOnHexes(removedHexKeys);
  }

  // build the new grid, reusing existing hexes where possible
  const newEntries: HexEntry[][] = [];
  for (let c = 0; c < newCols; c++) {
    const row: HexEntry[] = [];
    for (let r = 0; r < newRows; r++) {
      row.push(getHexEntry(c, r) ?? drawHex(c, r));
    }
    newEntries.push(row);
  }
  // remove the now-orphaned hex elements
  for (const key of removedHexKeys) {
    const [c, r] = key.split(",").map(Number);
    if (c !== undefined && r !== undefined) {
      getHexEntry(c, r)?.hex.remove();
    }
  }

  GLOBAL_STATE.drawing.hexEntries = newEntries;
  GLOBAL_STATE.layers.GRID.cols = newCols;
  GLOBAL_STATE.layers.GRID.rows = newRows;

  positionHexes(GLOBAL_STATE.layers.GRID.gridDirection);
  const canvasColor = GLOBAL_STATE.layers.GRID.canvasColor;
  const gridColor = GLOBAL_STATE.layers.GRID.gridColor;
  const gridThickness = GLOBAL_STATE.layers.GRID.gridThickness;
  for (const row of newEntries) {
    for (const entry of row) {
      if (!entry.hex.getAttribute("fill")) {
        entry.hex.setAttribute("fill", canvasColor);
      }
      entry.hex.setAttribute("stroke", gridColor);
      entry.hex.setAttribute("stroke-width", `${gridThickness}px`);
    }
  }
  repositionPaths();
  repositionBoundaries();
  initMiniMap();
  updateGridDimensionInputs();
  markDirty();
}

function removeContentOnHexes(removedHexKeys: Set<string>) {
  for (const el of Array.from(SVG.getElementsByClassName("hex-object"))) {
    if (removedHexKeys.has(`${el.getAttribute("data-c")},${el.getAttribute("data-r")}`)) {
      el.remove();
    }
  }
  for (const el of Array.from(SVG.querySelectorAll(".path, .path-highlight"))) {
    if (!(el instanceof SVGLineElement)) {
      continue;
    }
    const fromKey = `${el.dataset["c1"]},${el.dataset["r1"]}`;
    const toKey = `${el.dataset["c2"]},${el.dataset["r2"]}`;
    if (removedHexKeys.has(fromKey) || removedHexKeys.has(toKey)) {
      el.remove();
    }
  }
  for (const el of Array.from(SVG.getElementsByClassName("boundary"))) {
    if (!(el instanceof SVGLineElement)) {
      continue;
    }
    const fromCRN = parseCRN(el.dataset["fromcrn"]);
    const toCRN = parseCRN(el.dataset["tocrn"]);
    if (!fromCRN || !toCRN) {
      continue;
    }
    if (
      removedHexKeys.has(`${fromCRN.c},${fromCRN.r}`) ||
      removedHexKeys.has(`${toCRN.c},${toCRN.r}`)
    ) {
      el.remove();
    }
  }
}

/*****************************
 * COLOR LAYER FUNCTIONALITY *
 *****************************/
function colorHex(c: number, r: number, fillColor: string | null = null, isFloodFill = false) {
  const hexEntry = getHexEntry(c, r);
  if (!hexEntry) {
    return;
  }
  if (!fillColor) {
    fillColor = GLOBAL_STATE.mouseState.holdingRightClick
      ? GLOBAL_STATE.layers.COLOR.secondaryColor
      : GLOBAL_STATE.layers.COLOR.primaryColor;
  }
  const oldFillColor = hexEntry.hex.getAttribute("fill");
  if (oldFillColor === fillColor) {
    return;
  }
  hexEntry.hex.setAttribute("fill", fillColor);
  hexEntry.minihex?.setAttribute("fill", fillColor);
  if (!isFloodFill) {
    addToUndoStack({
      type: "color",
      target: { cr: { c, r }, old: oldFillColor, new: fillColor },
    });
  }
}

function floodFill(startC: number, startR: number) {
  const startEntry = getHexEntry(startC, startR);
  if (!startEntry) {
    return;
  }
  const oldFillColor = startEntry.hex.getAttribute("fill");
  const newFillColor = GLOBAL_STATE.mouseState.holdingRightClick
    ? GLOBAL_STATE.layers.COLOR.secondaryColor
    : GLOBAL_STATE.layers.COLOR.primaryColor;
  if (oldFillColor === newFillColor) {
    return;
  }

  const gridDirection = GLOBAL_STATE.layers.GRID.gridDirection;
  const cols = GLOBAL_STATE.layers.GRID.cols;
  const rows = GLOBAL_STATE.layers.GRID.rows;

  const visited: CR[] = [{ c: startC, r: startR }];
  const visitedSet = new Set<string>([`${startC},${startR}`]);
  const queue: CR[] = [{ c: startC, r: startR }];
  // for-of over an array observes items appended during iteration, which is
  // exactly the breadth-first behaviour we want here.
  for (const current of queue) {
    for (const [nc, nr] of getHexNeighbors(current.c, current.r, gridDirection)) {
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) {
        continue;
      }
      const key = `${nc},${nr}`;
      if (visitedSet.has(key)) {
        continue;
      }
      const neighbor = getHexEntry(nc, nr);
      if (!neighbor || neighbor.hex.getAttribute("fill") !== oldFillColor) {
        continue;
      }
      visitedSet.add(key);
      visited.push({ c: nc, r: nr });
      queue.push({ c: nc, r: nr });
    }
  }

  for (const cr of visited) {
    colorHex(cr.c, cr.r, newFillColor, true);
  }
  addToUndoStack({
    type: "floodFill",
    target: {
      floodTargets: visited.map((cr) => `${cr.c},${cr.r}`),
      old: oldFillColor,
      new: newFillColor,
    },
  });
}

/******************************
 * OBJECT LAYER FUNCTIONALITY *
 ******************************/
function placeObjectOnHex(c: number, r: number, objectToUse: string | null = null) {
  // if objectToUse = "" empty string, empty/delete the text.
  // we create/delete instead of keeping a permanent text element because this
  // takes up literally 60% of the space of even a well-populated map
  const hexEntry = getHexEntry(c, r);
  if (!hexEntry) {
    return;
  }
  if (objectToUse === null) {
    objectToUse = GLOBAL_STATE.mouseState.holdingRightClick
      ? GLOBAL_STATE.layers.OBJECT.secondaryObject
      : GLOBAL_STATE.layers.OBJECT.primaryObject;
  }
  const oldObject = hexEntry.hexObject;
  const oldObjectText = oldObject?.textContent ?? "";
  if (oldObjectText === objectToUse) {
    return;
  }
  if (objectToUse === "") {
    oldObject?.remove();
    hexEntry.hexObject = null;
  } else {
    let hexObject = oldObject;
    if (!hexObject) {
      hexObject = document.createElementNS(SVG_NS, "text") as SVGTextElement;
      hexObject.dataset["c"] = c.toString();
      hexObject.dataset["r"] = r.toString();
      hexObject.setAttribute("x", hexEntry.x.toString());
      hexObject.setAttribute("y", hexEntry.y.toString());
      hexObject.classList.add("no-pointer-events", "hex-object", `layer-${Layers.OBJECT}`);
      getSvgLayer(Layers.OBJECT).appendChild(hexObject);
      hexEntry.hexObject = hexObject;
    }
    hexObject.textContent = objectToUse;
  }
  addToUndoStack({
    type: "object",
    target: { cr: { c, r }, old: oldObjectText, new: objectToUse },
  });
}

/****************************
 * PATH LAYER FUNCTIONALITY *
 ****************************/
function repositionPaths() {
  for (const path of Array.from(SVG.querySelectorAll<SVGLineElement>(".path, .path-highlight"))) {
    const hexEntry1 = getHexEntry(Number(path.dataset["c1"]), Number(path.dataset["r1"]));
    const hexEntry2 = getHexEntry(Number(path.dataset["c2"]), Number(path.dataset["r2"]));
    if (!hexEntry1 || !hexEntry2) {
      logUnexpectedError("path refers to a hex that no longer exists");
      continue;
    }
    path.setAttribute("x1", hexEntry1.x.toString());
    path.setAttribute("y1", hexEntry1.y.toString());
    path.setAttribute("x2", hexEntry2.x.toString());
    path.setAttribute("y2", hexEntry2.y.toString());
  }
}

function createLine(x1: number, y1: number, x2: number, y2: number, stroke: string) {
  const line = document.createElementNS(SVG_NS, "line") as SVGLineElement;
  line.setAttribute("x1", x1.toString());
  line.setAttribute("y1", y1.toString());
  line.setAttribute("x2", x2.toString());
  line.setAttribute("y2", y2.toString());
  line.setAttribute("stroke", stroke);
  return line;
}

function drawLineAndHighlight(
  fromHexEntry: HexEntry,
  toHexEntry: HexEntry,
  lineColor: string,
  highlightColor: string,
) {
  const id = newId();
  const line = createLine(fromHexEntry.x, fromHexEntry.y, toHexEntry.x, toHexEntry.y, lineColor);
  line.dataset["c1"] = fromHexEntry.c.toString();
  line.dataset["r1"] = fromHexEntry.r.toString();
  line.dataset["c2"] = toHexEntry.c.toString();
  line.dataset["r2"] = toHexEntry.r.toString();
  // the highlight is the clickable part; the visible line must not intercept
  // pointer events or erasing the path would be unreliable
  line.classList.add("path", `layer-${Layers.PATH}`, "no-pointer-events");
  line.id = `path-${id}`;

  const lineHighlight = createLine(
    fromHexEntry.x,
    fromHexEntry.y,
    toHexEntry.x,
    toHexEntry.y,
    highlightColor,
  );
  lineHighlight.dataset["c1"] = fromHexEntry.c.toString();
  lineHighlight.dataset["r1"] = fromHexEntry.r.toString();
  lineHighlight.dataset["c2"] = toHexEntry.c.toString();
  lineHighlight.dataset["r2"] = toHexEntry.r.toString();
  lineHighlight.classList.add("path-highlight", `layer-${Layers.PATH}`, `eraseable-${Layers.PATH}`);
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
  getSvgLayer(Layers.PATH).appendChild(lineHighlight);
  getSvgLayer(Layers.PATH).appendChild(line);
}

function drawPath(hexEntry: HexEntry) {
  const lastHexEntry = GLOBAL_STATE.layers.PATH.lastHexEntry;
  if (!lastHexEntry) {
    GLOBAL_STATE.layers.PATH.lastHexEntry = hexEntry;
    return;
  }
  if (lastHexEntry.c === hexEntry.c && lastHexEntry.r === hexEntry.r) {
    return;
  }
  GLOBAL_STATE.layers.PATH.lastHexEntry = hexEntry;
  drawLineAndHighlight(
    lastHexEntry,
    hexEntry,
    GLOBAL_STATE.layers.PATH.primaryColor,
    GLOBAL_STATE.layers.PATH.secondaryColor,
  );
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
function closestVertexIndex(hex: SVGPolygonElement, pt: DOMPoint): number {
  let closestN = -1;
  let closestDistance = Infinity;
  const points = hex.points;
  for (let i = 0; i < points.numberOfItems; i++) {
    const p = points.getItem(i);
    // first, check that the point is even a neighbor - since we know it's a hex
    // vertex, it must be within HEX_RADIUS distance in both dimensions. This
    // helps cut down how much squaring we have to do
    if (Math.abs(p.x - pt.x) < HEX_RADIUS && Math.abs(p.y - pt.y) < HEX_RADIUS) {
      const distance = (p.x - pt.x) ** 2 + (p.y - pt.y) ** 2;
      if (distance < closestDistance) {
        closestN = i;
        closestDistance = distance;
      }
    }
  }
  return closestN;
}

function startBoundaryDrawing(hexEntry: HexEntry, mouseX: number, mouseY: number) {
  if (GLOBAL_STATE.layers.BOUNDARY.lastCRN != null) {
    return;
  }
  const pt = screenToSvg(mouseX, mouseY);
  if (!pt) {
    return;
  }
  const closestN = closestVertexIndex(hexEntry.hex, pt);
  if (closestN < 0) {
    return;
  }
  GLOBAL_STATE.layers.BOUNDARY.lastCRN = { c: hexEntry.c, r: hexEntry.r, n: closestN };

  // our primary mouseover event isn't good enough, since it only fires once per hex.
  // at the same time, having a mousemove main loop is just wasteful. so add a special
  // listener just during boundary drawing, then remove it once drawn
  window.addEventListener("mousemove", drawBoundary);
}

function drawBoundary(e: MouseEvent) {
  const currentHex = e.target;
  if (!(currentHex instanceof SVGPolygonElement) || !currentHex.classList.contains("hex")) {
    return;
  }
  const lastCRN = GLOBAL_STATE.layers.BOUNDARY.lastCRN;
  if (!lastCRN) {
    return;
  }
  const currentC = Number(currentHex.dataset["c"]);
  const currentR = Number(currentHex.dataset["r"]);
  if (!Number.isInteger(currentC) || !Number.isInteger(currentR)) {
    return;
  }
  // if we're not on one of the neigh of the lastCRN, do nothing. Cuts a lot of calculations
  if (Math.abs(lastCRN.c - currentC) > 1 || Math.abs(lastCRN.r - currentR) > 1) {
    return;
  }
  const pt = screenToSvg(e.clientX, e.clientY);
  if (!pt) {
    return;
  }
  const closestN = closestVertexIndex(currentHex, pt);
  if (closestN < 0) {
    return;
  }
  const lastEntry = getHexEntry(lastCRN.c, lastCRN.r);
  const currentEntry = getHexEntry(currentC, currentR);
  if (!lastEntry || !currentEntry) {
    return;
  }
  const lastBoundaryPoint = getHexPoint(lastEntry.hex, lastCRN.n);
  const nextBoundaryPoint = getHexPoint(currentEntry.hex, closestN);
  if (!lastBoundaryPoint || !nextBoundaryPoint) {
    return;
  }

  // we only want to draw boundary lines on top of existing hex edges.
  // we already know that our vertices are on hex vertices. If the distance
  // is within a unit of the hex radius, that means this must be a hex edge
  const lineLength =
    (lastBoundaryPoint.x - nextBoundaryPoint.x) ** 2 +
    (lastBoundaryPoint.y - nextBoundaryPoint.y) ** 2;
  // this looks like a large difference, but keep in mind these are square numbers
  // and we're at 35^2
  if (Math.abs(lineLength - HEX_RADIUS_SQUARED) > 75) {
    return;
  }
  const strokeColor = GLOBAL_STATE.mouseState.holdingRightClick
    ? GLOBAL_STATE.layers.BOUNDARY.secondaryColor
    : GLOBAL_STATE.layers.BOUNDARY.primaryColor;
  const closestCRN = { c: currentC, r: currentR, n: closestN };
  drawBoundaryLine(lastCRN, closestCRN, strokeColor);
  GLOBAL_STATE.layers.BOUNDARY.lastCRN = closestCRN;
}

function drawBoundaryLine(fromCRN: CRN, toCRN: CRN, color: string) {
  const fromEntry = getHexEntry(fromCRN.c, fromCRN.r);
  const toEntry = getHexEntry(toCRN.c, toCRN.r);
  if (!fromEntry || !toEntry) {
    return;
  }
  const fromHexVertex = getHexPoint(fromEntry.hex, fromCRN.n);
  const toHexVertex = getHexPoint(toEntry.hex, toCRN.n);
  if (!fromHexVertex || !toHexVertex) {
    return;
  }
  const fromCRNStr = crnToString(fromCRN);
  const toCRNStr = crnToString(toCRN);

  const line = createLine(fromHexVertex.x, fromHexVertex.y, toHexVertex.x, toHexVertex.y, color);
  line.dataset["fromcrn"] = fromCRNStr;
  line.dataset["tocrn"] = toCRNStr;
  line.classList.add("boundary", `layer-${Layers.BOUNDARY}`, `eraseable-${Layers.BOUNDARY}`);

  const minimapLine = createLine(
    fromHexVertex.x,
    fromHexVertex.y,
    toHexVertex.x,
    toHexVertex.y,
    color,
  );
  minimapLine.dataset["fromcrn"] = fromCRNStr;
  minimapLine.dataset["tocrn"] = toCRNStr;
  minimapLine.classList.add("miniboundary");

  getSvgLayer(Layers.BOUNDARY).appendChild(line);
  MINIMAP_PREVIEW.appendChild(minimapLine);
  addToUndoStack({
    type: "boundary",
    action: "added",
    target: { fromCRN: fromCRNStr, toCRN: toCRNStr, color },
  });
}

function repositionBoundaries() {
  for (const boundary of Array.from(SVG.getElementsByClassName("boundary"))) {
    if (!(boundary instanceof SVGLineElement)) {
      continue;
    }
    const fromCRN = parseCRN(boundary.dataset["fromcrn"]);
    const toCRN = parseCRN(boundary.dataset["tocrn"]);
    if (!fromCRN || !toCRN) {
      continue;
    }
    const fromEntry = getHexEntry(fromCRN.c, fromCRN.r);
    const toEntry = getHexEntry(toCRN.c, toCRN.r);
    if (!fromEntry || !toEntry) {
      continue;
    }
    const fromPoint = getHexPoint(fromEntry.hex, fromCRN.n);
    const toPoint = getHexPoint(toEntry.hex, toCRN.n);
    if (!fromPoint || !toPoint) {
      continue;
    }
    boundary.setAttribute("x1", fromPoint.x.toString());
    boundary.setAttribute("y1", fromPoint.y.toString());
    boundary.setAttribute("x2", toPoint.x.toString());
    boundary.setAttribute("y2", toPoint.y.toString());
  }
}

/****************************
 * TEXT LAYER FUNCTIONALITY *
 ****************************/
function sanitizeFontSize(value: string): string {
  const size = parseFloat(value);
  if (!Number.isFinite(size) || size <= 0) {
    return String(DEFAULT_TEXT_FONT_SIZE);
  }
  return String(size);
}

function placeText(pt: DOMPoint) {
  const textInput = TEXT_INPUT_DIV.value.trim();
  if (!textInput) {
    return;
  }
  const strokeWidth = GLOBAL_STATE.layers.TEXT.bold ? "0.5" : null;
  const fontStyle = GLOBAL_STATE.layers.TEXT.italics ? "italic" : null;
  const textDecoration = GLOBAL_STATE.layers.TEXT.underline ? "underline" : null;
  placeTextWithConfig(
    pt,
    textInput,
    sanitizeFontSize(TEXT_FONT_SIZE_DIV.value),
    strokeWidth,
    fontStyle,
    textDecoration,
    GLOBAL_STATE.layers.TEXT.primaryColor,
  );
}

function placeTextWithConfig(
  pt: DOMPoint,
  textInput: string,
  fontSize: string,
  strokeWidth: string | null,
  fontStyle: string | null,
  textDecoration: string | null,
  color: string,
) {
  const textbox = document.createElementNS(SVG_NS, "text") as SVGTextElement;
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
  textbox.classList.add("in-image-text", `layer-${Layers.TEXT}`, `eraseable-${Layers.TEXT}`);
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
  getSvgLayer(Layers.TEXT).appendChild(textbox);
}

/***************
 * ZOOM/SCROLL *
 ***************/
function freeDragScroll(e: MouseEvent) {
  scrollSvg(-e.movementX, -e.movementY);
}

function scrollSvg(xdiff: number, ydiff: number) {
  const viewBox = getViewBox();
  if (!viewBox) {
    return;
  }
  const scale = viewBox.width / window.innerWidth;
  const newX = viewBox.x + xdiff * scale;
  const newY = viewBox.y + ydiff * scale;
  setViewBox(newX, newY, viewBox.width, viewBox.height);
}

function zoomSvg(scale: number, mouseX: number, mouseY: number) {
  const pt = screenToSvg(mouseX, mouseY);
  const viewBox = getViewBox();
  if (!pt || !viewBox) {
    return;
  }
  const factor = 1 + scale;
  if (factor <= 0) {
    return;
  }
  // clamp so the user can neither lose the map to infinite zoom-out nor
  // zoom in so far that coordinates lose precision
  let newWidth = viewBox.width * factor;
  let newHeight = viewBox.height * factor;
  const clampedWidth = Math.min(Math.max(newWidth, MIN_VIEW_WIDTH), MAX_VIEW_WIDTH);
  const clampedFactor = clampedWidth / viewBox.width;
  newWidth = viewBox.width * clampedFactor;
  newHeight = viewBox.height * clampedFactor;

  const xPropW = (pt.x - viewBox.x) / viewBox.width;
  const yPropH = (pt.y - viewBox.y) / viewBox.height;
  const newX = pt.x - xPropW * newWidth;
  const newY = pt.y - yPropH * newHeight;
  setViewBox(newX, newY, newWidth, newHeight);
}

/*************
 * HEX UTILS *
 *************/
function getHexNeighbors(c: number, r: number, gridDirection: string): [number, number][] {
  if (gridDirection === GridDirection.VERTICAL) {
    const offset = r % 2 === 0 ? -1 : 1;
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
  const offset = c % 2 === 0 ? -1 : 1;
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

function hexIndexToPixel(c: number, r: number, gridDirection: string) {
  if (gridDirection === GridDirection.VERTICAL) {
    const x = HEX_RADIUS * Math.sqrt(3) * (c + 0.5 * (r % 2));
    const y = ((HEX_RADIUS * 3) / 2) * r;
    return { x, y };
  }
  const x = ((HEX_RADIUS * 3) / 2) * c;
  const y = HEX_RADIUS * Math.sqrt(3) * (r + 0.5 * (c % 2));
  return { x, y };
}

function roundForHex(num: number) {
  return Math.ceil(num);
}

function getHexVertixes(c: number, r: number, gridDirection: string) {
  const { x, y } = hexIndexToPixel(c, r, gridDirection);
  const points: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    if (gridDirection === GridDirection.VERTICAL) {
      const px = roundForHex(x + HEX_RADIUS * Math.sin(angle));
      const py = roundForHex(y + HEX_RADIUS * Math.cos(angle));
      points.push(`${px},${py}`);
    } else {
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
function positionHexes(gridDirection: string) {
  for (const hexEntriesRow of GLOBAL_STATE.drawing.hexEntries) {
    for (const hexEntry of hexEntriesRow) {
      if (!hexEntry) {
        continue;
      }
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

function drawHex(c: number, r: number): HexEntry {
  const hex = document.createElementNS(SVG_NS, "polygon") as SVGPolygonElement;
  hex.setAttribute("stroke-width", `${GLOBAL_STATE.layers.GRID.gridThickness}px`);
  hex.dataset["c"] = c.toString();
  hex.dataset["r"] = r.toString();
  hex.classList.add("hex");
  getSvgLayer("HEX").appendChild(hex);
  return { hex, minihex: null, hexObject: null, x: 0, y: 0, c, r };
}

function initMiniMap() {
  MINIMAP_PREVIEW.replaceChildren();
  for (const hexEntriesRow of GLOBAL_STATE.drawing.hexEntries) {
    for (const hexEntry of hexEntriesRow) {
      if (!hexEntry) {
        continue;
      }
      const minihex = document.createElementNS(SVG_NS, "polygon") as SVGPolygonElement;
      minihex.dataset["c"] = hexEntry.c.toString();
      minihex.dataset["r"] = hexEntry.r.toString();
      minihex.setAttribute("points", pointsToString(hexEntry.hex.points));
      const fill = hexEntry.hex.getAttribute("fill");
      if (fill) {
        minihex.setAttribute("fill", fill);
      }
      const stroke = hexEntry.hex.getAttribute("stroke");
      if (stroke) {
        minihex.setAttribute("stroke", stroke);
      }
      minihex.classList.add("minihex");
      hexEntry.minihex = minihex;
      MINIMAP_PREVIEW.appendChild(minihex);
    }
  }

  for (const boundary of Array.from(SVG.getElementsByClassName("boundary"))) {
    if (!(boundary instanceof SVGLineElement)) {
      logUnexpectedError("non-line boundary element");
      continue;
    }
    const miniboundary = document.createElementNS(SVG_NS, "line") as SVGLineElement;
    for (const attr of ["x1", "y1", "x2", "y2", "stroke"]) {
      const value = boundary.getAttribute(attr);
      if (value != null) {
        miniboundary.setAttribute(attr, value);
      }
    }
    miniboundary.dataset["fromcrn"] = boundary.dataset["fromcrn"];
    miniboundary.dataset["tocrn"] = boundary.dataset["tocrn"];
    miniboundary.classList.add("miniboundary");
    MINIMAP_PREVIEW.appendChild(miniboundary);
  }

  const minibbox = MINIMAP_PREVIEW.getBBox();
  if (minibbox.width > 0 && minibbox.height > 0) {
    MINIMAP.setAttribute(
      "viewBox",
      `${minibbox.x} ${minibbox.y} ${minibbox.width} ${minibbox.height}`,
    );
  }
  syncMinimapViewBoxFromSvg();
}

function clearSvgLayers() {
  for (const groupId of ["HEXLayer", "OBJECTLayer", "PATHLayer", "BOUNDARYLayer", "TEXTLayer"]) {
    document.getElementById(groupId)?.replaceChildren();
  }
  MINIMAP_PREVIEW.replaceChildren();
}

function svgInit() {
  GLOBAL_STATE.undoRedo.pauseUndoStack = true;
  SVG.dataset["griddirection"] = GLOBAL_STATE.layers.GRID.gridDirection;
  SVG.setAttribute("xmlns", SVG_NS);
  GLOBAL_STATE.drawing.hexEntries = [];
  clearSvgLayers();

  for (let c = 0; c < GLOBAL_STATE.layers.GRID.cols; c++) {
    const hexColEntries: HexEntry[] = [];
    for (let r = 0; r < GLOBAL_STATE.layers.GRID.rows; r++) {
      hexColEntries.push(drawHex(c, r));
    }
    GLOBAL_STATE.drawing.hexEntries.push(hexColEntries);
  }
  positionHexes(SVG.dataset["griddirection"] ?? GridDirection.HORIZONTAL);
  const bbox = SVG.getBBox();
  const midX = bbox.x + (bbox.width - window.innerWidth) / 2;
  const midY = bbox.y + (bbox.height - window.innerHeight) / 2;
  setViewBox(midX, midY, window.innerWidth, window.innerHeight);

  initMiniMap();

  setCanvasColor(null, GLOBAL_STATE.layers.GRID.canvasColor);
  setGridColor(null, GLOBAL_STATE.layers.GRID.gridColor);
  setPrimaryObject(GLOBAL_STATE.layers.OBJECT.primaryObject);
  setSecondaryObject(GLOBAL_STATE.layers.OBJECT.secondaryObject);

  TEXT_FONT_SIZE_DIV.value = DEFAULT_TEXT_FONT_SIZE.toString();
  GRID_THICKNESS_SLIDER_DIV.value = GLOBAL_STATE.layers.GRID.gridThickness;
  setGridDirection(GLOBAL_STATE.layers.GRID.gridDirection);
  updateGridDimensionInputs();

  switchToControlSet(Layers.COLOR);
  GLOBAL_STATE.undoRedo.pauseUndoStack = false;

  // a freshly-initialised document has no unsaved changes
  isDirty = false;
  SVG.dataset["lastmodified"] = "-1";
}

/****************
 * SVG IMPORT   *
 ****************/
// strips potentially active content from an imported SVG before it is
// inserted into the document.
function sanitizeSvg(root: Element) {
  for (const el of Array.from(root.querySelectorAll("script, foreignObject"))) {
    el.remove();
  }
  const allElements: Element[] = [root, ...Array.from(root.querySelectorAll("*"))];
  for (const el of allElements) {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
      } else if (
        (name === "href" || name.endsWith(":href")) &&
        /^\s*javascript:/i.test(attr.value)
      ) {
        el.removeAttribute(attr.name);
      }
    }
  }
}

function getHexPolygons(root: Element): SVGPolygonElement[] {
  return Array.from(root.getElementsByClassName("hex")).filter(
    (el): el is SVGPolygonElement => el instanceof SVGPolygonElement,
  );
}

interface ParsedHexGrid {
  cols: number;
  rows: number;
  entries: (HexEntry | null)[][];
}

function parseHexGrid(
  hexElements: SVGPolygonElement[],
  gridDirection: string,
): ParsedHexGrid | null {
  const hexesMap = new Map<number, Map<number, HexEntry>>();
  let maxC = -1;
  let maxR = -1;
  for (const hex of hexElements) {
    const c = Number(hex.dataset["c"]);
    const r = Number(hex.dataset["r"]);
    if (!Number.isInteger(c) || !Number.isInteger(r) || c < 0 || r < 0) {
      continue;
    }
    let x = parseFloat(hex.getAttribute("x") ?? "");
    let y = parseFloat(hex.getAttribute("y") ?? "");
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      const position = hexIndexToPixel(c, r, gridDirection);
      x = position.x;
      y = position.y;
    }
    let column = hexesMap.get(c);
    if (!column) {
      column = new Map();
      hexesMap.set(c, column);
    }
    column.set(r, { hex, minihex: null, hexObject: null, x, y, c, r });
    maxC = Math.max(maxC, c);
    maxR = Math.max(maxR, r);
  }
  if (maxC < 0 || maxR < 0) {
    return null;
  }
  const cols = maxC + 1;
  const rows = maxR + 1;
  if (cols > MAX_GRID_DIMENSION || rows > MAX_GRID_DIMENSION) {
    return null;
  }
  const entries: (HexEntry | null)[][] = [];
  for (let c = 0; c < cols; c++) {
    const row: (HexEntry | null)[] = [];
    const column = hexesMap.get(c);
    for (let r = 0; r < rows; r++) {
      const entry = column?.get(r);
      if (!entry) {
        // a non-rectangular grid would break direct indexing everywhere
        return null;
      }
      row.push(entry);
    }
    entries.push(row);
  }
  return { cols, rows, entries };
}

function loadSvg(fileName: string, svgStr: string): boolean {
  let root: Element;
  try {
    const parsed = new DOMParser().parseFromString(svgStr, "image/svg+xml");
    if (parsed.getElementsByTagName("parsererror").length > 0) {
      alert("Could not read that SVG file.");
      return false;
    }
    root = parsed.documentElement;
  } catch {
    alert("Could not read that SVG file.");
    return false;
  }
  if (!root || root.tagName.toLowerCase() !== "svg") {
    alert("That file is not an SVG image.");
    return false;
  }
  sanitizeSvg(root);

  // validate before touching the live document so a bad import can't destroy
  // the map the user currently has open
  const parsedGrid = parseHexGrid(
    getHexPolygons(root),
    root.getAttribute("data-griddirection") ?? GridDirection.HORIZONTAL,
  );
  if (!parsedGrid) {
    alert("This SVG doesn't look like a Hexaggon map (no usable hex grid found).");
    return false;
  }

  const gridDirection: GridDirectionName =
    root.getAttribute("data-griddirection") === GridDirection.VERTICAL
      ? GridDirection.VERTICAL
      : GridDirection.HORIZONTAL;
  const canvasColor = root.getAttribute("data-canvas-color");
  const gridColor = root.getAttribute("data-grid-color");

  GLOBAL_STATE.undoRedo.undoStack = [];
  GLOBAL_STATE.undoRedo.redoStack = [];
  GLOBAL_STATE.undoRedo.pauseUndoStack = true;

  // remove any styling shipped in the file; Hexaggon relies on its own
  for (const style of Array.from(root.getElementsByTagName("style"))) {
    style.remove();
  }
  const importedChildren = Array.from(root.childNodes).map((node) =>
    document.importNode(node, true),
  );
  SVG.replaceChildren(...importedChildren);
  if (SVG_STYLE) {
    SVG.appendChild(SVG_STYLE);
  }

  const liveGrid = parseHexGrid(getHexPolygons(SVG), gridDirection);
  if (!liveGrid) {
    // extremely unlikely (validated above), but don't leave a broken state
    GLOBAL_STATE.undoRedo.pauseUndoStack = false;
    alert("This SVG could not be loaded.");
    return false;
  }

  GLOBAL_STATE.drawing.fileName = fileName;
  FILE_NAME_DIV.textContent = fileName;
  GLOBAL_STATE.drawing.hexEntries = liveGrid.entries;
  GLOBAL_STATE.layers.GRID.cols = liveGrid.cols;
  GLOBAL_STATE.layers.GRID.rows = liveGrid.rows;

  for (const hexObject of Array.from(SVG.getElementsByClassName("hex-object"))) {
    if (!(hexObject instanceof SVGTextElement)) {
      logUnexpectedError("hex object is not a text element");
      continue;
    }
    const hexEntry = getHexEntry(Number(hexObject.dataset["c"]), Number(hexObject.dataset["r"]));
    if (hexEntry) {
      hexEntry.hexObject = hexObject;
    }
  }

  setGridDirection(gridDirection);
  updateGridDimensionInputs();
  const firstHex = liveGrid.entries[0]?.[0]?.hex;
  const strokeWidth = parsePx(firstHex?.getAttribute("stroke-width") ?? null);
  if (strokeWidth != null) {
    setGridThickness(strokeWidth);
  }
  if (canvasColor) {
    setCanvasColor(null, canvasColor);
  }
  if (gridColor) {
    setGridColor(null, gridColor);
  }

  const bbox = SVG.getBBox();
  const midX = bbox.x + (bbox.width - window.innerWidth) / 2;
  const midY = bbox.y + (bbox.height - window.innerHeight) / 2;
  setViewBox(midX, midY, window.innerWidth, window.innerHeight);
  initMiniMap();

  switchToControlSet(Layers.COLOR);
  clearWelcomeScreen();

  GLOBAL_STATE.undoRedo.pauseUndoStack = false;
  isDirty = false;
  return true;
}

function readAndImport(file: File) {
  file
    .text()
    .then((text) => importSvg(file.name, text))
    .catch(() => alert(`Could not read ${file.name}.`));
}

function importSvg(fileName: string, svgStr: string) {
  if (!loadSvg(fileName, svgStr)) {
    return;
  }
  const uniqueName = uniqueFileName(fileName);
  if (uniqueName !== fileName) {
    GLOBAL_STATE.drawing.fileName = uniqueName;
    FILE_NAME_DIV.textContent = uniqueName;
  }
  const result = saveToLocalStorage(uniqueName, serializeSvg(), { preventOverwrite: true });
  if (result === "quota") {
    alert("Browser storage exceeded - this file will not be autosaved.");
  }
  setFileBrowserView(uniqueName);
  isDirty = false;
}

/*************************************
 * STATE PERSISTENCE/FILE MANAGEMENT *
 *************************************/
function listSavedFileNames(): string[] {
  const names: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        names.push(key.slice(STORAGE_PREFIX.length));
      }
    }
  } catch {
    logUnexpectedError("localStorage is unavailable");
  }
  return names.sort((a, b) => a.localeCompare(b));
}

function uniqueFileName(base: string): string {
  if (localStorage.getItem(`${STORAGE_PREFIX}${base}`) == null) {
    return base;
  }
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : "";
  for (let i = 2; i < 10000; i++) {
    const candidate = `${stem} (${i})${ext}`;
    if (localStorage.getItem(`${STORAGE_PREFIX}${candidate}`) == null) {
      return candidate;
    }
  }
  return `${stem}-${Date.now()}${ext}`;
}

type SaveResult = "ok" | "exists" | "quota";

function saveToLocalStorage(
  fileName: string,
  svgStr: string,
  options?: { preventOverwrite?: boolean },
): SaveResult {
  const key = `${STORAGE_PREFIX}${fileName}`;
  try {
    if (options?.preventOverwrite && localStorage.getItem(key) != null) {
      return "exists";
    }
    localStorage.setItem(key, svgStr);
    quotaAlertShown = false;
    return "ok";
  } catch {
    return "quota";
  }
}

function autosave() {
  if (!isDirty) {
    return;
  }
  let result: SaveResult;
  try {
    result = saveToLocalStorage(GLOBAL_STATE.drawing.fileName, serializeSvg());
  } catch {
    logUnexpectedError("autosave failed");
    return;
  }
  if (result === "ok") {
    isDirty = false;
  } else if (result === "quota" && !quotaAlertShown) {
    quotaAlertShown = true;
    alert(
      "Browser storage exceeded - this file will not be autosaved. Delete other files and try again.",
    );
  }
}

function populateFileBrowser() {
  FILE_BROWSER_DIV.replaceChildren();
  for (const imageName of listSavedFileNames()) {
    const nameDiv = document.createElement("div");
    nameDiv.textContent = imageName;
    nameDiv.dataset["imagename"] = imageName;
    nameDiv.classList.add("loaded-file-name");
    if (imageName === GLOBAL_STATE.drawing.fileName) {
      nameDiv.classList.add("selected");
    }

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
}

function makePreviewImage(svgStr: string): HTMLImageElement | null {
  try {
    const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    welcomePreviewUrls.push(url);
    const img = document.createElement("img");
    img.classList.add("loaded-file-preview");
    img.alt = "";
    img.src = url;
    return img;
  } catch {
    return null;
  }
}

function populateWelcomeScreenFiles() {
  for (const imageName of listSavedFileNames()) {
    const svgStr = localStorage.getItem(`${STORAGE_PREFIX}${imageName}`);
    if (svgStr == null) {
      continue;
    }
    const nameDiv = document.createElement("div");
    nameDiv.textContent = imageName;
    nameDiv.dataset["imagename"] = imageName;
    nameDiv.classList.add("loaded-file-name");

    const div = document.createElement("div");
    div.appendChild(nameDiv);
    const preview = makePreviewImage(svgStr);
    if (preview) {
      div.appendChild(preview);
    }
    div.classList.add("flex-column", "loaded-file-entry", "gappy");

    div.addEventListener("click", () => {
      const current = localStorage.getItem(`${STORAGE_PREFIX}${imageName}`);
      if (current != null && loadSvg(imageName, current)) {
        setFileBrowserView(imageName);
      }
    });

    WELCOME_FILE_BROWSER_DIV.appendChild(div);
  }
}

/*****************
 * EVENT HANDLERS *
 *****************/
function registerDropUploadEventHandlers() {
  FILE_UPLOAD_INPUT.addEventListener("change", () => {
    const file = FILE_UPLOAD_INPUT.files?.[0];
    if (file) {
      readAndImport(file);
    }
    // reset so selecting the same file again still fires "change"
    FILE_UPLOAD_INPUT.value = "";
  });

  document.addEventListener("drop", (e) => {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) {
      return;
    }
    for (const file of Array.from(files)) {
      readAndImport(file);
    }
  });

  document.addEventListener("dragover", (e) => {
    e.preventDefault();
  });
}

function isEditableTarget(target: Element | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function registerEventListeners() {
  // keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    const target = document.activeElement;
    if (isEditableTarget(target)) {
      if (target instanceof HTMLElement && target.id === "fileName" && e.code === "Enter") {
        target.blur();
        e.preventDefault();
      }
      return;
    }

    const modifier = e.metaKey || e.ctrlKey;
    if (modifier) {
      switch (e.code) {
        case "KeyS":
          e.preventDefault();
          exportToSvg();
          return;
        case "KeyZ":
          e.preventDefault();
          if (e.shiftKey) {
            redoLastAction();
          } else {
            undoLastAction();
          }
          return;
        case "KeyY":
          e.preventDefault();
          redoLastAction();
          return;
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
      case "KeyZ":
        switchToTool(Tools.ZOOM);
        break;
      case "KeyF":
        toggleFullscreen();
        break;
      case "AltLeft":
      case "AltRight":
        e.preventDefault();
        switchToTool(Tools.EYEDROPPER, true);
        break;
    }
  });

  document.addEventListener("keyup", (e) => {
    if (e.code === "AltLeft" || e.code === "AltRight") {
      dropTemporaryModes();
    }
  });

  // when the window loses focus, reset - otherwise, Cmd+Tab to change windows
  // will continue having modifier/mouse state after coming back
  window.addEventListener("blur", () => {
    resetInteractionState();
    dropTemporaryModes();
  });

  // releasing the mouse outside the SVG must still end any drag operation
  window.addEventListener("mouseup", () => {
    resetInteractionState();
  });

  // global controls
  WELCOME_DIV.addEventListener("click", clearWelcomeScreen);

  for (const layerPicker of LAYER_PICKER_BUTTONS) {
    layerPicker.addEventListener("click", () => {
      const controlSet = layerPicker.dataset["controlset"];
      if (controlSet) {
        switchToControlSet(controlSet);
      }
    });
  }

  for (const controlSetPicker of NON_LAYER_CONTROL_SET_PICKER_BUTTONS) {
    controlSetPicker.addEventListener("click", () => {
      const controlSet = controlSetPicker.dataset["controlset"];
      if (controlSet) {
        switchToControlSet(controlSet, false);
      }
    });
  }

  for (const toolPicker of TOOL_PICKER_BUTTONS) {
    toolPicker.addEventListener("click", () => {
      const tool = toolPicker.dataset["tool"];
      if (tool) {
        switchToTool(tool);
      }
    });
  }

  SAVE_BUTTON.addEventListener("click", () => {
    exportToSvg();
  });

  byId("fullscreenBtn").addEventListener("click", () => {
    toggleFullscreen();
  });

  FILE_BROWSER_DIV.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const imageName = target.dataset["imagename"];
    if (!imageName) {
      return;
    }
    if (target.classList.contains("loaded-file-name")) {
      const svgStr = localStorage.getItem(`${STORAGE_PREFIX}${imageName}`);
      if (svgStr != null && loadSvg(imageName, svgStr)) {
        setFileBrowserView(imageName);
      }
    } else if (target.classList.contains("delete-file-btn")) {
      localStorage.removeItem(`${STORAGE_PREFIX}${imageName}`);
      if (imageName === GLOBAL_STATE.drawing.fileName) {
        // don't immediately recreate the file we just deleted via autosave
        isDirty = false;
      }
      populateFileBrowser();
    }
  });

  FILE_NAME_DIV.addEventListener("focusout", () => {
    const oldName = GLOBAL_STATE.drawing.fileName;
    const newName = (FILE_NAME_DIV.textContent ?? "").trim();
    if (!newName || newName === oldName) {
      FILE_NAME_DIV.textContent = oldName;
      return;
    }
    if (localStorage.getItem(`${STORAGE_PREFIX}${newName}`) != null) {
      alert("An image with that name already exists.");
      FILE_NAME_DIV.textContent = oldName;
      return;
    }
    const result = saveToLocalStorage(newName, serializeSvg(), { preventOverwrite: true });
    if (result !== "ok") {
      alert(
        result === "exists"
          ? "An image with that name already exists."
          : "Browser storage exceeded - the file was not renamed.",
      );
      FILE_NAME_DIV.textContent = oldName;
      return;
    }
    localStorage.removeItem(`${STORAGE_PREFIX}${oldName}`);
    setFileBrowserView(newName);
    isDirty = false;
  });

  // shared across many layers
  for (const swatch of COLOR_CONTROL_SWATCHES) {
    if (!(swatch instanceof HTMLElement)) {
      continue;
    }
    // left click - set as primary color
    swatch.addEventListener("click", () => {
      setPrimaryColor(swatch.dataset["color"]);
    });
    // right click - set as secondary color
    swatch.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      setSecondaryColor(swatch.dataset["color"]);
    });
  }

  // grid layer buttons
  for (const swatch of CANVAS_COLOR_SWATCHES) {
    if (!(swatch instanceof HTMLElement)) {
      continue;
    }
    swatch.addEventListener("click", () => {
      const color = swatch.dataset["color"];
      if (color) {
        setCanvasColor(GLOBAL_STATE.layers.GRID.canvasColor, color);
      }
    });
  }

  for (const swatch of GRID_COLOR_SWATCHES) {
    if (!(swatch instanceof HTMLElement)) {
      continue;
    }
    swatch.addEventListener("click", () => {
      const color = swatch.dataset["color"];
      if (color) {
        setGridColor(GLOBAL_STATE.layers.GRID.gridColor, color);
      }
    });
  }

  for (const b of GRID_DIRECTION_BUTTONS) {
    b.addEventListener("click", () => {
      const direction = b.dataset["direction"];
      if (direction !== GridDirection.HORIZONTAL && direction !== GridDirection.VERTICAL) {
        return;
      }
      if (direction === GLOBAL_STATE.layers.GRID.gridDirection) {
        return;
      }
      setGridDirection(direction);
      positionHexes(direction);
      repositionPaths();
      repositionBoundaries();
      initMiniMap();
    });
  }

  // the slider fires "input" continuously while dragging and "change" once on
  // release, so record one undo action per drag instead of one per pixel
  let gridThicknessBeforeInput: string | null = null;
  GRID_THICKNESS_SLIDER_DIV.addEventListener("input", () => {
    if (gridThicknessBeforeInput === null) {
      gridThicknessBeforeInput = GLOBAL_STATE.layers.GRID.gridThickness;
    }
    setGridThickness(GRID_THICKNESS_SLIDER_DIV.value);
  });
  GRID_THICKNESS_SLIDER_DIV.addEventListener("change", () => {
    const before = gridThicknessBeforeInput;
    gridThicknessBeforeInput = null;
    const after = GLOBAL_STATE.layers.GRID.gridThickness;
    if (before !== null && before !== after) {
      addToUndoStack({ type: "gridThickness", target: { old: before, new: after } });
    }
  });

  for (const input of [GRID_ROWS_INPUT, GRID_COLS_INPUT]) {
    input.addEventListener("change", () => {
      const cols = clampGridDimension(GRID_COLS_INPUT.value);
      const rows = clampGridDimension(GRID_ROWS_INPUT.value);
      if (cols === null || rows === null) {
        updateGridDimensionInputs();
        return;
      }
      resizeGrid(cols, rows);
    });
  }

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

    if (e.button === 1) {
      // middle click - free drag scroll
      e.preventDefault();
      GLOBAL_STATE.mouseState.holdingCenterClick = true;
      window.addEventListener("mousemove", freeDragScroll);
      switchToCursor("move");
      return;
    }

    if (GLOBAL_STATE.currentTool === Tools.ZOOM) {
      // right click zooms out, left click zooms in
      const zoomFactor = 0.5 * (e.button === 2 ? 1 : -1);
      zoomSvg(zoomFactor, e.clientX, e.clientY);
      e.preventDefault();
      return;
    }

    if (e.button !== 0 && e.button !== 2) {
      return;
    }

    // single left/right click
    GLOBAL_STATE.mouseState.holdingStdClick = true;
    // a right mouse down means paint with secondary colors
    GLOBAL_STATE.mouseState.holdingRightClick = e.button === 2;
    if (target instanceof SVGPolygonElement && target.classList.contains("hex")) {
      handleHexInteraction(
        Number(target.dataset["c"]),
        Number(target.dataset["r"]),
        e.clientX,
        e.clientY,
      );
    }
  });

  SVG.addEventListener("mouseover", (e) => {
    const target = e.target;
    if (!(target instanceof SVGElement) || !GLOBAL_STATE.mouseState.holdingStdClick) {
      return;
    }
    const layer = GLOBAL_STATE.currentLayer;
    if (!layer) {
      return;
    }

    if (
      GLOBAL_STATE.currentTool === Tools.ERASER &&
      target.classList.contains(`eraseable-${layer}`)
    ) {
      eraseElement(target);
      return;
    }

    if (target instanceof SVGPolygonElement && target.classList.contains("hex")) {
      handleHexInteraction(
        Number(target.dataset["c"]),
        Number(target.dataset["r"]),
        e.clientX,
        e.clientY,
      );
    }
  });

  SVG.addEventListener("contextmenu", (e) => e.preventDefault());

  SVG.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      if (e.metaKey || e.ctrlKey) {
        let scale = e.deltaY / 100;
        scale = Math.abs(scale) > 0.1 ? (0.1 * e.deltaY) / Math.abs(e.deltaY) : scale;
        zoomSvg(scale, e.clientX, e.clientY);
      } else {
        scrollSvg(e.deltaX, e.deltaY);
      }
    },
    { passive: false },
  );
}

function eraseElement(target: SVGElement) {
  if (target.classList.contains("path-highlight")) {
    if (!(target instanceof SVGLineElement)) {
      return;
    }
    const path = document.getElementById(`path-${target.id}`);
    addToUndoStack({
      type: "path",
      action: "erased",
      target: {
        fromCR: {
          c: Number(target.dataset["c1"]),
          r: Number(target.dataset["r1"]),
        },
        toCR: {
          c: Number(target.dataset["c2"]),
          r: Number(target.dataset["r2"]),
        },
        lineColor: path?.getAttribute("stroke") ?? null,
        highlightColor: target.getAttribute("stroke"),
      },
    });
    target.remove();
    path?.remove();
  } else if (target.classList.contains("boundary")) {
    if (!(target instanceof SVGLineElement)) {
      return;
    }
    const fromCRN = target.dataset["fromcrn"];
    const toCRN = target.dataset["tocrn"];
    const color = target.getAttribute("stroke");
    addToUndoStack({
      type: "boundary",
      action: "erased",
      target: { fromCRN, toCRN, color },
    });
    target.remove();
    removeMinimapBoundaries(fromCRN, toCRN, color);
  } else if (target.classList.contains("in-image-text")) {
    if (!(target instanceof SVGTextElement)) {
      return;
    }
    const pt = new DOMPoint(
      parseFloat(target.getAttribute("x") ?? "0"),
      parseFloat(target.getAttribute("y") ?? "0"),
    );
    addToUndoStack({
      type: "text",
      action: "erased",
      target: {
        pt,
        textInput: target.textContent,
        fontSize: target.getAttribute("font-size"),
        strokeWidth: target.getAttribute("stroke-width"),
        fontStyle: target.getAttribute("font-style"),
        textDecoration: target.getAttribute("text-decoration"),
        color: target.getAttribute("fill"),
      },
    });
    target.remove();
  }
}

function removeMinimapBoundaries(fromCRN?: string, toCRN?: string, color?: string | null) {
  for (const el of Array.from(MINIMAP_PREVIEW.getElementsByClassName("miniboundary"))) {
    if (
      el instanceof SVGLineElement &&
      el.dataset["fromcrn"] === fromCRN &&
      el.dataset["tocrn"] === toCRN &&
      el.getAttribute("stroke") === color
    ) {
      el.remove();
    }
  }
}

function removeBoundary(fromCRN: CRN, toCRN: CRN, color: string | null) {
  const fromStr = crnToString(fromCRN);
  const toStr = crnToString(toCRN);
  for (const el of Array.from(SVG.getElementsByClassName("boundary"))) {
    if (
      el instanceof SVGLineElement &&
      el.dataset["fromcrn"] === fromStr &&
      el.dataset["tocrn"] === toStr &&
      el.getAttribute("stroke") === color
    ) {
      el.remove();
    }
  }
  removeMinimapBoundaries(fromStr, toStr, color);
}

function removeText(pt: DOMPoint, textInput: string, color: string | null) {
  for (const el of Array.from(SVG.getElementsByClassName("in-image-text"))) {
    if (!(el instanceof SVGTextElement)) {
      continue;
    }
    if (
      parseFloat(el.getAttribute("x") ?? "") === pt.x &&
      parseFloat(el.getAttribute("y") ?? "") === pt.y &&
      el.textContent === textInput &&
      el.getAttribute("fill") === color
    ) {
      el.remove();
    }
  }
}

function removePath(fromCR: CR, toCR: CR, lineColor: string | null, highlightColor: string | null) {
  for (const el of Array.from(SVG.querySelectorAll(".path, .path-highlight"))) {
    if (!(el instanceof SVGLineElement)) {
      continue;
    }
    if (Number(el.dataset["c1"]) !== fromCR.c || Number(el.dataset["r1"]) !== fromCR.r) {
      continue;
    }
    if (Number(el.dataset["c2"]) !== toCR.c || Number(el.dataset["r2"]) !== toCR.r) {
      continue;
    }
    if (el.classList.contains("path") && el.getAttribute("stroke") === lineColor) {
      el.remove();
    } else if (
      el.classList.contains("path-highlight") &&
      el.getAttribute("stroke") === highlightColor
    ) {
      el.remove();
    }
  }
}

/********
 * MAIN *
 ********/
registerEventListeners();
registerDropUploadEventHandlers();
setFileBrowserView(GLOBAL_STATE.drawing.fileName);
svgInit();
setInterval(autosave, AUTOSAVE_INTERVAL_MS);
// persist pending edits when the tab is hidden or closed
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    autosave();
  }
});
window.addEventListener("beforeunload", () => {
  if (!isDirty) {
    return;
  }
  try {
    saveToLocalStorage(GLOBAL_STATE.drawing.fileName, serializeSvg());
  } catch {
    // nothing sensible we can do while unloading
  }
});
populateWelcomeScreenFiles();
