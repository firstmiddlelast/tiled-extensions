/* Draws a line. 
 * plot (x, y) draws the point @x, y. 
 * x and y values are not bounded in the line function, so it's up to the plot() call to check those. 
 */
export default function line (x0, y0, x1, y1, plot, nodiagonals = false) {
    const dx = Math.abs (x1 - x0);
    const dy = Math.abs (y1 - y0);
    const sx = (x0 < x1) ? 1 : -1;
    const sy = (y0 < y1) ? 1 : -1;
    let err = dx - dy;
    let x3;
    let y3;
    let x2;
    let y2;

    let lastPlottedX;
    while (true) {
        
        if (!nodiagonals || (nodiagonals 
            && (x0 !== x3 || y0 !== y3) 
            && (x0 !== x2 || y0 !== y2))) {  // This is to ensure we don't plot an already plotted point
            plot (x0, y0); 
        }
        if ((x0 === x1) && (y0 === y1)) break;
        /*
         * Note that comparing floats directly may fail as you step (though it shouldn't when stepping by integer amounts, it might if either end point is non-integer),
         * so instead of directly comparing the end points you might want to use an epsilon:
         * if (Math.abs(x0 - x1) < 0.0001 && Math.abs(y0 - y1) < 0.0001) break;
         */
        const e2 = 2 * err;
        if (e2 > -dy) {
            err -= dy; 
            x0  += sx;
            if (nodiagonals) {
                plot (x0, y0);
                x3 = x0;
                y3 = y0;
            }
        }
        if (e2 < dx) {
            err += dx;
            y0  += sy;
            if (nodiagonals) {
                plot (x0, y0);
                x2 = x0;
                y2 = y0;
            }
        }
    }
}

