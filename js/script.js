/* ============================================================
   Federica Sorba — portfolio SPA
   Loads projects.json, renders home / detail / works / info
   with lightweight hash routing. Works on desktop & mobile.
   ============================================================ */

(function () {
  "use strict";

  var DATA = null;
  var app = document.getElementById("app");
  var nav = document.querySelector(".nav");
  var navToggle = document.getElementById("navToggle");

  /* ----- helpers ----- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  // A work is "selected" (homepage + Selected Works group) when selected:true.
  // Legacy: indexType:"selected" still counts, so old data keeps working.
  function isSelected(p) { return p.selected === true || p.indexType === "selected"; }
  function orderIndex(p) { return p.index == null || p.index === "" ? Infinity : Number(p.index); }
  function yearNum(p) { var m = String(p.year == null ? "" : p.year).match(/\d{4}/); return m ? parseInt(m[0], 10) : -Infinity; }

  // selected works ordered by their `index` (1, 2, 3…); unindexed ones keep file order at the end
  function selected() {
    return DATA.projects.filter(isSelected).slice().sort(function (a, b) { return orderIndex(a) - orderIndex(b); });
  }
  function byId(id) {
    return DATA.projects.filter(function (p) { return p.id === id; })[0];
  }
  // Group every work by its category (indexType), each group sorted newest → oldest by year.
  // "selected" is a flag, not a category, so it is skipped here.
  function groupOthers() {
    var groups = {};
    DATA.projects.forEach(function (p) {
      var cat = p.indexType;
      if (!cat || cat === "selected") return;
      (groups[cat] = groups[cat] || []).push(p);
    });
    Object.keys(groups).forEach(function (k) {
      groups[k].sort(function (a, b) { return yearNum(b) - yearNum(a); });
    });
    return groups;
  }
  function titleCase(s) {
    return s.replace(/\w\S*/g, function (t) { return t.charAt(0).toUpperCase() + t.slice(1); });
  }
  function closeMenu() { nav.classList.remove("is-open"); }

  /* Turn a YouTube / Google Drive / Vimeo link into an embeddable src.
     Accepts full URLs, share links, or an already-embed URL. */
  function toEmbed(url) {
    var u = String(url == null ? "" : url).trim();
    if (!u) return "";
    var m;
    // YouTube: watch?v=, youtu.be/, /embed/, /shorts/, /v/
    m = u.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/|live\/)|youtu\.be\/)([\w-]{11})/);
    if (m) return "https://www.youtube.com/embed/" + m[1];
    // Google Drive: /file/d/ID/..., open?id=ID, uc?id=ID
    m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:.*&)?id=)([\w-]+)/);
    if (m) return "https://drive.google.com/file/d/" + m[1] + "/preview";
    // Vimeo
    m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (m) return "https://player.vimeo.com/video/" + m[1];
    // already an embed / direct file — use as-is
    return u;
  }

  /* ---- gallery image helpers (shared by project galleries + markdown image blocks) ----
     An image entry is a "path" string or { src, credit, full, alt }. */
  function normImg(x) { return typeof x === "string" ? { src: x } : (x || {}); }
  function galMedia(im) {
    var src = im.src || im.image || "";
    if (/\.(mp4|webm|ogg|mov)$/i.test(src))
      return '<video src="' + esc(src) + '" controls playsinline preload="metadata"></video>';
    return '<img src="' + esc(src) + '" alt="' + esc(im.alt || "") + '" loading="lazy"/>';
  }
  function galFig(im) {
    return '<figure class="detail__fig">' + galMedia(im) +
      (im.credit ? '<figcaption class="detail__credit">' + esc(im.credit) + "</figcaption>" : "") + "</figure>";
  }
  function isFull(im) { return im.full === true || im.fullscreen === true || im.fullwidth === true; }
  // Lay out a list of images: pairs become 2-up rows, singles/`full` span the page.
  function imageGroup(list) {
    var html = "", pend = null;
    list.forEach(function (im) {
      if (isFull(im)) {
        if (pend) { html += '<div class="detail__full">' + galFig(pend) + "</div>"; pend = null; }
        html += '<div class="detail__full">' + galFig(im) + "</div>";
      } else if (pend) {
        html += '<div class="row">' + galFig(pend) + galFig(im) + "</div>";
        pend = null;
      } else { pend = im; }
    });
    if (pend) html += '<div class="detail__full">' + galFig(pend) + "</div>";
    return html;
  }

  /* ---- minimal Markdown -> HTML (paragraphs, headings, lists, bold/italic,
     links, inline code, and image blocks that interleave with the text). ---- */
  function mdInline(s) {
    return s
      // links — link text may itself contain one level of [brackets], e.g. [[2026] Title](url)
      .replace(/\[((?:[^\[\]]|\[[^\]]*\])+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/_([^_]+)_/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  }
  function mdToHtml(md) {
    var text = esc(String(md == null ? "" : md)).replace(/\r\n/g, "\n").trim();
    if (!text) return "";
    return text.split(/\n{2,}/).map(function (block) {
      block = block.replace(/\s+$/, "");
      if (!block.trim()) return "";
      // image block: every line is ![credit](src) -> lay out as a gallery group
      var imgRe = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;
      var lines = block.split(/\n/).map(function (l) { return l.trim(); }).filter(Boolean);
      if (lines.length && lines.every(function (l) { return imgRe.test(l); })) {
        return imageGroup(lines.map(function (l) { var m = l.match(imgRe); return { src: m[2], credit: m[1] }; }));
      }
      var h = block.match(/^(#{1,6})\s+([\s\S]*)$/);
      if (h) { var lvl = Math.min(h[1].length + 2, 6); return "<h" + lvl + ">" + mdInline(h[2]) + "</h" + lvl + ">"; }
      if (/^\s*[-*]\s+/.test(block)) {
        return "<ul>" + block.split(/\n/).filter(function (l) { return l.trim(); })
          .map(function (li) { return "<li>" + mdInline(li.replace(/^\s*[-*]\s+/, "")) + "</li>"; }).join("") + "</ul>";
      }
      if (/^\s*\d+\.\s+/.test(block)) {
        return "<ol>" + block.split(/\n/).filter(function (l) { return l.trim(); })
          .map(function (li) { return "<li>" + mdInline(li.replace(/^\s*\d+\.\s+/, "")) + "</li>"; }).join("") + "</ol>";
      }
      // per-paragraph style directive: "{right small} text…" -> <p class="md-right md-small">
      var cls = "";
      var dm = block.match(/^\{([^}]*)\}[ \t]*\n?/);
      if (dm) {
        cls = dm[1].trim().split(/\s+/).filter(Boolean)
          .map(function (t) { return "md-" + t.toLowerCase().replace(/[^a-z0-9-]/g, ""); }).join(" ");
        block = block.slice(dm[0].length);
      }
      return "<p" + (cls ? ' class="' + cls + '"' : "") + ">" + mdInline(block).replace(/\n/g, "<br/>") + "</p>";
    }).join("");
  }

  /* Any element with [data-md] gets its Markdown file fetched and rendered.
     The JSON text already inside it stays as the fallback if the fetch fails. */
  function hydrateMarkdown(root) {
    var nodes = root.querySelectorAll("[data-md]");
    Array.prototype.forEach.call(nodes, function (el) {
      var path = el.getAttribute("data-md");
      if (!path) return;
      fetch(path, { cache: "no-cache" })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then(function (txt) {
          var html = mdToHtml(txt);
          if (html) { el.innerHTML = html; el.classList.add("is-md"); }
        })
        .catch(function () { /* keep the JSON fallback already in the element */ });
    });
  }

  /* ---- Calendar: parse date-led lines into sections split by Upcoming / Past ----
     Lines beginning with a date (YYYY, YYYY/MM, YYYY/MM/DD) or a range
     "date • date" are events; any other line is a section header. */
  function renderCalendar(md) {
    var lines = String(md || "").split("\n");
    var sections = [];
    var cur = { title: "", events: [] };
    var parseDate = function (str) {
      var p = str.split(/[.\/-]/);
      return new Date(+p[0], p[1] ? +p[1] - 1 : 0, p[2] ? +p[2] : 1);
    };
    var endOf = function (str) {
      var p = str.split(/[.\/-]/), y = +p[0], m = p[1] ? +p[1] - 1 : 0, d = p[2] ? +p[2] : 1;
      var dt = new Date(y, m, d);
      if (p.length === 1) dt.setFullYear(y + 1);
      else if (p.length === 2) dt.setMonth(m + 1);
      else dt.setDate(d + 1);
      return dt;
    };
    var datePart = "\\d{4}(?:[.\\/-]\\d{1,2})?(?:[.\\/-]\\d{1,2})?";
    var rangeRe = new RegExp("^\\s*(" + datePart + ")\\s*[\\-•]\\s*(" + datePart + ")");
    var singleRe = new RegExp("^\\s*(" + datePart + ")");

    lines.forEach(function (line) {
      if (!line.trim()) return;
      var dateObj = null, effEnd = null, dateStr = "", content = line;
      var rm = line.match(rangeRe), sm = line.match(singleRe);
      if (rm) { dateStr = rm[0].trim(); dateObj = parseDate(rm[1]); effEnd = endOf(rm[2]); content = content.replace(rm[0], ""); }
      else if (sm) { dateStr = sm[0].trim(); dateObj = parseDate(sm[1]); effEnd = endOf(sm[1]); content = content.replace(sm[0], ""); }

      if (dateObj) {
        content = content.replace(/^[*\-]\s+/, "").trim().replace(/^[,.\-|]\s+/, "").trim();
        cur.events.push({ date: dateObj, effectiveEnd: effEnd, dateStr: dateStr, markdown: content });
      } else {
        if (cur.title || cur.events.length) sections.push(cur);
        cur = { title: line.trim().replace(/^\*\*|\*\*$/g, ""), events: [] };
      }
    });
    if (cur.title || cur.events.length) sections.push(cur);

    var now = new Date();
    var list = function (arr) {
      return '<ul class="cal__list">' + arr.map(function (e) {
        return '<li><span class="cal__date">' + esc(e.dateStr) + '</span>' +
               '<span class="cal__event">' + mdInline(esc(e.markdown)) + '</span></li>';
      }).join("") + "</ul>";
    };
    var html = "";
    sections.forEach(function (sec) {
      var up = sec.events.filter(function (e) { return e.effectiveEnd > now; }).sort(function (a, b) { return a.date - b.date; });
      var past = sec.events.filter(function (e) { return e.effectiveEnd <= now; }).sort(function (a, b) { return b.date - a.date; });
      if (!up.length && !past.length) return;
      if (sec.title) html += '<h3 class="cal__section">' + esc(sec.title) + "</h3>";
      if (up.length) html += '<h4 class="cal__sub">Upcoming</h4>' + list(up);
      if (past.length) html += '<h4 class="cal__sub">Past</h4>' + list(past);
    });
    return html || mdToHtml(md);
  }

  /* ---- Press: each line is a raw <a> link; **bold** lines become sub-headers ---- */
  function renderPress(md) {
    var lines = String(md || "").split("\n");
    var html = "", inList = false;
    lines.forEach(function (line) {
      line = line.trim();
      if (!line) return;
      if (line.slice(0, 2) === "**" && line.slice(-2) === "**") {
        if (inList) { html += "</ul>"; inList = false; }
        html += '<h3 class="press__cat">' + esc(line.replace(/\*\*/g, "")) + "</h3>";
      } else {
        if (!inList) { html += '<ul class="press__list">'; inList = true; }
        var content = line.replace(/^[*\-]\s+/, "").trim();  // raw <a> HTML from the file
        // pull a leading [YEAR] out of the link text into its own date column
        var year = "";
        content = content.replace(/(<a\b[^>]*>)?\s*\[(\d{4})\]\s*/, function (m, tag, y) { year = y; return tag || ""; });
        html += '<li><span class="press__date">' + esc(year) + '</span>' +
                '<span class="press__event">' + content + '</span></li>';
      }
    });
    if (inList) html += "</ul>";
    return html;
  }

  /* ---- CV: rendered from a JSON file (timeline + sections + toolkit + pdf) ---- */
  function renderCV(cv) {
    cv = cv || {};
    var raw = function (v) { return v == null ? "" : String(v); };  // keep <br> etc.

    var tl = cv.timeline || [];
    var cell = function (main, sub) {
      return '<div class="tl-cell' + (main ? " tl-filled" : "") + '">' +
        (main ? "<b>" + raw(main) + "</b>" : "") +
        (sub ? "<span>" + raw(sub) + "</span>" : "") + "</div>";
    };
    var timeline = tl.length ? (
      '<div class="cv-tl-wrap"><div class="cv-tl">' +
        '<div class="cv-tl-above">' + tl.map(function (t) { return cell(t.above, t.aboveSub); }).join("") + "</div>" +
        '<div class="cv-tl-axis">' + tl.map(function (t) { return '<div class="tl-yr">' + esc(t.year) + "</div>"; }).join("") + "</div>" +
        '<div class="cv-tl-below">' + tl.map(function (t) { return cell(t.below, t.belowSub); }).join("") + "</div>" +
      "</div></div>"
    ) : "";

    var entries = function (arr) {
      return (arr || []).map(function (e) {
        return '<div class="cv__entry">' +
          '<div class="cv__entry-top"><span class="cv__entry-title">' + esc(e.title) + "</span>" +
          (e.date ? '<span class="cv__entry-date">' + esc(e.date) + "</span>" : "") + "</div>" +
          (e.sub ? '<div class="cv__entry-sub">' + esc(e.sub) + "</div>" : "") +
        "</div>";
      }).join("");
    };
    var pubs = (cv.publications || []).map(function (p) {
      return '<div class="cv__entry"><div class="cv__entry-title">' + esc(p.title) + "</div>" +
        (p.description ? '<div class="cv__entry-sub">' + esc(p.description) + "</div>" : "") +
        (p.venue ? '<div class="cv__entry-venue">' + esc(p.venue) + "</div>" : "") + "</div>";
    }).join("");
    var toolkit = "";
    if (cv.toolkit) {
      toolkit = '<dl class="cv__toolkit">' + Object.keys(cv.toolkit).map(function (k) {
        return "<dt>" + esc(k) + "</dt><dd>" + esc(cv.toolkit[k]) + "</dd>";
      }).join("") + "</dl>";
    }
    var block = function (title, body) { return body ? '<div class="cv__block"><h3 class="cv__block-title">' + title + "</h3>" + body + "</div>" : ""; };

    return (
      timeline +
      '<div class="cv__cols">' +
        block("Education", entries(cv.education)) +
        block("Experience", entries(cv.experience)) +
        block("Publications", pubs) +
        block("Toolkit", toolkit) +
      "</div>"
    );
  }

  // Load calendar / press / cv files and render them; attach link previews for press.
  function hydrateSections(root) {
    Array.prototype.forEach.call(root.querySelectorAll("[data-cv]"), function (el) {
      fetch(el.getAttribute("data-cv"), { cache: "no-cache" })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (data) { el.innerHTML = renderCV(data); })
        .catch(function () { el.innerHTML = ""; });
    });
    Array.prototype.forEach.call(root.querySelectorAll("[data-calendar]"), function (el) {
      fetch(el.getAttribute("data-calendar"), { cache: "no-cache" })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then(function (t) { el.innerHTML = renderCalendar(t); })
        .catch(function () { el.innerHTML = ""; });
    });
    Array.prototype.forEach.call(root.querySelectorAll("[data-press]"), function (el) {
      fetch(el.getAttribute("data-press"), { cache: "no-cache" })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then(function (t) { el.innerHTML = renderPress(t); attachPreviews(el); })
        .catch(function () { el.innerHTML = ""; });
    });
  }

  // Hover a press link -> show a screenshot preview of the target page.
  function attachPreviews(scope) {
    var links = scope.querySelectorAll("a");
    if (!links.length) return;
    var popup = document.getElementById("preview-popup");
    if (!popup) {
      popup = document.createElement("div");
      popup.id = "preview-popup";
      popup.appendChild(document.createElement("img"));
      document.body.appendChild(popup);
    }
    var img = popup.querySelector("img");
    Array.prototype.forEach.call(links, function (link) {
      link.addEventListener("mouseenter", function () {
        img.src = "https://api.microlink.io/?url=" + encodeURIComponent(link.href) +
                  "&screenshot=true&meta=false&embed=screenshot.url";
        popup.style.display = "block";
      });
      link.addEventListener("mousemove", function (e) {
        popup.style.left = (e.clientX + 18) + "px";
        popup.style.top = Math.min(e.clientY + 18, window.innerHeight - 200) + "px";
      });
      link.addEventListener("mouseleave", function () {
        popup.style.display = "none";
        img.src = "";
      });
    });
  }

  function videoBlock(url, title) {
    var src = toEmbed(url);
    if (!src) return "";
    return (
      '<div class="detail__video">' +
        '<iframe src="' + esc(src) + '" title="' + esc(title || "Video") + '" ' +
        'frameborder="0" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" ' +
        'allowfullscreen loading="lazy"></iframe>' +
      '</div>'
    );
  }

  /* ----- views ----- */
  function viewHome() {
    var pr = DATA.profile || {};
    var items = selected().map(function (p) {
      return (
        '<article class="home__item">' +
          '<div class="home__sticky">' +
            '<span class="home__sticky-title">' + esc(p.title) + '</span>' +
            '<span class="home__sticky-cat">' + esc((p.medium || "").toUpperCase()) + '</span>' +
          '</div>' +
          '<a class="home__media" href="#/project/' + p.id + '" data-link>' +
            '<img src="' + esc(p.cover) + '" alt="' + esc(p.title) + '" loading="lazy" />' +
            '<span class="home__view">View →</span>' +
          '</a>' +
        '</article>'
      );
    }).join("");

    var intro =
      '<aside class="home__intro">' +
        '<div class="home__intro-bio"' + (pr.bioFile ? ' data-md="' + esc(pr.bioFile) + '"' : "") + '>' +
          (pr.bio ? '<p>' + esc(pr.bio) + '</p>' : "") +
        '</div>' +
        '<div class="home__intro-contact">' +
          (pr.cv ? '<a href="' + esc(pr.cv) + '" target="_blank" rel="noopener">CV</a>' : '') +
          (pr.email ? '<a href="mailto:' + esc(pr.email) + '">' + esc(pr.email) + '</a>' : '') +
          (pr.instagramHandle ? '<a href="' + esc(pr.instagram || "#") + '" target="_blank" rel="noopener">' + esc(pr.instagramHandle) + '</a>' : '') +
        '</div>' +
      '</aside>';

    return '<section class="view home">' + intro + '<div class="home__stack">' + items + '</div></section>';
  }

  function viewProject(id) {
    var p = byId(id);
    if (!p) return viewMissing();
    var sel = selected();
    var idx = -1;
    for (var i = 0; i < sel.length; i++) { if (sel[i].id === id) idx = i; }
    var prev = idx > 0 ? sel[idx - 1] : null;
    var next = idx >= 0 && idx < sel.length - 1 ? sel[idx + 1] : null;

    // videos: accept a single `video` string or a `videos` array
    var vids = [];
    if (p.videos && p.videos.length) vids = p.videos;
    else if (p.video) vids = [p.video];
    var videos = vids.map(function (v) { return videoBlock(v, p.title); }).join("");

    // gallery from the `images` array (used when the description .md has no inline images).
    // Each entry is a "path" string or { src, credit, full }.
    var imgs = (p.images || []).map(normImg).filter(function (im) { return im.src || im.image; });
    var gallery = imageGroup(imgs);

    // meta: only render fields that are filled in (empty ones are dropped)
    var metaItems = [];
    var addMeta = function (label, value, isHtml) {
      if (value) metaItems.push("<div><dt>" + esc(label) + "</dt><dd>" + (isHtml ? value : esc(value)) + "</dd></div>");
    };
    addMeta("Medium", p.medium);
    // Role: break onto a new line at "@" (e.g. "Graphic Designer @ Studio")
    addMeta("Role", p.role ? esc(p.role).replace(/\s*@/g, "<br>@") : "", true);
    addMeta("Year", p.year);
    addMeta("Deliverables", p.deliverables);
    var clientName = p.client || p.agency;          // `client` (or legacy `agency`)
    if (clientName) {
      var clientUrl = p.clientUrl || p.agencyUrl;
      var client = clientUrl
        ? '<a href="' + esc(clientUrl) + '" target="_blank" rel="noopener">' + esc(clientName) + "</a>"
        : esc(clientName);
      addMeta(p.clientLabel || "Client", client, true);
    }
    var metaHtml = metaItems.length ? '<dl class="detail__meta">' + metaItems.join("") + "</dl>" : "";

    return (
      '<article class="view detail">' +
        '<h1 class="detail__head">' + esc(p.title) + '<em>' + esc(p.subtitle || "") + '</em></h1>' +
        metaHtml +
        '<div class="detail__desc"' + (p.descriptionFile ? ' data-md="' + esc(p.descriptionFile) + '"' : "") + '>' +
          (p.description ? '<p>' + esc(p.description) + '</p>' : "") +
        '</div>' +
        (videos ? '<div class="detail__videos">' + videos + '</div>' : '') +
        '<div class="detail__gallery">' + gallery + '</div>' +
        '<div class="detail__nav">' +
          (prev ? '<a href="#/project/' + prev.id + '" data-link>← ' + esc(prev.title) + '</a>' : '<span class="disabled">←</span>') + ' ' +
          (next ? '<a href="#/project/' + next.id + '" data-link>' + esc(next.title) + ' →</a>' : '<span class="disabled">→</span>') +
        '</div>' +
      '</article>'
    );
  }

  function worksCard(p) {
    var thumb = p.cover || (p.images && p.images[0]) || "";
    return (
      '<a class="card" href="#/project/' + p.id + '" data-link>' +
        '<div class="card__media"><img src="' + esc(thumb) + '" alt="' + esc(p.title) + '" loading="lazy" />' +
          '<span class="card__view">View →</span>' +
        '</div>' +
        '<div class="card__info">' +
          '<span class="card__title">' + esc(p.title) +
            (p.subtitle ? '<small>' + esc(p.subtitle) + '</small>' : '') +
          '</span>' +
          '<span class="card__meta">' + esc(p.medium || "") + (p.year ? ' — ' + esc(p.year) : '') + '</span>' +
        '</div>' +
      '</a>'
    );
  }
  function worksGroup(title, list) {
    if (!list.length) return "";
    return (
      '<div class="works__group">' +
        '<h2>' + esc(title) + '<sup>' + list.length + '</sup></h2>' +
        '<div class="works__grid">' + list.map(worksCard).join("") + '</div>' +
      '</div>'
    );
  }

  function viewWorks() {
    var groups = groupOthers();
    var html = "";
    Object.keys(groups).forEach(function (key) { html += worksGroup(titleCase(key), groups[key]); });
    return '<section class="view works">' + (html || '<p>No works yet.</p>') + '</section>';
  }

  // a titled section whose body is filled by a hydrator (data-* attribute)
  function infoSection(title, attr, file) {
    if (!file) return "";
    return (
      '<section class="info__section">' +
        '<h2 class="info__section-title">' + esc(title) + '</h2>' +
        '<div class="info__md" ' + attr + '="' + esc(file) + '"></div>' +
      '</section>'
    );
  }

  function viewInfo() {
    var pr = DATA.profile || {};
    // profile portrait if provided, otherwise fall back to a project cover
    var portrait = pr.infoImage || (selected()[0] || DATA.projects[0] || {}).cover || "";
    return (
      '<section class="view info">' +
        '<div class="info__hero">' +
          '<div class="info__media"><img src="' + esc(portrait) + '" alt="' + esc(pr.name || "") + '" /></div>' +
          '<div class="info__intro">' +
            '<div class="info__bio"' + (pr.bioFile ? ' data-md="' + esc(pr.bioFile) + '"' : "") + '>' +
              (pr.bio ? '<p>' + esc(pr.bio) + '</p>' : "") +
            '</div>' +
            '<div class="info__contact">' +
              (pr.cv ? '<a href="' + esc(pr.cv) + '" target="_blank" rel="noopener">CV</a>' : '') +
              (pr.email ? '<a href="mailto:' + esc(pr.email) + '">' + esc(pr.email) + '</a>' : '') +
              (pr.instagramHandle ? '<a href="' + esc(pr.instagram || "#") + '" target="_blank" rel="noopener">' + esc(pr.instagramHandle) + '</a>' : '') +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="info__stack">' +
          (pr.cvFile ? '<section class="info__section cv"><h2 class="info__section-title">Curriculum Vitae</h2><div class="cv__body" data-cv="' + esc(pr.cvFile) + '"></div></section>' : "") +
          infoSection("Agenda", "data-calendar", pr.calendarFile) +
          infoSection("Press", "data-press", pr.pressFile) +
        '</div>' +
      '</section>'
    );
  }

  function viewMissing() {
    return '<section class="view works"><p>Page not found. <a href="#/" data-link>Back to index →</a></p></section>';
  }

  /* ----- router ----- */
  function parse() {
    var h = (location.hash || "#/").replace(/^#/, "");
    var parts = h.split("/").filter(Boolean); // ["project","id"] etc.
    return parts;
  }

  function render() {
    if (!DATA) return;
    var parts = parse();
    var html, route = parts[0] || "";

    if (route === "project" && parts[1]) { html = viewProject(parts[1]); }
    else if (route === "works") { html = viewWorks(); }
    else if (route === "info") { html = viewInfo(); }
    else { html = viewHome(); }

    app.innerHTML = html;
    hydrateMarkdown(app);
    hydrateSections(app);
    setActive(route);
    closeMenu();
    window.scrollTo(0, 0);
  }

  function setActive(route) {
    var links = document.querySelectorAll(".nav__links a");
    links.forEach(function (a) {
      var href = a.getAttribute("href") || "";
      var isSel = href === "#/" && (route === "" || route === "project");
      var isWorks = href === "#/works" && route === "works";
      var isInfo = href === "#/info" && route === "info";
      a.classList.toggle("is-active", isSel || isWorks || isInfo);
    });
  }

  /* ----- boot ----- */
  function fillChrome() {
    var pr = DATA.profile || {};
    document.getElementById("navCount").textContent = selected().length;
    var ig = document.getElementById("navIg"), li = document.getElementById("navLi");
    if (pr.instagram) ig.href = pr.instagram;
    if (pr.linkedin) li.href = pr.linkedin;
    document.querySelector(".nav__brand").textContent = (pr.name || "").toUpperCase();
    document.title = pr.name || "Portfolio";
    document.getElementById("year").textContent = new Date().getFullYear();
  }

  function init(data) {
    DATA = data;
    fillChrome();
    render();
  }

  navToggle.addEventListener("click", function () { nav.classList.toggle("is-open"); });
  window.addEventListener("hashchange", render);

  // Load content. Falls back to an embedded copy if fetch is blocked (file://).
  fetch("js/projects.json", { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(init)
    .catch(function () {
      if (window.PROJECTS_DATA) { init(window.PROJECTS_DATA); return; }
      app.innerHTML =
        '<div class="loading">Could not load projects.json.<br/>' +
        'Run a local server (e.g. <code>python3 -m http.server</code>) or deploy the site, then reload.</div>';
    });
})();
