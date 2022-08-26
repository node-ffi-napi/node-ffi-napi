#[no_mangle]
pub extern "C" fn fibo(idx: i32) -> i32 {
    if idx < 2 {
        idx
    } else {
        fibo(idx - 1) + fibo(idx - 2)
    }
}

#[cfg(test)]
mod test {
    use crate::fibo;

    #[test]
    fn fibo_of_19th_idx() {
        assert_eq!(fibo(19), 4181)
    }
}
