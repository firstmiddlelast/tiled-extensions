import line from './line.mjs';
import Graph from './astar.mjs';
import {astar} from './astar.mjs';


let wangIdsCache = [];
let log = console.log;


const findWangIds = function (tile) {
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

const pathTool = tiled.registerTool ("Path", {
    name: "Pathing Tool", 
    icon: "measuring-tape.png", 
    targetLayerType: Layer.TileLayerType, 


    activated: function () {
        layer = tiled.activeAsset.layers [0];   // TODO manage multiple layers
    },


    updateStatusInfo: function () {
        currentTileX = this.tilePosition.x;
        currentTileY = this.tilePosition.y;
        //log ("tilePosition="+this.tilePosition);
        // TODO : selected surface (with all rects)
        let lineDistance = -1;  // The line function counts the first pixel, but we expect the distance to be 0 in this case
        if (isDragging) {
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
                // TODO : use these results to make a selection matching the paths
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
                });
            }
            this.statusInfo = "D(rect)=" + (Math.abs (this.tilePosition.x - startDragX) + Math.abs (this.tilePosition.y - startDragY)) + " D(line)=" + lineDistance + " D(diagpath)=" + astarDiagResult.length + " D(rectpath)=" + astarRectResult.length;
        }

    }, 

    // modifiers : 0x4000000 = shift, 0x2000000 = ctrl, 0x8000000 = alt
    modifiersChanged: function (modifiers) {
        const ctrl = modifiers & 0x4000000;
        const shift = modifiers & 0x2000000;
        const alt = modifiers & 0x8000000;
        addToSelection = (shift !== 0);
        useTerrains = (ctrl === 0);
        useDiagonals = (alt !== 0);
        this.updateStatusInfo ();
    },

    mousePressed: function (button, x, y, modifiers) {
        startDragX = currentTileX;
        startDragY = currentTileY;
        isDragging = true;

        wangIdsCache = [];
        const graph = new Array (layer.width);
        const clickedTile = layer.tileAt (startDragX, startDragY);
        if (useTerrains) {
            const clickedWangIds = findWangIds (clickedTile);
            //log ("clickedWangIds="+clickedWangIds);
            for (let x = 0; x < layer.width; x ++) {
                graph [x] = new Array (layer.height);
                for (let y = 0; y < layer.height; y ++) {
                    if (clickedWangIds.length === 0) {
                        graph [x] [y] = ((layer.tileAt (x, y) === clickedTile) ? 1 : 0);
                    }
                    else {
                        //Find the wIds of this tile ; if one at least matches one of the starting one, we can use it
                        const tile = layer.tileAt (x, y);
                        const tileWIds = findWangIds (tile);
                        graph [x] [y] = 0;
                        for (const tileWId of tileWIds) {
                            //log ("tileWId="+tileWId);
                            for (const tlsWId of clickedWangIds) {
                                //log ("tlsWId="+tlsWId);
                                if (""+tlsWId === ""+tileWId) {
                                    graph [x] [y] = 1;
                                    break;
                                }
                            }
                        }
                        //log ("graph["+x+"]["+y+"]="+graph[x][y]);
                    }
                }
            }
        }
        else {
            // We just look for terrains that have the same tile id
            const clickedId = layer.tileAt (currentTileX, currentTileY).id;
            for (let x = 0; x < layer.width; x ++) {
                graph [x] = new Array (layer.height);
                for (let y = 0; y < layer.height; y ++) {
                    graph [x] [y] = (layer.tileAt (x, y).id === clickedId) ? 1 : 0;
                }
            }
        }
        rectGraph = new Graph (graph);
        diagGraph = new Graph (graph, {diagonal: true});
    }, 

    mouseReleased: function () {
        isDragging = false;
    }
});

