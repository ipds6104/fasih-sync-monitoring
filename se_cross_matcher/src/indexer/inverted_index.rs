use std::collections::HashMap;
use crate::domain::BusinessRecord;

pub trait IndexStrategy: Send + Sync {
    fn build(&mut self, records: &[BusinessRecord]);
    fn find_candidates(&self, query: &BusinessRecord) -> Vec<usize>;
}

/// Inverted Index with Owner-First Indexing and Frequency Capping
pub struct InvertedTokenIndex {
    /// Maps normalized token -> list of active record indices
    postings: HashMap<String, Vec<usize>>,
    /// Maps NIK -> list of active record indices
    nik_postings: HashMap<String, Vec<usize>>,
    /// Maps normalized owner name -> list of active record indices
    owner_postings: HashMap<String, Vec<usize>>,
    /// Max postings threshold (tokens appearing in more than this count are ignored as too generic)
    max_postings_limit: usize,
}

impl InvertedTokenIndex {
    pub fn new() -> Self {
        Self {
            postings: HashMap::new(),
            nik_postings: HashMap::new(),
            owner_postings: HashMap::new(),
            max_postings_limit: 800,
        }
    }
}

impl Default for InvertedTokenIndex {
    fn default() -> Self {
        Self::new()
    }
}

impl IndexStrategy for InvertedTokenIndex {
    fn build(&mut self, records: &[BusinessRecord]) {
        self.postings.clear();
        self.nik_postings.clear();
        self.owner_postings.clear();

        for (idx, rec) in records.iter().enumerate() {
            // 1. Index tokens from base_name and canonical_name
            for token in &rec.tokens {
                self.postings.entry(token.clone()).or_default().push(idx);
            }

            // 2. Index NIK if available (exact 16 digits)
            let nik = rec.nik_pengusaha.trim();
            if nik.len() >= 10 {
                self.nik_postings.entry(nik.to_string()).or_default().push(idx);
            }

            // 3. Index full owner name and owner tokens
            let owner_clean = rec.owner_name.trim();
            if !owner_clean.is_empty() {
                self.owner_postings.entry(owner_clean.to_string()).or_default().push(idx);
                for w in owner_clean.split_whitespace() {
                    if w.len() >= 3 {
                        self.owner_postings.entry(w.to_string()).or_default().push(idx);
                    }
                }
            }
        }
    }

    fn find_candidates(&self, query: &BusinessRecord) -> Vec<usize> {
        let mut candidate_scores: HashMap<usize, u32> = HashMap::new();

        // 1. Exact NIK Match (Highest priority)
        let query_nik = query.nik_pengusaha.trim();
        if query_nik.len() >= 10 {
            if let Some(hits) = self.nik_postings.get(query_nik) {
                for &idx in hits {
                    *candidate_scores.entry(idx).or_default() += 200;
                }
            }
        }

        // 2. Owner Match (Critical for both generic and non-generic)
        let owner_clean = query.owner_name.trim();
        if !owner_clean.is_empty() {
            // Full owner string match
            if let Some(hits) = self.owner_postings.get(owner_clean) {
                for &idx in hits {
                    *candidate_scores.entry(idx).or_default() += 100;
                }
            }
            // Sub-word owner token match
            for w in owner_clean.split_whitespace() {
                if w.len() >= 3 {
                    if let Some(hits) = self.owner_postings.get(w) {
                        if hits.len() <= self.max_postings_limit {
                            for &idx in hits {
                                *candidate_scores.entry(idx).or_default() += 30;
                            }
                        }
                    }
                }
            }
        }

        // 3. Name Token Match
        // NOTE: If business is generic, do NOT query generic tokens to prevent false positives!
        if !query.is_generic_business {
            for token in &query.tokens {
                if let Some(hits) = self.postings.get(token) {
                    if hits.len() <= self.max_postings_limit {
                        for &idx in hits {
                            *candidate_scores.entry(idx).or_default() += 10;
                        }
                    }
                }
            }
        }

        let mut candidates: Vec<(usize, u32)> = candidate_scores.into_iter().collect();
        candidates.sort_unstable_by(|a, b| b.1.cmp(&a.1));

        candidates.into_iter().take(50).map(|(idx, _)| idx).collect()
    }
}
