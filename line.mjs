export default function line(x0, y0, x1, y1, plot) {
   var dx = Math.abs(x1 - x0);
   var dy = Math.abs(y1 - y0);
   var sx = (x0 < x1) ? 1 : -1;
   var sy = (y0 < y1) ? 1 : -1;
   var err = dx - dy;

   while(true) {
      plot(x0, y0); 
      if ((x0 === x1) && (y0 === y1)) break;
        /*
        Note that comparing floats directly may fail as you step (though it shouldn't when stepping by integer amounts, it might if either end point is non-integer), so instead of directly comparing the end points you might want to use an epsilon:
        if (Math.abs(x0 - x1) < 0.0001 && Math.abs(y0 - y1) < 0.0001) break;
        */
      var e2 = 2*err;
      if (e2 > -dy) { err -= dy; x0  += sx; }
      if (e2 < dx) { err += dx; y0  += sy; }
   }
}

