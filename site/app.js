"use strict";
(() => {
  // src/core/GuidefInspection.ts
  var numeric = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
  function rectFrom(value, line) {
    const parts = value.trim().split(/\s+/);
    if (parts.length !== 4 || parts.some((p) => !numeric.test(p))) return null;
    const coords = parts.map(Number);
    if (coords.some((n) => !Number.isFinite(n))) return null;
    return { x: coords[0], y: coords[1], width: coords[2], height: coords[3], line };
  }
  function inspectGuidef(source2) {
    const lines = [];
    const blocks = [];
    const diagnostics2 = [];
    const stack = [];
    const sourceLines = source2.split(/\r\n|\n|\r/);
    for (let i = 0; i < sourceLines.length; i++) {
      const number = i + 1;
      const raw = sourceLines[i];
      const trimmed = raw.trim();
      const current = stack.length ? stack[stack.length - 1] : null;
      let kind = "opaque";
      let lineBlock = current;
      if (trimmed.length === 0) kind = "blank";
      else if (trimmed.startsWith("#")) kind = "comment";
      else if (/^![A-Za-z_][A-Za-z_0-9]*(?:\s|$)/.test(trimmed)) {
        kind = "directive";
        if (/^!include(?:\s|$)/i.test(trimmed)) {
          diagnostics2.push({
            line: number,
            severity: "info",
            code: "INCLUDE_UNRESOLVED",
            message: "Include recorded but not resolved. This inspection reads only the selected file."
          });
        }
      } else if (/^GUI_[A-Za-z0-9_]+$/.test(trimmed)) {
        kind = "block";
        const id = blocks.length;
        blocks.push({
          id,
          type: trimmed,
          startLine: number,
          endLine: null,
          parentId: current,
          properties: [],
          rect: null
        });
        stack.push(id);
        lineBlock = id;
      } else if (/^END(?:\s+#.*)?$/.test(trimmed)) {
        kind = "end";
        if (current === null) diagnostics2.push({
          line: number,
          severity: "warning",
          code: "UNMATCHED_END",
          message: "END without a recognized open GUI_ block."
        });
        else {
          blocks[current].endLine = number;
          stack.pop();
        }
      } else {
        const property = /^([A-Za-z_][A-Za-z0-9_]*)[ \t]+(.+)$/.exec(trimmed);
        if (current !== null && property) {
          kind = "property";
          const item = {
            key: property[1],
            value: property[2],
            raw,
            line: number
          };
          blocks[current].properties.push(item);
          if (item.key === "SCREEN_RECT") {
            const rect = rectFrom(item.value, number);
            if (rect) blocks[current].rect = rect;
            else diagnostics2.push({
              line: number,
              severity: "warning",
              code: "UNPARSED_SCREEN_RECT",
              message: "SCREEN_RECT was preserved as text; exactly four finite numeric values are needed for a schematic rectangle."
            });
          }
        }
      }
      lines.push({ number, raw, kind, blockId: lineBlock });
    }
    for (const id of stack) diagnostics2.push({
      line: blocks[id].startLine,
      severity: "warning",
      code: "UNCLOSED_BLOCK",
      message: "Recognized GUI_ block has no matching END in this source."
    });
    return { source: source2, lines, blocks, diagnostics: diagnostics2 };
  }

  // site/app.ts
  var fileInput = document.querySelector("#file");
  var drop = document.querySelector("#drop");
  var status = document.querySelector("#status");
  var summary = document.querySelector("#summary");
  var source = document.querySelector("#source");
  var structures = document.querySelector("#structures");
  var diagnostics = document.querySelector("#diagnostics");
  var drawing = document.querySelector("#drawing");
  var exampleButton = document.querySelector("#example");
  var maxBytes = 8 * 1024 * 1024;
  function el(tag, cls, value) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (value !== void 0) node.textContent = value;
    return node;
  }
  function openLine(line) {
    const current = source.value;
    const matches = /\r\n|\n|\r/g;
    let start = 0;
    for (let n = 1; n < line; n++) {
      const match = matches.exec(current);
      if (!match) break;
      start = matches.lastIndex;
    }
    const end = current.slice(start).search(/\r\n|\n|\r/);
    source.focus();
    source.setSelectionRange(start, end < 0 ? current.length : start + end);
  }
  function textProperty(b, key) {
    const raw = b.properties.find((p) => p.key === key)?.value || "";
    return raw.length >= 2 && raw[0] === '"' && raw[raw.length - 1] === '"' ? raw.slice(1, -1) : raw;
  }
  function visualize(blocks) {
    drawing.replaceChildren();
    const data = blocks.filter((b) => b.rect !== null).map((b) => ({ block: b, rect: b.rect })).filter((p) => p.rect.width > 0 && p.rect.height > 0 && [p.rect.x, p.rect.y, p.rect.width, p.rect.height].every((v) => Number.isFinite(v) && Math.abs(v) <= 1e6));
    if (!data.length) {
      drawing.append(el("p", "empty", "Nenhum SCREEN_RECT num\xE9rico para exibir. O texto e os blocos continuam dispon\xEDveis."));
      return;
    }
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    const minX = Math.min(0, ...data.map((v) => v.rect.x));
    const minY = Math.min(0, ...data.map((v) => v.rect.y));
    const maxX = Math.max(1, ...data.map((v) => v.rect.x + v.rect.width));
    const maxY = Math.max(1, ...data.map((v) => v.rect.y + v.rect.height));
    const span = Math.max(maxX - minX, maxY - minY, 1);
    const margin = Math.max(5, span * 0.04);
    svg.setAttribute("viewBox", [
      minX - margin,
      minY - margin,
      maxX - minX + 2 * margin,
      maxY - minY + 2 * margin
    ].join(" "));
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Esquema dos ret\xE2ngulos SCREEN_RECT identificados, n\xE3o uma simula\xE7\xE3o de runtime");
    for (const item of data) {
      const rect = document.createElementNS(svgNS, "rect");
      rect.setAttribute("x", String(item.rect.x));
      rect.setAttribute("y", String(item.rect.y));
      rect.setAttribute("width", String(item.rect.width));
      rect.setAttribute("height", String(item.rect.height));
      rect.setAttribute("fill", "rgba(50, 190, 135, 0.12)");
      rect.setAttribute("stroke", "#67efb7");
      rect.setAttribute("stroke-width", String(Math.max(0.5, span * 2e-3)));
      rect.setAttribute("tabindex", "0");
      const label = textProperty(item.block, "NAME") || item.block.type;
      rect.appendChild(document.createElementNS(svgNS, "title")).textContent = label + " \xB7 linha " + item.rect.line;
      rect.addEventListener("click", () => openLine(item.rect.line));
      rect.addEventListener("keydown", (e) => {
        if (e.key === "Enter") openLine(item.rect.line);
      });
      svg.append(rect);
    }
    drawing.append(svg);
    drawing.append(el("p", "hint", "Representa\xE7\xE3o geom\xE9trica por coordenadas declaradas; Z, cor, textura e estados n\xE3o s\xE3o inferidos."));
  }
  function renderInspection(result, title, encoding) {
    source.value = result.source;
    status.textContent = title + " \xB7 " + encoding + " \xB7 processamento local";
    const represented = result.blocks.filter((b) => b.rect !== null).length;
    summary.textContent = result.lines.length + " linhas \xB7 " + result.blocks.length + " blocos reconhecidos \xB7 " + represented + " ret\xE2ngulos \xB7 " + result.diagnostics.length + " avisos/notas";
    structures.replaceChildren();
    if (!result.blocks.length) structures.append(el("p", "empty", "Nenhum in\xEDcio de bloco GUI_ isolado foi reconhecido. Consulte o texto original."));
    for (const block of result.blocks) {
      const card = el("details", "block");
      const heading = el("summary", "", block.type + " \xB7 linha " + block.startLine + (block.endLine ? "\u2013" + block.endLine : " \xB7 END n\xE3o encontrado"));
      heading.addEventListener("click", () => openLine(block.startLine));
      card.append(heading);
      const props = el("div", "properties");
      props.append(el("p", "hint", "Pai: " + (block.parentId === null ? "raiz" : "#" + block.parentId) + " \xB7 identifica\xE7\xE3o local #" + block.id));
      for (const prop of block.properties) {
        const row = el("button", "prop");
        row.setAttribute("type", "button");
        row.append(el("strong", "", prop.key), el("code", "", prop.value), el("small", "", "L" + prop.line));
        row.addEventListener("click", () => openLine(prop.line));
        props.append(row);
      }
      if (!block.properties.length) props.append(el("p", "empty", "Sem propriedades registradas neste bloco."));
      card.append(props);
      structures.append(card);
    }
    diagnostics.replaceChildren();
    if (!result.diagnostics.length) diagnostics.append(el("p", "empty", "Nenhuma inconsist\xEAncia estrutural reconhecida. Isso n\xE3o valida a sem\xE2ntica Gearbox."));
    for (const d of result.diagnostics) {
      const row = el("button", "diagnostic");
      row.setAttribute("type", "button");
      row.append(el("strong", "", d.code), el("span", "", "Linha " + d.line + ": " + d.message));
      row.addEventListener("click", () => openLine(d.line));
      diagnostics.append(row);
    }
    visualize(result.blocks);
  }
  async function openFile(file) {
    if (file.size > maxBytes) throw new Error("Limite de 8 MiB para esta primeira vers\xE3o do inspector.");
    const bytes = await file.arrayBuffer();
    let encoding = "UTF-8";
    let text;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      text = new TextDecoder("windows-1252").decode(bytes);
      encoding = "Windows-1252 (fallback expl\xEDcito)";
    }
    renderInspection(inspectGuidef(text), file.name, encoding);
  }
  async function acceptFile(file) {
    if (!file) return;
    try {
      await openFile(file);
    } catch (e) {
      status.textContent = "Erro: " + (e instanceof Error ? e.message : String(e));
    }
  }
  fileInput.addEventListener("change", () => {
    void acceptFile(fileInput.files?.[0]);
  });
  drop.addEventListener("dragover", (e) => {
    e.preventDefault();
    drop.classList.add("drag");
  });
  drop.addEventListener("dragleave", () => drop.classList.remove("drag"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("drag");
    void acceptFile(e.dataTransfer?.files[0]);
  });
  exampleButton.addEventListener("click", () => {
    const sample = [
      "!define SAMPLE 1",
      "GUI_SCREEN",
      '  NAME "Synthetic sample"',
      "  SCREEN_RECT 12 18 200 90",
      "  NONSTANDARD_PROPERTY value.bin",
      "END",
      ""
    ].join("\n");
    renderInspection(inspectGuidef(sample), "Exemplo sint\xE9tico (n\xE3o extra\xEDdo do SLUS)", "UTF-8");
  });
})();
