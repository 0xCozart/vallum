import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import config from "../docs.config.mjs";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(appRoot, "../..");
const checkOnly = process.argv.includes("--check");
const outDir = checkOnly ? resolve(repoRoot, "tmp/agentrail/docs-site-check") : resolve(appRoot, "dist");

const allPages = config.sections.flatMap((section) =>
  section.pages.map((page) => ({
    ...page,
    section: section.label,
  })),
);
const sourceToSlug = new Map(allPages.map((page) => [normalize(page.source), page.slug]));

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function htmlToken(placeholders, html) {
  const token = `__AGENTRAIL_HTML_${placeholders.length}__`;
  placeholders.push([token, html]);
  return token;
}

function resolveHref(href, page) {
  const [rawPath, rawHash = ""] = href.split("#");
  const hash = rawHash ? `#${rawHash}` : "";

  if (/^(https?:|mailto:|#)/.test(href)) {
    return href;
  }

  if (rawPath.startsWith("docs/assets/")) {
    return `../assets/${rawPath.slice("docs/assets/".length)}${hash}`;
  }

  const sourceDir = dirname(page.source);
  const resolvedPath = normalize(rawPath.startsWith("docs/") ? rawPath : relative(repoRoot, resolve(repoRoot, sourceDir, rawPath)));
  const mappedSlug = sourceToSlug.get(resolvedPath);

  if (mappedSlug) {
    return `../${mappedSlug}/${hash}`;
  }

  return `${config.repositoryUrl}/blob/main/${resolvedPath}${hash}`;
}

function renderInline(value, page) {
  const placeholders = [];
  let output = value
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, href) =>
      htmlToken(
        placeholders,
        `<img src="${escapeHtml(resolveHref(href, page))}" alt="${escapeHtml(alt)}">`,
      ),
    )
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) =>
      htmlToken(
        placeholders,
        `<a href="${escapeHtml(resolveHref(href, page))}">${escapeHtml(label)}</a>`,
      ),
    )
    .replace(/`([^`]+)`/g, (_match, code) => htmlToken(placeholders, `<code>${escapeHtml(code)}</code>`))
    .replace(/\*\*([^*]+)\*\*/g, (_match, strong) =>
      htmlToken(placeholders, `<strong>${escapeHtml(strong)}</strong>`),
    );

  output = escapeHtml(output);

  for (const [token, html] of placeholders) {
    output = output.replaceAll(token, html);
  }

  return output;
}

function flushParagraph(blocks, paragraph, page) {
  if (paragraph.length > 0) {
    blocks.push(`<p>${renderInline(paragraph.join(" "), page)}</p>`);
    paragraph.length = 0;
  }
}

function flushList(blocks, listItems, page, listTag) {
  if (listItems.length > 0) {
    blocks.push(`<${listTag}>${listItems.map((item) => `<li>${renderInline(item, page)}</li>`).join("")}</${listTag}>`);
    listItems.length = 0;
  }
}

function tableCells(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableRow(line) {
  return /^\s*\|.+\|\s*$/.test(line);
}

function isTableSeparator(line) {
  return tableCells(line).every((cell) => /^:?-{3,}:?$/.test(cell));
}

function flushTable(blocks, tableLines, page) {
  if (tableLines.length === 0) {
    return;
  }

  const [headerLine, separatorLine, ...bodyLines] = tableLines;
  const validTable = tableLines.length >= 2 && isTableSeparator(separatorLine);

  if (!validTable) {
    for (const line of tableLines) {
      blocks.push(`<p>${renderInline(line, page)}</p>`);
    }
    tableLines.length = 0;
    return;
  }

  const header = tableCells(headerLine)
    .map((cell) => `<th>${renderInline(cell, page)}</th>`)
    .join("");
  const body = bodyLines
    .filter((line) => isTableRow(line))
    .map((line) => `<tr>${tableCells(line).map((cell) => `<td>${renderInline(cell, page)}</td>`).join("")}</tr>`)
    .join("");

  blocks.push(`<div class="table-wrap"><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></div>`);
  tableLines.length = 0;
}

function renderMarkdown(markdown, page) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  const paragraph = [];
  const listItems = [];
  const tableLines = [];
  let listTag = "ul";
  let codeFence = null;
  let codeLines = [];

  for (const line of lines) {
    const fence = line.match(/^```(\w+)?/);
    if (fence) {
      if (codeFence) {
        blocks.push(
          `<pre><code class="language-${escapeHtml(codeFence)}">${escapeHtml(codeLines.join("\n"))}</code></pre>`,
        );
        codeFence = null;
        codeLines = [];
      } else {
        flushParagraph(blocks, paragraph, page);
        flushList(blocks, listItems, page, listTag);
        flushTable(blocks, tableLines, page);
        codeFence = fence[1] || "text";
      }
      continue;
    }

    if (codeFence) {
      codeLines.push(line);
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph(blocks, paragraph, page);
      flushList(blocks, listItems, page, listTag);
      flushTable(blocks, tableLines, page);
      const level = heading[1].length;
      const text = heading[2].trim();
      const id = slugify(text);
      blocks.push(`<h${level} id="${id}">${renderInline(text, page)}</h${level}>`);
      continue;
    }

    const unorderedList = line.match(/^\s*[-*]\s+(.+)$/);
    if (unorderedList) {
      flushParagraph(blocks, paragraph, page);
      flushTable(blocks, tableLines, page);
      if (listTag !== "ul") flushList(blocks, listItems, page, listTag);
      listTag = "ul";
      listItems.push(unorderedList[1].trim());
      continue;
    }

    const orderedList = line.match(/^\s*\d+\.\s+(.+)$/);
    if (orderedList) {
      flushParagraph(blocks, paragraph, page);
      flushTable(blocks, tableLines, page);
      if (listTag !== "ol") flushList(blocks, listItems, page, listTag);
      listTag = "ol";
      listItems.push(orderedList[1].trim());
      continue;
    }

    if (isTableRow(line)) {
      flushParagraph(blocks, paragraph, page);
      flushList(blocks, listItems, page, listTag);
      tableLines.push(line);
      continue;
    }

    if (line.trim() === "") {
      flushParagraph(blocks, paragraph, page);
      flushList(blocks, listItems, page, listTag);
      flushTable(blocks, tableLines, page);
      continue;
    }

    if (line.startsWith("> ")) {
      flushParagraph(blocks, paragraph, page);
      flushList(blocks, listItems, page, listTag);
      flushTable(blocks, tableLines, page);
      blocks.push(`<blockquote>${renderInline(line.slice(2).trim(), page)}</blockquote>`);
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph(blocks, paragraph, page);
  flushList(blocks, listItems, page, listTag);
  flushTable(blocks, tableLines, page);

  return blocks.join("\n");
}

