const FEEDBACK_LAYER = "Transform-feedback";



const DEBUG = true;
if (DEBUG) {
    tiled.debug = tiled.log;
}
else {
    tiled.debug = function (){};
}



const getProperty = function (propertyName) {
    switch (propertyName) {
        default:
            throw new Error ("Don't know how to get property " + propertyName);
    }
}


const WANGID_SEPARATOR = ',';

let wangIdToTiles;
let tileIdToWang; // A map from tile id to wang id
let tileById;
let activeMap;

// TODO : check this is an EDGE wang set, not border or mixed
const buildWangIdToTilesReference = function () {
    wangIdToTiles = {};
    tileIdToWang = {};
    tileById = {};
    if (!activeMap.isTileMap) {
        throw new Error ("A tile map must be active");
    }
    tiled.debug ("activeMap="+activeMap);
    const tilesets = activeMap.usedTilesets ();
    const selectedRects = activeMap.selectedArea.get().rects;
    tiled.debug (selectedRects);
    for (const tileset of tilesets) {
        for (const tile of tileset.tiles) {
            tileById [tile.id] = tile;
            for (const wangSet of tile.tileset.wangSets) {
                const wangId = wangSet.wangId (tile);
                tileIdToWang [tile.id] = wangId;   // FIXME There can be more than one wang id per tile??
                tiled.debug ("Tile " + tile.id + " has wangId " + wangId);
                const wangIdString = wangId.join (WANGID_SEPARATOR);
                if (wangIdToTiles [wangIdString] === undefined)
                    wangIdToTiles [wangIdString] = [];
                if (!wangIdToTiles [wangIdString].some (e=>e==tile.id))
                    wangIdToTiles [wangIdString].push (tile.id);
            }
        }
    }
}



// Shameless copy/paste from https://stackoverflow.com/questions/17428587/transposing-a-2d-array-in-javascript
function transpose (matrix) {
    const rows = matrix.length, cols = matrix[0].length;
    const grid = [];
    for (let j = 0; j < cols; j++) {
        grid[j] = Array(rows);
    }
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            grid[j][i] = matrix[i][j];
        }
    }
    return grid;
}




let wangCells = [];
// Indexes of the numbers in the wang ids matching the position of the square
const WANG_TOP_LEFT = 7;
const WANG_TOP_RIGHT = 1;
const WANG_BOTTOM_LEFT = 5;
const WANG_BOTTOM_RIGHT = 3;

const buildWangCellsMap = function (tileMap) {
    const boundingRect = tileMap.selectedArea.boundingRect;
    wangCells = [];
    for (let x = 0; x < boundingRect.width; x ++) {
        wangCells [x * 2] = new Array (boundingRect.height * 2);
        wangCells [x * 2 + 1] = new Array (boundingRect.height * 2);
        for (let y = 0; y < boundingRect.height; y ++) {
            for (const layer of tileMap.selectedLayers) {   // TODO : use visible layers instead of selected ones
                // FIXME This works only on ONE layer. we must have as many wangCells arrays as we have layers
                const wangTile = tileIdToWang [layer.tileAt (x + boundingRect.x, y + boundingRect.y).id];
                wangCells [x * 2] [y * 2] = wangTile [WANG_TOP_LEFT];
                wangCells [x * 2 + 1] [y * 2] = wangTile [WANG_TOP_RIGHT];
                wangCells [x * 2] [y * 2 + 1] = wangTile [WANG_BOTTOM_LEFT];
                wangCells [x * 2 + 1] [y * 2 + 1] = wangTile [WANG_BOTTOM_RIGHT];
            }
        }
    }
}



const wangCellsToMap = function (tileMap) {
    const boundingRect = tileMap.selectedArea.boundingRect;
    for (const tileId in tileById) {
        tiled.debug ("tileById["+tileId+"]="+tileById[tileId]);
    }
    const edits = {};
    for (const layer of tileMap.selectedLayers) {   // TODO : use visible layers instead of selected ones
                // FIXME This works only on ONE layer. we must have as many wangCells arrays as we have layers
        const edit = layer.edit ();
        for (let x = 0; x < wangCells.length / 2; x ++) {
            for (let y = 0; y < wangCells [0].length / 2; y ++) {
                // Build a wangId from the wang cells
                const wangIdString = [0, wangCells [x * 2 + 1] [y * 2], 0, wangCells [x * 2 + 1] [y * 2 + 1], 
                    0, wangCells [x * 2] [y * 2 + 1], 0, wangCells [x * 2] [y * 2]].join (WANGID_SEPARATOR);
                const tileId = wangIdToTiles [wangIdString];
                // TODO Pick a random one and put it onto the map
                tiled.debug ("tileId="+tileId);
                // For now we take only the first tile ([0])
                edit.setTile (x + boundingRect.x, y + boundingRect.y, tileById [tileId[0]]);
            }
        }
        edit.apply ();
    }
}



const scale = function (matrix, scaleX, scaleY) {
    const output = new Array (matrix.length * scaleX);
    for (let x = 0; x < matrix.length; x ++) {
        for (let dx = 0; dx < scaleX; dx ++) {
            output [x * scaleX + dx] = new Array (matrix [x].length * scaleY);
        }
        for (let y = 0; y < matrix [x].length; y ++) {
            for (let dx = 0; dx < scaleX; dx ++) {
                for (let dy = 0; dy < scaleY; dy ++) {
                    output [parseInt(x * scaleX + dx)] [parseInt(y * scaleY + dy)] = matrix [x] [y];
                }
            }
        }
    }
    return output;
}


