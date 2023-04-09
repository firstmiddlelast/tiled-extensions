import line from './line.mjs';
import fill from './fill.mjs';


const DEBUG = false;
let debug = function () {};
if (DEBUG) {
    debug = tiled.log;
}


/*

p = new Process();
e = p.exec ('C:\\Users\\ROBIN\\Downloads\\curl-8.0.1_5-win32-mingw\\bin\\curl', ["https://www.mapeditor.org/docs/scripting/classes/Process.html"], true);
r = p.readStdOut ();
p.close ();

*/



const TOP_RIGHT = 1; 
const TOP_LEFT = 7;
const BOTTOM_RIGHT = 3;
const BOTTOM_LEFT = 5;



// From https://stackoverflow.com/questions/17410809/how-to-calculate-rotation-in-2d-in-javascript
function rotate (cx, cy, x, y, angle) {
    const radians = (Math.PI / 180) * angle,
        cos = Math.cos (radians),
        sin = Math.sin (radians),
        nx = (cos * (x - cx)) + (sin * (y - cy)) + cx,
        ny = (cos * (y - cy)) - (sin * (x - cx)) + cy;
    return [nx, ny];
}



const plot = function (id) {
    return function (x, y) {
        if (x >= 0 && x < grid.length && y >= 0 && y < grid [0].length) {
            //debug ("Plotting " + x + "," + y + " as " + id);
            grid [x][y] = id;
        }
    }
}

let p;
let activeMap;
let plotTile;
let coordsCounter;
let grid;

let drawId; // This is either a tile ID or a wang color ID
let lineWidth = 1;

const importOSMAction = tiled.registerAction ("ImportOSM", function (action) {
    const d = new Dialog ("OSM import");
    const geoJsonFilePicker = d.addFilePicker ("OSM GEOJson File");
    geoJsonFilePicker.fileUrl = "C:/Users/ROBIN/Downloads/export(3).geojson";
    const useTerrainsCheckbox = d.addCheckBox ("Use Terrains");
    useTerrainsCheckbox.checked = true;
    const rotationNumber = d.addNumberInput ("Rotation angle");
    rotationNumber.value = 0;
    const fillPolygonsCheckbox = d.addCheckBox ("Fill polygons");
    const respectOSMRatioCheckbox = d.addCheckBox ("Respect OSM XY ratio");
    const lineWidthNumber = d.addNumberInput ("Line width");
    lineWidthNumber.decimals = 0;
    lineWidthNumber.minimum = 1;
    const importButton = d.addButton ("Import OSM data");
    importButton.clicked.connect (function () {
        lineWidth = lineWidthNumber.value;
        importOsm (geoJsonFilePicker.fileUrl, rotationNumber.value, fillPolygonsCheckbox.checked, useTerrainsCheckbox.checked, respectOSMRatioCheckbox.checked);
    });
    d.show ();
});

