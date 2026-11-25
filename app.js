const els = {
  coverScreen: document.getElementById("cover-screen"),
  shelfBooks: document.querySelectorAll(".shelf-book[data-volume]"),
  shelfSearch: document.getElementById("shelf-search"),
  shelfResults: document.getElementById("shelf-results"),
  coverHome: document.getElementById("cover-home"),
  pageMetas: document.querySelectorAll(".page-meta"),
  pageTitle: document.getElementById("page-title"),
  pagePrevs: document.querySelectorAll(".page-prev"),
  pageNexts: document.querySelectorAll(".page-next"),
  tocTop: document.getElementById("toc-top"),
  tocBottom: document.getElementById("toc-bottom"),
  content: document.getElementById("content"),
  listen: document.getElementById("listen"),
  listenBtn: document.getElementById("listen-btn"),
  listenParts: document.getElementById("listen-parts"),
};

const state = {
  pages: [],
  index: 0,
  tocQuery: "",
  volume: "",
  bookTitle: "Яков Фельдман",
  bookYear: "",
};

const VOLUMES = {
  2005: { title: "Теория уровней и модель человека", manifest: "pages.json" },
  sun: { title: "Педагогика луны и педагогика солнца", manifest: "sun/pages.json" },
  album: { title: "Альбом. Том 1. Инструментарий", manifest: "album/pages.json" },
  m678: { title: "М678", manifest: "m678/pages.json" },
  chai: { title: "Общая теория человека для «чайников»", manifest: "chai/pages.json" },
  kino: { title: "Кино и уровни. Общая теория человека", manifest: "kino/pages.json" },
  kino2: { title: "Кино и уровни — 2. Последняя надежда", manifest: "kino2/pages.json" },
  kino3: { title: "Кино и уровни — 3. Люди и ангелы", manifest: "kino3/pages.json" },
  plus: { title: "Философия++", manifest: "plus/pages.json" },
  anthro: { title: "Антропология для инопланетян", manifest: "anthro/pages.json" },
  beach: { title: "Философ на пляже", manifest: "beach/pages.json" },
  later: { title: "Философ 20 лет спустя", manifest: "later/pages.json" },
  dnevnik: { title: "Дневник", manifest: "dnevnik/pages.json" },
  uchebnik: { title: "Учебник к Атласу", manifest: "uchebnik/pages.json" },
};

let searchGen = 0;

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
    const cls = src.includes("pict/") ? "md-pict" : /(?:^|\/)page\//.test(src) ? "md-page" : "md-fig";
    return `<img class="${cls}" src="${escapeAttr(src)}" alt="${escapeAttr(alt)}">`;
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
  const firstColWide = parsed.some((row) => (row[0] || "").trim().length > 4);
  const kind =
    head.length <= 2
      ? firstColWide
        ? "md-table-pairs"
        : "md-table-list"
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
    const video = line.match(/^!video\[([^\]]*)\]\(([^)]+)\)$/);
    if (video) {
      const caption = video[1] ? `<figcaption>${renderInline(video[1])}</figcaption>` : "";
      const youtube = video[2].match(
        /(?:youtube\.com\/(?:shorts\/|embed\/|watch\?v=)|youtu\.be\/)([\w-]{11})/
      );
      if (youtube) {
        const title = escapeAttr(video[1] || "Видео");
        const short = /youtube\.com\/shorts\//.test(video[2]);
        parts.push(
          `<figure class="md-video${short ? " md-video-short" : ""}"><iframe src="https://www.youtube.com/embed/${youtube[1]}" title="${title}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>${caption}</figure>`
        );
      } else {
        parts.push(
          `<figure class="md-video"><video controls playsinline preload="metadata" src="${escapeAttr(video[2])}"></video>${caption}</figure>`
        );
      }
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
        next.startsWith("!video[") ||
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
  stopListen();
  document.body.classList.add("cover-open");
  document.body.classList.remove("view-toc");
  document.body.classList.remove("view-part");
  document.body.classList.remove("view-book-cover");
  els.coverScreen.classList.remove("cover-hidden");
  els.coverScreen.setAttribute("aria-hidden", "false");
  document.title = "Яков Фельдман";
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
  const gen = ++searchGen;
  const queue = state.pages.filter((page) => page.md || page.comment);
  for (let i = 0; i < queue.length; i += 6) {
    if (gen !== searchGen) return;
    await Promise.all(queue.slice(i, i + 6).map(indexPageText));
    if (gen === searchGen && isTocView()) applyTocFilter();
  }
}

