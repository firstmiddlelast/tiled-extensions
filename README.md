# Tiled extensions
Javascript extensions for the [Tiled Map Editor](https://www.mapeditor.org/). 

_Proof of Concepts_ are not meant to be downloaded (they include hardcoded data and most certainly won't work on anyone else's map).

_Prototypes_ may be downloaded, but they are still prototypes, and may probably stop working at some point. Any feedback about issues is welcome!

_Work In Progresses_ may be downloaded but will most probably be modified frequently. 

## path-tool.mjs - status : Working Prototype
requires `wang.mjs`, `measuring-tape.png`, `line.mjs`, `astar.mjs` and `fill.mjs`.

Adds a tool for selecting and measuring paths and surfaces, results in the status bar. S=surface, D(diag) = path length using diagonals, D(rect) = path length without diagonals, D(line) = distance from the tile clicked to the current tile when going in a direct line, D(rect) = distance when going only vertical or horizontal. 
### Path measurement 
Click and drag a path to measure it. Ctrl allows the path to use diagonals.  Pressing Alt _before you click_ makes the tool not use Terrains (the default is to use it). 
Pressing Shift before clicking keeps the previous selected area. 
### Surface measurement
Right-click a tile to select all the contiguous area that contain _at least one_ of the terrains on the tile clicked. The total surface is shown in the status bar. Press Alt _before_ clicking to not use Terrains and only expand to identical tiles. Pressing Shift before clicking keeps the previous selected area. 

## transform-terrains.mjs - status : Proof Of Concept - WIP
requires `wang.mjs`
Adds an 'Transform terrains' item in the Map menu that opens a dialong for rotating, reversing or enlarging (WIP) selected parts of the map. 

## osm-tiled.mjs - status : Proof of concept - WIP
requires `wang.mjs`, `line.mjs` and `fill.mjs`

Adds an 'Import OSM' item in the Map menu that opens a dialog for importing Open Source Maps, downloaded in GEOJSON format from [Overpass Turbo](https://overpass-turbo.eu/). 
The downloaded map is drawn on the rectangular selection area (using Terrains or not). 

## wfc-tiled.mjs - status : Working Prototype
requires `seedrandom.mjs`, `overlapping-model.mjs`, `random-indice.mjs` and `model.mjs`

Adds a Map/Wave Function Collapse action that opens a dialog for applying a basic version of the Wave Function Collapse to your currently opened tile map. Based on [Kevin Chapelier port](https://github.com/kchapelier/wavefunctioncollapse) of [Maxim Gumin's implementation of the algorithm](https://github.com/mxgmn/WaveFunctionCollapse).
As it is now, is works but has limited utility. You still can use it to randomly fill areas of random patterns matching your selection. There is a lot to do in order to make it really useful (see TODO list). 

### 1 Give the algorithm a source selection to work from
Open the dialog, select a rectangular part of your map to feed the algorithm, click "Select input". This will save all the required data for generation. Check the console output for feedback. All visible layers are part of the input data. 

### 2 Select your generation options
* Circular input
Select if the input wraps around the edges. 
* Circular output
Select if the generated tiles are supposed to wrap around the edges. 
* Symmetry and rotations
Cursor to the left : no symmetry or rotations in the initial selection. The tile patterns are only those visible. 
Cursor to the right : full symmetry and rotations. All the patterns in the input selection will be rotated and reverted in all axes and directions before generation. 
* Pattern size
Cursor to the left : patterns are 2X2
Cursor to the left : patterns are 4X4
* Random seed : if you want a repeatable result, type something in this zone. Generated results that have the same input selection, generation options (including random seed) and output region will allways produce the same result. 
* Counter : Number of iterations before giving up on a generation (-1 = no limit). Not implemented yet. 

### 3 Generate tiles
Select the rectangular region you want to fill with the algoritm and press the "Generate" button. Check the console output for feedback. You can Edit/Undo your changes if you don't like them, and click the button again. Note that all the layers that were included in the source selection will be modified. 

Tips : 
* The larger the pattern size, the more the chances of a failure ("contradiction"). 
* The more symmetries / rotations are added, the less constraints there are in the output. That may balance out the increase in pattern size. 
* The algorithm likes repetitive patterns on (very) small numbers of tiles. Since all the visible layers are part of a visible tile for the algorithm, try to keep visible layers to 2 or 3 at most. See [interactive examples](http://www.kchapelier.com/wfc-example/overlapping-model.html) of the working algorithm. 
* Transparent tiles in the input do not overwrite existing tiles when they are generated in the output selection. 

TODOs : 
* Use terrains information for building the patterns in the tiled model
* Generate around existing map tiles
* Backtracking
* Add a built-in list of sample patterns like the mazes in the interactive examples
* Allow step by step generation

# Tiled Javascript export demo
This is not a Tiled extension, but a demo on how to use the Tiled javascript export to display a map in the browser. 

## Requirements
You will need, in the same directory : 
* `pako.js` from https://raw.githubusercontent.com/nodeca/pako/master/dist/pako.js
* The tileset used by the map, exported as `tileset.png` using the procedure described at https://github.com/mapeditor/tiled/issues/1944#issuecomment-1574845289
* The map, exported as `map.js`. Only the first layer is displayed, using the first tileset. 
* The `map.html` from this repository

Once this is all set, just open the `map.html` file in your browser, it should display your map. 
