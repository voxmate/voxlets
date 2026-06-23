function gen4col_bt(solutions, vertices, whichVertex, work, stopAtOne) { // generate a 4-coloring through backtracking

    for (let color = 0; color < 4; ++color) {

        let color_burned = false;

        for (let neighbor = 0, neighborCap = vertices[whichVertex].neighbors.length; ((neighbor < neighborCap) && (!color_burned)); ++neighbor) {
            if (vertices[vertices[whichVertex].neighbors[neighbor]].color === color) {
                color_burned = true;
            }
        }

        if (!color_burned) {

            vertices[whichVertex].color = color;

            if (whichVertex === (vertices.length - 1)) {
                solutions.push(vertices.map(v => v.color));
                if (stopAtOne) {
                    return solutions[0];
                }
            } else {
                const oneRowResult = gen4col_bt(solutions, vertices, whichVertex + 1, work, stopAtOne);
                if (oneRowResult) {
                    return oneRowResult;
                }
            }

            vertices[whichVertex].color = undefined;

        }

    }

}

function gen4col_obj(vertices, stopAtOne) {
    const solutions = [],
        oneRow = gen4col_bt(solutions, vertices, 0, [], stopAtOne);
    return oneRow ? oneRow : solutions;
}

function gen4col(vertices, stopAtOne) {
    return gen4col_obj(vertices.map(arr => {
        return {neighbors: arr};
    }), stopAtOne);
}

export function colorize(adjacencyMatrix: number[][]): number[] {
    return gen4col(adjacencyMatrix, true);
}