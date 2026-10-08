use std::collections::HashMap;
use std::fs::File;
use std::path::Path;
use crate::domain::{MatchResult, RelocationScope};

pub struct Reporter;

impl Reporter {
    pub fn write_csv(path: &Path, results: &[MatchResult]) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let file = File::create(path)?;
        let mut wtr = csv::WriterBuilder::new().from_writer(file);

        // Header
        wtr.write_record(&[
            "similarity_score",
            "relocation_scope",
            "is_generic_activity",
            "inactive_canonical",
            "inactive_raw_name",
            "inactive_owner",
            "inactive_status",
            "inactive_kec",
            "inactive_desa",
            "inactive_sls",
            "active_canonical",
            "active_raw_name",
            "active_owner",
            "active_status",
            "active_kec",
            "active_desa",
            "active_sls",
            "business_sim",
            "owner_sim",
            "owner_matched",
            "explanation",
            "inactive_record_id",
            "active_record_id",
            "inactive_assignment_id",
            "active_assignment_id",
        ])?;

        for r in results {
            wtr.write_record(&[
                format!("{:.4}", r.similarity_score),
                r.relocation_scope.to_string(),
                r.is_generic_business.to_string(),
                r.inactive_canonical.clone(),
                r.inactive_raw_name.clone(),
                r.inactive_owner.clone(),
                r.inactive_status_lbl.clone(),
                r.inactive_kec.clone(),
                r.inactive_desa.clone(),
                r.inactive_sls_name.clone(),
                r.active_canonical.clone(),
                r.active_raw_name.clone(),
                r.active_owner.clone(),
                r.active_status_lbl.clone(),
                r.active_kec.clone(),
                r.active_desa.clone(),
                r.active_sls_name.clone(),
                format!("{:.4}", r.business_similarity),
                format!("{:.4}", r.owner_similarity),
                r.owner_matched.to_string(),
                r.explanation.clone(),
                r.inactive_record_id.clone(),
                r.active_record_id.clone(),
                r.inactive_assignment_id.clone(),
                r.active_assignment_id.clone(),
            ])?;
        }

        wtr.flush()?;
        Ok(())
    }

    pub fn print_summary(
        results: &[MatchResult],
        total_inactive: usize,
        total_active: usize,
        elapsed_secs: f64,
    ) {
        println!("\n{}", "=".repeat(85));
        println!("📊 HASIL CROSS-SLS SIMILARITY MATCHING (DENGAN GATING PEMILIK & FORMAT KANONIKAL)");
        println!("{}", "=".repeat(85));
        println!("  • Total Unit Inactive Diperiksa (Tutup/Tidak Ditemukan/Ganda) : {:>7}", total_inactive);
        println!("  • Total Unit Active Terindeks (Ditemukan/Baru)                : {:>7}", total_active);
        println!("  • Potensi Relokasi Valid (Lolos Verifikasi Pemilik)           : {:>7}", results.len());
        println!("  • Waktu Pemrosesan                                            : {:>7.2} detik", elapsed_secs);
        println!("{}", "-".repeat(85));

        // Group by Status Pair
        let mut pair_counts: HashMap<(&str, &str), usize> = HashMap::new();
        let mut scope_counts: HashMap<RelocationScope, usize> = HashMap::new();

        for r in results {
            *pair_counts.entry((&r.inactive_status_lbl, &r.active_status_lbl)).or_default() += 1;
            *scope_counts.entry(r.relocation_scope).or_default() += 1;
        }

        println!("🔍 Distribusi Berdasarkan Transisi Status:");
        let mut pairs_vec: Vec<_> = pair_counts.into_iter().collect();
        pairs_vec.sort_unstable_by(|a, b| b.1.cmp(&a.1));

        for ((in_stat, act_stat), count) in pairs_vec {
            let pct = (count as f64 / results.len() as f64) * 100.0;
            println!("   [{:>18}] ➜ [{:>14}] : {:>5} unit ({:>5.1}%)", in_stat, act_stat, count, pct);
        }

        println!("\n📍 Distribusi Berdasarkan Jangkauan Wilayah Relokasi:");
        for scope in [RelocationScope::SameDesa, RelocationScope::SameKecamatan, RelocationScope::CrossKecamatan] {
            let count = scope_counts.get(&scope).copied().unwrap_or(0);
            let pct = if !results.is_empty() { (count as f64 / results.len() as f64) * 100.0 } else { 0.0 };
            println!("   • {:<28} : {:>5} unit ({:>5.1}%)", scope.to_string(), count, pct);
        }

        println!("{}", "=".repeat(85));

        // Sample Top 5 Matches
        println!("\n📋 5 Contoh Teratas Relokasi Antar-SLS (Telah Tervalidasi Pemiliknya):");
        for (i, r) in results.iter().take(5).enumerate() {
            println!(
                "  {}. [{:.1}% | {}]\n     ❌ Asal   : \"{}\" [{}] ({}) - SLS: {}, Desa: {}\n     ✅ Temuan : \"{}\" [{}] ({}) - SLS: {}, Desa: {}\n     ℹ️  Ket    : {}",
                i + 1,
                r.similarity_score * 100.0,
                r.relocation_scope,
                r.inactive_raw_name,
                r.inactive_canonical,
                r.inactive_status_lbl,
                r.inactive_sls_name,
                r.inactive_desa,
                r.active_raw_name,
                r.active_canonical,
                r.active_status_lbl,
                r.active_sls_name,
                r.active_desa,
                r.explanation
            );
        }
        println!();
    }
}
