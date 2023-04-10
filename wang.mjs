const DEBUG = false;
let debug;
if (DEBUG) {
    debug = tiled.log;
}
else {
    debug = function () {};
}


const WANGID_SEPARATOR = ',';
// Indexes of the numbers in the wang ids matching the position of the square
const TOP_LEFT = 7;
const TOP_RIGHT = 1;
const BOTTOM_LEFT = 5;
const BOTTOM_RIGHT = 3;


// TODO : check this is a CORNER wang set, not edge or mixed

export function analyzeTileSets (map) {
    const wangIdsToTiles = {};
    const tileById = {};
    const tileIdToWang = {};
    const tileProbabilities = {};
    for (const tileset of map.usedTilesets()) { // FIXME can be an issue if there are more than one tileset with tiles having the same id
        for (const tile of tileset.tiles) {
            debug ("Tile " + tile.id + " has probability " + tile.probability);
            tileProbabilities [tile.id] = tile.probability;
            tileById [tile.id] = tile;
            // ..choose tiles that have a matching WangId..
            for (const wangSet of tile.tileset.wangSets) {
                const wangId = wangSet.wangId (tile);
                tileIdToWang [tile.id] = wangId;   // FIXME There can be more than one wang id per tile
                debug ("Tile " + tile.id + " has wangId " + wangId);
                const wangIdString = wangId.join (',');
                if (wangIdsToTiles [wangIdString] === undefined)
                    wangIdsToTiles [wangIdString] = [];
                if (!wangIdsToTiles [wangIdString].some (e=>e==tile.id))
                    wangIdsToTiles [wangIdString].push (tile.id);
            }
        }
    }
    return [wangIdsToTiles, tileById, tileIdToWang, tileProbabilities];
}


export function pickRandomTile (wangId, wangIdsToTiles, tileProbabilities) {
    const wangIdString = wangId.join (WANGID_SEPARATOR);
    const distribution = [];
    let totalProb = 0;
    if (wangIdsToTiles [wangIdString] === undefined) {
        return;
    }
    for (const replacementTileId of wangIdsToTiles [wangIdString]) {
        distribution.push ({tileId: replacementTileId, probability: tileProbabilities [replacementTileId]});
        totalProb += tileProbabilities [replacementTileId];
    }
    if (DEBUG) debug ("distribution="+JSON.stringify(distribution));
    let pickedRandom = Math.random () * totalProb;
    for (const distributed of distribution) {
        pickedRandom -= distributed.probability;
        if (pickedRandom <= 0) {
            return distributed.tileId;
        }
    }
}

export function buildWangCellsMap (tileMap, tileIdToWang) {
    const boundingRect = tileMap.selectedArea.boundingRect;
    const wangCells = [];
    for (let x = 0; x < boundingRect.width; x ++) {
        wangCells [x * 2] = new Array (boundingRect.height * 2);
        wangCells [x * 2 + 1] = new Array (boundingRect.height * 2);
        for (let y = 0; y < boundingRect.height; y ++) {
            for (const layer of tileMap.selectedLayers) {   // TODO : use visible layers instead of selected ones
                // FIXME This works only on ONE layer. we must have as many wangCells arrays as we have layers
                const wangTile = tileIdToWang [layer.tileAt (x + boundingRect.x, y + boundingRect.y).id];
                wangCells [x * 2] [y * 2] = wangTile [TOP_LEFT];
                wangCells [x * 2 + 1] [y * 2] = wangTile [TOP_RIGHT];
                wangCells [x * 2] [y * 2 + 1] = wangTile [BOTTOM_LEFT];
                wangCells [x * 2 + 1] [y * 2 + 1] = wangTile [BOTTOM_RIGHT];
            }
        }
    }
    return wangCells;
}

export function wangCellsToMap (wangCells, tileMap, tileById, wangIdsToTiles, tileProbabilities) {
    const boundingRect = tileMap.selectedArea.boundingRect;
    for (const tileId in tileById) {
        debug ("tileById["+tileId+"]="+tileById[tileId]);
    }
    const edits = {};
    debug (tileMap.selectedLayers.length + " layers selected");
    for (const layer of tileMap.selectedLayers) {   // TODO : use visible layers instead of selected ones
                // FIXME This works only on ONE layer. we must have as many wangCells arrays as we have layers
        const edit = layer.edit ();
        for (let x = 0; x < wangCells.length / 2; x ++) {
            for (let y = 0; y < wangCells [0].length / 2; y ++) {
                const wangId = [0, wangCells [x * 2 + 1] [y * 2], 0, wangCells [x * 2 + 1] [y * 2 + 1], 
                    0, wangCells [x * 2] [y * 2 + 1], 0, wangCells [x * 2] [y * 2]];
                const r = pickRandomTile (wangId, wangIdsToTiles, tileProbabilities);
                edit.setTile (x + boundingRect.x, y + boundingRect.y, tileById [r]);
            }
        }
        edit.apply ();
    }
}