const randomizeSelectedArea = function () {
    // Go through the selected area..
    const activeMap = tiled.activeAsset;
    tiled.debug ("activeMap="+activeMap);
    const tilesets = activeMap.usedTilesets ();
    const selectedRects = activeMap.selectedArea.get().rects;
    tiled.debug (selectedRects);
    let wangIdsToTiles = {};
    const tileById = {};
    const tileProbabilities = {};
    for (const tileset of tilesets) {
        for (const tile of tileset.tiles) {
            tiled.debug ("Tile " + tile.id + " has probability " + tile.probability);
            if (tile.probability < 1) { // TODO change the probability mechanism : sort the probabilities from greater to least, test them all and replace with the last one that passes the test
                tileProbabilities [tile.id] = tile.probability;
            }
            tileById [tile.id] = tile;
            // ..choose tiles that have a matching WangId..
            for (const wangSet of tile.tileset.wangSets) {
                const wangId = wangSet.wangId (tile);
                tiled.debug ("Tile " + tile.id + " has wangId " + wangId);
                const wangIdString = wangId.join (',');
                if (wangIdsToTiles [wangIdString] === undefined)
                    wangIdsToTiles [wangIdString] = [];
                if (!wangIdsToTiles [wangIdString].some (e=>e==tile.id))
                    wangIdsToTiles [wangIdString].push (tile.id);
            }
        }
    }
    activeMap.macro ("Randomize", function(){
    tiled.debug ("Randomizing..");
    tiled.debug (JSON.stringify (tileProbabilities));
    for (const rect of selectedRects) {
        for (let x = rect.x; x < rect.x + rect.width; x ++) {
            for (let y = rect.y; y < rect.y + rect.width; y ++) {
                for (const layer of activeMap.selectedLayers) {
                    const edit = layer.edit ();
                    const tile = layer.tileAt (x, y);
                    for (const wangSet of tile.tileset.wangSets) {
                        const wangId = wangSet.wangId (tile);
                        // ..pick all the tiles and replace them with other tiles 
                        // ..with the same wangid randomly according to their probability
                        const wangIdString = wangId.join (',');
                        for (const replacementTileId of wangIdsToTiles [wangIdString]) {
                            if (Math.random () < tileProbabilities [replacementTileId]) {
                                tiled.debug ("Replacing tile " + tile.id + " @"+x+","+y+" with tile " + replacementTileId);
                                edit.setTile (x, y, tileById [replacementTileId]);
                            }
                        }
                    }
                    edit.apply();
                }
            }
        }
    }
    });
}

/**
 * Tiled menu integration and dialogs
 *
 */


const transformDialog = tiled.registerAction ("TransformTerrainsDialog", function (action) {
    const d = new Dialog ("Transform Terrains");
    let transformCombo;
    let useTerrainsCheckbox;
    const selectTransformInputButton = d.addButton ("Select the area for transformation");
    selectTransformInputButton.clicked.connect (function () {
        activeMap = tiled.activeAsset;
        buildWangIdToTilesReference ();
        buildWangCellsMap (activeMap);
    });
    transformCombo = d.addComboBox ("Transforms", ["Horizontal symmetry", "Vertical symmetry", "Rotate left", "Rotate right", "Rotate 180°"]);
    useTerrainsCheckbox = d.addCheckBox ("Use Terrains");
    useTerrainsCheckbox.checked = true;
    useTerrainsCheckbox.enabled = false;    // TODO
    const transformSelectedButton = d.addButton ("Transform into the selected area");
    transformSelectedButton.clicked.connect (function () {
        activeMap = tiled.activeAsset;
        switch (transformCombo.currentIndex) {
            case 0:     // Horizontal symmetry
                wangCells.reverse ();
                break;
            case 1:     // Vertical symmetry
                for (let x = 0; x < wangCells.length; x ++) {
                    wangCells [x].reverse ();
                }
                break;
            case 2:     // Rotate left
                wangCells.reverse ();
                wangCells = transpose (wangCells);
                break;
            case 3:     // Rotate right
                wangCells = transpose (wangCells); 
                wangCells.reverse ();
                break;
            case 4:     // Rotate 180°
                wangCells = transpose (wangCells);
                wangCells.reverse ();
                wangCells = transpose (wangCells);
                wangCells.reverse ();
                break;
            default: 
                throw new Error ("Invalid index : " + transformCombo.currentIndex);
        }
        tiled.debug ("wangCells="+JSON.stringify (wangCells));
        wangCellsToMap (activeMap);
    });
    d.addSeparator ();
    const scalingSelectButton = d.addButton ("Select the area to scale up");
    scalingSelectButton.clicked.connect (function () {
        activeMap = tiled.activeAsset;
        buildWangIdToTilesReference ();
        buildWangCellsMap (activeMap);
        scalingApplyButton.enabled = true;
    });
    const xScalingSpinner = d.addNumberInput ("X Scaling");
    xScalingSpinner.decimals = 0;
    xScalingSpinner.minimum = 1;
    const yScalingSpinner = d.addNumberInput ("Y Scaling");
    yScalingSpinner.decimals = 0;
    yScalingSpinner.minimum = 1;
    const scalingApplyButton = d.addButton ("Scale up into the selected area");
    scalingApplyButton.enabled = false;
    scalingApplyButton.clicked.connect (function () {
        if (tiled.activeAsset !== activeMap) {
            tiled.alert ("The input selection for scaling must be in the same map as the output");
        }
        wangCells = scale (wangCells, xScalingSpinner.value, yScalingSpinner.value);
        wangCellsToMap (activeMap);
        scalingApplyButton.enabled = false;
    });
    d.addSeparator ();
    const randomizeButton = d.addButton ("Randomize the selected area");
    randomizeButton.clicked.connect (randomizeSelectedArea);
    d.show ();
});

transformDialog.text = "Transform Terrains";
tiled.extendMenu ("Map", [{action: "TransformTerrainsDialog", before: "MapProperties"},{separator: true}]);
