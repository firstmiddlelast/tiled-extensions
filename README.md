# Tiled extensions
Javascript extensions for the [Tiled Map Editor](https://www.mapeditor.org/)

## wfc-tiled.js
Adds a Map/Wave Function Collapse action that opens a dialog for applying a basic version of the Wave Function Collapse to your currently opened tile map. Based on [Kevin Chapelier port](https://github.com/kchapelier/wavefunctioncollapse) of [Maxim Gumin's implementation of the algorithm](https://github.com/mxgmn/WaveFunctionCollapse). 

### 1 Give the algorithm a tile selection to work from
Open the dialog, select a rectangular part of your map to feed the algorithm, click "Select input". This will save all the required data for generation. Check the console output for feedback. All visible layers are part of the input data. 

### 2 Select your generation options
* Circular input
Select if the input wraps around the edges. 
* Circular output
Select if the generated tiles are supposed to wrap around the edges. 
* Symmetry and rotations
Cursor to the left : no symmetry or rotations in the initial selection. The tile patterns are only those visible. 
Cursor to the right : full symmetry and rotations. All the patterns in the input selection will be rotated and reverted in all axes and directions before generation. 
* Pattern size
Cursor to the left : patterns are 2X2
Cursor to the left : patterns are 4X4
* Random seed : if you want a repeatable result, type something in this zone. Generated results that have the same input selection, generation options (including random seed) and output region will allways produce the same result. 
* Counter : Number of iterations before giving up on a generation (-1 = no limit). Not implemented yet. 

### 3 Generate tiles
Select the rectangular region you want to fill with the algoritm and press the "Generate" button. Check the console output for feedback. You can Edit/Undo your changes if you don't like them, and click the button again. Note that all the layers that were included in the source selection will be modified. 

Tips : 
* The larger the pattern size, the more the changes of a failure (contradiction). 
* The algorithm likes repetitive patterns on (very) small numbers of tiles. Since all the visible layers are part of a visible tile for the algorithm, try to keep visible layers to 2 or 3 at most. See [interactive examples](http://www.kchapelier.com/wfc-example/overlapping-model.html) of the working algorithm. 
* Transparent tiles in the input do not overwrite existing tiles when they are generated in the output selection. 
