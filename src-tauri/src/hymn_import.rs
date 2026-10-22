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
/// Marks a real line break while the tags are still being stripped. Newlines in
/// the source are only formatting, so they must not be mistaken for breaks:
/// these pages put one after almost every `<br>`.
const BREAK: &str = "\u{1}";

/// Splits the markup into display lines. A piece that holds nothing but
/// whitespace comes from two breaks in a row, which is how these pages separate
/// verses, so it is kept as an empty entry for the caller to interpret.
fn pieces(html: &str) -> Vec<String> {
    let tags = Regex::new("(?is)<[^>]+>").expect("tags regex");
    let breaks = Regex::new(r"(?i)<br\s*/?>|</p>").expect("breaks regex");
    let marked = breaks.replace_all(html, BREAK);
    entities(&tags.replace_all(&marked, " "))
        .split(BREAK)
        .map(|piece| piece.split_whitespace().collect::<Vec<_>>().join(" "))
        .collect()
}
fn plain(html: &str) -> String {
    pieces(html)
        .into_iter()
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}
/// Like `plain`, but keeps one blank line wherever the page separated verses so
/// the stanzas arrive apart instead of as a single block.
fn plain_verses(html: &str) -> String {
    let mut lines: Vec<String> = Vec::new();
    for piece in pieces(html) {
        if !piece.is_empty() {
            lines.push(piece);
        } else if lines.last().is_some_and(|last| !last.is_empty()) {
            lines.push(String::new());
        }
    }
    while lines.last().is_some_and(String::is_empty) {
        lines.pop();
    }
    lines.join("\n")
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
    parse_lyrics_page(&html)
}

/// Pulls the title and lyrics out of a christianstudy hymn page. The lyrics
/// sit in `<font size=+2> ... </FONT></p>`; that block can contain its own
/// `<font>` tags (an empty colour tag, a small spacer), so the match runs to
/// the `</font>` that closes the paragraph, not the first one.
fn parse_lyrics_page(html: &str) -> LyricsResult {
    let title_re = Regex::new(r"(?is)<title>\s*([^<]+)\s*</title>").expect("title regex");
    let block_re =
        Regex::new(r"(?is)<font[^>]*size\s*=\s*\+2[^>]*>(.*?)</font>\s*</p>").expect("block regex");
    let fallback_re =
        Regex::new(r"(?is)<font[^>]*size\s*=\s*\+2[^>]*>(.*?)</font>").expect("body regex");
    let title = title_re
        .captures(html)
        .and_then(|capture| capture.get(1))
        .map(|match_| plain(match_.as_str()).replace('【', "").replace('】', ""))
        .unwrap_or_default();
    let lyrics = [&block_re, &fallback_re]
        .into_iter()
        .filter_map(|re| re.captures(html)?.get(1))
        .map(|match_| plain_verses(match_.as_str()))
        .find(|text| !text.is_empty())
        .unwrap_or_default();
    LyricsResult { title, lyrics }
}

#[cfg(test)]
mod tests {
    use super::*;

    const DIVIDER: &str =
        "<p><TABLE BORDER=\"0\"><TR><TD><IMG SRC=\" \"><br></TD></TR></TABLE></p>";

    fn page(title: &str, body: &str) -> String {
        format!(
            "<html><head><title>{title}
</title></head><body><p><font color=\"#3333FF\" size=+3>{title}</font>
<br>meta</p>{DIVIDER}
<p><font size=+2>
{body}</FONT></p>
{DIVIDER}</body></html>"
        )
    }

    #[test]
    fn plain_lyrics_block_is_parsed() {
        let result = parse_lyrics_page(&page(
            "【我心尊主為大】",
            "第一行<br>
第二行<br>
",
        ));
        assert_eq!(result.title, "我心尊主為大");
        assert_eq!(
            result.lyrics,
            "第一行
第二行"
        );
    }

    #[test]
    fn empty_font_tag_at_start_does_not_hide_the_lyrics() {
        // c0514 opens the lyrics block with an empty colour tag.
        let html = page(
            "【詩】",
            "<font color=\"#3333FF\"></font>
第一行<br>
第二行<BR>
",
        );
        assert_eq!(
            parse_lyrics_page(&html).lyrics,
            "第一行
第二行"
        );
    }

    #[test]
    fn nested_spacer_font_keeps_every_verse_and_chorus() {
        // c0600 puts a small spacer font between numbered verses.
        let html = page(
            "【詩】",
            "<ol>
<li>一節<br>
<font size=1><br></font>
<li>二節<br>
</ol>
副歌<br>
",
        );
        // The page spaces the two verses apart but runs straight into the
        // chorus, and the import keeps that shape.
        assert_eq!(parse_lyrics_page(&html).lyrics, "一節\n\n二節\n副歌");
    }

    #[test]
    fn a_double_break_separates_verses() {
        // c0100 separates verses with two breaks in a row.
        let html = page(
            "【詩】",
            "一節甲<br>\n一節乙<br>\n<br>\n二節甲<br>\n二節乙<br>\n",
        );
        assert_eq!(
            parse_lyrics_page(&html).lyrics,
            "一節甲\n一節乙\n\n二節甲\n二節乙"
        );
    }

    #[test]
    fn source_newlines_alone_do_not_split_or_separate_lines() {
        // A newline in the markup is formatting; only a break tag ends a line.
        assert_eq!(plain("一\n二"), "一 二");
        assert_eq!(plain_verses("一<br>\n\n\n二"), "一\n二");
    }

    #[test]
    fn blank_lines_are_never_left_at_the_edges_or_doubled_up() {
        assert_eq!(plain_verses("<br><br>一<br><br><br>二<br><br>"), "一\n\n二");
    }

    #[test]
    fn uppercase_br_splits_lines() {
        assert_eq!(plain("一<BR>二<Br/>三"), "一\n二\n三");
    }
}
