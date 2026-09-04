import re
import hashlib


_HTML_TAG_RE = re.compile(r"<[^>]+>")
_MARKDOWN_HEADING_RE = re.compile(r"^#{1,6}\s+", re.MULTILINE)
_MARKDOWN_BOLD_RE = re.compile(r"\*{2}(.+?)\*{2}")
_MARKDOWN_ITALIC_RE = re.compile(r"(?<!\*)\*([^*]+?)\*(?!\*)")
_MARKDOWN_LINK_RE = re.compile(r"\[([^\]]*)\]\([^)]+\)")
_MARKDOWN_IMAGE_RE = re.compile(r"!\[[^\]]*\]\([^)]+\)")
_MARKDOWN_CODE_BLOCK_RE = re.compile(r"```[\s\S]*?```")
_MARKDOWN_INLINE_CODE_RE = re.compile(r"`([^`]+)`")
_ZERO_WIDTH_RE = re.compile(r"[\u200b\u200c\u200d\ufeff\u00a0]")
_CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_MULTI_SPACE_RE = re.compile(r"[ \t]+")
_MULTI_NEWLINE_RE = re.compile(r"\n{3,}")


def clean_text(raw: str) -> str:
    if not raw:
        return ""
    text = raw
    text = _MARKDOWN_CODE_BLOCK_RE.sub("", text)
    text = _MARKDOWN_IMAGE_RE.sub("", text)
    text = _MARKDOWN_LINK_RE.sub(r"\1", text)
    text = _MARKDOWN_INLINE_CODE_RE.sub(r"\1", text)
    text = _HTML_TAG_RE.sub("", text)
    text = _MARKDOWN_HEADING_RE.sub("", text)
    text = _MARKDOWN_BOLD_RE.sub(r"\1", text)
    text = _MARKDOWN_ITALIC_RE.sub(r"\1", text)
    text = _ZERO_WIDTH_RE.sub("", text)
    text = _CONTROL_CHAR_RE.sub("", text)
    text = _MULTI_SPACE_RE.sub(" ", text)
    text = _MULTI_NEWLINE_RE.sub("\n\n", text)
    text = text.strip()
    return text


def compute_content_hash(source: str, raw_text: str, publish_time: str = "") -> str:
    payload = f"{source}|{raw_text}|{publish_time}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def compute_clean_text_hash(clean_text: str) -> str:
    return hashlib.sha256(clean_text.encode("utf-8")).hexdigest()
