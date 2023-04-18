/**
 * Adds a tool for selecting and measuring paths and surfaces, results in the status bar : S=last selected surface/total selected surface, D(diag) = path length using diagonals, D(rect) = path length without diagonals, D(line) = distance from the tile clicked to the current tile when going in a direct line, D(rect) = distance when going only vertical or horizontal.
 * Path measurement

 * Click and drag a path to measure it. Ctrl allows the path to use diagonals. Pressing Alt when you click makes the tool not use Terrains data (the default is to use it).
Surface measurement

 * Right-click a tile to select all the contiguous area that contain at least one of the terrains on the tile clicked. The total surface is shown in the status bar. Press Alt when clicking to not use Terrains and only expand to identical tiles.
 */

import line from './line.mjs';
import Graph from './astar.mjs';
import {astar} from './astar.mjs';
import fill from './fill.mjs';
import {TOP_LEFT, TOP_RIGHT, BOTTOM_LEFT, BOTTOM_RIGHT} from './wang.mjs';


let wangIdsCache = [];
const DEBUG = false;
let debug;
if (DEBUG) {
    debug = tiled.log;
}
else {
    debug = function () {};
}


const findWangIds = function (tile) {
    if (tile === null) {
        return [];
    }
    if (wangIdsCache [tile.id] !== undefined) {
        return wangIdsCache [tile.id]; 
    }
    else {
        const wangIds = [];
        for (const wSet of tile.tileset.wangSets) {
            wangIds.push (wSet.wangId (tile));  // FIXME Will only return coherent results if the tileSet has only one wangSet : the wangId is relative to a wangSet, not a tileSet. 
        }
        //debug ("tile "+ tile + " has wangids"+wangIds);
        wangIdsCache [tile.id] = wangIds;
        return wangIds;
    }
}


const LEFT_BUTTON = 1;
const RIGHT_BUTTON = 2;

let currentTileX;
let currentTileY;
let isDragging = false;
let startDragX;
let startDragY;
let addToSelection = false;
let useTerrains = true;
let useDiagonals = false;

let layer;
let diagGraph;
let rectGraph;
let dragsPaths; // true : paths ; false : areas
let fillableIds;
let totalSurfaceFilled = 0;
let surfaceFilled;
let selectedRegion;

