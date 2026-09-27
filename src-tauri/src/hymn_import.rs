use encoding_rs::{BIG5, GBK};
use regex::Regex;
use serde::Serialize;

const SEARCH_URL: &str = "http://www.christianstudy.com/cgi-bin/searchhymn.cgi";
const HYMN_PREFIX: &str = "http://www.christianstudy.com/data/hymns/text/";

#[derive(Serialize)]
pub struct HymnResult {
    pub title: String,
    pub url: String,
}
#[derive(Serialize)]
pub struct LyricsResult {
    pub title: String,
    pub lyrics: String,
}

fn readable_score(text: &str) -> i32 {
    text.chars()
        .map(|c| {
            if c == '\u{fffd}' {
                -40
            } else if ('\u{4e00}'..='\u{9fff}').contains(&c) {
                2
            } else if c.is_alphanumeric() {
                1
            } else {
                0
            }
        })
        .sum()
}
fn decode(bytes: &[u8]) -> String {
    let utf8 = String::from_utf8_lossy(bytes).into_owned();
    let (big5, _, _) = BIG5.decode(bytes);
    let (gbk, _, _) = GBK.decode(bytes);
    [utf8, big5.into_owned(), gbk.into_owned()]
        .into_iter()
        .max_by_key(|text| readable_score(text))
        .unwrap_or_default()
}
fn entities(text: &str) -> String {
    text.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
}
fn plain(html: &str) -> String {
    let tags = Regex::new("(?is)<[^>]+>").expect("tags regex");
    entities(
        &tags.replace_all(
            &html
                .replace("<br>", "\n")
                .replace("<br/>", "\n")
                .replace("<br />", "\n")
                .replace("</p>", "\n"),
            " ",
        ),
    )
    .lines()
    .map(str::trim)
    .filter(|line| !line.is_empty())
    .collect::<Vec<_>>()
    .join("\n")
}
fn safe_url(url: &str) -> bool {
    url.starts_with(HYMN_PREFIX)
        || url.starts_with("https://www.christianstudy.com/data/hymns/text/")
}
fn fetch(url: &str) -> Result<String, String> {
    reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?
        .get(url)
        .send()
        .and_then(|r| r.error_for_status())
        .map_err(|e| e.to_string())
        .and_then(|r| r.bytes().map_err(|e| e.to_string()))
        .map(|bytes| decode(&bytes))
}

pub fn search(keyword: String) -> Vec<HymnResult> {
    let keyword = keyword.trim();
    if keyword.is_empty() {
        return vec![];
    }
    let response = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .and_then(|client| {
            client
                .post(SEARCH_URL)
                .form(&[
                    ("terms", keyword),
                    ("boolean", "AND"),
                    ("case", "Insensitive"),
                ])
                .send()
        })
        .and_then(|response| response.error_for_status())
        .and_then(|response| response.bytes());
    let Ok(bytes) = response else {
        return vec![];
    };
    let link = Regex::new(r#"(?is)<a\s+[^>]*href\s*=\s*[\"']?([^\"'\s>]+)[\"']?[^>]*>(.*?)</a>"#)
        .expect("link regex");
    link.captures_iter(&decode(&bytes))
        .filter_map(|capture| {
            let url = capture.get(1)?.as_str().trim();
            let title = plain(capture.get(2)?.as_str()).trim().to_owned();
            safe_url(url).then_some(HymnResult {
                title,
                url: url.to_owned(),
            })
        })
        .filter(|item| !item.title.is_empty() && !item.title.to_lowercase().contains("blog"))
        .take(20)
        .collect()
}

pub fn lyrics(url: String) -> LyricsResult {
    if !safe_url(&url) {
        return LyricsResult {
            title: String::new(),
            lyrics: String::new(),
        };
    }
    let Ok(html) = fetch(&url) else {
        return LyricsResult {
            title: String::new(),
            lyrics: String::new(),
        };
    };
    let title_re = Regex::new(r"(?is)<title>\s*([^<]+)\s*</title>").expect("title regex");
    let body_re =
        Regex::new(r"(?is)<font[^>]*size\s*=\s*\+2[^>]*>(.*?)</font>").expect("body regex");
    let title = title_re
        .captures(&html)
        .and_then(|capture| capture.get(1))
        .map(|match_| plain(match_.as_str()).replace('【', "").replace('】', ""))
        .unwrap_or_default();
    let lyrics = body_re
        .captures(&html)
        .and_then(|capture| capture.get(1))
        .map(|match_| plain(match_.as_str()))
        .unwrap_or_default();
    LyricsResult { title, lyrics }
}