function navHtml(currentSlug, basePath) {
  return config.sections
    .map((section) => {
      const links = section.pages
        .map((page) => {
          const href = `${basePath}${page.slug}/`;
          const active = page.slug === currentSlug ? " active" : "";
          return `<a class="nav-link${active}" href="${href}">${escapeHtml(page.title)}</a>`;
        })
        .join("");
      return `<section class="nav-section"><h2>${escapeHtml(section.label)}</h2>${links}</section>`;
    })
    .join("");
}

function pageCards() {
  return config.sections
    .map((section) => {
      const cards = section.pages
        .map((page) => {
          const href = `./${page.slug}/`;
          return `<a class="doc-card" href="${href}">
            <span>${escapeHtml(section.label)}</span>
            <strong>${escapeHtml(page.title)}</strong>
            <p>${escapeHtml(page.description)}</p>
          </a>`;
        })
        .join("");
      return `<section class="doc-group"><h2>${escapeHtml(section.label)}</h2><div class="doc-grid">${cards}</div></section>`;
    })
    .join("");
}

function themeInitScript() {
  return `<script>
(() => {
  const key = "agentrail-docs-theme";
  const root = document.documentElement;
  let stored = null;
  try {
    stored = window.localStorage.getItem(key);
  } catch (_error) {}
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = stored === "light" || stored === "dark" ? stored : prefersDark ? "dark" : "light";
})();
</script>`;
}

function themeRuntimeScript() {
  return `<script>
(() => {
  const key = "agentrail-docs-theme";
  const root = document.documentElement;
  const toggle = document.querySelector("[data-theme-toggle]");
  const label = document.querySelector("[data-theme-label]");
  const media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function getStoredTheme() {
    try {
      const stored = window.localStorage.getItem(key);
      return stored === "light" || stored === "dark" ? stored : null;
    } catch (_error) {
      return null;
    }
  }

  function setStoredTheme(theme) {
    try {
      window.localStorage.setItem(key, theme);
    } catch (_error) {}
  }

  function preferredTheme() {
    return getStoredTheme() || (media && media.matches ? "dark" : "light");
  }

  function applyTheme(theme) {
    const isDark = theme === "dark";
    root.dataset.theme = theme;
    root.style.colorScheme = theme;

    if (toggle) {
      toggle.setAttribute("aria-pressed", String(isDark));
      toggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
      toggle.title = isDark ? "Switch to light mode" : "Switch to dark mode";
    }

    if (label) {
      label.textContent = isDark ? "Dark" : "Light";
    }
  }

  applyTheme(preferredTheme());

  if (toggle) {
    toggle.addEventListener("click", () => {
      const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
      setStoredTheme(nextTheme);
      applyTheme(nextTheme);
    });
  }

  if (media) {
    const syncSystemTheme = () => {
      if (!getStoredTheme()) applyTheme(preferredTheme());
    };
    if (media.addEventListener) media.addEventListener("change", syncSystemTheme);
    else if (media.addListener) media.addListener(syncSystemTheme);
  }
})();
</script>`;
}

