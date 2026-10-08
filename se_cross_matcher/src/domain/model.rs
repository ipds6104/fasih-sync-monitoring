use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BusinessRecord {
    pub id: String,
    pub assignment_id: String,
    pub no_usaha: i32,
    pub raw_name: String,
    pub base_name: String,
    pub owner_name: String,
    pub canonical_name: String,
    pub is_generic_business: bool,
    pub tokens: Vec<String>,
    pub keberadaan_value: String,
    pub keberadaan_label: String,
    pub is_prelist: Option<i32>,
    pub pengusaha: String,
    pub nik_pengusaha: String,
    pub alamat: String,
    pub kecamatan: String,
    pub desa: String,
    pub sls_name: String,
    pub sls_code: String,
}

impl BusinessRecord {
    #[inline]
    pub fn is_inactive_candidate(&self) -> bool {
        matches!(self.keberadaan_value.as_str(), "00" | "0" | "3" | "4")
    }

    #[inline]
    pub fn is_active_candidate(&self) -> bool {
        matches!(self.keberadaan_value.as_str(), "1" | "2")
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum RelocationScope {
    SameDesa,
    SameKecamatan,
    CrossKecamatan,
}

impl std::fmt::Display for RelocationScope {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::SameDesa => write!(f, "SE-DESA (Beda SLS)"),
            Self::SameKecamatan => write!(f, "SE-KECAMATAN (Beda Desa)"),
            Self::CrossKecamatan => write!(f, "LINTAS KECAMATAN"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchScore {
    pub total_score: f64,
    pub business_similarity: f64,
    pub owner_similarity: f64,
    pub owner_matched: bool,
    pub scope: RelocationScope,
    pub explanation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchResult {
    pub inactive_record_id: String,
    pub inactive_assignment_id: String,
    pub inactive_raw_name: String,
    pub inactive_canonical: String,
    pub inactive_owner: String,
    pub inactive_status_val: String,
    pub inactive_status_lbl: String,
    pub inactive_kec: String,
    pub inactive_desa: String,
    pub inactive_sls_name: String,
    pub inactive_sls_code: String,

    pub active_record_id: String,
    pub active_assignment_id: String,
    pub active_raw_name: String,
    pub active_canonical: String,
    pub active_owner: String,
    pub active_status_val: String,
    pub active_status_lbl: String,
    pub active_kec: String,
    pub active_desa: String,
    pub active_sls_name: String,
    pub active_sls_code: String,

    pub similarity_score: f64,
    pub business_similarity: f64,
    pub owner_similarity: f64,
    pub owner_matched: bool,
    pub is_generic_business: bool,
    pub relocation_scope: RelocationScope,
    pub explanation: String,
}
