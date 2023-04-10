import {analyzeTileSets, pickRandomTile, buildWangCellsMap, wangCellsToMap} from './wang.mjs';


const FEEDBACK_LAYER = "Transform-feedback";



const DEBUG = false;
let debug;
if (DEBUG) {
    debug = tiled.log;
}
else {
    debug = function (){};
}



const getProperty = function (propertyName) {
    switch (propertyName) {
        default:
            throw new Error ("Don't know how to get property " + propertyName);
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
    const scalingSelectButton = d.addButton ("Select the area to scale up");
    scalingSelectButton.clicked.connect (function () {
        activeMap = tiled.activeAsset;
        const [wangIdsToTiles, tileById, tileIdToWang, tileProbabilities] = analyzeTileSets (activeMap);
        wangCells = buildWangCellsMap (activeMap, tileIdToWang);
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
