// /src/core/ScannerTypes.ts

export enum TokenType {
    Directive,  // !define, !include
    Keyword,    // GUI_SCREEN, NAME, COLOR, END...
    Identifier, // Macro or element names
    Literal,    // Numbers and quoted strings
    End,        // The specific 'END' token
    EOF         // End of file
}

export interface Token {
    type: TokenType;
    text: string;
    line: number;
}