const library = {
  books: [],
  pages: [],
  done: 0,
  total: 0,
};

let libraryPromise = null;
let shelfListKey = "";
const SHELF_HITS_LIMIT = 40;

function volumeIds() {
  const fromShelf = [...document.querySelectorAll(".shelf-book[data-volume]")].map((el) => el.dataset.volume);
  const rest = Object.keys(VOLUMES).filter((id) => !fromShelf.includes(id));
  return [...fromShelf, ...rest];
}

function shelfMeta(id) {
  const el = document.querySelector(`.shelf-book[data-volume="${id}"]`);
  return {
    title: el?.querySelector("strong")?.textContent.trim() || VOLUMES[id].title,
    year: el?.querySelector("span")?.textContent.trim() || "",
  };
}

function normalizeQuery(raw) {
  return foldSearch(raw).replace(/\s+/g, " ").trim();
}

function plainFromMd(src) {
  return String(src || "")
    .replace(/\r\n/g, "\n")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/[*_`>#|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeSnippet(plain, at, qlen) {
  const radius = 72;
  let start = Math.max(0, at - radius);
  let end = Math.min(plain.length, at + qlen + radius);
  if (start > 0) {
    const space = plain.indexOf(" ", start);
    if (space !== -1 && space < at) start = space + 1;
  }
  if (end < plain.length) {
    const space = plain.lastIndexOf(" ", end);
    if (space > at + qlen) end = space;
  }
  const pre = start > 0 ? "… " : "";
  const post = end < plain.length ? " …" : "";
  return `${pre}${escapeHtml(plain.slice(start, at))}<mark>${escapeHtml(plain.slice(at, at + qlen))}</mark>${escapeHtml(plain.slice(at + qlen, end))}${post}`;
}

function matchAt(folded, query) {
  let from = 0;
  while (from < folded.length) {
    const at = folded.indexOf(query, from);
    if (at < 0) return -1;
    const prev = at === 0 ? "" : folded[at - 1];
    if (!prev || !/[a-zа-я0-9]/.test(prev)) return at;
    from = at + 1;
  }
  return -1;
}

function highlightText(text, query) {
  const at = matchAt(foldSearch(text), query);
  if (at < 0) return escapeHtml(text);
  return `${escapeHtml(text.slice(0, at))}<mark>${escapeHtml(text.slice(at, at + query.length))}</mark>${escapeHtml(text.slice(at + query.length))}`;
}

function countLabel(n) {
  const n10 = n % 10;
  const n100 = n % 100;
  let word = "совпадений";
  if (n10 === 1 && n100 !== 11) word = "совпадение";
  else if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) word = "совпадения";
  return `${n} ${word}`;
}

async function readOptional(url) {
  if (!url) return "";
  try {
    return await fetchText(encodeURI(url));
  } catch {
    return "";
  }
}

async function fetchManifests() {
  const books = await Promise.all(
    volumeIds().map(async (id) => {
      const vol = VOLUMES[id];
      const card = shelfMeta(id);
      let manifestTitle = vol.title;
      let pages = [];
      try {
        const res = await fetch(`${vol.manifest}?v=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const manifest = await res.json();
        manifestTitle = manifest.title || vol.title;
        pages = manifest.pages || [];
        if (!card.year && manifest.year) card.year = String(manifest.year);
      } catch {
        pages = [];
      }
      return {
        id,
        title: card.title,
        manifestTitle,
        year: card.year,
        foldedShelf: foldSearch(card.title).replace(/\s+/g, " "),
        foldedTitle: foldSearch([card.title, manifestTitle].join("\n")).replace(/\s+/g, " "),
        pages,
      };
    }),
  );
  library.books = books;
  library.pages = [];
  for (const book of books) {
    for (const page of book.pages) {
      const title = page.title || titleFromMd(page.md || "");
      const subtitle = page.subtitle || "";
      const item = {
        volume: book.id,
        bookTitle: book.title,
        year: book.year,
        id: String(page.id),
        title,
        subtitle,
        md: page.md || "",
        comment: page.comment || "",
        foldedTitle: foldSearch([title, subtitle].filter(Boolean).join(" ")).replace(/\s+/g, " "),
        plain: "",
        folded: "",
        ready: false,
      };
      if (!item.md && !item.comment) item.ready = true;
      library.pages.push(item);
    }
  }
  library.total = library.pages.length;
  library.done = library.pages.filter((page) => page.ready).length;
}