function shell({ page, content, isIndex = false }) {
  const title = isIndex ? config.title : `${page.title} | ${config.title}`;
  const source = page ? relative(repoRoot, resolve(repoRoot, page.source)) : null;
  const description = page?.description ?? config.description;
  const basePath = isIndex ? "./" : "../";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${escapeHtml(description)}">
    <title>${escapeHtml(title)}</title>
    ${themeInitScript()}
    <link rel="stylesheet" href="${basePath}styles.css">
  </head>
  <body>
    <div class="site-shell">
      <aside class="sidebar">
        <a class="brand" href="${basePath}">
          <span class="brand-mark">GK</span>
          <span>
            <strong>AgentRail</strong>
            <small>Self-hosted gas sponsorship toolkit</small>
          </span>
        </a>
        <nav aria-label="Documentation navigation">
          ${navHtml(page?.slug ?? "overview", basePath)}
        </nav>
      </aside>
      <main class="content">
        <header class="topbar">
          <button class="theme-toggle" type="button" data-theme-toggle aria-label="Toggle dark mode" aria-pressed="false" title="Toggle dark mode">
            <span class="theme-toggle-track" aria-hidden="true"><span class="theme-toggle-thumb"></span></span>
            <span data-theme-label>Light</span>
          </button>
          <a href="${escapeHtml(config.repositoryUrl)}">GitHub</a>
          <a href="${basePath}best-practices/">Best practices</a>
          <a href="${basePath}quickstart/">Quickstart</a>
        </header>
        ${
          isIndex
            ? `<section class="hero">
                <p class="hero-label">Open-source operator docs</p>
                <h1>${escapeHtml(config.title)}</h1>
                <p>${escapeHtml(config.description)}</p>
                <div class="hero-actions">
                  <a class="primary-action" href="./concepts/">Start with basics</a>
                  <a class="secondary-action" href="./examples/">Use code examples</a>
                </div>
              </section>
              ${pageCards()}`
            : `<article class="doc-article">
                <div class="doc-meta">
                  <span>${escapeHtml(page.section)}</span>
                  <a href="${escapeHtml(`${config.repositoryUrl}/blob/main/${source}`)}">${escapeHtml(source)}</a>
                </div>
                ${content}
              </article>`
        }
      </main>
    </div>
    ${themeRuntimeScript()}
  </body>
</html>`;
}

async function build() {
  for (const page of allPages) {
    await readFile(resolve(repoRoot, page.source), "utf8");
  }

  await rm(outDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  await mkdir(outDir, { recursive: true });

  const css = await readFile(resolve(appRoot, "src/styles.css"), "utf8");
  await writeFile(resolve(outDir, "styles.css"), css);
  await cp(resolve(repoRoot, "docs/assets"), resolve(outDir, "assets"), { recursive: true });
  await writeFile(resolve(outDir, "index.html"), shell({ isIndex: true }));

  for (const page of allPages) {
    const markdown = await readFile(resolve(repoRoot, page.source), "utf8");
    const pageDir = resolve(outDir, page.slug);
    await mkdir(pageDir, { recursive: true });
    await writeFile(resolve(pageDir, "index.html"), shell({ page, content: renderMarkdown(markdown, page) }));
  }

  const manifest = {
    title: config.title,
    pages: allPages.map(({ title, slug, source, section }) => ({ title, slug, source, section })),
  };
  await writeFile(resolve(outDir, "docs-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  if (checkOnly) {
    const overview = await readFile(resolve(outDir, "overview/index.html"), "utf8");
    const bestPractices = await readFile(resolve(outDir, "best-practices/index.html"), "utf8");
    const deployment = await readFile(resolve(outDir, "deployment/index.html"), "utf8");
    const examples = await readFile(resolve(outDir, "examples/index.html"), "utf8");

    if (overview.includes("!<a ")) {
      throw new Error("Docs check failed: Markdown images rendered as broken text links.");
    }
    if (!overview.includes("<table>")) {
      throw new Error("Docs check failed: overview status matrix did not render as a table.");
    }
    if (!bestPractices.includes("<ol>")) {
      throw new Error("Docs check failed: ordered best-practice steps did not render as an ordered list.");
    }
    if (!deployment.includes("<table>")) {
      throw new Error("Docs check failed: live testnet deployment checkpoints did not render as a table.");
    }
    if (!examples.includes("createAgentRailClient") || !examples.includes("fetch(&quot;/api/agentrail/reserve&quot;")) {
      throw new Error("Docs check failed: code examples page did not render expected SDK and browser examples.");
    }
    if (!overview.includes("data-theme-toggle") || !overview.includes("agentrail-docs-theme")) {
      throw new Error("Docs check failed: theme toggle did not render into generated pages.");
    }
  }
}

await build();

if (checkOnly) {
  const generated = allPages.length + 1;
  console.log(`Docs site check passed: generated ${generated} HTML pages from ${allPages.length} Markdown sources.`);
} else {
  console.log(`Docs site built at ${relative(repoRoot, outDir)}.`);
}
