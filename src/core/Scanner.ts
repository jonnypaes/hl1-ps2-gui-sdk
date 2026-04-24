// /src/core/Scanner.ts

import { Token, TokenType } from './Types';

export class Scanner {
    private source: string;
    private tokens: Token[] = [];
    private start = 0;
    private current = 0;
    private line = 1;

    // Exhaustive mapping of reserved keywords based on reverse engineering of the Gearbox engine (Half-Life PS2).
    private static readonly keywords: Record<string, TokenType> = {
        // Block structures
        'END': TokenType.End,
        'GUI_SCREEN': TokenType.Keyword,
        'GUI_GENERIC': TokenType.Keyword,
        'GUI_DEPENDENCY': TokenType.Keyword,
        'GUI_ELEMENT_STATE': TokenType.Keyword,
        'GUI_CAPTION': TokenType.Keyword,
        'GUI_INPUT': TokenType.Keyword,

        // Base properties
        'NAME': TokenType.Keyword,
        'Z_PLANE': TokenType.Keyword,
        'DEPENDS_VALUE': TokenType.Keyword,
        'SCREEN_RECT': TokenType.Keyword,
        'TEXTURE': TokenType.Keyword,
        'TEXT': TokenType.Keyword,
        'COLOR': TokenType.Keyword,

        // Rendering and hardware properties (PS2 Graphics Synthesizer)
        'FADE_IN_TIME': TokenType.Keyword,
        'FADE_OUT_TIME': TokenType.Keyword,
        'BLEND_FUNC': TokenType.Keyword,
        'TEX_ENV': TokenType.Keyword,
        'TEXTURE_RECT': TokenType.Keyword,
        'COLOR_MODULATE': TokenType.Keyword,
        'SCALE': TokenType.Keyword,
        'WRAP': TokenType.Keyword,

        // Variable and animation logic
        'STATE_SELECTION_LINEAR': TokenType.Keyword,
        'LERP_TIME': TokenType.Keyword,
        'LOOP': TokenType.Keyword,
        'INITIAL_VALUE': TokenType.Keyword,
        'MAX_VALUE': TokenType.Keyword,
        'MIN_VALUE': TokenType.Keyword,

        // Blending constants
        'GL_ONE': TokenType.Literal,
        'GL_ZERO': TokenType.Literal,
        'GL_SRC_ALPHA': TokenType.Literal,
        'GL_ONE_MINUS_SRC_ALPHA': TokenType.Literal,
        'GL_DST_COLOR': TokenType.Literal,
        'GL_SRC_COLOR': TokenType.Literal,
        'GL_MODULATE': TokenType.Literal,
        'GL_REPLACE': TokenType.Literal,

        // PS2 control mapping
        'TRIANGLE': TokenType.Literal,
        'CIRCLE': TokenType.Literal,
        'CROSS': TokenType.Literal,
        'SQUARE': TokenType.Literal,
        'SELECT': TokenType.Literal,
        'START': TokenType.Literal,
        'L1': TokenType.Literal,
        'R1': TokenType.Literal,
        'L2': TokenType.Literal,
        'R2': TokenType.Literal,
        'L3': TokenType.Literal,
        'R3': TokenType.Literal
    };

    constructor(source: string) {
        this.source = source;
    }

    // Transforms the raw .guidef string into a list of processable Tokens.
    public scanTokens(): Token[] {
        while (!this.isAtEnd()) {
            this.start = this.current;
            this.scanToken();
        }

        this.tokens.push({ type: TokenType.EOF, text: "", line: this.line });
        return this.tokens;
    }

    private scanToken() {
        const c = this.advance();
        switch (c) {
            case ' ':
            case '\r':
            case '\t': break; // Ignore whitespace
            case '\n': this.line++; break;
            
            case '#': // Comments: ignore until end of line
                while (this.peek() !== '\n' && !this.isAtEnd()) this.advance();
                break;

            case '!': // Directives (!define, !include)
                this.identifier(TokenType.Directive);
                break;

            case '"': this.string(); break; // Strings in quotes

            default:
                // Number support (including negatives and decimals)
                if (this.isDigit(c) || (c === '-' && this.isDigit(this.peek()))) {
                    this.number();
                } else if (this.isAlpha(c)) {
                    this.identifier();
                }
                break;
        }
    }

    private identifier(forceType?: TokenType) {
        while (this.isAlphaNumeric(this.peek())) this.advance();

        const text = this.source.substring(this.start, this.current);
        let type: TokenType = forceType || TokenType.Identifier;

        if (!forceType) {
            const upperText = text.toUpperCase();
            if (Scanner.keywords[upperText] !== undefined) {
                // Double cast to satisfy strict TS enum typing
                type = Scanner.keywords[upperText] as any as TokenType;
            }
        }

        this.addToken(type, text);
    }

    private string() {
        while (this.peek() !== '"' && !this.isAtEnd()) {
            if (this.peek() === '\n') this.line++;
            this.advance();
        }

        if (this.isAtEnd()) return;

        this.advance(); // Consumes the closing "
        const value = this.source.substring(this.start + 1, this.current - 1);
        this.addToken(TokenType.Literal, value);
    }

    private number() {
        while (this.isDigit(this.peek())) this.advance();
        
        // Float support
        if (this.peek() === '.' && this.isDigit(this.peekNext())) {
            this.advance();
            while (this.isDigit(this.peek())) this.advance();
        }
        
        this.addToken(TokenType.Literal, this.source.substring(this.start, this.current));
    }

    // --- Navigation helpers ---

    private addToken(type: TokenType, text: string) {
        this.tokens.push({ type, text, line: this.line });
    }

    private isAtEnd(): boolean { 
        return this.current >= this.source.length; 
    }

    private advance(): string { 
        return this.source.charAt(this.current++); 
    }

    private peek(): string { 
        return this.isAtEnd() ? '\0' : this.source.charAt(this.current); 
    }

    private peekNext(): string { 
        if (this.current + 1 >= this.source.length) return '\0';
        return this.source.charAt(this.current + 1); 
    }

    private isDigit(c: string): boolean { 
        return c >= '0' && c <= '9'; 
    }

    private isAlpha(c: string): boolean { 
        return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_'; 
    }

    private isAlphaNumeric(c: string): boolean { 
        return this.isAlpha(c) || this.isDigit(c); 
    }
}
