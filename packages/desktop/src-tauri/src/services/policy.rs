use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ExtractedMode {
    NoCache,
    LruCapped,
    #[default]
    Unlimited,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ThumbRetain {
    #[default]
    UntilSourceRemoved,
    LruCapped,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractedPolicy {
    #[serde(default)]
    pub mode: ExtractedMode,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_size_per_source: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_file_size: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThumbnailPolicy {
    #[serde(default)]
    pub retain: ThumbRetain,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_total_size: Option<i64>,
}

fn default_thumbnail_sizes() -> Vec<u32> {
    vec![400, 800, 1600]
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CachePolicy {
    #[serde(default)]
    pub extracted: ExtractedPolicy,
    #[serde(default)]
    pub thumbnails: ThumbnailPolicy,
    #[serde(default = "default_thumbnail_sizes")]
    pub thumbnail_sizes: Vec<u32>,
}

impl Default for CachePolicy {
    fn default() -> Self {
        Self {
            extracted: ExtractedPolicy::default(),
            thumbnails: ThumbnailPolicy::default(),
            thumbnail_sizes: default_thumbnail_sizes(),
        }
    }
}

/// Partial overlay applied on top of a base `CachePolicy`.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CachePolicyOverride {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub extracted: Option<ExtractedOverride>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thumbnails: Option<ThumbnailOverride>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractedOverride {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mode: Option<ExtractedMode>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_size_per_source: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_file_size: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThumbnailOverride {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retain: Option<ThumbRetain>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_total_size: Option<i64>,
    /// Per-source override for the thumbnail widths array. When `Some`,
    /// replaces the global `CachePolicy::thumbnail_sizes` wholesale — we
    /// don't element-wise merge. Empty arrays are rejected at the
    /// `set_source_policy` boundary (see `archive_commands::set_source_policy`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub widths: Option<Vec<u32>>,
}

impl CachePolicy {
    pub fn merged_with(&self, over: Option<&CachePolicyOverride>) -> CachePolicy {
        let mut out = self.clone();
        if let Some(o) = over {
            if let Some(ex) = &o.extracted {
                if let Some(m) = ex.mode {
                    out.extracted.mode = m;
                }
                if let Some(v) = ex.max_size_per_source {
                    out.extracted.max_size_per_source = Some(v);
                }
                if let Some(v) = ex.min_file_size {
                    out.extracted.min_file_size = Some(v);
                }
            }
            if let Some(th) = &o.thumbnails {
                if let Some(r) = th.retain {
                    out.thumbnails.retain = r;
                }
                if let Some(v) = th.max_total_size {
                    out.thumbnails.max_total_size = Some(v);
                }
                if let Some(w) = &th.widths {
                    if !w.is_empty() {
                        out.thumbnail_sizes = w.clone();
                    }
                }
            }
        }
        out
    }
}

pub fn parse_override(json: Option<&str>) -> Option<CachePolicyOverride> {
    json.and_then(|s| serde_json::from_str(s).ok())
}

/// Resolve the effective thumbnail widths for a source.
///
/// Returns the source's override widths when set and non-empty, otherwise the
/// global policy's `thumbnail_sizes`. Empty arrays on either side fall through
/// to the next layer — an empty override is treated as "unset" rather than
/// "generate nothing" (the boundary check in `set_source_policy` rejects empty
/// arrays before they reach storage, so this is belt-and-suspenders).
pub fn resolve_widths(override_json: Option<&str>, global: &CachePolicy) -> Vec<u32> {
    parse_override(override_json)
        .and_then(|o| o.thumbnails.and_then(|t| t.widths))
        .filter(|w| !w.is_empty())
        .unwrap_or_else(|| global.thumbnail_sizes.clone())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn merge_no_override() {
        let base = CachePolicy::default();
        let merged = base.merged_with(None);
        assert_eq!(merged.extracted.mode, ExtractedMode::Unlimited);
    }

    #[test]
    fn merge_partial_override() {
        let base = CachePolicy::default();
        let over: CachePolicyOverride =
            serde_json::from_str(r#"{"extracted":{"mode":"no-cache"}}"#).unwrap();
        let merged = base.merged_with(Some(&over));
        assert_eq!(merged.extracted.mode, ExtractedMode::NoCache);
        // Other fields untouched
        assert_eq!(merged.thumbnails.retain, ThumbRetain::UntilSourceRemoved);
    }

    #[test]
    fn parse_override_invalid_returns_none() {
        assert!(parse_override(Some("not-json")).is_none());
        assert!(parse_override(None).is_none());
    }

    #[test]
    fn resolve_widths_uses_global_when_no_override() {
        let global = CachePolicy {
            thumbnail_sizes: vec![800],
            ..CachePolicy::default()
        };
        assert_eq!(resolve_widths(None, &global), vec![800]);
    }

    #[test]
    fn resolve_widths_uses_override_when_set() {
        let global = CachePolicy {
            thumbnail_sizes: vec![800],
            ..CachePolicy::default()
        };
        let over = r#"{"thumbnails":{"widths":[400,800,1600]}}"#;
        assert_eq!(resolve_widths(Some(over), &global), vec![400, 800, 1600]);
    }

    #[test]
    fn resolve_widths_empty_override_falls_back_to_global() {
        let global = CachePolicy {
            thumbnail_sizes: vec![800],
            ..CachePolicy::default()
        };
        let over = r#"{"thumbnails":{"widths":[]}}"#;
        assert_eq!(resolve_widths(Some(over), &global), vec![800]);
    }

    #[test]
    fn resolve_widths_override_without_widths_field_uses_global() {
        let global = CachePolicy {
            thumbnail_sizes: vec![800],
            ..CachePolicy::default()
        };
        let over = r#"{"extracted":{"mode":"no-cache"}}"#;
        assert_eq!(resolve_widths(Some(over), &global), vec![800]);
    }

    #[test]
    fn merged_with_widths_replaces_global_wholesale() {
        let base = CachePolicy {
            thumbnail_sizes: vec![400, 800, 1600],
            ..CachePolicy::default()
        };
        let over: CachePolicyOverride =
            serde_json::from_str(r#"{"thumbnails":{"widths":[800]}}"#).unwrap();
        let merged = base.merged_with(Some(&over));
        assert_eq!(merged.thumbnail_sizes, vec![800]);
    }
}
