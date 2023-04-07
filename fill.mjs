/*
Fill code modified from https://codeheir.com/2022/08/21/comparing-flood-fill-algorithms-in-javascript/
*/
const directions = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
// border either a comparison function (c) that returns true if c is an appropriate color for the border, or a value for the border
// getGrid (x, y) returns values that can be compared to border with !==
// setGrid (x, y) draws the (x, y) point
export default function fill (x, y, width, height, border, getGrid, setGrid) {
    //tiled.log ("Filling from " + x + "," + y + " to color " + border);
    const queue = [{x: x, y: y}];
    let fillCounter = 100000;   // DEBUG ensures the fill stops at some point
    while (queue.length > 0 && fillCounter > 0) {
        fillCounter --;
        const current = queue.shift(0);
        for (let i = 0; i < directions.length; i++) {
            const child = {
                x: current.x + directions[i][0],
                y: current.y + directions[i][1],
            }
            //tiled.log ("child="+child.x+","+child.y);
            if (child.x >= 0 && child.x < width 
                && child.y >= 0 && child.y < height) {
                    //tiled.log ("getGrid (child.x, child.y)="+getGrid (child.x, child.y));
                    if (border instanceof Function 
                        && !border (getGrid (child.x, child.y))
                        || !border instanceof Function 
                        && getGrid (child.x, child.y) !== border) {
                            setGrid (child.x, child.y);
                            queue.push(child);
                    }
            }
        }
    }
    //tiled.log ("End of fill, queue length=" + queue.length);
}

