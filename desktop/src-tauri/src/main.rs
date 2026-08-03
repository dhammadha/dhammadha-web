// ห้ามให้ console โผล่บน Windows ตอน release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    typedee_lib::run()
}
