const els = {
  coverScreen: document.getElementById("cover-screen"),
  coverEnter: document.getElementById("cover-enter"),
  coverHome: document.getElementById("cover-home"),
  pageMetas: document.querySelectorAll(".page-meta"),
  pageTitle: document.getElementById("page-title"),
  pagePrevs: document.querySelectorAll(".page-prev"),
  pageNexts: document.querySelectorAll(".page-next"),
  tocTop: document.getElementById("toc-top"),
  tocBottom: document.getElementById("toc-bottom"),
  content: document.getElementById("content"),
};

const state = {
  pages: [],
  index: 0,
  tocQuery: "",
};

const BOOK_TITLE = "Теория уровней и модель человека";

function titleFromMd(path) {
  return path
    .split("/")
    .pop()
    .replace(/\.md$/i, "")
    .replace(/^(?:\d+(?:\.\d+)*|[IVX]+)\.?\s*/, "")
    .trim();
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(text) {
  return escapeHtml(text).replace(/"/g, "&quot;");
}

function renderInline(text) {
  let html = escapeHtml(text);
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
    return `<img class="md-pict" src="${escapeAttr(src)}" alt="${escapeAttr(alt)}">`;
  });
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    if (href.startsWith("#")) return `<a href="${href}">${label}</a>`;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  html = html.replace(/(^|[^"'>=])(https?:\/\/[^\s<]+)/g, (_, prefix, url) => {
    const trimmed = url.replace(/[.,;:!?)]+$/, "");
    const suffix = url.slice(trimmed.length);
    return `${prefix}<a href="${trimmed}" target="_blank" rel="noopener noreferrer">${trimmed}</a>${suffix}`;
  });
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/\|([^|<]{1,40})\|/g, '<span class="md-abs">$1</span>');
  return html;
}

function splitTableCells(row) {
  const esc = "\u0000";
  return row
    .replace(/\\\|/g, esc)
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim().replaceAll(esc, "|"));
}

function renderTable(rows) {
  const parsed = rows
    .filter((row) => !/^\|\s*-/.test(row))
    .map((row) => splitTableCells(row));
  if (!parsed.length) return "";
  const head = parsed[0];
  const first = head[0].trim();
  const kind =
    head.length <= 2
      ? "md-table-list"
      : head.length === 3
        ? first === "№" || first.length <= 2
          ? "md-table-compare"
          : first === "Уровень"
            ? "md-table-fields"
            : "md-table-grid"
        : "md-table-matrix";
  const pictRe = /!\[[^\]]*\]\([^)]+\)/;
  const pictCol = head.findIndex((_, col) => parsed.some((row) => pictRe.test(row[col] || "")));
  const hasPict = pictCol >= 0;
  const levelCols = head.length === 4 && (first === "Уровень" || first === "№-№") ? " md-table-level" : "";
  const ageCols = head.length === 3 && head[1] && head[1].includes("Возраст") ? " md-table-age" : "";
  const levelList = head.length <= 2 && first === "Уровень" ? " md-table-level-list" : "";
  const numCols = head.length === 4 && first === "№" ? " md-table-num" : "";
  let headerRows = 1;
  while (headerRows < parsed.length && parsed[headerRows][0].trim() === "~") headerRows += 1;
  const spanAt = (r, c) => {
    const row = parsed[r];
    let colspan = 1;
    while (c + colspan < row.length && row[c + colspan].trim() === "^") colspan += 1;
    let rowspan = 1;
    while (r + rowspan < parsed.length && parsed[r + rowspan][c] && parsed[r + rowspan][c].trim() === "~") rowspan += 1;
    return { colspan, rowspan };
  };
  const rowHtml = (r, tag) => {
    const cells = parsed[r];
    let html = "";
    for (let c = 0; c < cells.length; c += 1) {
      const raw = cells[c].trim();
      if (raw === "^" || raw === "~") continue;
      const { colspan, rowspan } = spanAt(r, c);
      const attrs = `${colspan > 1 ? ` colspan="${colspan}"` : ""}${rowspan > 1 ? ` rowspan="${rowspan}"` : ""}`;
      html += `<${tag}${attrs}>${renderInline(cells[c])}</${tag}>`;
    }
    return html;
  };
  const thead = `<thead>${parsed.slice(0, headerRows).map((_, r) => `<tr>${rowHtml(r, "th")}</tr>`).join("")}</thead>`;
  const tbody = `<tbody>${parsed.slice(headerRows).map((_, i) => `<tr>${rowHtml(headerRows + i, "td")}</tr>`).join("")}</tbody>`;
  let colgroup = "";
  if (first === "№-№") {
    colgroup = `<colgroup><col style="width:4.5rem"><col style="width:34%"><col style="width:24%"><col style="width:24%"></colgroup>`;
  } else if (first === "Уровень" && head.length === 8) {
    colgroup = `<colgroup><col style="width:4.8rem"><col style="width:3.4rem"><col><col><col><col style="width:4.8rem"><col><col></colgroup>`;
  } else if (first === "Уровень" && head.length === 6) {
    colgroup = `<colgroup><col style="width:4.8rem"><col style="width:5.5rem"><col style="width:3.2rem"><col style="width:4.6rem"><col><col style="width:9.2rem"></colgroup>`;
  } else if (first === "Уровень" && head.length === 11) {
    colgroup = `<colgroup><col style="width:4.6rem">${"<col>".repeat(10)}</colgroup>`;
  }
  return `<div class="md-table-wrap"><table class="md-table ${kind} md-cols-${head.length}${levelCols}${ageCols}${levelList}${numCols}${hasPict ? (pictCol === head.length - 1 ? " md-table-pict" : " md-table-pict-mid") : ""}">${colgroup}${thead}${tbody}</table></div>`;
}

