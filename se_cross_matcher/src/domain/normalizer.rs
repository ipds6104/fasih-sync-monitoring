use std::collections::HashSet;

pub struct TextNormalizer {
    stopwords: HashSet<&'static str>,
    generic_activities: HashSet<&'static str>,
}

impl Default for TextNormalizer {
    fn default() -> Self {
        Self::new()
    }
}

impl TextNormalizer {
    pub fn new() -> Self {
        let mut stopwords = HashSet::new();
        for &w in &[
            "pt", "cv", "ud", "tb", "dan", "yang", "di", "ke", "dari",
            "dusun", "desa", "rt", "rw", "indonesia", "mandiri", "jaya",
        ] {
            stopwords.insert(w);
        }

        let mut generic_activities = HashSet::new();
        for &g in &[
            "utp perkebunan", "utp tanaman pangan", "utp hortikultura",
            "utp peternakan", "utp perikanan", "utp perikanan tangkap",
            "utp perikanan budidaya", "upt tanaman pangan", "upt perkebunan",
            "tanaman pangan", "perkebunan", "hortikultura", "peternakan",
            "perikanan", "perkebunan kelapa", "perkebunan kelapa sawit",
            "toko sembako", "warung sembako", "warung kopi", "toko kelontong",
            "bengkel motor", "pedagang keliling", "ojek", "jualan sayur",
        ] {
            generic_activities.insert(g);
        }

        Self {
            stopwords,
            generic_activities,
        }
    }

    /// Basic string normalization
    pub fn clean_string(&self, s: &str) -> String {
        let s = s.trim().to_lowercase();
        let s = s.replace('&', " dan ");

        let mut clean = String::with_capacity(s.len());
        for c in s.chars() {
            if c.is_alphanumeric() || c.is_whitespace() || c == '<' || c == '>' || c == '(' || c == ')' {
                clean.push(c);
            } else {
                clean.push(' ');
            }
        }

        clean.split_whitespace().collect::<Vec<_>>().join(" ")
    }

    /// Decompose entity into (base_name, owner_name, is_generic, canonical_format)
    /// Example 1: "UTP HORTIKULTURA <SUKI>" -> ("utp hortikultura", "suki", true, "utp hortikultura <suki>")
    /// Example 2: "KEBUN SAWIT", pengusaha: "AAN" -> ("kebun sawit", "aan", true, "kebun sawit <aan>")
    pub fn decompose_entity(
        &self,
        raw_name: &str,
        pengusaha_var: &str,
    ) -> (String, String, bool, String) {
        let cleaned = self.clean_string(raw_name);
        let mut owner = self.clean_string(pengusaha_var);
        let mut base_name = cleaned.clone();

        // 1. Try to extract owner from brackets: <...> or (...)
        if let Some(start) = cleaned.find('<').or_else(|| cleaned.find('(')) {
            if let Some(end) = cleaned[start..].find('>').or_else(|| cleaned[start..].find(')')) {
                let inside = &cleaned[start + 1..start + end];
                let norm_inside = inside.trim();
                if !norm_inside.is_empty() {
                    owner = norm_inside.to_string();
                }
                let before = &cleaned[..start];
                let after = &cleaned[start + end + 1..];
                base_name = format!("{} {}", before, after)
                    .split_whitespace()
                    .collect::<Vec<_>>()
                    .join(" ");
            }
        }

        // 2. Check if trailing word of base_name matches pengusaha or belongs to generic activity
        if owner.is_empty() && base_name.contains(' ') {
            let words: Vec<String> = base_name.split_whitespace().map(|s| s.to_string()).collect();
            if words.len() >= 3 && words.last().unwrap().len() >= 3 {
                let potential_base = words[..words.len() - 1].join(" ");
                if self.generic_activities.contains(potential_base.as_str()) {
                    base_name = potential_base;
                    owner = words.last().unwrap().clone();
                }
            }
        }

        let is_generic = self.generic_activities.contains(base_name.as_str())
            || base_name.starts_with("utp ")
            || base_name.starts_with("upt ");

        let canonical_name = if !owner.is_empty() {
            format!("{} <{}>", base_name, owner)
        } else {
            base_name.clone()
        };

        (base_name, owner, is_generic, canonical_name)
    }

    /// Extract meaningful keywords/tokens ignoring generic stopwords
    pub fn extract_tokens(&self, s: &str) -> Vec<String> {
        let clean = self.clean_string(s);
        clean
            .split_whitespace()
            .filter(|w| w.len() >= 2 && !self.stopwords.contains(*w))
            .map(|w| w.to_string())
            .collect()
    }
}