function loadLibrary() {
  if (!libraryPromise) {
    libraryPromise = fetchManifests()
      .then(() => {
        renderShelfResults();
        indexLibrary();
      })
      .catch((err) => {
        libraryPromise = null;
        throw err;
      });
  }
  return libraryPromise;
}

async function indexLibrary() {
  const queue = library.pages.filter((page) => !page.ready);
  let cursor = 0;
  async function worker() {
    while (cursor < queue.length) {
      const page = queue[cursor];
      cursor += 1;
      try {
        const [md, comment] = await Promise.all([readOptional(page.md), readOptional(page.comment)]);
        page.plain = plainFromMd([md, comment].filter(Boolean).join("\n"));
        page.folded = foldSearch(page.plain);
      } finally {
        page.ready = true;
        library.done += 1;
        const query = normalizeQuery(els.shelfSearch?.value || "");
        const found = query.length >= 2 && page.folded && matchAt(page.folded, query) >= 0;
        if (found || library.done % 40 === 0 || library.done === library.total) renderShelfResults();
      }
    }
  }
  const workers = Math.min(6, queue.length);
  if (workers) await Promise.all(Array.from({ length: workers }, () => worker()));
  renderShelfResults();
}

function collectShelfHits(query) {
  const hits = [];
  for (const book of library.books) {
    if (matchAt(book.foldedTitle, query) < 0) continue;
    const shelfHit = matchAt(book.foldedShelf, query) >= 0;
    hits.push({
      kind: "book",
      volume: book.id,
      year: book.year,
      title: book.title,
      titleHit: true,
      snip: shelfHit ? "" : highlightText(book.manifestTitle, query),
    });
  }
  for (const page of library.pages) {
    const titleHit = matchAt(page.foldedTitle, query) >= 0;
    let snip = "";
    let bodyHit = false;
    if (page.ready && page.folded) {
      const at = matchAt(page.folded, query);
      if (at >= 0) {
        bodyHit = true;
        snip = makeSnippet(page.plain, at, query.length);
      }
    }
    if (!titleHit && !bodyHit) continue;
    hits.push({
      kind: "page",
      volume: page.volume,
      pageId: page.id,
      bookTitle: page.bookTitle,
      year: page.year,
      title: page.title,
      subtitle: page.subtitle,
      titleHit,
      snip,
    });
  }
  hits.sort((a, b) => {
    const rank = (hit) => (hit.kind === "book" ? 0 : hit.titleHit ? 1 : 2);
    return rank(a) - rank(b);
  });
  return hits;
}

function shelfStatus(totalHits, pending) {
  if (!library.books.length) return "Открываю оглавления…";
  if (!totalHits && pending) return `В названиях нет. Читаю текст · ${library.done} из ${library.total}`;
  if (!totalHits) return "Ничего не найдено";
  const reading = pending ? ` · читаю текст ${library.done} из ${library.total}` : "";
  return `${countLabel(totalHits)}${reading}`;
}

function renderShelfHit(hit, query) {
  if (hit.kind === "book") {
    const year = hit.year ? ` · ${escapeHtml(hit.year)}` : "";
    const snip = hit.snip ? `<span class="shelf-hit-snip">${hit.snip}</span>` : "";
    return `<button type="button" class="shelf-hit" data-kind="book" data-volume="${escapeAttr(hit.volume)}"><span class="shelf-hit-book">Книга${year}</span><span class="shelf-hit-title">${highlightText(hit.title, query)}</span>${snip}</button>`;
  }
  const where = `${escapeHtml(hit.bookTitle)}${hit.year ? ` · ${escapeHtml(hit.year)}` : ""}`;
  const id = hit.subtitle
    ? `<span class="shelf-hit-id">${escapeHtml(hit.subtitle)}</span>`
    : hit.pageId
      ? `<span class="shelf-hit-id">${escapeHtml(hit.pageId)}</span>`
      : "";
  const snip = hit.snip ? `<span class="shelf-hit-snip">${hit.snip}</span>` : "";
  return `<button type="button" class="shelf-hit" data-kind="page" data-volume="${escapeAttr(hit.volume)}" data-page="${escapeAttr(hit.pageId)}"><span class="shelf-hit-book">${where}</span><span class="shelf-hit-title">${id}${highlightText(hit.title, query)}</span>${snip}</button>`;
}

