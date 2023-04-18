import {analyzeTileSets, pickRandomTile, buildWangCellsMap, wangCellsToMap} from './wang.mjs';


const DEBUG = false;
let debug;
if (DEBUG) {
    debug = tiled.log;
}
else {
    debug = function (){};
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


/**
 *
 * Every two (because there are 2 wangcells for 1 tile) rows, add rows that are identical to the last wangId row are added. Same for columns. 
 */
const inflate = function (matrix, addX, addY) {
    let output = [];
    let outputX = 0;
    let outputY;
    for (let x = 0; x < matrix.length; x ++) {
        output [outputX] = [];
        for (let y = 0; y < matrix [0].length; y ++) {
            output [outputX] [y] = matrix [x] [y];
        }
        outputX ++;
        if (x & 1 !== 0 && x !== matrix.length - 1) {
            for (let i = 0; i < addX; i ++) {
                output [outputX] = [];
                for (let y = 0; y < matrix [0].length; y ++) {
                    output [outputX] [y] = matrix [x] [y];
                }
                outputX ++;
            }
        }
    }
    if (addY > 0) {
        output = transpose (output);
        output = inflate (output, addY, 0);
        output = transpose (output);
    }
    return output;
}

tiled.log (JSON.stringify (inflate ([[0,1,2],[3,4,5]], 0, 2)));

const randomizeSelectedArea = function () {
    // Go through the selected area..
    const activeMap = tiled.activeAsset;
    debug ("activeMap="+activeMap);
    const tilesets = activeMap.usedTilesets ();
    const selectedRects = activeMap.selectedArea.get().rects;
    debug (selectedRects);

    const [wangIdsToTiles, tileById, tileIdToWang, tileProbabilities] = analyzeTileSets (activeMap);
    activeMap.macro ("Randomize", function(){
    debug ("Randomizing..");
    if (DEBUG) debug (JSON.stringify (tileProbabilities));
    for (const rect of selectedRects) {
        for (let x = rect.x; x < rect.x + rect.width; x ++) {
            for (let y = rect.y; y < rect.y + rect.height; y ++) {
                for (const layer of activeMap.selectedLayers) {
                    const edit = layer.edit ();
                    const tile = layer.tileAt (x, y);
                    for (const wangSet of tile.tileset.wangSets) {
                        edit.setTile (x, y, tileById [pickRandomTile (wangSet.wangId (tile), wangIdsToTiles, tileProbabilities)]);
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
    let wangCells = [];
    const d = new Dialog ("Transform Terrains");
    let transformCombo;
    let activeMap;
    let useTerrainsCheckbox;
    const selectTransformInputButton = d.addButton ("Select the area for transformation");
    selectTransformInputButton.clicked.connect (function () {
        activeMap = tiled.activeAsset;
        const [wangIdsToTiles, tileById, tileIdToWang, tileProbabilities] = analyzeTileSets (activeMap);
        wangCells = buildWangCellsMap (activeMap, tileIdToWang);
        transformSelectedButton.enabled = true;
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
        if (DEBUG) debug ("wangCells="+JSON.stringify (wangCells));
        debug ("activeMap="+activeMap);
        const [wangIdsToTiles, tileById, tileIdToWang, tileProbabilities] = analyzeTileSets (activeMap);
        debug ("activeMap="+activeMap);
        wangCellsToMap (wangCells, activeMap, tileById, wangIdsToTiles, tileProbabilities);
        debug ("activeMap="+activeMap);
        transformSelectedButton.enabled = false;
    });
    transformSelectedButton.enabled = false;
    d.addSeparator ();
    const scalingSelectButton = d.addButton ("Select the area to scale up or inflate");
    scalingSelectButton.clicked.connect (function () {
        activeMap = tiled.activeAsset;
        const [wangIdsToTiles, tileById, tileIdToWang, tileProbabilities] = analyzeTileSets (activeMap);
        wangCells = buildWangCellsMap (activeMap, tileIdToWang);
        scalingApplyButton.enabled = true;
    });
    const scaleOrInflate = d.addCheckBox ("Scale/inflate");
    const xScalingSpinner = d.addNumberInput ("X");
    xScalingSpinner.decimals = 0;
    const yScalingSpinner = d.addNumberInput ("Y");
    yScalingSpinner.decimals = 0;
    const scalingApplyButton = d.addButton ("Scale up / inflate into selected");
    scalingApplyButton.enabled = false;
    scalingApplyButton.clicked.connect (function () {
        if (tiled.activeAsset !== activeMap) {
            tiled.alert ("The input selection for scaling must be in the same map as the output");
        }
        if (scaleOrInflate.checked) {
            wangCells = scale (wangCells, xScalingSpinner.value, yScalingSpinner.value);
        }
        else {
            wangCells = inflate (wangCells, xScalingSpinner.value, yScalingSpinner.value * 2);
        }
        const [wangIdsToTiles, tileById, tileIdToWang, tileProbabilities] = analyzeTileSets (activeMap);
        wangCellsToMap (wangCells, activeMap, tileById, wangIdsToTiles, tileProbabilities);
        scalingApplyButton.enabled = false;
    });
    d.addSeparator ();
    const randomizeButton = d.addButton ("Randomize the selected area");
    randomizeButton.clicked.connect (randomizeSelectedArea);
    d.show ();
});

transformDialog.text = "Transform Terrains";
tiled.extendMenu ("Map", [{action: "TransformTerrainsDialog", before: "MapProperties"},{separator: true}]);
