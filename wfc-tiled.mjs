import seedrandom from "./seedrandom.mjs";
import OverlappingModel from './overlapping-model.mjs';

const FEEDBACK_LAYER = "WFC-feedback";




let activeMap;
    
const TRANSPARENT_PIXEL_ID = 0;
let pixelId = TRANSPARENT_PIXEL_ID;
let pixelIds = [];    // A reference of all pixel Ids, by reference
let tiles = {};  // A reference to all the Tiled Tile objects, by their .id
let tileReferences = [];  // All references of tiles, by pixel id
let layersById = {};  // Layers by their layer.id

let sourceWidth;
let sourceHeight;
let data;




const DEBUG = false;
if (DEBUG) {
    tiled.debug = tiled.log;
}
else {
    tiled.debug = function (){};
}




const getProperty = function (propertyName) {
    switch (propertyName) {
        case "PATTERN_WIDTH": 
        case "PATTERN_HEIGHT": 
            return NSlider.value;
        case "OUTPUT_X_CIRCULAR": 
        case "OUTPUT_Y_CIRCULAR": 
            return isOutputCircularCheckbox.checked;
        case "SOURCE_X_CIRCULAR": 
        case "SOURCE_Y_CIRCULAR": 
            return isSourceCircularCheckbox.checked;
        case "SYMMETRY": 
            return symmetrySlider.value;
        case "RANDOM_SEED": 
            return randomSeedText.text;
        case "COUNTER": 
            return counterNumber.value;
        default:
            throw new Error ("Don't know how to get property " + propertyName);
    }
}


/** Makes a pixel reference for the pixel at x,y on all the visible layers ; 
 * also, stores a pointer for all the tiles given their ids 
 * (used for populating the output layers)
 */
// TODO cache this!
const makeTileReference = function (x, y, layers) {
    const visibleTiles = [];
    for (const layer of layers) {
        if (layer !== null && layer.visible) {
            const tile = layer.tileAt (x, y);
            if (DEBUG) tiled.debug ("x="+x+",y="+y+",layer#"+layer.id);
            if (tile !== null) {
                tiles [tile.id] = tile;
                layersById [layer.id] = layer;
                visibleTiles.push ({layerId: layer.id, id: tile.id});
            }
        }
    }
    return JSON.stringify (visibleTiles);
}

// TODO cache this!
const tilesFromReference = function (tileReference) {
    return JSON.parse (tileReference);
}


/**
 * Creates tile references for all the selected tiled ; stores input data
 */
const selectInput = function () {
    tiled.log ("Analyzing selected input zone...");
    let asset = tiled.activeAsset;
    if (asset.isTileMap) {
        activeMap = asset;
    }



    // convertir les données dans le layer source en données RGBA dans data
    const sourceX = activeMap.selectedArea.boundingRect.x;
    const sourceY = activeMap.selectedArea.boundingRect.y;
    sourceWidth = activeMap.selectedArea.boundingRect.width;
    sourceHeight = activeMap.selectedArea.boundingRect.height;
    data = new Uint8Array (sourceWidth * sourceHeight * 4);
    


    pixelId = TRANSPARENT_PIXEL_ID + 1;    // 0 is reserved for transparent (unresolved or impossible) pixels in the output
    pixelIds = [];
    tiles = {};
    tileReferences = [];
    layersById = {};

    if (DEBUG) tiled.debug ("sourceWidth="+sourceWidth+",sourceHeight="+sourceHeight);
    for (let x = 0; x < sourceWidth; x ++) {
        for (let y = 0; y < sourceHeight; y ++) {
            const tileReference = makeTileReference (x + sourceX, y + sourceY, activeMap.layers);
            tiled.debug ("tileReference="+tileReference);
            if (pixelIds [tileReference] === undefined) {
                tileReferences [pixelId] = tileReference;
                tiled.debug ("new tile reference=" + tileReference);
                pixelIds [tileReference] = pixelId;
                tiled.debug ("new pixel id :"+pixelIds [tileReference]);
                pixelId ++;
            }
            const dataPixelId = pixelIds [tileReference];
            tiled.debug ("setting data @"+x+","+y+" as "+dataPixelId);
            data [4 * (x + y * sourceWidth)] = dataPixelId & 255;
            data [1 + 4 * (x + y * sourceWidth)] = dataPixelId >> 8 & 255;
        }
    }

    if (DEBUG) {
        for (const tileref in tileReferences) {
            tiled.debug ("tileref="+tileref+", ref="+tileReferences[tileref]);
        }
        for (const pixelid in pixelIds) {
            tiled.debug ("pixid="+pixelid+",id="+pixelIds[pixelid]);
        }
        for (const layerId in layersById) {
            tiled.debug ("Layer id="+layerId+"="+layersById[layerId]);
        }
    }
    tiled.log ("Done.");
}


/**
 * Generates WFC data to the output region
 */
