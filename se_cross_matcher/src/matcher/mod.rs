use rayon::prelude::*;
use crate::domain::{BusinessRecord, MatchResult};
use crate::indexer::IndexStrategy;
use crate::scorer::SimilarityScorer;

pub struct CrossSlsMatcher<I, S>
where
    I: IndexStrategy,
    S: SimilarityScorer,
{
    index: I,
    scorer: S,
}

impl<I, S> CrossSlsMatcher<I, S>
where
    I: IndexStrategy,
    S: SimilarityScorer,
{
    pub fn new(index: I, scorer: S) -> Self {
        Self { index, scorer }
    }

    /// Run multi-threaded cross-SLS similarity matching with Owner Gating
    pub fn find_matches(
        &mut self,
        inactive_records: &[BusinessRecord],
        active_records: &[BusinessRecord],
    ) -> Vec<MatchResult> {
        // Step 1: Build Inverted Index over the Active Pool: O(M)
        self.index.build(active_records);

        // Step 2: Parallel Candidate Retrieval & Gated Scoring: O(N * K) across Rayon threads
        let mut results: Vec<MatchResult> = inactive_records
            .par_iter()
            .filter_map(|inactive| {
                let candidate_indices = self.index.find_candidates(inactive);
                if candidate_indices.is_empty() {
                    return None;
                }

                let mut best_match: Option<(usize, crate::domain::MatchScore)> = None;

                for &act_idx in &candidate_indices {
                    let active = &active_records[act_idx];
                    if let Some(score) = self.scorer.score(inactive, active) {
                        if let Some((_, ref current_best)) = best_match {
                            if score.total_score > current_best.total_score {
                                best_match = Some((act_idx, score));
                            }
                        } else {
                            best_match = Some((act_idx, score));
                        }
                    }
                }

                best_match.map(|(act_idx, score)| {
                    let active = &active_records[act_idx];
                    MatchResult {
                        inactive_record_id: inactive.id.clone(),
                        inactive_assignment_id: inactive.assignment_id.clone(),
                        inactive_raw_name: inactive.raw_name.clone(),
                        inactive_canonical: inactive.canonical_name.clone(),
                        inactive_owner: inactive.owner_name.clone(),
                        inactive_status_val: inactive.keberadaan_value.clone(),
                        inactive_status_lbl: inactive.keberadaan_label.clone(),
                        inactive_kec: inactive.kecamatan.clone(),
                        inactive_desa: inactive.desa.clone(),
                        inactive_sls_name: inactive.sls_name.clone(),
                        inactive_sls_code: inactive.sls_code.clone(),

                        active_record_id: active.id.clone(),
                        active_assignment_id: active.assignment_id.clone(),
                        active_raw_name: active.raw_name.clone(),
                        active_canonical: active.canonical_name.clone(),
                        active_owner: active.owner_name.clone(),
                        active_status_val: active.keberadaan_value.clone(),
                        active_status_lbl: active.keberadaan_label.clone(),
                        active_kec: active.kecamatan.clone(),
                        active_desa: active.desa.clone(),
                        active_sls_name: active.sls_name.clone(),
                        active_sls_code: active.sls_code.clone(),

                        similarity_score: score.total_score,
                        business_similarity: score.business_similarity,
                        owner_similarity: score.owner_similarity,
                        owner_matched: score.owner_matched,
                        is_generic_business: inactive.is_generic_business || active.is_generic_business,
                        relocation_scope: score.scope,
                        explanation: score.explanation,
                    }
                })
            })
            .collect();

        // Sort by similarity score descending
        results.sort_unstable_by(|a, b| {
            b.similarity_score
                .partial_cmp(&a.similarity_score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        results
    }
}
