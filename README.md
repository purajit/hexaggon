# Hexaggon

A simple, beautiful, fully static hex map editor. No servers, no server-side state - just you and your maps, in a universal format. Follows various conventions established by programs like Aseprite, fine-tuned for hex editing.

![Screenshot 2025-05-25 at 19-56-37 Hex Map Editor](https://github.com/user-attachments/assets/d2023488-64a3-4dd0-8a3a-d2d3e81b1a27)

Features:
* Exports and imports as a standard SVG - no custom image formats to lock you in!
* Primary/secondary colors accessible via left/right click (in all cases - selecting colors from a palette, brushing, filling, using the eyedropper)
* 5 layers - Base, Object (currently, emojis, soon - svgs!), Path, Boundary, Text
* 5 tools depending on the layer - Select, Brush, Fill, Eyedropper, Erase, Zoom
* Saving as an svg
* Shortcuts for all modes and layers!
* More mouse shortcuts:
  * Middle-click and drag: scroll
  * Cmd + Scroll: zoom

Just open `docs/index.html` to run locally!