const urlToLocalPath = function (url) {
    return url
        .replace ('file:///', '')
        .replace (/\//g, '\\');
}

const importOsm = function (geoJsonFile, rotation, fillPolygons, useTerrains, respectOSMRatio) {
    coordsCounter = 10000;  // DEBUG feature.
    const f = new TextFile (urlToLocalPath ("" + geoJsonFile));
    p = JSON.parse (f.readAll());
    f.close ();
    activeMap = tiled.activeAsset;  // TODO check this is a map, and there is one layer selected
    const tiles = tiled.mapEditor.tilesetsView.selectedTiles;
    if (tiles.length !== 1) {
        tiled.alert ("One tile must be selected in the tilesets view");
        return;
    }
    const drawingTileId = tiles [0].id;
    plotTile = activeMap.usedTilesets()[0].findTile (drawingTileId);
    //debug ("plotTile="+plotTile);
    const useWangCells = useTerrains;
    const wangIdToTiles = {};
    if (useWangCells) {
        const drawWangId = tiles [0].tileset.wangSets [0].wangId (tiles [0]);
        if (!(drawWangId [TOP_RIGHT] === drawWangId [TOP_LEFT] && drawWangId [TOP_LEFT] === drawWangId [BOTTOM_LEFT] && drawWangId [BOTTOM_LEFT] === drawWangId [BOTTOM_RIGHT])) {
            tiled.alert ("The selected tile must have only one terrain type");
            return;
        }
        drawId = drawWangId [TOP_LEFT];
        for (const tile of activeMap.usedTilesets()[0].tiles) {
            wangIdToTiles ["" + tile.tileset.wangSets[0].wangId (tile)] = tile;
        }
    }
    else {
        drawId = drawingTileId;    // Make this the selected tile in the selected tileset
    }
    let selectedWidth = activeMap.selectedArea.boundingRect.width;
    let selectedHeight = activeMap.selectedArea.boundingRect.height;
    const selectedX = activeMap.selectedArea.boundingRect.x;
    const selectedY = activeMap.selectedArea.boundingRect.y;
    let minLongitude;
    let minLatitude;
    let maxLongitude;
    let maxLatitude;
    let centerLongitude = 0;
    let centerLatitude = 0;
    let coordsCount = 0;
    for (const feature of p.features) {
        let geometry = feature.geometry;
        const type = geometry.type;
        let coordsSet;
        switch (type) {
            case "LineString":
                coordsSet = [geometry.coordinates];
                break;
            case "MultiLineString":
            case "Polygon":
                coordsSet = geometry.coordinates;
                break;
            default:
                tiled.warn ("geometry type " + type + " is unknown, skipping it");
                break;
        }
        if (coordsSet === undefined) {
            continue;
        }
        for (const coordinates of coordsSet) {
            for (const coord of coordinates) {
                const longitude = coord [0];
                const latitude = coord [1];
                centerLongitude += longitude; 
                centerLatitude += latitude;
                coordsCount ++;
                if (minLongitude === undefined) {
                    minLongitude = maxLongitude = longitude; 
                    minLatitude = maxLatitude = latitude; 
                }
                else {
                    minLongitude = Math.min (minLongitude, longitude);
                    minLatitude = Math.min (minLatitude, latitude);
                    maxLongitude = Math.max (maxLongitude, longitude);
                    maxLatitude = Math.max (maxLatitude, latitude);
                }
            }
        }
    }
    centerLongitude = centerLongitude / coordsCount;
    centerLatitude /= coordsCount;
    debug ("rotation centerLongitude="+centerLongitude+", centerLatitude="+centerLatitude);
    if (useWangCells) {
        selectedWidth *= 2;
        selectedHeight *= 2;
    }
    let xMapScaling = selectedWidth / (maxLongitude - minLongitude);
    let yMapScaling = selectedHeight / (maxLatitude - minLatitude);
    if (respectOSMRatio) {
        xMapScaling = yMapScaling = Math.min (xMapScaling, yMapScaling);
    }
    debug ("xMapScaling="+xMapScaling);
    debug ("yMapScaling="+yMapScaling);
    const angle = rotation;
    const editedLayer = activeMap.selectedLayers [0];
    // Setup a grid for drawing and filling
    grid = new Array (selectedWidth);
    for (let x = 0; x < grid.length; x ++) {
        grid [x] = new Array (selectedHeight);
    }
    for (const feature of p.features) {
        let geometry = feature.geometry;
        const type = geometry.type;
        let coordsSet;
        switch (type) {
            case "LineString":
                coordsSet = [geometry.coordinates];
                break;
            case "MultiLineString":
            case "Polygon":
                coordsSet = geometry.coordinates;
                break;
            default:
                tiled.warn ("geometry type " + type + " is unknown, skipping it");
                break;
        }
        if (coordsSet === undefined) {
            continue;
        }
        for (const coordinates of coordsSet) {
            let centerX = 0; 
            let centerY = 0; 
            let coordsCount = 0;
            let previousX;
            let previousY;
            let currentX;
            let currentY;
            for (const coord of coordinates) {
                if (coordsCounter < 0) break;   // this is a DEBUG feature
                let coordLongitude = coord [0];
                let coordLatitude = coord [1];
                if (angle !== 0) {
                    const rotatedCoords = rotate (
                        centerLongitude, centerLatitude,
                        coordLongitude, coordLatitude, angle);
                    debug ("Rotated coords="+rotatedCoords[0]+","+rotatedCoords[1] +" (from " + coordLongitude+","+coordLatitude+")");
                    coordLongitude = rotatedCoords [0];
                    coordLatitude = rotatedCoords [1];
                }
                currentX = /*selectedX + */ Math.floor ((coordLongitude - minLongitude) * xMapScaling);
                //debug ("coord="+coord+", minLongitude="+minLongitude+",xMapScaling="+xMapScaling);
                currentY = /*selectedY + */ selectedHeight - Math.floor ((coordLatitude - minLatitude) * yMapScaling); // Latitudes go up and map coordinates go down, so we need to take the opposite of the latitude
                //debug ("currentX="+currentX+",currentY="+currentY);
                centerX += coordLongitude;
                centerY += coordLatitude;
                coordsCount ++;
                if (previousX !== undefined) {
                    if (previousX !== currentX || previousY !== currentY) {
                coordsCounter --;
                        //debug ("Line " + previousX + "," + previousY + "-" + currentX + "," + currentY);
                        if (lineWidth === 1) {
                            line (previousX, previousY, currentX, currentY, plot (drawId), useWangCells);
                        }
                        else {
                            const dx = currentX - previousX;
                            const dy = currentY - previousY;
                            const d = Math.sqrt (dx*dx+dy*dy);
                            const bx = Math.floor (-lineWidth*dy/(d*2));
                            const by = Math.floor (lineWidth*dx/(d*2));
                            tiled.log ("border from " + (previousX+bx) + ","
                                + (previousY+by) + " to " + (previousX-bx) + ","
                                + (previousY-by));
                            line (previousX+bx, previousY+by, 
                                previousX-bx, previousY-by, 
                                function (x, y) {
                                    line (x, y, x+dx, y+dy, plot (drawId), useWangCells);
                                }, useWangCells);
                        }
                    }
                }
                previousX = currentX;
                previousY = currentY;
            }
            if (fillPolygons && type === "Polygon") {
                centerX /= coordsCount;
                centerY /= coordsCount;
                centerX = /*selectedX +*/ Math.floor ((centerX - minLongitude) * xMapScaling);
                centerY = /*selectedY +*/ selectedHeight - Math.floor ((centerY - minLatitude) * yMapScaling);
                debug ("polygon centerX="+centerX+",centerY="+centerY+",drawId="+drawId);
                fill (centerX, centerY, 
                    grid.length, grid [0].length, 
                    drawId, function (x, y) {
                        return grid [x] [y];
                    }, plot (drawId));
                // TODO : utiliser une grille de wangCells
            }
        }
    }
    // Draw from the grid to the tiles
    const edit = editedLayer.edit ();  // TODO check only one layer is selected
    const tileset = activeMap.usedTilesets()[0];    // TODO fix this (many tilesets are possible)
    if (!useWangCells) {
        for (let x = 0; x < grid.length; x ++) {
            for (let y = 0; y < grid [0].length; y ++) {
                if (grid [x] [y] !== undefined) {
                    edit.setTile (selectedX + x, selectedY + y, tileset.findTile (drawId)); 
                }
            }
        }
    }
    else {
        // We make sure the wang IDs will be ok for a Terrains Corner Set
        for (let x = 0; x < grid.length; x ++) {
            for (let y = 0; y < grid [0].length; y ++) {
                if (grid [x] [y] !== undefined) {
                    const xSmallOdd = x - 1 | 1;
                    const ySmallOdd = y - 1 | 1;
                    //debug ("xSmallOdd="+xSmallOdd);
                    if (grid [xSmallOdd] === undefined) {
                        grid [xSmallOdd] = new Array (selectedHeight);
                    }
                    grid [xSmallOdd] [ySmallOdd] = grid [x] [y];
                    grid [xSmallOdd] [ySmallOdd + 1] = grid [x] [y];
                    if (grid [xSmallOdd + 1] === undefined) {
                        grid [xSmallOdd + 1] = new Array (selectedHeight);
                    }
                    grid [xSmallOdd + 1] [ySmallOdd] = grid [x] [y];
                    grid [xSmallOdd + 1] [ySmallOdd + 1] = grid [x] [y];
                }
            }
        }


        let stop = false;   // DEBUG
        let wangCounter = 10000;
        // Now find tiles with the appropriate wang ids (=colors), matching also the colors on the map
        for (let tileX = selectedX; !stop && tileX < selectedX + selectedWidth / 2; tileX ++) { // /2 because it has been multiplied by 2 earlier - FIXME make another variable
            for (let tileY = selectedY; !stop && tileY < selectedY + selectedHeight / 2; tileY ++) { // See comment above
                const tile = editedLayer.tileAt (tileX, tileY);
                let wangId;
                if (tile === null) {
                    wangId = [0, 0, 0, 0, 0, 0, 0, 0];
                    debug ("empty tile @"+tileX+","+tileY);
                }
                else {
                    wangId = tile.tileset.wangSets[0].wangId (tile);  // TODO could be more than one wangsets
                }
                const x = (tileX - selectedX) * 2;
                const y = (tileY - selectedY) * 2;
                let changed = false;
                if (grid [x] [y] !== undefined) {
                    wangId [TOP_LEFT] = grid [x] [y];
                    changed = true;
                }
                if (grid [x+1] [y] !== undefined) {
                    wangId [TOP_RIGHT] = grid [x+1] [y];
                    changed = true;
                }
                if (grid [x] [y+1] !== undefined) {
                    wangId [BOTTOM_LEFT] = grid [x] [y+1];
                    changed = true;
                }
                if (grid [x+1] [y+1] !== undefined) {
                    wangId [BOTTOM_RIGHT] = grid [x+1] [y+1];
                    changed = true;
                }
                if (changed) {
                    // TODO FIXME This is wrong : there can be many tiles with the same wangId, we need to pick one at random
                    const newTile = wangIdToTiles [""+wangId];
                    if (tile === null) debug ("newTile="+newTile);
                    if (newTile !== undefined) {
                        edit.setTile (tileX, tileY, newTile);
                    }
                }
                stop = (wangCounter--<0);
            }
        }
    }
    edit.apply ();
    //const c = g.coordinates[0][0];    // Premier point (x, y) d'un MultiLineString
    //g.coordinates[0];    // Premier point (x, y) d'un LineString
};

importOSMAction.text = "Import OSM";
tiled.extendMenu ("Map", [{action: "ImportOSM", before: "MapProperties"}, {separator: true}]);
