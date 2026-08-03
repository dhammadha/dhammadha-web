use serde::Serialize;

/// หน้าจอที่แอปควรแสดง — **Rust เป็นคนตัดสิน ไม่ใช่ router ฝั่ง JS**
///
/// เหตุผล: การตัดสินใจว่าผู้ใช้เห็นอะไรผูกกับ entitlement/สิทธิ์เครื่อง ซึ่งเป็นข้อมูล
/// ที่ JS ไม่ควรมีครบพอจะตัดสินเองได้ · ถ้าให้ JS route เอง การเปลี่ยนหน้าจะกลายเป็น
/// สิ่งที่แก้ได้จาก devtools
// S1 ยังไม่มีเส้นทางไปหน้าที่เหลือ — ตัวที่ยังไม่ถูกใช้จะโดน dead_code เตือน
// เอาออกได้ตอน S3 เมื่อลำดับ launch ตัวจริงเข้ามาตัดสินหน้าจอครบทุกกรณี
#[allow(dead_code)]
#[derive(Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Screen {
    Loading,
    Login,
    Library,
    NoSubscription,
    Expired,
}

/// สิ่งเดียวที่ไหลจาก Rust ไป JS
///
/// ⚠️ ห้ามเพิ่มฟิลด์ที่เป็น access/refresh token, `device_key`, หรือ path ของไฟล์ฟอนต์
/// ที่ถอดรหัสแล้ว — เหตุผลอยู่ในหัวไฟล์ `commands.rs`
#[derive(Serialize, Clone)]
pub struct ViewModel {
    pub screen: Screen,
    pub version: String,
    pub email: Option<String>,
}

impl ViewModel {
    pub fn initial() -> Self {
        Self {
            screen: Screen::Loading,
            version: env!("CARGO_PKG_VERSION").to_string(),
            email: None,
        }
    }
}
