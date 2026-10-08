use std::fs::File;
use std::path::Path;
use arrow::array::{Array, StringArray};
use parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder;

use crate::domain::{BusinessRecord, TextNormalizer};

pub trait DataReader: Send + Sync {
    fn read_records(&self, path: &Path) -> Result<Vec<BusinessRecord>, Box<dyn std::error::Error>>;
}

pub struct ParquetBusinessReader {
    normalizer: TextNormalizer,
}

impl Default for ParquetBusinessReader {
    fn default() -> Self {
        Self::new()
    }
}

impl ParquetBusinessReader {
    pub fn new() -> Self {
        Self {
            normalizer: TextNormalizer::new(),
        }
    }

    fn extract_str(col: &StringArray, row: usize) -> String {
        if col.is_null(row) {
            String::new()
        } else {
            col.value(row).trim().to_string()
        }
    }
}

impl DataReader for ParquetBusinessReader {
    fn read_records(&self, path: &Path) -> Result<Vec<BusinessRecord>, Box<dyn std::error::Error>> {
        let file = File::open(path)?;
        let builder = ParquetRecordBatchReaderBuilder::try_new(file)?;
        let schema = builder.schema();

        // Target columns to project
        let target_cols = [
            "id",
            "assignment_id",
            "no_usaha",
            "nama_usaha",
            "keberadaan_usaha_value",
            "keberadaan_usaha_label",
            "is_prelist2",
            "pengusaha_var_label",
            "nik_pengusaha",
            "alamat_usaha",
            "level_3_name",
            "level_4_name",
            "level_6_name",
            "level_6_full_code",
        ];

        // Find column indices in the parquet file
        let mut proj_indices = Vec::new();
        for &col_name in &target_cols {
            if let Ok(idx) = schema.index_of(col_name) {
                proj_indices.push(idx);
            }
        }

        // Apply projection pushdown to read ONLY needed columns
        let projection_mask = parquet::arrow::ProjectionMask::roots(
            builder.parquet_schema(),
            proj_indices.clone(),
        );

        let reader = builder
            .with_projection(projection_mask)
            .with_batch_size(8192)
            .build()?;

        let mut records = Vec::with_capacity(80_000);

        for batch_result in reader {
            let batch = batch_result?;
            let num_rows = batch.num_rows();

            // Resolve column references in the projected batch
            let get_col = |name: &str| -> Option<&StringArray> {
                let idx = batch.schema().index_of(name).ok()?;
                batch.column(idx).as_any().downcast_ref::<StringArray>()
            };

            let col_id = get_col("id");
            let col_asg_id = get_col("assignment_id");
            let col_no_usaha = get_col("no_usaha");
            let col_nama = get_col("nama_usaha");
            let col_keb_val = get_col("keberadaan_usaha_value");
            let col_keb_lbl = get_col("keberadaan_usaha_label");
            let col_prelist = get_col("is_prelist2");
            let col_pengusaha = get_col("pengusaha_var_label");
            let col_nik = get_col("nik_pengusaha");
            let col_alamat = get_col("alamat_usaha");
            let col_kec = get_col("level_3_name");
            let col_desa = get_col("level_4_name");
            let col_sls_name = get_col("level_6_name");
            let col_sls_code = get_col("level_6_full_code");

            for row in 0..num_rows {
                let nama_raw = col_nama.map(|c| Self::extract_str(c, row)).unwrap_or_default();
                if nama_raw.trim().len() < 2 {
                    continue;
                }

                let pengusaha = col_pengusaha.map(|c| Self::extract_str(c, row)).unwrap_or_default();
                let (base_name, owner_name, is_generic, canonical_name) =
                    self.normalizer.decompose_entity(&nama_raw, &pengusaha);

                let tokens = self.normalizer.extract_tokens(&canonical_name);

                let no_usaha = col_no_usaha
                    .map(|c| Self::extract_str(c, row))
                    .and_then(|s| s.parse::<i32>().ok())
                    .unwrap_or(1);

                let is_prelist = col_prelist
                    .map(|c| Self::extract_str(c, row))
                    .and_then(|s| s.parse::<i32>().ok());

                let id = col_id.map(|c| Self::extract_str(c, row)).unwrap_or_default();
                let assignment_id = col_asg_id.map(|c| Self::extract_str(c, row)).unwrap_or_default();
                let keberadaan_val = col_keb_val.map(|c| Self::extract_str(c, row)).unwrap_or_default();
                let keberadaan_lbl = col_keb_lbl.map(|c| Self::extract_str(c, row)).unwrap_or_default();
                let nik_pengusaha = col_nik.map(|c| Self::extract_str(c, row)).unwrap_or_default();
                let alamat = col_alamat.map(|c| Self::extract_str(c, row)).unwrap_or_default();
                let kecamatan = col_kec.map(|c| Self::extract_str(c, row)).unwrap_or_default();
                let desa = col_desa.map(|c| Self::extract_str(c, row)).unwrap_or_default();
                let sls_name = col_sls_name.map(|c| Self::extract_str(c, row)).unwrap_or_default();
                let sls_code = col_sls_code.map(|c| Self::extract_str(c, row)).unwrap_or_default();

                records.push(BusinessRecord {
                    id,
                    assignment_id,
                    no_usaha,
                    raw_name: nama_raw,
                    base_name,
                    owner_name,
                    canonical_name,
                    is_generic_business: is_generic,
                    tokens,
                    keberadaan_value: keberadaan_val,
                    keberadaan_label: keberadaan_lbl,
                    is_prelist,
                    pengusaha,
                    nik_pengusaha,
                    alamat,
                    kecamatan,
                    desa,
                    sls_name,
                    sls_code,
                });
            }
        }

        Ok(records)
    }
}
