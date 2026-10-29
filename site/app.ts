import { inspectGuidef, GuidefBlock, GuidefInspection } from '../src/core/GuidefInspection';

const fileInput = document.querySelector<HTMLInputElement>('#file')!;
const drop = document.querySelector<HTMLElement>('#drop')!;
const status = document.querySelector<HTMLElement>('#status')!;
const summary = document.querySelector<HTMLElement>('#summary')!;
const source = document.querySelector<HTMLTextAreaElement>('#source')!;
const structures = document.querySelector<HTMLElement>('#structures')!;
const diagnostics = document.querySelector<HTMLElement>('#diagnostics')!;
const drawing = document.querySelector<HTMLElement>('#drawing')!;
const exampleButton = document.querySelector<HTMLButtonElement>('#example')!;
const maxBytes = 8 * 1024 * 1024;

function el(tag: string, cls?: string, value?: string): HTMLElement {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (value !== undefined) node.textContent = value;
  return node;
}
function openLine(line: number) {
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
function textProperty(b: GuidefBlock, key: string): string {
  const raw = b.properties.find(p => p.key === key)?.value || '';
  // Only remove symmetrical surrounding quotes for presentation.
  return raw.length >= 2 && raw[0] === '"' && raw[raw.length - 1] === '"'
    ? raw.slice(1, -1) : raw;
}
function visualize(blocks: GuidefBlock[]) {
  drawing.replaceChildren();
  const data = blocks
    .filter(b => b.rect !== null)
    .map(b => ({ block: b, rect: b.rect! }))
    .filter(p => p.rect.width > 0 && p.rect.height > 0 &&
      [p.rect.x, p.rect.y, p.rect.width, p.rect.height].every(v => Number.isFinite(v) && Math.abs(v) <= 1000000));
  if (!data.length) {
    drawing.append(el('p', 'empty', 'Nenhum SCREEN_RECT numérico para exibir. O texto e os blocos continuam disponíveis.'));
    return;
  }
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  const minX = Math.min(0, ...data.map(v => v.rect.x));
  const minY = Math.min(0, ...data.map(v => v.rect.y));
  const maxX = Math.max(1, ...data.map(v => v.rect.x + v.rect.width));
  const maxY = Math.max(1, ...data.map(v => v.rect.y + v.rect.height));
  const span = Math.max(maxX - minX, maxY - minY, 1);
  const margin = Math.max(5, span * 0.04);
  svg.setAttribute('viewBox', [
    minX - margin, minY - margin,
    maxX - minX + 2 * margin, maxY - minY + 2 * margin
  ].join(' '));
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Esquema dos retângulos SCREEN_RECT identificados, não uma simulação de runtime');
  for (const item of data) {
    const rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('x', String(item.rect.x));
    rect.setAttribute('y', String(item.rect.y));
    rect.setAttribute('width', String(item.rect.width));
    rect.setAttribute('height', String(item.rect.height));
    rect.setAttribute('fill', 'rgba(50, 190, 135, 0.12)');
    rect.setAttribute('stroke', '#67efb7');
    rect.setAttribute('stroke-width', String(Math.max(0.5, span * 0.002)));
    rect.setAttribute('tabindex', '0');
    const label = textProperty(item.block, 'NAME') || item.block.type;
    rect.appendChild(document.createElementNS(svgNS, 'title')).textContent = label + ' · linha ' + item.rect.line;
    rect.addEventListener('click', () => openLine(item.rect.line));
    rect.addEventListener('keydown', e => { if (e.key === 'Enter') openLine(item.rect.line); });
    svg.append(rect);
  }
  drawing.append(svg);
  drawing.append(el('p', 'hint', 'Representação geométrica por coordenadas declaradas; Z, cor, textura e estados não são inferidos.'));
}
function renderInspection(result: GuidefInspection, title: string, encoding: string) {
  source.value = result.source;
  status.textContent = title + ' · ' + encoding + ' · processamento local';
  const represented = result.blocks.filter(b => b.rect !== null).length;
  summary.textContent = result.lines.length + ' linhas · ' + result.blocks.length +
    ' blocos reconhecidos · ' + represented + ' retângulos · ' +
    result.diagnostics.length + ' avisos/notas';
  structures.replaceChildren();
  if (!result.blocks.length) structures.append(el('p', 'empty', 'Nenhum início de bloco GUI_ isolado foi reconhecido. Consulte o texto original.'));
  for (const block of result.blocks) {
    const card = el('details', 'block');
    const heading = el('summary', '', block.type + ' · linha ' + block.startLine +
      (block.endLine ? '–' + block.endLine : ' · END não encontrado'));
    heading.addEventListener('click', () => openLine(block.startLine));
    card.append(heading);
    const props = el('div', 'properties');
    props.append(el('p', 'hint', 'Pai: ' + (block.parentId === null ? 'raiz' : '#' + block.parentId) +
      ' · identificação local #' + block.id));
    for (const prop of block.properties) {
      const row = el('button', 'prop');
      row.setAttribute('type', 'button');
      row.append(el('strong', '', prop.key), el('code', '', prop.value), el('small', '', 'L' + prop.line));
      row.addEventListener('click', () => openLine(prop.line));
      props.append(row);
    }
    if (!block.properties.length) props.append(el('p', 'empty', 'Sem propriedades registradas neste bloco.'));
    card.append(props);
    structures.append(card);
  }
  diagnostics.replaceChildren();
  if (!result.diagnostics.length) diagnostics.append(el('p', 'empty', 'Nenhuma inconsistência estrutural reconhecida. Isso não valida a semântica Gearbox.'));
  for (const d of result.diagnostics) {
    const row = el('button', 'diagnostic');
    row.setAttribute('type', 'button');
    row.append(el('strong', '', d.code), el('span', '', 'Linha ' + d.line + ': ' + d.message));
    row.addEventListener('click', () => openLine(d.line));
    diagnostics.append(row);
  }
  visualize(result.blocks);
}
async function openFile(file: File) {
  if (file.size > maxBytes) throw new Error('Limite de 8 MiB para esta primeira versão do inspector.');
  const bytes = await file.arrayBuffer();
  let encoding = 'UTF-8';
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder('windows-1252').decode(bytes);
    encoding = 'Windows-1252 (fallback explícito)';
  }
  renderInspection(inspectGuidef(text), file.name, encoding);
}
async function acceptFile(file: File | undefined) {
  if (!file) return;
  try { await openFile(file); }
  catch (e) { status.textContent = 'Erro: ' + (e instanceof Error ? e.message : String(e)); }
}
fileInput.addEventListener('change', () => { void acceptFile(fileInput.files?.[0]); });
drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
drop.addEventListener('drop', e => {
  e.preventDefault();
  drop.classList.remove('drag');
  void acceptFile(e.dataTransfer?.files[0]);
});
exampleButton.addEventListener('click', () => {
  const sample = ['!define SAMPLE 1', 'GUI_SCREEN', '  NAME "Synthetic sample"', '  SCREEN_RECT 12 18 200 90',
    '  NONSTANDARD_PROPERTY value.bin', 'END', ''].join('\n');
  renderInspection(inspectGuidef(sample), 'Exemplo sintético (não extraído do SLUS)', 'UTF-8');
});
