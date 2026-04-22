use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ExtractedMode {
    NoCache,
    LruCapped,
    Unlimited,
}

impl Default for ExtractedMode {
    fn default() -> Self {
        ExtractedMode::Unlimited
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ThumbRetain {
    UntilSourceRemoved,
    LruCapped,
}

impl Default for ThumbRetain {
    fn default() -> Self {
        ThumbRetain::UntilSourceRemoved
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractedPolicy {
    #[serde(default)]
    pub mode: ExtractedMode,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_size_per_source: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_file_size: Option<i64>,
}

impl Default for ExtractedPolicy {
    fn default() -> Self {
        Self {
            mode: ExtractedMode::default(),
            max_size_per_source: None,
            min_file_size: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThumbnailPolicy {
    #[serde(default)]
    pub retain: ThumbRetain,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_total_size: Option<i64>,
}

impl Default for ThumbnailPolicy {
    fn default() -> Self {
        Self {
            retain: ThumbRetain::default(),
            max_total_size: None,
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CachePolicy {
    #[serde(default)]
    pub extracted: ExtractedPolicy,
    #[serde(default)]
    pub thumbnails: ThumbnailPolicy,
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
            }
        }
        out
    }
}

pub fn parse_override(json: Option<&str>) -> Option<CachePolicyOverride> {
    json.and_then(|s| serde_json::from_str(s).ok())
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
}
