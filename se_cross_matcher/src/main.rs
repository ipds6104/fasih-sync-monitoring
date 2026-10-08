use std::path::PathBuf;
use std::time::Instant;
use clap::Parser;

mod domain;
mod indexer;
mod matcher;
mod reader;
mod reporter;
mod scorer;

use domain::BusinessRecord;
use indexer::InvertedTokenIndex;
use matcher::CrossSlsMatcher;
use reader::{DataReader, ParquetBusinessReader};
use reporter::Reporter;
use scorer::CompositeScorer;

#[derive(Parser, Debug)]
#[command(
    name = "se_cross_matcher",
    author = "BPS Mempawah & Antigravity",
    version = "0.1.0",
    about = "High-performance Cross-SLS Business Similarity Matcher for SE2026"
)]
struct Args {
    /// Path to se2026_nested.parquet
    #[arg(short, long, default_value = "export_parquet/se2026_nested.parquet")]
    input: PathBuf,

    /// Output CSV file path
    #[arg(short, long, default_value = "results/cross_sls_matches.csv")]
    output: PathBuf,

    /// Minimum similarity score threshold (0.0 to 1.0)
    #[arg(short, long, default_value_t = 0.75)]
    threshold: f64,

    /// Filter to only matches within the same Desa
    #[arg(long, default_value_t = false)]
    only_same_desa: bool,

    /// Filter to only matches within the same Kecamatan
    #[arg(long, default_value_t = false)]
    only_same_kec: bool,

    /// Exclude UTP & generic agricultural businesses (focussing purely on commercial/MSME scraping targets)
    #[arg(long, default_value_t = false)]
    exclude_utp: bool,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();

    println!("=================================================================================");
    println!("🚀 SENSUS EKONOMI 2026: CROSS-SLS BUSINESS SIMILARITY MATCHER (RUST)");
    println!("   Input File : {:?}", args.input);
    println!("   Output CSV : {:?}", args.output);
    println!("   Threshold  : {:.2}", args.threshold);
    println!("=================================================================================\n");

    if !args.input.exists() {
        eprintln!("❌ File input tidak ditemukan: {:?}", args.input);
        std::process::exit(1);
    }

    let t_start = Instant::now();

    // 1. Ingest Data via Projected Parquet Reader
    println!("⏳ [1/4] Membaca data Parquet dengan projected column pushdown...");
    let reader = ParquetBusinessReader::new();
    let records = reader.read_records(&args.input)?;
    println!(
        "   ✓ Berhasil membaca {} baris unit usaha dalam {:.2}s",
        records.len(),
        t_start.elapsed().as_secs_f64()
    );

    // 2. Partition into Inactive Candidate Pool vs Active Target Pool
    println!("⚙️  [2/4] Mempartisi data ke dalam Pool Inactive vs Active...");
    if args.exclude_utp {
        println!("   🛡️  Filter Aktif: Mengabaikan UTP & Pertanian Generik (Fokus Komersial/UMK/UB)");
    }
    let mut inactive_pool: Vec<BusinessRecord> = Vec::new();
    let mut active_pool: Vec<BusinessRecord> = Vec::new();

    for rec in records {
        if args.exclude_utp {
            let lower = rec.raw_name.to_lowercase();
            if rec.is_generic_business
                || lower.starts_with("utp ")
                || lower.starts_with("upt ")
                || lower.starts_with("pertanian ")
                || lower.starts_with("perkebunan ")
                || lower.starts_with("tanaman ")
                || lower.starts_with("hortikultura ")
                || lower.starts_with("holtikultura ")
                || lower.starts_with("peternakan ")
                || lower.starts_with("perikanan ")
            {
                continue;
            }
        }
        if rec.is_inactive_candidate() {
            inactive_pool.push(rec);
        } else if rec.is_active_candidate() {
            active_pool.push(rec);
        }
    }

    println!(
        "   • Pool Inactive (Tutup / Tidak Ditemukan / Ganda) : {:>6} unit",
        inactive_pool.len()
    );
    println!(
        "   • Pool Active   (Ditemukan / Baru)               : {:>6} unit",
        active_pool.len()
    );

    // 3. Build Inverted Index and Execute Multi-threaded Parallel Matching
    println!("⚡ [3/4] Membangun Inverted Index & mengeksekusi pencocokan paralel (Rayon)...");
    let t_match = Instant::now();
    let index = InvertedTokenIndex::new();
    let scorer = CompositeScorer::new(args.threshold);
    let mut matcher = CrossSlsMatcher::new(index, scorer);

    let mut matches = matcher.find_matches(&inactive_pool, &active_pool);

    // Optional post-filters
    if args.only_same_desa {
        matches.retain(|m| m.relocation_scope == domain::RelocationScope::SameDesa);
    } else if args.only_same_kec {
        matches.retain(|m| {
            matches!(
                m.relocation_scope,
                domain::RelocationScope::SameDesa | domain::RelocationScope::SameKecamatan
            )
        });
    }

    let match_duration = t_match.elapsed().as_secs_f64();
    println!("   ✓ Pencocokan selesai dalam {:.2}s!", match_duration);

    // 4. Export to CSV and Report Statistics
    println!("💾 [4/4] Menyimpan hasil ke {:?}...", args.output);
    Reporter::write_csv(&args.output, &matches)?;
    println!("   ✓ Berkas CSV berhasil ditulis!");

    Reporter::print_summary(
        &matches,
        inactive_pool.len(),
        active_pool.len(),
        t_start.elapsed().as_secs_f64(),
    );

    Ok(())
}
