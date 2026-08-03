use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use hkdf::Hkdf;
use hmac::{Hmac, Mac};
use sha2::Sha256;

// พารามิเตอร์ทุกตัวในไฟล์นี้ต้องตรงกับ `supabase/functions/_shared/device-crypto.ts` เป๊ะ
// การทดสอบท้ายไฟล์เทียบกับ fixture ที่สร้างจาก **ไฟล์ Deno ตัวจริง** ไม่ใช่จากสเปกที่จดไว้
// (ดู `scripts/gen-crypto-fixtures.mjs`)

const HKDF_INFO: &[u8] = b"sub-font-v1";
const SALT_LEN: usize = 16;
const IV_LEN: usize = 12;
const TAG_LEN: usize = 16;

/// ความยาว device key จริง — server สร้างด้วย `newDeviceKey()` = 32 bytes
pub const DEVICE_KEY_LEN: usize = 32;

#[derive(Debug, thiserror::Error)]
pub enum CryptoError {
    #[error("device key ต้องเป็น hex {} ตัว (= {} bytes)", DEVICE_KEY_LEN * 2, DEVICE_KEY_LEN)]
    BadKeyLength,
    #[error("device key ไม่ใช่ hex")]
    BadKeyHex,
    #[error("payload สั้นเกินกว่าจะมี salt+iv+tag ครบ")]
    BlobTooShort,
    #[error("ถอดรหัสไม่สำเร็จ — key ไม่ตรงกับที่ server ใช้ หรือข้อมูลเสียหาย")]
    Decrypt,
}

/// แปลง device key จาก hex 64 ตัวที่ server คืนมา → 32 bytes ดิบ
///
/// 🔴 **กับดักที่ debug ยากที่สุดของงานนี้**: `register_device` คืน `device_key` เป็น
/// **สตริง hex 64 ตัว** แต่ทั้ง HMAC และ HKDF ต้องการ **32 bytes ดิบ**
/// ถ้าเอาสตริง hex ไปใช้ตรง ๆ ทั้งคู่ยัง "ทำงานได้" — คำนวณออกมาได้ค่าหนึ่ง ไม่ error —
/// แค่ได้ผลผิด แล้วอาการที่เห็นคือ `401 bad_signature` ซึ่งชี้ไปทางอื่นหมด
///
/// ฟังก์ชันนี้จึงเป็นทางเดียวที่โค้ดส่วนอื่นควรได้ key มา
pub fn decode_device_key(key_hex: &str) -> Result<[u8; DEVICE_KEY_LEN], CryptoError> {
    if key_hex.len() != DEVICE_KEY_LEN * 2 {
        return Err(CryptoError::BadKeyLength);
    }
    let bytes = hex::decode(key_hex).map_err(|_| CryptoError::BadKeyHex)?;
    let mut out = [0u8; DEVICE_KEY_LEN];
    out.copy_from_slice(&bytes);
    Ok(out)
}

/// `HMAC-SHA256(key, payload)` → hex ตัวพิมพ์เล็ก
///
/// ผู้เรียกต้องส่ง payload เป็น `"<timestamp>.<rawBody>"` โดย `rawBody` คือสตริงดิบ
/// **ตัวเดียวกับที่ส่งขึ้น body จริง** — serialize ใหม่แล้วลายเซ็นจะไม่ตรง (ดู `api.rs`)
pub fn hmac_hex(key: &[u8], payload: &str) -> String {
    let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(key)
        .expect("HMAC รับ key ความยาวเท่าไรก็ได้ — เข้ามาที่นี่ไม่ได้");
    mac.update(payload.as_bytes());
    hex::encode(mac.finalize().into_bytes())
}

