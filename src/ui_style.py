"""Original high-contrast sport-tech visual system for the Streamlit interface."""

from __future__ import annotations

import html

import streamlit as st


CSS = r"""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=Noto+Sans+SC:wght@400;500;700;900&display=swap');
:root { --ink:#070908; --paper:#F4F4F0; --lime:#B6FF00; --orange:#FF5A36; --muted:#9CA39E; }
.stApp { background:linear-gradient(145deg,#050706 0%,#0A0D0B 54%,#101511 100%); color:#F4F4F0; }
html, body, [class*="css"] { font-family:'Inter','Noto Sans SC',sans-serif; }
[data-testid="stSidebar"] { background:#F4F4F0; border-right:1px solid rgba(182,255,0,.45); }
[data-testid="stSidebar"] * { color:#0A0C0B; }
[data-testid="stSidebar"] .stButton button { border:1px solid #0A0C0B; }
[data-testid="stHeader"] { background:transparent; }
.block-container { max-width:1520px; padding-top:1.1rem; padding-bottom:3rem; }
.hero { position:relative; overflow:hidden; min-height:270px; padding:38px 42px; border:1px solid rgba(255,255,255,.15);
background:linear-gradient(112deg,rgba(255,255,255,.08),rgba(255,255,255,.015)); box-shadow:0 24px 70px rgba(0,0,0,.28); }
.hero:after { content:''; position:absolute; right:-70px; top:-120px; width:420px; height:420px; border:80px solid var(--lime);
transform:rotate(22deg); opacity:.10; }
.eyebrow { color:var(--lime); font-size:.72rem; font-weight:800; letter-spacing:.22em; text-transform:uppercase; }
.hero h1 { max-width:980px; margin:17px 0 8px; font-size:clamp(3rem,6vw,6.4rem); line-height:.86; letter-spacing:-.07em;
font-weight:900; text-transform:uppercase; color:#FFF; }
.hero-cn { font-size:1.18rem; font-weight:700; letter-spacing:.06em; color:#F4F4F0; margin-top:24px; }
.hero-meta { display:flex; gap:18px; flex-wrap:wrap; margin-top:20px; color:#AEB6B0; font-size:.78rem; letter-spacing:.12em; }
.hero-meta span { padding:7px 11px; border:1px solid rgba(255,255,255,.16); }
.section-kicker { margin:2.4rem 0 .5rem; color:var(--lime); font-size:.70rem; font-weight:800; letter-spacing:.20em; text-transform:uppercase; }
.section-title { font-size:2rem; font-weight:900; letter-spacing:-.035em; margin-bottom:1rem; }
.metric-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin:1.2rem 0 1.6rem; }
.metric-card { min-height:132px; padding:20px; border:1px solid rgba(255,255,255,.14); background:rgba(255,255,255,.045);
backdrop-filter:blur(12px); box-shadow:inset 0 2px 0 rgba(182,255,0,.88); }
.metric-card.orange { box-shadow:inset 0 2px 0 rgba(255,90,54,.95); }
.metric-label { color:#AAB2AC; font-size:.68rem; font-weight:700; letter-spacing:.13em; text-transform:uppercase; }
.metric-value { margin-top:20px; color:#FFF; font-size:2.15rem; line-height:1; font-weight:900; letter-spacing:-.055em; }
.metric-note { margin-top:9px; color:#7E8780; font-size:.72rem; }
.status-strip { display:flex; gap:8px; flex-wrap:wrap; margin:1rem 0; }
.status-pill { padding:7px 10px; border:1px solid rgba(255,255,255,.18); color:#C8CEC9; font-size:.72rem; }
.status-pill.live { color:#080A09!important; background:var(--lime); border-color:var(--lime); font-weight:800; }
.status-pill:not(.live) { color:#080A09!important; background:var(--orange); border-color:var(--orange); font-weight:800; }

/* stPopoverBody is emitted only by Streamlit popover widgets, not select menus. */
[data-testid="stPopoverBody"] {
  color:#F4F4F0!important;
  background:rgba(7,9,8,.97)!important;
  border:1px solid rgba(255,255,255,.18)!important;
  border-top:3px solid var(--lime)!important;
  border-radius:0!important;
  box-shadow:0 28px 80px rgba(0,0,0,.58), inset 0 1px 0 rgba(255,255,255,.04)!important;
  backdrop-filter:blur(18px);
  max-height:min(78vh,720px)!important;
  overflow-y:auto!important;
  overscroll-behavior:contain;
}
[data-testid="stPopoverBody"] > div,
[data-testid="stPopoverBody"] [data-testid="stVerticalBlock"] {
  background:transparent!important;
}
[data-testid="stPopoverBody"] h3,
[data-testid="stPopoverBody"] h4,
[data-testid="stPopoverBody"] p,
[data-testid="stPopoverBody"] li,
[data-testid="stPopoverBody"] label,
[data-testid="stPopoverBody"] summary,
[data-testid="stPopoverBody"] [data-testid="stCaptionContainer"] {
  color:#F4F4F0!important;
}
[data-testid="stPopoverBody"] [data-testid="stCaptionContainer"] { color:#AEB6B0!important; }
[data-testid="stPopoverBody"] [data-testid="stExpander"] {
  color:#F4F4F0!important;
  background:rgba(255,255,255,.035)!important;
  border:1px solid rgba(255,255,255,.17)!important;
  border-radius:0!important;
}
[data-testid="stPopoverBody"] [data-testid="stExpander"] details[open] {
  box-shadow:inset 3px 0 0 var(--lime);
}
[data-testid="stPopoverBody"] [data-testid="stExpander"] summary:hover {
  background:rgba(182,255,0,.07)!important;
}
[data-testid="stPopoverBody"] [data-testid="stExpander"] svg { fill:#B6FF00!important; }
[data-testid="stPopoverBody"] [data-testid="stAlert"] {
  color:#FFD39A!important;
  background:rgba(255,138,0,.11)!important;
  border:1px solid rgba(255,138,0,.48)!important;
  border-left:3px solid #FF8A00!important;
  border-radius:0!important;
}
[data-testid="stPopoverBody"] [data-testid="stAlert"] * { color:#FFD39A!important; }
[data-testid="stPopoverBody"] [data-testid="stMetric"] {
  background:rgba(255,255,255,.04)!important;
  border:1px solid rgba(255,255,255,.14)!important;
  border-radius:0!important;
}
[data-testid="stPopoverBody"] [data-testid="stMetricLabel"] * { color:#9CA39E!important; }
[data-testid="stPopoverBody"] [data-testid="stMetricValue"] * { color:#FFFFFF!important; }
[data-testid="stPopoverBody"] a { color:var(--lime)!important; }
[data-testid="stPopoverBody"]::-webkit-scrollbar { width:8px; }
[data-testid="stPopoverBody"]::-webkit-scrollbar-track { background:#0A0D0B; }
[data-testid="stPopoverBody"]::-webkit-scrollbar-thumb { background:#536B19; }
[data-testid="stMetric"] { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.12); padding:14px; }
[data-testid="stDataFrame"] { border:1px solid rgba(255,255,255,.12); }
.stDownloadButton button { background:var(--lime)!important; color:#080A09!important; border:0!important; border-radius:0!important; font-weight:800!important; }
.stSelectbox div[data-baseweb="select"] > div, .stNumberInput input, .stTextInput input { border-radius:0!important; }
.stAlert { border-radius:0!important; }
iframe { border:1px solid rgba(255,255,255,.14)!important; }
@media (max-width:900px){ .metric-grid{grid-template-columns:repeat(2,minmax(0,1fr));}.hero{padding:28px 24px;}.hero h1{font-size:3.2rem;} }
</style>
"""


