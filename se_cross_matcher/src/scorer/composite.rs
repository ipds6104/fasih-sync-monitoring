use std::collections::HashSet;
use strsim::jaro_winkler;
use crate::domain::{BusinessRecord, MatchScore, RelocationScope};

pub trait SimilarityScorer: Send + Sync {
    fn score(&self, inactive: &BusinessRecord, active: &BusinessRecord) -> Option<MatchScore>;
}

pub struct CompositeScorer {
    min_threshold: f64,
}

impl CompositeScorer {
    pub fn new(min_threshold: f64) -> Self {
        Self { min_threshold }
    }

    fn calculate_token_jaccard(&self, a_tokens: &[String], b_tokens: &[String]) -> f64 {
        if a_tokens.is_empty() || b_tokens.is_empty() {
            return 0.0;
        }

        let set_a: HashSet<&str> = a_tokens.iter().map(|s| s.as_str()).collect();
        let set_b: HashSet<&str> = b_tokens.iter().map(|s| s.as_str()).collect();

        let intersection_count = set_a.intersection(&set_b).count();
        let union_count = set_a.union(&set_b).count();

        if union_count == 0 {
            0.0
        } else {
            intersection_count as f64 / union_count as f64
        }
    }
}

impl SimilarityScorer for CompositeScorer {
    fn score(&self, inactive: &BusinessRecord, active: &BusinessRecord) -> Option<MatchScore> {
        // Condition 0: Must be across different SLS!
        if !inactive.sls_code.is_empty() && !active.sls_code.is_empty() && inactive.sls_code == active.sls_code {
            return None;
        }

        // 1. Check NIK Match (Definitive Proof)
        let in_nik = inactive.nik_pengusaha.trim();
        let act_nik = active.nik_pengusaha.trim();
        let nik_matched = !in_nik.is_empty() && in_nik.len() >= 10 && in_nik == act_nik;

        // 2. Owner Similarity & Hard Contradiction Veto
        let has_in_owner = !inactive.owner_name.is_empty();
        let has_act_owner = !active.owner_name.is_empty();

        let owner_sim = if nik_matched {
            1.0
        } else if has_in_owner && has_act_owner {
            if inactive.owner_name == active.owner_name {
                1.0
            } else {
                jaro_winkler(&inactive.owner_name, &active.owner_name)
            }
        } else {
            0.5 // Unknown / unstated owner
        };

        // RULE 1: OWNER CONTRADICTION VETO
        // If both records specify an owner, and they disagree (e.g. Suki vs Heri), REJECT!
        if has_in_owner && has_act_owner && !nik_matched && owner_sim < 0.72 {
            return None;
        }

        // RULE 2: GENERIC BUSINESS REQUIREMENT
        // For generic agricultural / informal activities (e.g. UTP perkebunan, tanaman pangan, warung kopi),
        // we CANNOT match without a verified owner match!
        let is_either_generic = inactive.is_generic_business || active.is_generic_business;
        if is_either_generic {
            if (!has_in_owner || !has_act_owner) && !nik_matched {
                return None; // Cannot guess among thousands of generic agricultural units
            }
            if !nik_matched && owner_sim < 0.80 {
                return None; // Owner must be strongly matching
            }
        }

        // 3. Business Name Similarity
        let bus_jw = if inactive.base_name == active.base_name && !inactive.base_name.is_empty() {
            1.0
        } else {
            jaro_winkler(&inactive.base_name, &active.base_name)
        };
        let bus_jaccard = self.calculate_token_jaccard(&inactive.tokens, &active.tokens);
        let bus_sim = (bus_jw * 0.60) + (bus_jaccard * 0.40);

        // 4. Geographic scope
        let scope = if !inactive.desa.is_empty() && inactive.desa.eq_ignore_ascii_case(&active.desa) {
            RelocationScope::SameDesa
        } else if !inactive.kecamatan.is_empty() && inactive.kecamatan.eq_ignore_ascii_case(&active.kecamatan) {
            RelocationScope::SameKecamatan
        } else {
            RelocationScope::CrossKecamatan
        };

        // 5. Composite Score Calculation
        let mut total_score = if is_either_generic {
            // For generic businesses: Owner identity is 70% of the weight!
            (owner_sim * 0.70) + (bus_sim * 0.30)
        } else {
            // For non-generic / unique businesses: Brand name is 65% of the weight!
            (bus_sim * 0.65) + (owner_sim * 0.35)
        };

        if nik_matched {
            total_score = (total_score + 0.25).min(1.0);
        }

        match scope {
            RelocationScope::SameDesa => total_score = (total_score + 0.05).min(1.0),
            RelocationScope::SameKecamatan => total_score = (total_score + 0.02).min(1.0),
            RelocationScope::CrossKecamatan => {}
        }

        if total_score < self.min_threshold {
            return None;
        }

        let mut explanations = Vec::new();
        if nik_matched {
            explanations.push("NIK pengelola identik 100%");
        } else if owner_sim >= 0.90 {
            explanations.push("Nama pemilik/pengelola cocok");
        }

        if bus_jw >= 0.95 {
            explanations.push("Bidang usaha identik");
        } else if bus_jw >= 0.80 {
            explanations.push("Bidang usaha mirip");
        }

        explanations.push(match scope {
            RelocationScope::SameDesa => "Relokasi antar-SLS di desa yang sama",
            RelocationScope::SameKecamatan => "Relokasi antar-desa di kecamatan yang sama",
            RelocationScope::CrossKecamatan => "Relokasi lintas kecamatan",
        });

        Some(MatchScore {
            total_score,
            business_similarity: bus_sim,
            owner_similarity: owner_sim,
            owner_matched: nik_matched || owner_sim >= 0.80,
            scope,
            explanation: explanations.join(" | "),
        })
    }
}
