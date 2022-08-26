# Call Rust from node

Simple example to get the 40th fibonacci number

## Run

```bash
cargo build --release
```

```bash
# make sure you have ffi-napi installed
$ node index.js
{ output: 102334155 }
```

## Configs

To be able to call your lib from other languages including node you need add to this to your `Cargo.toml`

```toml
# This tells rust that we want to expose the lib in C like interface
[lib]
name = "fibo"
crate-type = ["cdylib"]
```

Also, you need to export your function using `pub extern`
and don't forget to use `#[no_mangle]` so the compiler doesn't change the function name

```rs
#[no_mangle]
pub extern "C" fn fibo(idx: i32) -> i32 {
    if idx < 2 {
        idx
    } else {
        fibo(idx - 1) + fibo(idx - 2)
    }
}
```
