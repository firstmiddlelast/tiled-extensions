import line from './line.mjs';
import fill from './fill.mjs';

/*

p = new Process();
e = p.exec ('C:\\Users\\ROBIN\\Downloads\\curl-8.0.1_5-win32-mingw\\bin\\curl', ["https://www.mapeditor.org/docs/scripting/classes/Process.html"], true);
r = p.readStdOut ();
p.close ();

*/






const tilePlot = function (tileId) {
    return function (x, y) {
        if (x >= 0 && x < grid.length && y >= 0 && y < grid [0].length) {
            //tiled.log ("Setting tile " + x + "," + y + " as " + tileId);
            grid [x][y] = tileId;
        }
    }
}

let p;
let activeMap;
let plotTile;
let coordsCounter;
let grid;
let drawTileId;

const importOSM = tiled.registerAction ("ImportOSM", function (action) {
    coordsCounter = 1000;
    const f = new TextFile ("c:\\users\\robin\\downloads\\export(3).geojson");  // TODO get this froma file in the UI
    p = JSON.parse (f.readAll());
    f.close ();
    activeMap = tiled.activeAsset;  // TODO check this is a map, and there is one layer selected
    plotTile = activeMap.usedTilesets()[0].findTile (9);  // TODO check there is an used tileset
    drawTileId = 9;    // Make this the selected tile in the selected tileset
    const selectedWidth = activeMap.selectedArea.boundingRect.width;
    const selectedHeight = activeMap.selectedArea.boundingRect.height;
    const selectedX = activeMap.selectedArea.boundingRect.x;
    const selectedY = activeMap.selectedArea.boundingRect.y;
    let minLongitude;
    let minLatitude;
    let maxLongitude;
    let maxLatitude;
    for (const feature of p.features) {
        tiled.log (feature.properties.description);
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
    tiled.log ("minLatitude="+minLatitude);
    tiled.log ("maxLatitude="+maxLatitude);
    let xMapScaling = selectedWidth / (maxLongitude - minLongitude);
    let yMapScaling = selectedHeight / (maxLatitude - minLatitude);
    const respectOSMRatio = false;   // TODO make this an option
    if (respectOSMRatio) {
        xMapScaling = yMapScaling = Math.min (xMapScaling, yMapScaling);
    }
    tiled.log ("xMapScaling="+xMapScaling);
    tiled.log ("yMapScaling="+yMapScaling);
    const editedLayer = activeMap.selectedLayers [0];
    // Setup a grid for drawing and filling
    grid = new Array (editedLayer.width);
    for (let x = 0; x < grid.length; x ++) {
        grid [x] = new Array (editedLayer.height);
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
                if (coordsCounter < 0) break;
                currentX = selectedX + Math.floor ((coord [0] - minLongitude) * xMapScaling);
                //tiled.log ("coord="+coord+", minLongitude="+minLongitude+",xMapScaling="+xMapScaling);
                currentY = selectedY + selectedHeight - Math.floor ((coord [1] - minLatitude) * yMapScaling); // Latitudes go up and map coordinates go down, so we need to take the opposite of the latitude
                //tiled.log ("currentX="+currentX+",currentY="+currentY);
                centerX += coord [0];
                centerY += coord [1];
                coordsCount ++;
                if (previousX !== undefined) {
                    if (previousX !== currentX || previousY !== currentY) {
                coordsCounter --;
                        //tiled.log ("Line " + previousX + "," + previousY + "-" + currentX + "," + currentY);
                        line (previousX, previousY, currentX, currentY, tilePlot (drawTileId));
                    }
                }
                previousX = currentX;
                previousY = currentY;
            }
            // TODO : filling polygons should be optional
            if (type === "Polygon") {
                centerX /= coordsCount;
                centerY /= coordsCount;
                centerX = selectedX + Math.floor ((centerX - minLongitude) * xMapScaling);
                centerY = selectedY + selectedHeight - Math.floor ((centerY - minLatitude) * yMapScaling);
                tiled.log ("centerX="+centerX+",centerY="+centerY);
                fill (centerX, centerY, 
                    grid.length, grid [0].length, 
                    drawTileId, function (x, y) {
                        return grid[x][y];
                    }, tilePlot (drawTileId));
                // TODO : utiliser une grille de wangCells
            }
        }
    }
    // Draw from the grid to the tiles
    const edit = editedLayer.edit ();  // TODO check only one layer is selected
    const tileset = activeMap.usedTilesets()[0];    // TODO fix this (many tilesets are possible)
    for (let x = 0; x < grid.length; x ++) {
        for (let y = 0; y < grid.length; y ++) {
            if (grid [x] [y] !== undefined) {
                edit.setTile (x, y, tileset.findTile (drawTileId)); 
            }
        }
    }
    edit.apply ();
    //const c = g.coordinates[0][0];    // Premier point (x, y) d'un MultiLineString
    //g.coordinates[0];    // Premier point (x, y) d'un LineString
});

importOSM.text = "Import OSM";
tiled.extendMenu ("Map", [{action: "ImportOSM", before: "MapProperties"}, {separator: true}]);