function renderMarkdown(src) {
  const lines = String(src || "").replace(/\r\n/g, "\n").split("\n");
  const parts = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i += 1;
      continue;
    }
    if (line === "---") {
      parts.push("<hr>");
      i += 1;
      continue;
    }
    if (line.startsWith("## ")) {
      parts.push(`<h2>${renderInline(line.slice(3))}</h2>`);
      i += 1;
      continue;
    }
    if (line.startsWith("# ")) {
      parts.push(`<h2>${renderInline(line.slice(2))}</h2>`);
      i += 1;
      continue;
    }
    if (line.startsWith(">")) {
      const quotes = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quotes.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      parts.push(`<blockquote>${quotes.map(renderInline).join("<br>")}</blockquote>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length) {
        const item = lines[i].trim().match(/^[-*]\s+(.*)$/);
        if (!item) break;
        items.push(`<li>${renderInline(item[1])}</li>`);
        i += 1;
      }
      parts.push(`<ul>${items.join("")}</ul>`);
      continue;
    }
    if (line.startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(lines[i].trim());
        i += 1;
      }
      parts.push(renderTable(rows));
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length) {
        const item = lines[i].trim().match(/^(\d+)\.\s+(.*)$/);
        if (!item) break;
        items.push(`<li>${renderInline(item[2])}</li>`);
        i += 1;
      }
      parts.push(`<ol>${items.join("")}</ol>`);
      continue;
    }
    const para = [line];
    i += 1;
    while (i < lines.length) {
      const next = lines[i].trim();
      if (
        !next ||
        next === "---" ||
        next.startsWith("#") ||
        next.startsWith(">") ||
        next.startsWith("|") ||
        /^[-*]\s+/.test(next) ||
        /^\d+\.\s+/.test(next)
      ) {
        break;
      }
      para.push(next);
      i += 1;
    }
    parts.push(`<p>${para.map(renderInline).join("<br>")}</p>`);
  }
  return parts.join("\n");
}

function hideCover() {
  document.body.classList.remove("cover-open");
  els.coverScreen.classList.add("cover-hidden");
  els.coverScreen.setAttribute("aria-hidden", "true");
}

function showCover() {
  document.body.classList.add("cover-open");
  document.body.classList.remove("view-toc");
  document.body.classList.remove("view-part");
  els.coverScreen.classList.remove("cover-hidden");
  els.coverScreen.setAttribute("aria-hidden", "false");
  document.title = BOOK_TITLE;
  history.replaceState(null, "", location.pathname + location.search);
}

function isTocView() {
  return document.body.classList.contains("view-toc");
}

function setMeta(text) {
  els.pageMetas.forEach((el) => {
    el.textContent = text;
  });
}

function bookLen() {
  return state.pages.length;
}

function currentPage() {
  return state.pages[state.index];
}

function setNavDisabled(prevsDisabled, nextsDisabled) {
  els.pagePrevs.forEach((el) => {
    el.disabled = prevsDisabled;
  });
  els.pageNexts.forEach((el) => {
    el.disabled = nextsDisabled;
  });
}

function syncNav() {
  if (isTocView()) {
    setNavDisabled(false, state.pages.length === 0);
    return;
  }
  setNavDisabled(false, state.index >= state.pages.length - 1);
}

function foldSearch(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/ё/g, "е");
}

function tocSearchHay(page) {
  return foldSearch([page.id, page.title, page.subtitle].filter(Boolean).join(" "));
}

function seedSearchText() {
  for (const page of state.pages) {
    page.searchText = tocSearchHay(page);
  }
}

function pageMatchesQuery(page, query) {
  if (!query) return true;
  return foldSearch(page.searchText || tocSearchHay(page)).includes(query);
}

async function fetchText(url) {
  const res = await fetch(`${url}?v=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(String(res.status));
  return res.text();
}

async function indexPageText(page) {
  const meta = tocSearchHay(page);
  const bits = [meta];
  try {
    if (page.md) bits.push(await fetchText(encodeURI(page.md)));
  } catch {
    // title-only if the old text is missing
  }
  try {
    if (page.comment) bits.push(await fetchText(encodeURI(page.comment)));
  } catch {
    // commentary is optional
  }
  page.searchText = foldSearch(bits.join("\n"));
}

async function indexBookSearch() {
  const queue = state.pages.filter((page) => page.md || page.comment);
  for (let i = 0; i < queue.length; i += 6) {
    await Promise.all(queue.slice(i, i + 6).map(indexPageText));
    if (isTocView()) applyTocFilter();
  }
}

function hasCommentText(text) {
  return String(text || "").replace(/^\s*#.*$/m, "").trim().length > 0;
}

function commentBlock(page, text) {
  if (!page.comment) return "";
  const label = `<p class="now-comment-label">Современный комментарий</p>`;
  if (!hasCommentText(text)) {
    return `<section class="now-comment">${label}<p class="now-comment-empty">Пока пусто. Пишите в <span class="now-comment-file">${escapeHtml(page.comment)}</span></p></section>`;
  }
  return `<section class="now-comment">${label}${renderMarkdown(text)}</section>`;
}

function renderTocPage() {
  const query = escapeAttr(state.tocQuery || "");
  const parts = [
    `<button type="button" class="toc-page-cover-link">← К обложке</button>`,
    `<label class="toc-search-wrap">
      <span class="search-loupe" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="11" cy="11" r="6.5"></circle>
          <path d="M20 20l-3.2-3.2"></path>
        </svg>
      </span>
      <input id="toc-search" type="search" value="${query}" placeholder="Поиск по книге…" autocomplete="off" spellcheck="false" aria-label="Поиск по книге">
    </label>`,
    `<p class="toc-search-empty" hidden>Ничего не найдено</p>`,
  ];
  state.pages.forEach((page, index) => {
    if (page.kind === "part") {
      const label = page.subtitle ? `<span class="toc-part-label">${escapeHtml(page.subtitle)}</span>` : "";
      parts.push(
        `<button type="button" class="toc-part toc-row" data-index="${index}">${label}<span class="title">${escapeHtml(page.title)}</span></button>`,
      );
      return;
    }
    parts.push(
      `<button type="button" class="toc-page-item toc-row" data-index="${index}"><span class="num">${escapeHtml(page.id)}</span><span class="title">${escapeHtml(page.title)}</span></button>`,
    );
  });
  return `<div class="toc-page">${parts.join("")}</div>`;
}

function applyTocFilter() {
  const input = els.content.querySelector("#toc-search");
  const empty = els.content.querySelector(".toc-search-empty");
  const query = foldSearch((input?.value || state.tocQuery || "").trim());
  const rows = [...els.content.querySelectorAll(".toc-row")];
  if (!query) {
    rows.forEach((el) => el.classList.remove("toc-filter-hide"));
    if (empty) empty.hidden = true;
    return;
  }
  const matches = rows.map((el) => {
    const page = state.pages[Number(el.dataset.index)];
    return Boolean(page && pageMatchesQuery(page, query));
  });
  const shown = matches.slice();
  for (let i = 0; i < rows.length; i += 1) {
    if (!matches[i]) continue;
    if (rows[i].classList.contains("toc-part")) {
      for (let j = i + 1; j < rows.length && !rows[j].classList.contains("toc-part"); j += 1) {
        shown[j] = true;
      }
    }
  }
  for (let i = 0; i < rows.length; i += 1) {
    if (shown[i] || !rows[i].classList.contains("toc-part")) continue;
    for (let j = i + 1; j < rows.length && !rows[j].classList.contains("toc-part"); j += 1) {
      if (shown[j]) {
        shown[i] = true;
        break;
      }
    }
  }
  rows.forEach((el, i) => el.classList.toggle("toc-filter-hide", !shown[i]));
  if (empty) empty.hidden = shown.some(Boolean);
}

function firstVisibleTocPageIndex() {
  const btn = els.content.querySelector(".toc-page-item:not(.toc-filter-hide)");
  const index = Number(btn?.dataset.index);
  return Number.isFinite(index) ? index : -1;
}

function bindTocPageClicks() {
  els.content.querySelector(".toc-page-cover-link")?.addEventListener("click", showCover);
  els.content.querySelectorAll(".toc-page-item, .toc-part").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.index);
      if (Number.isFinite(index)) openPage(index);
    });
  });
  const input = els.content.querySelector("#toc-search");
  if (!input) return;
  input.addEventListener("input", () => {
    state.tocQuery = input.value;
    applyTocFilter();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && input.value) {
      e.preventDefault();
      input.value = "";
      state.tocQuery = "";
      applyTocFilter();
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const index = firstVisibleTocPageIndex();
      if (index >= 0) openPage(index);
    }
  });
  applyTocFilter();
  queueMicrotask(() => input.focus());
}

