// cis487.js
// David Owen

const cis487 = {};

cis487.init = function (canvasId, clearColor=[0, 0, 0]) {
    const el = document.getElementById(canvasId);
    cis487.gl = el.getContext("experimental-webgl");
    cis487.gl.clearColor(...clearColor, 1);
    cis487.gl.enable(cis487.gl.DEPTH_TEST);
};

cis487.attachShader = function (shaderProgram, shader, sourceFile) {

    const readFile = function (file) {
        return new Promise(function (resolve, reject) {
            const xhr = new XMLHttpRequest();

            xhr.onload = function () {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        // File successfully read.
                        resolve(xhr.responseText);
                    } else {
                        // File not successfully read.
                        reject(xhr.statusText);
                    }
                }
            };

            xhr.onerror = function () {
                // File not successfully read.
                reject(xhr.statusText);
            };

            xhr.responseType = "text";
            xhr.open("GET", file, true);
            xhr.send();
        });
    };

    return new Promise(function (resolve, reject) {
        const shaderSourceRead = readFile(sourceFile);

        shaderSourceRead.then(
            // shaderSourceRead successful.
            function (source) {
                cis487.gl.shaderSource(shader, source);
                cis487.gl.compileShader(shader);

                if (cis487.gl.getShaderParameter(shader,
                        cis487.gl.COMPILE_STATUS)) {
                    cis487.gl.attachShader(shaderProgram, shader);
                    // attachShader successful.
                    resolve();
                } else {
                    // attachShader not successful.
                    reject("Unable to compile " + sourceFile + " (" +
                            cis487.gl.getShaderInfoLog(shader) + ").");
                }
            },
            // shaderSourceRead not successful.
            function (statusText) {
                reject("Unable to read file " + sourceFile + " (" +
                        statusText + ").");
            }
        );
    });
};

cis487.setupShaders = function (vertexShaderFile, fragmentShaderFile,
        positionAttributeVarName, transformUniformVarName,
        colorUniformVarName) {

    return new Promise(function (resolve, reject) {
        const shaderProgram = cis487.gl.createProgram();
        const vertexShader = cis487.gl.createShader(
                cis487.gl.VERTEX_SHADER);
        const vertexShaderAttached = cis487.attachShader(
                shaderProgram, vertexShader, vertexShaderFile);
        const fragmentShader = cis487.gl.createShader(
                cis487.gl.FRAGMENT_SHADER);
        const fragmentShaderAttached = cis487.attachShader(
                shaderProgram, fragmentShader, fragmentShaderFile);
        const shadersAttached = Promise.all(
                [vertexShaderAttached, fragmentShaderAttached]);

        shadersAttached.then(
            // Both attachShader calls successful.
            function () {
                cis487.gl.linkProgram(shaderProgram);
                cis487.gl.useProgram(shaderProgram);

                cis487.positionAttribute = cis487.gl.getAttribLocation(
                        shaderProgram, positionAttributeVarName);
                cis487.gl.enableVertexAttribArray(
                        cis487.positionAttribute);
                cis487.transformUniform = cis487.gl.getUniformLocation(
                        shaderProgram, transformUniformVarName);
                cis487.colorUniform = cis487.gl.getUniformLocation(
                        shaderProgram, colorUniformVarName);

                resolve();
            },
            // One attachShader call failed.  (Or both--we just get
            // the error message for the first failure.)
            function (errorMessage) {
                reject(errorMessage);
            }
        );
    });
};

cis487.copyVertexDataToBuffer = function (vertexData) {
    const buffer = cis487.gl.createBuffer();

    cis487.gl.bindBuffer(cis487.gl.ARRAY_BUFFER, buffer);
    cis487.gl.bufferData(cis487.gl.ARRAY_BUFFER,
            new Float32Array(vertexData), cis487.gl.STATIC_DRAW);

    return buffer;
};

cis487.clear = function () {
    cis487.gl.clear(cis487.gl.COLOR_BUFFER_BIT |
            cis487.gl.DEPTH_BUFFER_BIT);
};

cis487.setTransform = function (transform) {

    if (transform.values) {
        cis487.gl.uniformMatrix4fv(cis487.transformUniform,
                false, new Float32Array(transform.values));
    } else {
        cis487.gl.uniformMatrix4fv(cis487.transformUniform,
                false, new Float32Array(transform));
    }
};

cis487.setColor = function (color) {
    cis487.gl.uniform3f(cis487.colorUniform, ...color);
};

cis487.drawFromBuffer = function (buffer, numberOfVertices) {
    cis487.gl.bindBuffer(cis487.gl.ARRAY_BUFFER, buffer);
    cis487.gl.vertexAttribPointer(cis487.positionAttribute, 3,
            cis487.gl.FLOAT, false, 12, 0);
    cis487.gl.drawArrays(cis487.gl.TRIANGLE_STRIP, 0,
            numberOfVertices);
};