const pathTool = tiled.registerTool ("Path", {
    name: "Pathing Tool", 
    icon: "measuring-tape.png", 
    targetLayerType: Layer.TileLayerType, 


    activated: function () {
        layer = this.map.selectedLayers [0];
        surfaceFilled = 0;
        const rects = this.map.selectedArea.get().rects;
        for (const rect of rects) {
            surfaceFilled += rect.width * rect.height; 
        }
        totalSurfaceFilled = surfaceFilled;
    },


    updateStatusInfo: function () {
        currentTileX = this.tilePosition.x;
        currentTileY = this.tilePosition.y;
        //debug ("tilePosition="+this.tilePosition);
        let lineDistance = -1;  // The line function counts the first pixel, but we expect the distance to be 0 in this case
        if (isDragging && dragsPaths) {
            line (this.tilePosition.x, this.tilePosition.y, startDragX, startDragY, function () {
                lineDistance ++;
            }, !useDiagonals);


            const diagStart = diagGraph.grid [startDragX * (useTerrains? 2 : 1)] [startDragY * (useTerrains? 2 : 1)]; // FIXME : *2 if useTerrains
            const rectStart = rectGraph.grid [startDragX * (useTerrains? 2 : 1)] [startDragY * (useTerrains? 2 : 1)]; // FIXME : *2 if useTerrains
            let astarDiagResult = [];
            let astarRectResult = [];
            if (this.tilePosition.x < layer.width && this.tilePosition.x >= 0 
                && this.tilePosition.y < layer.height && this.tilePosition.y >= 0) {
                const diagEnd = diagGraph.grid [this.tilePosition.x * (useTerrains? 2 : 1)] [this.tilePosition.y * (useTerrains? 2 : 1)]; // FIXME : *2 if useTerrains
                const rectEnd = rectGraph.grid [this.tilePosition.x * (useTerrains? 2 : 1)] [this.tilePosition.y * (useTerrains? 2 : 1)]; // FIXME : *2 if useTerrains
                // See list of heuristics: http://theory.stanford.edu/~amitp/GameProgramming/Heuristics.html
                astarDiagResult = astar.search (diagGraph, diagStart, diagEnd, {closest: true, heuristic: astar.heuristics.diagonal});
                astarRectResult = astar.search (rectGraph, rectStart, rectEnd, {closest: true});
                const thisMap = this.map;   // Required because in the function below, this.map is undefined. 
                const astarSelection = (useDiagonals)? astarDiagResult : astarRectResult;
                debug ("astarSelection.length="+astarSelection.length);
                // TODO FIXME : if useTerrains, convert wangCells to tile cells
                this.map.macro ("Select path", function () {
                    thisMap.selectedArea.subtract (thisMap.selectedArea.get());
                    for (let i = 0; i < astarSelection.length; i ++) {
                        debug ("astarSelection [i].x,y="+astarSelection[i].x+","+astarSelection[i].y);
                        if (useTerrains)
                            thisMap.selectedArea.add (Qt.rect (Math.floor (astarSelection [i].x / 2), Math.floor (astarSelection [i].y / 2), 1, 1));
                        else
                            thisMap.selectedArea.add (Qt.rect (astarSelection [i].x, astarSelection [i].y, 1, 1));
                    }
                    thisMap.selectedArea.add (Qt.rect (startDragX, startDragY, 1, 1));
                    if (addToSelection) {
                        thisMap.selectedArea.add (selectedRegion);
                    }
                });
            }
            const dRect = (Math.abs (this.tilePosition.x - startDragX) + Math.abs (this.tilePosition.y - startDragY));
            this.statusInfo = "D(rect)=" + dRect + " D(line)=" + lineDistance + " D(diagpath)=" + astarDiagResult.length + " D(rectpath)=" + astarRectResult.length;
        }
        else {
            if (!dragsPaths) {
                this.statusInfo = "S=" + surfaceFilled + "/" + totalSurfaceFilled;
            }
        }

    }, 

    // modifiers : 0x4000000 = shift, 0x2000000 = ctrl, 0x8000000 = alt
    modifiersChanged: function (modifiers) {
        const ctrl = modifiers & 0x4000000;
        const shift = modifiers & 0x2000000;
        const alt = modifiers & 0x8000000;
        addToSelection = (shift !== 0);
        useTerrains = (alt === 0);
        useDiagonals = (ctrl !== 0);
        this.updateStatusInfo ();
    },

    mousePressed: function (button, x, y, modifiers) {
        startDragX = currentTileX;
        startDragY = currentTileY;
        selectedRegion = this.map.selectedArea.get();
        isDragging = true;

        if (button === LEFT_BUTTON) {
            dragsPaths = true;
            // TODO we don't need to reset the cache every time, only if the map or the layer changes
            wangIdsCache = [];
            const clickedTile = layer.tileAt (startDragX, startDragY);
            let astarGraph;
            if (useTerrains) {
                astarGraph = new Array (layer.width * 2);
                const clickedWangIds = findWangIds (clickedTile);
                for (let x = 0; x < layer.width; x ++) {
                    astarGraph [2 * x] = new Array (layer.height * 2);
                    astarGraph [2 * x + 1] = new Array (layer.height * 2);
                    for (let y = 0; y < layer.height; y ++) {
                        //Find the wIds of this tile ; if one at least matches one of the starting one, we can use it
                        const tile = layer.tileAt (x, y);
                        const tileWIds = findWangIds (tile);
                        if (DEBUG) debug ("x="+x+",y="+y);
                        astarGraph [2 * x] [2 * y] = 0;
                        astarGraph [2 * x + 1] [2 * y] = 0;
                        astarGraph [2 * x + 1] [2 * y + 1] = 0;
                        astarGraph [2 * x] [2 * y + 1] = 0;
                        for (const tileWId of tileWIds) {
                            if (DEBUG) debug ("tileWId="+tileWId);
                            for (const clickedWangId of clickedWangIds) {
                                //debug ("clickedWangId="+clickedWangId);
                                if (clickedWangId.some (e => e === tileWId [TOP_LEFT]))
                                    astarGraph [2 * x] [2 * y] = 1;
                                if (clickedWangId.some (e => e === tileWId [TOP_RIGHT]))
                                    astarGraph [2 * x + 1] [2 * y] = 1;
                                if (clickedWangId.some (e => e === tileWId [BOTTOM_RIGHT]))
                                    astarGraph [2 * x + 1] [2 * y + 1] = 1;
                                if (clickedWangId.some (e => e === tileWId [BOTTOM_LEFT]))
                                    astarGraph [2 * x] [2 * y + 1] = 1;
                            }
                        }
                        //debug ("astarGraph["+x+"]["+y+"]="+astarGraph[x][y]);
                    }
                }
                if (DEBUG) debug ("astarGraph="+JSON.stringify(astarGraph));
            }
            else {
                astarGraph = new Array (layer.width);
                // We just look for terrains that have the same tile id
                const clickedId = layer.tileAt (currentTileX, currentTileY).id;
                for (let x = 0; x < layer.width; x ++) {
                    astarGraph [x] = new Array (layer.height);
                    for (let y = 0; y < layer.height; y ++) {
                        astarGraph [x] [y] = (layer.tileAt (x, y).id === clickedId) ? 1 : 0;
                    }
                }
            }
            rectGraph = new Graph (astarGraph);
            diagGraph = new Graph (astarGraph, {diagonal: true});
        }
        else {
            if (useTerrains) {
                fillableIds = findWangIds (layer.tileAt (currentTileX, currentTileY)) [0];  // TODO take into account the case when a tile can have multiple wangids 
                //debug ("fillableIds="+fillableIds);
                const thisMap = this.map;
                thisMap.macro ("Select Terrains area", function () {
                    thisMap.selectedArea.subtract (thisMap.selectedArea.get ());
                    const width = layer.width;
                    if (addToSelection) {
                        totalSurfaceFilled += surfaceFilled;
                    }
                    else {
                        totalSurfaceFilled = 0;
                    }
                    surfaceFilled = 0;
                    const cache = new Array (width * layer.height);
                    fill (currentTileX, currentTileY, layer.width, layer.height, 
                        function (wangId) {
                            //debug ("wangId="+wangId);
                            // If at least one wang color is the same, we include the tile
                            const hasOneSameWangColor = fillableIds.some (
                                fid => wangId.some (
                                    wid => wid === fid && wid !== 0));
                            //debug ("hasOneSameWangColor="+hasOneSameWangColor);
                            return !hasOneSameWangColor;
                        }, 
                        function (x, y) {
                            if (cache [x+y*width] === undefined) {
                                cache [x+y*width] = findWangIds (layer.tileAt (x, y)) [0];  // TODO take into account the case when a tile can have multiple wangids
                            }
                            return cache [x+y*width];
                        }, 
                        function (x, y) {
                            thisMap.selectedArea.add (Qt.rect (x, y, 1, 1));
                            surfaceFilled ++;
                            cache [x+y*width] = [];
                        });
                    if (addToSelection) {
                        thisMap.selectedArea.add (selectedRegion);
                    }
                    totalSurfaceFilled += surfaceFilled;
                });
                this.updateStatusInfo ();
            }
            else {
                dragsPaths = false;
                fillableIds = [layer.tileAt (currentTileX, currentTileY).id];
                const thisMap = this.map;
                this.map.macro ("Select Tile area", function () {
                    thisMap.selectedArea.subtract (thisMap.selectedArea.get ());
                    const width = layer.width;
                    const cache = new Array (width * layer.height);
                    surfaceFilled = 0;
                    fill (currentTileX, currentTileY, layer.width, layer.height, 
                        function (b) {
                            return !fillableIds.some (e=>e===b);
                        },
                        function (x, y) {
                            if (cache [x+y*width] === undefined) {
                                cache [x+y*width] = layer.tileAt (x, y).id;
                            }
                            return cache [x+y*width];
                        }, 
                        function (x, y) {
                            thisMap.selectedArea.add (Qt.rect (x, y, 1, 1));
                            surfaceFilled ++;
                            cache [x+y*width] = -1; // Needs to be filled so it won't be searched again ; -1 because tile ids start at 0. 
                        }
                    );
                    if (addToSelection) {
                        thisMap.selectedArea.add (selectedRegion);
                    }
                });
                this.updateStatusInfo ();
            }
        }
    }, 

    mouseReleased: function () {
        isDragging = false;
    }
});