function showShelfError() {
  if (!els.shelfResults) return;
  els.coverScreen.classList.add("shelf-searching");
  els.shelfResults.hidden = false;
  const status = els.shelfResults.querySelector(".shelf-results-status");
  const list = els.shelfResults.querySelector(".shelf-results-list");
  if (status) status.textContent = "Не удалось открыть книги.";
  if (list) list.innerHTML = "";
  shelfListKey = "";
}

function renderShelfResults() {
  if (!els.shelfSearch || !els.shelfResults) return;
  const query = normalizeQuery(els.shelfSearch.value);
  const active = query.length >= 2;
  els.coverScreen.classList.toggle("shelf-searching", active);
  if (!active) {
    els.shelfResults.hidden = true;
    shelfListKey = "";
    return;
  }
  els.shelfResults.hidden = false;
  const status = els.shelfResults.querySelector(".shelf-results-status");
  const list = els.shelfResults.querySelector(".shelf-results-list");
  if (!status || !list) return;
  if (!library.books.length) {
    status.textContent = "Открываю оглавления…";
    list.innerHTML = "";
    shelfListKey = "";
    return;
  }
  const hits = collectShelfHits(query);
  const shown = hits.slice(0, SHELF_HITS_LIMIT);
  const pending = library.done < library.total;
  let text = shelfStatus(hits.length, pending);
  if (hits.length > shown.length) text += ` · показаны первые ${shown.length}`;
  status.textContent = text;
  const listKey = `${query}|${shown.map((hit) => `${hit.kind}:${hit.volume}:${hit.pageId || ""}:${hit.snip ? 1 : 0}`).join("|")}`;
  if (listKey === shelfListKey) return;
  shelfListKey = listKey;
  list.innerHTML = shown.map((hit) => renderShelfHit(hit, query)).join("");
}