function showToc() {
  hideCover();
  document.body.classList.remove("view-part");
  document.body.classList.add("view-toc");
  setMeta("Оглавление");
  els.pageTitle.textContent = "Оглавление";
  document.title = `Оглавление — ${BOOK_TITLE}`;
  history.replaceState(null, "", `${location.pathname}${location.search}#toc`);
  syncNav();
  els.content.innerHTML = renderTocPage();
  bindTocPageClicks();
  document.getElementById("reader").scrollTop = 0;
}

async function openPage(index) {
  const page = state.pages[index];
  if (!page) return;
  state.index = index;
  hideCover();
  document.body.classList.remove("view-toc");
  document.body.classList.toggle("view-part", page.kind === "part");
  document.title = `${page.title} — ${BOOK_TITLE}`;
  history.replaceState(null, "", `${location.pathname}${location.search}#${page.id}`);
  syncNav();
  if (page.kind === "part") {
    setMeta("");
    els.pageTitle.textContent = "";
    const sub = page.subtitle
      ? `<span class="part-cover-sub">${escapeHtml(page.subtitle)}</span>`
      : "";
    els.content.innerHTML = `<button type="button" class="cover-image-btn part-cover" title="Открыть" aria-label="Открыть">${sub}<span class="part-cover-title">${escapeHtml(page.title)}</span></button>`;
    els.content.querySelector(".part-cover")?.addEventListener("click", goNext);
    document.getElementById("reader").scrollTop = 0;
    return;
  }
  setMeta(`${page.id} / ${bookLen()}`);
  els.pageTitle.textContent = page.title;
  els.content.innerHTML = "<p>…</p>";
  try {
    const text = await fetchText(encodeURI(page.md));
    let comment = "";
    if (page.comment) {
      try {
        comment = await fetchText(encodeURI(page.comment));
      } catch {
        comment = "";
      }
    }
    if (state.index !== index) return;
    els.content.innerHTML = renderMarkdown(text) + commentBlock(page, comment);
  } catch {
    if (state.index !== index) return;
    els.content.innerHTML = '<p class="load-error">Не удалось открыть главу.</p>';
  }
  document.getElementById("reader").scrollTop = 0;
}