/// ถอด payload ที่ `encryptForDevice` ส่งมา: `salt(16) ‖ iv(12) ‖ ciphertext ‖ tag(16)`
///
/// คีย์ AES มาจาก `HKDF-SHA256(ikm = device_key, salt = salt ในตัว payload, info = "sub-font-v1")`
/// ไม่ได้ใช้ device key ตรง ๆ — และ **ไม่มี AAD**
///
/// รูปแบบนี้คือ **รูปแบบเดียวกับที่เก็บลง vault** (ดู `vault.rs`) จึงไม่ต้องเข้ารหัสซ้ำ
pub fn open_device_blob(device_key: &[u8], blob: &[u8]) -> Result<Vec<u8>, CryptoError> {
    if blob.len() < SALT_LEN + IV_LEN + TAG_LEN {
        return Err(CryptoError::BlobTooShort);
    }
    let (salt, rest) = blob.split_at(SALT_LEN);
    let (iv, ct) = rest.split_at(IV_LEN);

    let hk = Hkdf::<Sha256>::new(Some(salt), device_key);
    let mut aes_key = [0u8; 32];
    hk.expand(HKDF_INFO, &mut aes_key)
        .expect("32 bytes อยู่ในพิสัยของ HKDF-SHA256");

    let cipher = Aes256Gcm::new_from_slice(&aes_key).expect("คีย์ 32 bytes เสมอ");
    cipher
        .decrypt(Nonce::from_slice(iv), ct)
        .map_err(|_| CryptoError::Decrypt)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;

    #[derive(Deserialize)]
    struct Fixtures {
        key_hex: String,
        signatures: Vec<SigCase>,
        encrypted: Vec<EncCase>,
    }
    #[derive(Deserialize)]
    struct SigCase {
        ts: String,
        raw_body: String,
        signature: String,
    }
    #[derive(Deserialize)]
    struct EncCase {
        plaintext: String,
        blob: String,
    }

    fn fixtures() -> Fixtures {
        serde_json::from_str(include_str!("../tests/fixtures/device-crypto.json"))
            .expect("fixture อ่านไม่ได้ — รัน `node scripts/gen-crypto-fixtures.mjs` ใหม่")
    }

    #[test]
    fn signatures_match_server() {
        let f = fixtures();
        let key = decode_device_key(&f.key_hex).unwrap();
        for c in &f.signatures {
            assert_eq!(
                hmac_hex(&key, &format!("{}.{}", c.ts, c.raw_body)),
                c.signature,
                "ลายเซ็นไม่ตรงกับ server สำหรับ body {:?}",
                c.raw_body
            );
        }
    }

    #[test]
    fn decrypts_server_payloads() {
        let f = fixtures();
        let key = decode_device_key(&f.key_hex).unwrap();
        for c in &f.encrypted {
            let blob = hex::decode(&c.blob).unwrap();
            assert_eq!(hex::encode(open_device_blob(&key, &blob).unwrap()), c.plaintext);
        }
    }

    /// กับดัก hex→bytes: ถ้าเผลอใช้สตริง hex เป็นคีย์ ต้อง **ไม่** ผ่าน
    /// ไม่งั้นการทดสอบข้างบนจะผ่านได้ทั้งที่ของจริงพัง
    #[test]
    fn hex_key_used_directly_is_wrong() {
        let f = fixtures();
        let c = &f.signatures[0];
        assert_ne!(
            hmac_hex(f.key_hex.as_bytes(), &format!("{}.{}", c.ts, c.raw_body)),
            c.signature
        );
    }

    #[test]
    fn wrong_key_fails_to_decrypt() {
        let f = fixtures();
        let blob = hex::decode(&f.encrypted[0].blob).unwrap();
        let mut key = decode_device_key(&f.key_hex).unwrap();
        key[0] ^= 0xff;
        assert!(matches!(
            open_device_blob(&key, &blob),
            Err(CryptoError::Decrypt)
        ));
    }

    /// blob ที่ถูกตัดปลาย (เน็ตหลุดกลางทาง) ต้องคืน error ไม่ใช่ panic
    #[test]
    fn truncated_blob_errors() {
        let f = fixtures();
        let key = decode_device_key(&f.key_hex).unwrap();
        let blob = hex::decode(&f.encrypted[2].blob).unwrap();
        assert!(open_device_blob(&key, &blob[..20]).is_err());
        assert!(open_device_blob(&key, &blob[..blob.len() - 1]).is_err());
    }

    #[test]
    fn rejects_malformed_keys() {
        assert!(matches!(decode_device_key("abcd"), Err(CryptoError::BadKeyLength)));
        assert!(matches!(
            decode_device_key(&"z".repeat(64)),
            Err(CryptoError::BadKeyHex)
        ));
    }
}
