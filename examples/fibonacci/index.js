const ffi = require("ffi-napi");

const lib = ffi.Library("../target/release/fibo", {
    fibo: ["int", ["int"]]
});


let output  = lib.fibo(40);
console.log({ output })
