// /src/core/Parser.ts

import { Token, TokenType, GuiCommand  } from './Types';

export class Parser {
    private tokens: Token[];
    private current = 0;
    private macros: Map<string, string> = new Map();

    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }

    // Main entry point
    public parse(): GuiCommand[] {
        const commands: GuiCommand[] = [];

        while (!this.isAtEnd()) {
            const token = this.peek();

            // Directive logic (!define) using TokenType
            if (token.type === TokenType.Directive && token.text === "!define") {
                this.handleDefine();
            } 
            // GUI block logic using TokenType
            else if (token.type === TokenType.Keyword && token.text.startsWith('GUI_')) {
                commands.push(this.parseElement());
            } 
            else {
                this.advance();
            }
        }

        // Sort by Z_PLANE for the Painter's Algorithm on the Canvas
        return commands.sort((a, b) => a.zPlane - b.zPlane);
    }

    private handleDefine() {
        this.advance(); // Consumes '!define'
        const nameToken = this.advance();
        const valueParts: string[] = [];
        const currentLine = nameToken.line;
        
        // Capture the rest of the line as the macro value
        while (!this.isAtEnd() && this.peek().line === currentLine) {
            valueParts.push(this.advance().text);
        }
        
        // Store and immediately try to resolve if the macro points to another macro
        this.macros.set(nameToken.text, this.resolveValue(valueParts.join(' ')));
    }

    private parseElement(): GuiCommand {
        const typeToken = this.advance(); // Ex: GUI_SCREEN
        const props: Record<string, string> = {};
        const elementLine = typeToken.line;
        
        // Process properties until encountering 'END'
        while (!this.isAtEnd() && this.peek().type !== TokenType.End) {
            const propToken = this.advance();
            
            if (propToken.type === TokenType.Keyword || propToken.type === TokenType.Identifier) {
                const key = propToken.text;
                const valParts: string[] = [];
                
                // Capture all values on the same line (e.g., SCREEN_RECT 0 0 640 480)
                while (!this.isAtEnd() && this.peek().line === propToken.line) {
                    valParts.push(this.advance().text);
                }
                props[key] = this.resolveValue(valParts.join(' '));
            }
        }
        
        if (!this.isAtEnd()) this.advance(); // Consumes 'END'

        // Color handling (supports simple RGBA or dual values for Highlight/Hover)
        const colorStr = props['COLOR'] || '1.0 1.0 1.0 1.0';
        const colorParts = colorStr.split(/\s+/);
        
        const normalColor = this.formatColor(colorParts.slice(0, 4).join(' '));
        const highlightColor = colorParts.length >= 8 
            ? this.formatColor(colorParts.slice(4, 8).join(' ')) 
            : normalColor;

        return {
            type: typeToken.text,
            name: props['NAME'] || `elem_${elementLine}`,
            ...this.parseRect(props['SCREEN_RECT'] || '0 0 100 100'),
            color: normalColor,
            hoverColor: highlightColor,
            text: props['TEXT'],
            texture: props['TEXTURE'],
            zPlane: parseInt(props['Z_PLANE'] || '0'),
            line: elementLine,
            enabled: true,
            active: false,
            dependsOn: props['DEPENDS_VALUE']
        };
    }

    //Recursively resolves macros with a safety limit
    private resolveValue(val: string): string {
        let resolved = val;
        let iterations = 0;
        let changed = true;

        while (changed && iterations < 10) { 
            changed = false;
            this.macros.forEach((mVal, mKey) => {
                if (resolved.includes(mKey)) {
                    // Global replacement to handle multiple occurrences on the same line
                    const next = resolved.replace(new RegExp(`\\b${mKey}\\b`, 'g'), mVal);
                    if (next !== resolved) {
                        resolved = next;
                        changed = true;
                    }
                }
            });
            iterations++;
        }
        return resolved;
    }

    private parseRect(rectStr: string) {
        const p = rectStr.split(/\s+/).map(Number);
        return { 
            x: p[0] || 0, 
            y: p[1] || 0, 
            w: p[2] || 0, 
            h: p[3] || 0 
        };
    }

    private formatColor(colorStr: string): string {
        const p = colorStr.split(/\s+/).map(v => {
            const n = parseFloat(v);
            return isNaN(n) ? 0 : n;
        });
        
        // Normalize to 0-255 for the Webview Canvas
        return `rgba(${Math.round(p[0] * 255)}, ${Math.round(p[1] * 255)}, ${Math.round(p[2] * 255)}, ${p[3] ?? 1})`;
    }

    private isAtEnd() { return this.current >= this.tokens.length; }
    private peek() { return this.tokens[this.current]; }
    private advance() { return this.tokens[this.current++]; }
}
