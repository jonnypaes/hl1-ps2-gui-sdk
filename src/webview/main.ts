// /src/webview/main.ts

// Half-Life PS2 Launcher SDK - Webview Interactive Simulator
// 1. VS Code API declaration
declare function acquireVsCodeApi(): {
    postMessage: (msg: any) => void;
    getState: () => any;
    setState: (state: any) => void;
};
const vscode = acquireVsCodeApi();

// 2. Canvas and 2D Context
const canvas = document.getElementById('screen') as HTMLCanvasElement;
const ctx = canvas?.getContext('2d');

if (!canvas || !ctx) {
    console.error('❌ [HL-PS2 SDK] Canvas não encontrado no DOM');
}

// 3. State and Cache
let currentCommands: any[] = [];
let hoveredElement: any = null;
const imageCache: Record<string, HTMLImageElement> = {};

// Resize
function resizeCanvas() {
    if (!canvas || !canvas.parentElement) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    console.log(`📏 [HL-PS2 SDK] Canvas Resized: ${canvas.width}x${canvas.height}`);
    render(currentCommands);
}
window.addEventListener('resize', resizeCanvas);

// Main Render
function render(commands: any[]) {
    if (!ctx || !canvas) return;
    currentCommands = commands;

    // Clear screen
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGrid(32);

    const scaleX = canvas.width / 640;
    const scaleY = canvas.height / 480;

    // Render each command sent by the parser
    for (const cmd of commands) {
        drawElement(cmd, scaleX, scaleY);
    }
}

// Reference Grid
function drawGrid(gridSize: number) {
    if (!ctx || !canvas) return;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath();
    for (let x = 0; x <= canvas.width; x += gridSize) {
        ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height);
    }
    for (let y = 0; y <= canvas.height; y += gridSize) {
        ctx.moveTo(0, y); ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();
}

// 7. Draw Element (Highlight and Label on top of everything)
function drawElement(cmd: any, scaleX: number, scaleY: number) {
    if (!ctx) return;

    const isHovered = hoveredElement === cmd;
    const sx = cmd.x * scaleX;
    const sy = cmd.y * scaleY;
    const sw = cmd.w * scaleX;
    const sh = cmd.h * scaleY;

    ctx.globalAlpha = cmd.enabled !== false ? 1.0 : 0.3;

    // --- LAYER 1: CONTENT (Image or Color) ---
    if (cmd.texture) {
        drawImageOrPlaceholder(sx, sy, sw, sh, cmd.texture);
    } else {
        ctx.fillStyle = isHovered ? (cmd.hoverColor || '#fff') : (cmd.active ? '#ffff00' : (cmd.color || '#444'));
        ctx.fillRect(sx, sy, sw, sh);
    }

    // --- LAYER 2: BORDERS AND HIGHLIGHT ---
    ctx.shadowBlur = 0;
    ctx.strokeStyle = isHovered ? '#fff' : (cmd.active ? '#ff0' : '#0f0');
    ctx.lineWidth = isHovered || cmd.active ? 2 : 1;
    ctx.strokeRect(sx, sy, sw, sh);

    // --- LAYER 3: LABELS (With shadow for contrast) ---
    ctx.fillStyle = cmd.enabled !== false ? '#0f0' : '#666';
    ctx.font = 'bold 10px monospace';
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 4;
    const label = (cmd.text || cmd.name || 'UNKNOWN').toUpperCase();
    ctx.fillText(label, sx + 4, sy + 14);
    
    // Reset for next element
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1.0;
}

// 8. Image Rendering with Cache and Error Debug
function drawImageOrPlaceholder(x: number, y: number, w: number, h: number, path: string) {
    if (!ctx) return;

    if (!imageCache[path]) {
        console.log(`🖼️ [HL-PS2 GUI] Loading texture: ${path}`);
        const img = new Image();
        img.src = path;
        img.onload = () => {
            console.log(`✅ [HL-PS2 GUI] Texture loaded: ${path}`);
            render(currentCommands);
        };
        img.onerror = () => { 
            console.error(`❌ [HL-PS2 GUI] Error loading: ${path}`);
            (img as any).failed = true; 
            render(currentCommands); 
        };
        imageCache[path] = img;
    }

    const cachedImg = imageCache[path];
    if (cachedImg.complete && !(cachedImg as any).failed) {
        ctx.drawImage(cachedImg, x, y, w, h);
    } else {
        // Placeholder in case of error (semi-transparent red)
        ctx.fillStyle = (cachedImg as any).failed ? 'rgba(255, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(x, y, w, h);
        if ((cachedImg as any).failed) {
            ctx.strokeStyle = 'red';
            ctx.strokeRect(x, y, w, h);
        }
    }
}

// 9. Mouse Events (Interactivity)
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const sX = canvas.width / 640;
    const sY = canvas.height / 480;

    let hit = null;
    for (let i = currentCommands.length - 1; i >= 0; i--) {
        const c = currentCommands[i];
        if (mx >= c.x * sX && mx <= (c.x + c.w) * sX && my >= c.y * sY && my <= (c.y + c.h) * sY) {
            hit = c;
            break;
        }
    }
    if (hoveredElement !== hit) {
        hoveredElement = hit;
        render(currentCommands);
    }
});

canvas.addEventListener('mouseleave', () => {
    hoveredElement = null;
    render(currentCommands);
});

// 10. Extension Listener (Communication between TS and HTML)
window.addEventListener('message', (event) => {
    const message = event.data;
    
    // Log to verify if data is arriving
    console.log(`📥 [HL-PS2 SDK] Message Received: ${message.type}`);

    if (message.type === 'UPDATE_UI' || message.type === 'render') {
        const rawData = message.data || message.commands || [];
        console.log(`📊 [HL-PS2 SDK] Rendering Data: ${rawData.length} elementos.`);
        render(rawData);
    }
});

// Initialization
console.log('🚀 [HL-PS2 SDK] Webview Simulator Started');
resizeCanvas();
