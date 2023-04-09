const DEBUG = false;
let debug;
if (DEBUG) {
    debug = console.log;
}
else {
    debug = function () {};
}


const WANGID_SEPARATOR = ',';


// TODO : check this is an EDGE wang set, not border or mixed

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