const outputToSelection = function () {
    tiled.log ("Generating..");

    let feedbackLayer;  // TODO Used for showing contradictory and impossible tiles
    let asset = tiled.activeAsset;
    if (asset.isTileMap) {
        if (asset !== activeMap) {
            tiled.alert ('The output map must be the same as the input map');
            return;
        }
        activeMap = asset;
        for (let layer of asset.layers) {
            // BUG : layer may be null sometimes!
            if (layer.isTileLayer && layer.name === FEEDBACK_LAYER) {
                feedbackLayer = layer;
            }
        }
    }
    else {
        tiled.alert ('The current active asset must be a tilemap');
        return;
    }

    if (feedbackLayer === undefined) {
        // TODO Create it if it doesn't exist
    }


    let PATTERN_WIDTH = getProperty ("PATTERN_WIDTH");
    let PATTERN_HEIGHT = getProperty ("PATTERN_HEIGHT");

    // TODO Updates so we can have different values for pattern width and height
    const N = (PATTERN_WIDTH !== undefined && PATTERN_WIDTH === PATTERN_HEIGHT) ? PATTERN_WIDTH : 2;
    
    // TODO use this so we can iterate a fixed number of steps
    const counter = getProperty ("COUNTER");

    // TODO Updates so we can manage rotations and symmetries with finer granularity (most notably enable X and Y symmetries separately)
    const SYMMETRY = getProperty ("SYMMETRY");
    const outputWidth = activeMap.selectedArea.boundingRect.width;
    const outputHeight = activeMap.selectedArea.boundingRect.height;
    const outputX = activeMap.selectedArea.boundingRect.x;
    const outputY = activeMap.selectedArea.boundingRect.y;

    const randomSeed = getProperty ('RANDOM_SEED');
    tiled.debug ("randomSeed="+randomSeed);
    const random = (randomSeed === undefined || randomSeed === null || randomSeed === '') ? Math.random : seedrandom (randomSeed);
    tiled.debug ("random="+random);

    // TODO : change the constructor signature to take a single properties object instead of numerous parameters
    const isSourceCircular = 
        (getProperty("SOURCE_X_CIRCULAR") || getProperty("SOURCE_Y_CIRCULAR")) === true;
    const isOutputCircular = 
        (getProperty("OUTPUT_X_CIRCULAR") || getProperty("OUTPUT_Y_CIRCULAR")) === true;
    tiled.debug ("sourceWidth="+sourceWidth+",sourceHeight="+sourceHeight+",N="+N+",outputWidth="+outputWidth+",outputHeight="+outputHeight+",SYMMETRY="+SYMMETRY+",isSourceCircular="+isSourceCircular+",isOutputCircular="+isOutputCircular);



    let model = new OverlappingModel (data, sourceWidth, sourceHeight, N, 
        outputWidth, outputHeight, isSourceCircular, isOutputCircular, 
        SYMMETRY);
    // TODO : add a new parameter to include contradictory and impossible pixels in the feedback layer
    

    // TODO use model.iterate () and use the counter parameter
    const generate = model.generate (random);  

    if (generate) {
        tiled.log ("Generation success.");
        const resultData = model.graphics ();
        activeMap.macro ("WFC generation", function () {
            const edits = [];
            for (const layerId in layersById) {
                edits [layerId] = layersById[layerId].edit ();
            }
            for (let x = 0; x < outputWidth; x ++) {
                for (let y = 0; y < outputHeight; y ++) {
                    const outputPixelId = 
                        resultData [4 * (x + y * outputWidth)] +
                        (resultData [1 + 4 * (x + y * outputWidth)] << 8);
                    if (DEBUG) tiled.debug ("outputPixelId="+outputPixelId);
                    if (outputPixelId !== TRANSPARENT_PIXEL_ID) {
                        if (DEBUG) tiled.debug ("tileReferences[outputPixelId]="+tileReferences [outputPixelId]);
                        const visibleTiles = tilesFromReference (tileReferences [outputPixelId]);
                        for (const tile of visibleTiles) {
                            edits [tile.layerId].setTile (outputX + x, outputY + y, tiles [tile.id]);
                        }
                    }
                    else {
                        if (DEBUG) tiled.debug ("Impossible pixel @" + x + "," + y);
                        // output a transparent tile on all the layers
                        for (const layerId in layersById) {
                            edits [layerId].setTile (outputX + x, outputY + y, null);
                        }
                    }
                }
            }
            for (const edit in edits) {
                edits [edit].apply();
            }
        });
    }
    else {
        tiled.warn ("Generation ended in a contradiction. You may try again. ");
    }
}

/**
 * Tiled menu integration and dialogs
 *
 */

let isSourceCircularCheckbox;
let isOutputCircularCheckbox;
let symmetrySlider;
let NSlider;
let counterNumber;
let randomSeedText;
let selectOutputButton;

const wfcDialog = tiled.registerAction ("WFCDialog", function (action) {
    const d = new Dialog ("Wave Function Collapse");
    const selectInputButton = d.addButton ("Select input");
    // TODO add busy cursor while the function is running
    selectInputButton.clicked.connect (function () {
        selectOutputButton.enabled = true;
        selectInput();
    });
    isSourceCircularCheckbox = d.addCheckBox ("Circular input");
    isOutputCircularCheckbox = d.addCheckBox ("Circular output");
    symmetrySlider = d.addSlider ("Symmetry and rotations");
    symmetrySlider.minimum = 1;
    symmetrySlider.maximum = 8;
    NSlider = d.addSlider ("Pattern size");
    NSlider.minimum = 2;
    NSlider.maximum = 4;
    counterNumber = d.addNumberInput ("Iterations counter");
    counterNumber.tooltip = "set to -1 to disable";
    counterNumber.minimum = -1;
    counterNumber.maximum = 1000;
    counterNumber.decimals = 0;
    counterNumber.value = -1;
    counterNumber.enabled = false; // TODO enable this when functional
    randomSeedText = d.addTextInput ("Random seed");
    randomSeedText.tooltip = "If set to empty, uses a random seed";
    selectOutputButton = d.addButton ("Generate and output to selection");
    // TODO add busy cursor while the function is running
    selectOutputButton.clicked.connect (outputToSelection);
    selectOutputButton.enabled = false;
    d.show ();
});

wfcDialog.text = "Wave Function Collapse";
tiled.extendMenu ("Map", [{action: "WFCDialog", before: "MapProperties"},{separator: true}]);