function goPrev() {
  if (isTocView()) {
    showCover();
    return;
  }
  if (state.index <= 0) {
    showToc();
    return;
  }
  openPage(state.index - 1);
}

function goNext() {
  if (isTocView()) {
    openPage(0);
    return;
  }
  if (state.index < state.pages.length - 1) openPage(state.index + 1);
}

async function boot() {
  const manifest = await fetch(`pages.json?v=${Date.now()}`, { cache: "no-store" }).then((r) => r.json());
  state.pages = (manifest.pages || []).map((page) => ({
    ...page,
    title: page.title || titleFromMd(page.md),
  }));
  seedSearchText();
  indexBookSearch();
  els.coverEnter.addEventListener("click", showToc);
  els.coverEnter.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      showToc();
    }
  });
  els.coverHome.addEventListener("click", showCover);
  els.pagePrevs.forEach((el) => el.addEventListener("click", goPrev));
  els.pageNexts.forEach((el) => el.addEventListener("click", goNext));
  els.tocTop.addEventListener("click", showToc);
  els.tocBottom.addEventListener("click", showToc);
  document.addEventListener("keydown", (e) => {
    if (document.body.classList.contains("cover-open")) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.code === "ArrowLeft") goPrev();
    if (e.code === "ArrowRight") goNext();
  });
  window.addEventListener("hashchange", applyHash);
  applyHash();
}

function applyHash() {
  const hash = decodeURIComponent(location.hash.replace(/^#/, ""));
  if (hash === "toc") {
    showToc();
    return;
  }
  const fromHash = state.pages.findIndex((p) => p.id === hash);
  if (fromHash >= 0) openPage(fromHash);
}

boot();
