import line from './line.mjs';
import Graph from './astar.mjs';
import {astar} from './astar.mjs';
import fill from './fill.mjs';


let wangIdsCache = [];
let log = console.log;


const findWangIds = function (tile) {
    if (tile === null) {
        return [];
    }
    if (wangIdsCache [tile] !== undefined) {
        return wangIdsCache [tile]; 
    }
    else {
        const wangIds = [];
        for (const wSet of tile.tileset.wangSets) {
            wangIds.push (wSet.wangId (tile));  // FIXME Will only return coherent results if the tileSet has only one wangSet : the wangId is relative to a wangSet, not a tileSet. 
        }
        //log ("tile "+ tile + " has wangids"+wangIds);
        wangIdsCache [tile] = wangIds;
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
let surfaceFilled = 0;

const pathTool = tiled.registerTool ("Path", {
    name: "Pathing Tool", 
    icon: "measuring-tape.png", 
    targetLayerType: Layer.TileLayerType, 


    activated: function () {
        layer = this.map.selectedLayers [0];
    },


    updateStatusInfo: function () {
        currentTileX = this.tilePosition.x;
        currentTileY = this.tilePosition.y;
        //log ("tilePosition="+this.tilePosition);
        // TODO : selected surface (with all rects)
        let lineDistance = -1;  // The line function counts the first pixel, but we expect the distance to be 0 in this case
        if (isDragging && dragsPaths) {
            line (this.tilePosition.x, this.tilePosition.y, startDragX, startDragY, function () {
                lineDistance ++;
            }, !useDiagonals);


            const diagStart = diagGraph.grid [startDragX] [startDragY];
            const rectStart = rectGraph.grid [startDragX] [startDragY];
            let astarDiagResult = [];
            let astarRectResult = [];
            if (this.tilePosition.x < layer.width && this.tilePosition.x >= 0 
                && this.tilePosition.y < layer.height && this.tilePosition.y >= 0) {
                const diagEnd = diagGraph.grid [this.tilePosition.x] [this.tilePosition.y];
                const rectEnd = rectGraph.grid [this.tilePosition.x] [this.tilePosition.y];
                // See list of heuristics: http://theory.stanford.edu/~amitp/GameProgramming/Heuristics.html
                astarDiagResult = astar.search (diagGraph, diagStart, diagEnd, {closest: true, heuristic: astar.heuristics.diagonal});
                astarRectResult = astar.search (rectGraph, rectStart, rectEnd, {closest: true});
                const thisMap = this.map;   // Required because in the function below, this.map is undefined. 
                const astarSelection = (useDiagonals)? astarDiagResult : astarRectResult;
                this.map.macro ("Select path", function () {
                    const region = thisMap.selectedArea.subtract (thisMap.selectedArea.get());
                    for (let i = 0; i < astarSelection.length; i ++) {
                        thisMap.selectedArea.add (Qt.rect (astarSelection [i].x, astarSelection [i].y, 1, 1));
                    }
                    thisMap.selectedArea.add (Qt.rect (startDragX, startDragY, 1, 1));
                });
            }
            this.statusInfo = "D(rect)=" + (Math.abs (this.tilePosition.x - startDragX) + Math.abs (this.tilePosition.y - startDragY)) + " D(line)=" + lineDistance + " D(diagpath)=" + astarDiagResult.length + " D(rectpath)=" + astarRectResult.length;
        }
        else {
            if (!dragsPaths) {
                this.statusInfo = "S=" + surfaceFilled;
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
        isDragging = true;

        if (button === LEFT_BUTTON) {
            dragsPaths = true;
            // TODO we don't need to reset the cache every time, only if the map or the layer changes
            wangIdsCache = [];
            const astarGraph = new Array (layer.width);
            const clickedTile = layer.tileAt (startDragX, startDragY);
            if (useTerrains) {
                const clickedWangIds = findWangIds (clickedTile);
                for (let x = 0; x < layer.width; x ++) {
                    astarGraph [x] = new Array (layer.height);
                    for (let y = 0; y < layer.height; y ++) {
                        if (clickedWangIds.length === 0) {
                            astarGraph [x] [y] = ((layer.tileAt (x, y) === clickedTile) ? 1 : 0);
                        }
                        else {
                            //Find the wIds of this tile ; if one at least matches one of the starting one, we can use it
                            const tile = layer.tileAt (x, y);
                            const tileWIds = findWangIds (tile);
                            astarGraph [x] [y] = 0;
                            for (const tileWId of tileWIds) {
                                //log ("tileWId="+tileWId);
                                for (const tlsWId of clickedWangIds) {
                                    //log ("tlsWId="+tlsWId);
                                    // If at least one non-zero wang color is in the tile, we can path through it
                                    if (tlsWId.some (e=>e!==0 && tileWId.some (f=>f===e))) {
                                        astarGraph [x] [y] = 1;
                                        break;
                                    }
                                }
                            }
                            //log ("astarGraph["+x+"]["+y+"]="+astarGraph[x][y]);
                        }
                    }
                }
            }
            else {
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
                //tiled.log ("fillableIds="+fillableIds);
                const thisMap = this.map;
                thisMap.macro ("Select Terrains area", function () {
                    const region = thisMap.selectedArea.subtract (thisMap.selectedArea.get ());
                    const width = layer.width;
                    surfaceFilled = 0;
                    const cache = new Array (width * layer.height);
                    fill (currentTileX, currentTileY, layer.width, layer.height, 
                        function (wangId) {
                            //tiled.log ("wangId="+wangId);
                            // If at least one wang color is the same, we include the tile
                            const hasOneSameWangColor = fillableIds.some (
                                fid => wangId.some (
                                    wid => wid === fid && wid !== 0));
                            //tiled.log ("hasOneSameWangColor="+hasOneSameWangColor);
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
                });
            }
            else {
                dragsPaths = false;
                fillableIds = [layer.tileAt (currentTileX, currentTileY).id];
                const thisMap = this.map;
                this.map.macro ("Select Tile area", function () {
                    const region = thisMap.selectedArea.subtract (thisMap.selectedArea.get ());
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
                });
                this.updateStatusInfo ();
            }
        }
    }, 

    mouseReleased: function () {
        isDragging = false;
    }
});