async function openShelfHit(btn) {
  const volume = btn.dataset.volume;
  if (!volume || !VOLUMES[volume]) return;
  if (btn.dataset.kind === "book") {
    await openVolume(volume);
    return;
  }
  const ok = await ensureVolume(volume);
  if (!ok) return;
  const index = state.pages.findIndex((page) => String(page.id) === btn.dataset.page);
  if (index >= 0) openPage(index);
  else showToc();
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
      `<button type="button" class="toc-page-item toc-row" data-index="${index}"><span class="num">${escapeHtml(page.id)}</span><span class="title">${escapeHtml(page.title)}</span>${pageAudio(page).length ? `<span class="audio-dot" title="Есть запись"></span>` : ""}</button>`,
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
  els.content.querySelector(".toc-page-cover-link")?.addEventListener("click", showBookCover);
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

const LANDING = "https://jfeldman777.github.io/books/";

function showBookCover() {
  if (!state.volume) {
    showCover();
    return;
  }
  stopListen();
  hideCover();
  document.body.classList.remove("view-toc");
  document.body.classList.remove("view-part");
  document.body.classList.add("view-book-cover");
  const year = state.bookYear ? `<p class="book-cover-year">${escapeHtml(state.bookYear)}</p>` : "";
  setMeta("");
  els.pageTitle.textContent = "";
  document.title = state.bookTitle;
  history.replaceState(null, "", `${location.pathname}${location.search}#${volumeHash("cover")}`);
  syncNav();
  els.content.innerHTML = `<div class="book-cover">
    <p class="book-cover-author">Яков Фельдман</p>
    <h2 class="book-cover-title">${escapeHtml(state.bookTitle)}</h2>
    ${year}
    <button type="button" class="book-cover-open">К оглавлению</button>
    <nav class="book-cover-links" aria-label="Куда дальше">
      <button type="button" class="book-cover-shelf">Книжная полка</button>
      <a href="${LANDING}">Лендинг</a>
    </nav>
  </div>`;
  els.content.querySelector(".book-cover-open").addEventListener("click", showToc);
  els.content.querySelector(".book-cover-shelf").addEventListener("click", showCover);
  document.getElementById("reader").scrollTop = 0;
}

function showToc() {
  stopListen();
  hideCover();
  document.body.classList.remove("view-part");
  document.body.classList.remove("view-book-cover");
  document.body.classList.add("view-toc");
  setMeta("Оглавление");
  els.pageTitle.textContent = "Оглавление";
  document.title = `Оглавление — ${state.bookTitle}`;
  history.replaceState(null, "", `${location.pathname}${location.search}#${volumeHash("toc")}`);
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
  document.body.classList.remove("view-book-cover");
  document.body.classList.toggle("view-part", page.kind === "part");
  document.title = `${page.title} — ${state.bookTitle}`;
  history.replaceState(null, "", `${location.pathname}${location.search}#${volumeHash(page.id)}`);
  syncNav();
  if (page.kind === "part") {
    stopListen();
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
  showListen(page);
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
    showBookCover();
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

function volumeHash(page) {
  if (!state.volume || state.volume === "2005") return page;
  return `${state.volume}/${page}`;
}

async function ensureVolume(id) {
  const vol = VOLUMES[id];
  if (!vol) return false;
  if (state.volume === id && state.pages.length) return true;
  const manifest = await fetch(`${vol.manifest}?v=${Date.now()}`, { cache: "no-store" }).then((r) => r.json());
  state.volume = id;
  state.bookTitle = manifest.title || vol.title;
  state.bookYear = manifest.year || "";
  state.pages = (manifest.pages || []).map((page) => ({
    ...page,
    title: page.title || titleFromMd(page.md),
  }));
  state.index = 0;
  state.tocQuery = "";
  seedSearchText();
  indexBookSearch();
  return true;
}

function parseLocation() {
  const hash = decodeURIComponent(location.hash.replace(/^#/, ""));
  if (!hash) return null;
  const slash = hash.indexOf("/");
  if (slash > 0) return { volume: hash.slice(0, slash), page: hash.slice(slash + 1) || "toc" };
  return { volume: "2005", page: hash };
}

async function route() {
  const target = parseLocation();
  if (!target || !VOLUMES[target.volume]) {
    showCover();
    return;
  }
  await ensureVolume(target.volume);
  if (target.page === "cover") {
    showBookCover();
    return;
  }
  if (target.page === "toc") {
    showToc();
    return;
  }
  const fromHash = state.pages.findIndex((p) => p.id === target.page);
  if (fromHash >= 0) openPage(fromHash);
  else showToc();
}

async function openVolume(id) {
  const ok = await ensureVolume(id);
  if (ok) showBookCover();
}

let listenGen = 0;
let listenPart = 0;
let ytPlayer = null;
let ytReady = null;

function pageAudio(page) {
  const audio = page && page.audio;
  if (!audio) return [];
  return (Array.isArray(audio) ? audio : [audio]).filter(Boolean);
}

function resetListenHost() {
  if (!els.listen) return;
  document.getElementById("listen-host")?.remove();
  const host = document.createElement("div");
  host.id = "listen-host";
  els.listen.appendChild(host);
}

function stopListen() {
  listenGen += 1;
  listenPart = 0;
  if (ytPlayer && typeof ytPlayer.destroy === "function") {
    try {
      ytPlayer.destroy();
    } catch {
      /* the player node is already gone */
    }
  }
  ytPlayer = null;
  if (!els.listen) return;
  els.listen.hidden = true;
  els.listen.dataset.ids = "";
  if (els.listenParts) els.listenParts.innerHTML = "";
  if (els.listenBtn) els.listenBtn.textContent = "Слушать";
  resetListenHost();
}

function showListen(page) {
  stopListen();
  const ids = pageAudio(page);
  if (!ids.length || !els.listen) return;
  els.listen.hidden = false;
  els.listen.dataset.ids = ids.join(",");
  els.listenBtn.textContent = "Слушать";
  if (ids.length > 1) {
    els.listenParts.innerHTML = ids
      .map((_, i) => `<button type="button" class="listen-part" data-part="${i}">${i + 1}</button>`)
      .join("");
  }
}

function loadYouTubeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (ytReady) return ytReady;
  ytReady = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previous === "function") previous();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return ytReady;
}

function markListenPart(part) {
  listenPart = part;
  els.listenParts.querySelectorAll(".listen-part").forEach((btn) => {
    btn.classList.toggle("is-current", Number(btn.dataset.part) === part);
  });
}

function onListenState(event, gen) {
  if (gen !== listenGen || !window.YT) return;
  if (event.data === YT.PlayerState.PLAYING) els.listenBtn.textContent = "Пауза";
  if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.CUED) {
    els.listenBtn.textContent = "Слушать";
  }
  if (event.data === YT.PlayerState.ENDED) {
    const ids = (els.listen.dataset.ids || "").split(",").filter(Boolean);
    if (listenPart + 1 < ids.length) playListen(listenPart + 1);
    else els.listenBtn.textContent = "Слушать";
  }
}

async function playListen(part) {
  const ids = (els.listen.dataset.ids || "").split(",").filter(Boolean);
  if (!ids[part]) return;
  const gen = listenGen;
  markListenPart(part);
  await loadYouTubeApi();
  if (gen !== listenGen) return;
  if (!ytPlayer) {
    resetListenHost();
    ytPlayer = new YT.Player("listen-host", {
      videoId: ids[part],
      width: "448",
      height: "252",
      playerVars: { autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1 },
      events: { onStateChange: (event) => onListenState(event, gen) },
    });
  } else {
    ytPlayer.loadVideoById(ids[part]);
  }
}

function toggleListen() {
  if (!ytPlayer || typeof ytPlayer.getPlayerState !== "function") {
    playListen(listenPart || 0);
    return;
  }
  const code = ytPlayer.getPlayerState();
  if (code === YT.PlayerState.PLAYING) {
    ytPlayer.pauseVideo();
    return;
  }
  if (code === YT.PlayerState.PAUSED) {
    ytPlayer.playVideo();
    return;
  }
  playListen(listenPart || 0);
}

async function boot() {
  els.shelfBooks.forEach((button) => {
    button.addEventListener("click", () => openVolume(button.dataset.volume));
  });
  els.shelfSearch?.addEventListener("focus", () => {
    loadLibrary().catch(() => {});
  });
  els.shelfSearch?.addEventListener("input", () => {
    const query = normalizeQuery(els.shelfSearch.value);
    if (query.length >= 2) {
      els.coverScreen.scrollTop = 0;
      loadLibrary().then(() => renderShelfResults()).catch(() => showShelfError());
    }
    renderShelfResults();
  });
  els.shelfSearch?.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && els.shelfSearch.value) {
      e.preventDefault();
      els.shelfSearch.value = "";
      renderShelfResults();
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const first = els.shelfResults?.querySelector(".shelf-hit");
      if (first) openShelfHit(first);
    }
  });
  els.shelfResults?.addEventListener("click", (e) => {
    const btn = e.target.closest(".shelf-hit");
    if (btn) openShelfHit(btn);
  });
  els.coverHome.addEventListener("click", () => {
    if (state.volume) showBookCover();
    else showCover();
  });
  els.pagePrevs.forEach((el) => el.addEventListener("click", goPrev));
  els.pageNexts.forEach((el) => el.addEventListener("click", goNext));
  els.tocTop.addEventListener("click", showToc);
  els.tocBottom.addEventListener("click", showToc);
  els.listenBtn?.addEventListener("click", toggleListen);
  els.listenParts?.addEventListener("click", (e) => {
    const btn = e.target.closest(".listen-part");
    if (!btn) return;
    playListen(Number(btn.dataset.part));
  });
  document.addEventListener("keydown", (e) => {
    if (document.body.classList.contains("cover-open")) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.code === "ArrowLeft") goPrev();
    if (e.code === "ArrowRight") goNext();
  });
  window.addEventListener("hashchange", () => {
    route();
  });
  await route();
}

boot();