def inject_css() -> None:
    """Inject the project visual system into the current Streamlit page."""

    st.markdown(CSS, unsafe_allow_html=True)


def render_hero() -> None:
    """Render the bilingual hero without external brand assets."""

    st.markdown(
        """
        <section class="hero">
          <div class="eyebrow">County Intelligence / Spatial Diagnostics / V1.0</div>
          <h1>Regional<br>Potential Lab</h1>
          <div class="hero-cn">县域经济潜力与空间错配诊断平台</div>
          <div class="hero-meta">
            <span>COUNTY ECONOMIC POTENTIAL DIAGNOSTICS</span>
            <span>2019 / 2024 SPATIAL MISMATCH INTELLIGENCE</span>
          </div>
        </section>
        """,
        unsafe_allow_html=True,
    )


def section_heading(kicker: str, title: str) -> None:
    """Render a consistent section label and title."""

    st.markdown(
        f'<div class="section-kicker">{html.escape(kicker)}</div>'
        f'<div class="section-title">{html.escape(title)}</div>',
        unsafe_allow_html=True,
    )


def metric_grid(cards: list[tuple[str, str, str, str]]) -> None:
    """Render four hard-edged KPI cards.

    Each tuple contains label, value, note, and accent (``lime`` or ``orange``).
    """

    body = "".join(
        f'<div class="metric-card {"orange" if accent == "orange" else ""}">'
        f'<div class="metric-label">{html.escape(label)}</div>'
        f'<div class="metric-value">{html.escape(value)}</div>'
        f'<div class="metric-note">{html.escape(note)}</div></div>'
        for label, value, note, accent in cards
    )
    st.markdown(f'<div class="metric-grid">{body}</div>', unsafe_allow_html=True)


def status_pills(items: list[tuple[str, bool]]) -> None:
    """Render compact availability/source status pills."""

    body = "".join(
        f'<span class="status-pill {"live" if live else ""}">{html.escape(label)}</span>'
        for label, live in items
    )
    st.markdown(f'<div class="status-strip">{body}</div>', unsafe_allow_html=True)
