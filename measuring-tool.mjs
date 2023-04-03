import line from './line.mjs';
import Graph from './astar.mjs';
import {astar} from './astar.mjs';


let wangIdsCache = [];


const findWangIds = function (tile) {
    if (wangIdsCache [tile] !== undefined) {
        return wangIdsCache [tile]; 
    }
    else {
        const wangIds = [];
        for (const wSet of tile.tileset.wangSets) {
            wangIds.push (wSet.wangId (tile));  // FIXME Will only return coherent results if the tileSet has only one wangSet : the wangId is relative to a wangSet, not a tileSet. 
        }
        //tiled.log ("tile "+ tile + " has wangids"+wangIds);
        wangIdsCache [tile] = wangIds;
        return wangIds;
    }
}



const measureTool = tiled.registerTool ("Measure", {
    name: "Measuring Tool", 
    icon: "measuring-tape.png", 
    targetLayerType: Layer.TileLayerType, 

    activated: function () {
        // TODO : check the selected pixel position, the active layer type
        this.selectedX = this.map.selectedArea.boundingRect.x;
        this.selectedY = this.map.selectedArea.boundingRect.y;

        wangIdsCache = [];
        this.layer = tiled.activeAsset.layers [0];   // TODO manage multiple layers
        const graph = new Array (this.layer.width);
        const topLeftSelectedTile = this.layer.tileAt (this.selectedX, this.selectedY);
        const topLeftSelectedWangIds = findWangIds (topLeftSelectedTile);
        //tiled.log ("topLeftSelectedWangIds="+topLeftSelectedWangIds);
        for (let x = 0; x < this.layer.width; x ++) {
            graph [x] = new Array (this.layer.height);
            for (let y = 0; y < this.layer.height; y ++) {
                if (topLeftSelectedWangIds.length === 0) {
                    graph [x] [y] = ((this.layer.tileAt (x, y) === topLeftSelectedTile) ? 1 : 0);
                }
                else {
                    //Find the wIds of this tile ; if one at least matches one of the starting one, we can use it
                    const tile = this.layer.tileAt (x, y);
                    const tileWIds = findWangIds (tile);
                    graph [x] [y] = 0;
                    for (const tileWId of tileWIds) {
                        //tiled.log ("tileWId="+tileWId);
                        for (const tlsWId of topLeftSelectedWangIds) {
                            //tiled.log ("tlsWId="+tlsWId);
                            if (""+tlsWId === ""+tileWId) {
                                graph [x] [y] = 1;
                                break;
                            }
                        }
                    }
                    //tiled.log ("graph["+x+"]["+y+"]="+graph[x][y]);
                }
            }
        }
        this.rectGraph = new Graph (graph);
        this.diagGraph = new Graph (graph, {diagonal: true});
    }, 

    updateStatusInfo: function () {
        //tiled.log ("tilePosition="+this.tilePosition);
        // TODO : selected surface (with all rects), A* distance, with or without wang
        let lineDistance = -1;  // The line function counts the first pixel, but we expect the distance to be 0 in this case
        line (this.tilePosition.x, this.tilePosition.y, this.selectedX, this.selectedY, function () {
            lineDistance ++;
        });


        let diagResult = "N/A";
        let rectResult = "N/A";
        const diagStart = this.diagGraph.grid [this.selectedX] [this.selectedY];
        const rectStart = this.rectGraph.grid [this.selectedX] [this.selectedY];
        if (this.tilePosition.x < this.layer.width && this.tilePosition.x >= 0 
            && this.tilePosition.y < this.layer.height && this.tilePosition.y >= 0) {
            const diagEnd = this.diagGraph.grid [this.tilePosition.x] [this.tilePosition.y];
            const rectEnd = this.rectGraph.grid [this.tilePosition.x] [this.tilePosition.y];
            // TODO : use these results to make a selection matching the paths
            diagResult = astar.search (this.diagGraph, diagStart, diagEnd, {heuristics: astar.heuristics.diagonal});
            diagResult = diagResult.length;
            rectResult = astar.search (this.rectGraph, rectStart, rectEnd);
            rectResult = rectResult.length;
        }

        this.statusInfo = "D(rect)=" + (Math.abs (this.tilePosition.x - this.selectedX) + Math.abs (this.tilePosition.y - this.selectedY)) + " D(line)=" + lineDistance + " D(diagpath)=" + diagResult + " D(rectpath)=" + rectResult;
    }, 
});