cis487.Transform = function (values=undefined) {
    const transform = {};

    if (values !== undefined) {
        transform.values = values.slice(); // Make a copy.
    } else {
        transform.values = [ 1, 0, 0, 0,
                             0, 1, 0, 0,
                             0, 0, 1, 0,
                             0, 0, 0, 1 ];
    }
    
    transform.stack = [];
    
    transform.push = function () {
        transform.stack.push(transform.values.slice());
    };
    
    transform.pop = function () {
        transform.values = transform.stack.pop();
    };
    
    transform.multiplyBy = function (b, pre=false) {
        const a = transform.values;
        
        if (b.values !== undefined) {
            b = b.values;
        }
        
        const result = [ 0, 0, 0, 0,
                         0, 0, 0, 0,
                         0, 0, 0, 0,
                         0, 0, 0, 0 ];

        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                for (let k = 0; k < 4; k++) {
                    if (pre) {
                        result[i * 4 + j] += 
                                b[i * 4 + k] * a[k * 4 + j];
                    } else {
                        result[i * 4 + j] +=
                                a[i * 4 + k] * b[k * 4 + j];
                    }
                }
            }
        }
        
        transform.values = result.slice();
    };
    
    transform.translate = function (tx, ty, tz, pre=false) {
        transform.multiplyBy([ 1, 0, 0, tx,
                               0, 1, 0, ty,
                               0, 0, 1, tz,
                               0, 0, 0,  1 ], pre);
    };
    
    transform.scale = function (sx, sy, sz, pre=false) {
        transform.multiplyBy([ sx,  0,  0, 0,
                                0, sy,  0, 0,
                                0,  0, sz, 0,
                                0,  0,  0, 1 ], pre);
    };
    
    transform.rotateX = function (angle, pre=false) {
        const a = angle * Math.PI / 180;
        const c = Math.cos(a);
        const s = Math.sin(a);
        transform.multiplyBy([ 1, 0,  0, 0,
                               0, c, -s, 0,
                               0, s,  c, 0,
                               0, 0,  0, 1 ], pre);
    };
    
    transform.rotateY = function (angle, pre=false) {
        const a = angle * Math.PI / 180;
        const c = Math.cos(a);
        const s = Math.sin(a);
        transform.multiplyBy([ c, 0, s, 0,
                               0, 1, 0, 0,
                              -s, 0, c, 0,
                               0, 0, 0, 1 ], pre);
    };
    
    transform.rotateZ = function (angle, pre=false) {
        const a = angle * Math.PI / 180;
        const c = Math.cos(a);
        const s = Math.sin(a);
        transform.multiplyBy([ c, -s, 0, 0,
                               s,  c, 0, 0,
                               0,  0, 1, 0,
                               0,  0, 0, 1 ], pre);
    };
    
    transform.perspective = function (n, f, t, r) {
        transform.multiplyBy(
                [ n/r,   0,           0,           0,
                    0, n/t,           0,           0,
                    0,   0, (n+f)/(n-f), 2*n*f/(n-f),
                    0,   0,          -1,           0 ]);
    };
   
    // Based on gluInvertMatrixd function, from Mesa 9.0.0, which
    // credits David Moore.
    // ftp://ftp.freedesktop.org/pub/mesa/glu/glu-9.0.0.tar.gz
    // (glu-9.0.0/src/libutil/project.c)
    //
    // This version is reformatted and refactored a bit.  If
    // the determinant is zero (i.e., the matrix doesn't have an
    // inverse), it will print an error message in the console
    // but leave the current transformation matrix unchanged.
    // Otherwise, it will invert the current transformation matrix.
    transform.invert = function () {
        const inv = [];
        const m = transform.values;

        inv[ 0] =  m[ 5]*m[10]*m[15] - m[ 5]*m[11]*m[14] -
                   m[ 9]*m[ 6]*m[15] + m[ 9]*m[ 7]*m[14] +
                   m[13]*m[ 6]*m[11] - m[13]*m[ 7]*m[10];

        inv[ 4] = -m[ 4]*m[10]*m[15] + m[ 4]*m[11]*m[14] +
                   m[ 8]*m[ 6]*m[15] - m[ 8]*m[ 7]*m[14] -
                   m[12]*m[ 6]*m[11] + m[12]*m[ 7]*m[10];

        inv[ 8] =  m[ 4]*m[ 9]*m[15] - m[ 4]*m[11]*m[13] -
                   m[ 8]*m[ 5]*m[15] + m[ 8]*m[ 7]*m[13] +
                   m[12]*m[ 5]*m[11] - m[12]*m[ 7]*m[ 9];

        inv[12] = -m[ 4]*m[ 9]*m[14] + m[ 4]*m[10]*m[13] +
                   m[ 8]*m[ 5]*m[14] - m[ 8]*m[ 6]*m[13] -
                   m[12]*m[ 5]*m[10] + m[12]*m[ 6]*m[ 9];

        const det = m[0] * inv[0] + m[1] * inv[ 4] +
                    m[2] * inv[8] + m[3] * inv[12];

        if (det === 0) {
            console.error("Failed to invert non-invertible matrix :(");
        } else {
            inv[ 0] = inv[ 0] / det;
            inv[ 4] = inv[ 4] / det;
            inv[ 8] = inv[ 8] / det;
            inv[12] = inv[12] / det;

            inv[ 1] = (-m[ 1]*m[10]*m[15] + m[ 1]*m[11]*m[14] +
                        m[ 9]*m[ 2]*m[15] - m[ 9]*m[ 3]*m[14] -
                        m[13]*m[ 2]*m[11] + m[13]*m[ 3]*m[10]) / det;

            inv[ 5] = ( m[ 0]*m[10]*m[15] - m[ 0]*m[11]*m[14] -
                        m[ 8]*m[ 2]*m[15] + m[ 8]*m[ 3]*m[14] +
                        m[12]*m[ 2]*m[11] - m[12]*m[ 3]*m[10]) / det;

            inv[ 9] = (-m[ 0]*m[ 9]*m[15] + m[ 0]*m[11]*m[13] +
                        m[ 8]*m[ 1]*m[15] - m[ 8]*m[ 3]*m[13] -
                        m[12]*m[ 1]*m[11] + m[12]*m[ 3]*m[ 9]) / det;

            inv[13] = ( m[ 0]*m[ 9]*m[14] - m[ 0]*m[10]*m[13] -
                        m[ 8]*m[ 1]*m[14] + m[ 8]*m[ 2]*m[13] +
                        m[12]*m[ 1]*m[10] - m[12]*m[ 2]*m[ 9]) / det;

            inv[ 2] = ( m[ 1]*m[ 6]*m[15] - m[ 1]*m[ 7]*m[14] -
                        m[ 5]*m[ 2]*m[15] + m[ 5]*m[ 3]*m[14] +
                        m[13]*m[ 2]*m[ 7] - m[13]*m[ 3]*m[ 6]) / det;

            inv[ 6] = (-m[ 0]*m[ 6]*m[15] + m[ 0]*m[ 7]*m[14] +
                        m[ 4]*m[ 2]*m[15] - m[ 4]*m[ 3]*m[14] -
                        m[12]*m[ 2]*m[ 7] + m[12]*m[ 3]*m[ 6]) / det;

            inv[10] = ( m[ 0]*m[ 5]*m[15] - m[ 0]*m[ 7]*m[13] -
                        m[ 4]*m[ 1]*m[15] + m[ 4]*m[ 3]*m[13] +
                        m[12]*m[ 1]*m[ 7] - m[12]*m[ 3]*m[ 5]) / det;

            inv[14] = (-m[ 0]*m[ 5]*m[14] + m[ 0]*m[ 6]*m[13] +
                        m[ 4]*m[ 1]*m[14] - m[ 4]*m[ 2]*m[13] -
                        m[12]*m[ 1]*m[ 6] + m[12]*m[ 2]*m[ 5]) / det;

            inv[ 3] = (-m[ 1]*m[ 6]*m[11] + m[ 1]*m[ 7]*m[10] +
                        m[ 5]*m[ 2]*m[11] - m[ 5]*m[ 3]*m[10] -
                        m[ 9]*m[ 2]*m[ 7] + m[ 9]*m[ 3]*m[ 6]) / det;

            inv[ 7] = ( m[ 0]*m[ 6]*m[11] - m[ 0]*m[ 7]*m[10] -
                        m[ 4]*m[ 2]*m[11] + m[ 4]*m[ 3]*m[10] +
                        m[ 8]*m[ 2]*m[ 7] - m[ 8]*m[ 3]*m[ 6]) / det;

            inv[11] = (-m[ 0]*m[ 5]*m[11] + m[ 0]*m[ 7]*m[ 9] +
                        m[ 4]*m[ 1]*m[11] - m[ 4]*m[ 3]*m[ 9] -
                        m[ 8]*m[ 1]*m[ 7] + m[ 8]*m[ 3]*m[ 5]) / det;

            inv[15] = ( m[ 0]*m[ 5]*m[10] - m[ 0]*m[ 6]*m[ 9] -
                        m[ 4]*m[ 1]*m[10] + m[ 4]*m[ 2]*m[ 9] +
                        m[ 8]*m[ 1]*m[ 6] - m[ 8]*m[ 2]*m[ 5]) / det;

            transform.values = inv.slice();
        }
    };
    
    transform.applyToVertex = function (v) {
        const m = transform.values;
        const w = m[12]*v[0] + m[13]*v[1] + m[14]*v[2] + m[15];

        return [ (m[0]*v[0] + m[1]*v[1] + m[ 2]*v[2] + m[ 3]) / w,
                 (m[4]*v[0] + m[5]*v[1] + m[ 6]*v[2] + m[ 7]) / w,
                 (m[8]*v[0] + m[9]*v[1] + m[10]*v[2] + m[11]) / w ];
    };
    
    return transform;
};
