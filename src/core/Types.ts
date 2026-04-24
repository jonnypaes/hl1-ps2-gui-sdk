// /src/core/Types.ts

export enum TokenType {
    Keyword,      // Commands like GUI_SCREEN, SCREEN_RECT
    Identifier,   // Element names
    Literal,      // Numbers, text strings, GL constants
    Directive,    // !define, !include (!include "PauseStr.txt")
    End,          // END
    EOF           // End of file
}

export interface Token {
    type: TokenType;
    text: string;
    line: number;
}

// Unified interface for GUI commands. Represents the internal data structure after parsing.
export interface GuiCommand {
    type: string;          // e.g. GUI_SCREEN, GUI_CAPTION, GUI_GENERIC
    name: string;          // Identifier name (NAME "Half-Life-FG")
    x: number;
    y: number;
    w: number;
    h: number;
    zPlane: number;        // Depth (Z_PLANE 8)
    color: string;         // Processed rgba(...) string
    hoverColor: string;    // rgba(...) string for focus/hover
    
    // Optional properties discovered in the Gearbox engine
    dependsOn?: string;    // Reference to another element (GUI_DEPENDENCY)
    blendMode?: string;    // GL modes (BLEND_FUNC GL_ONE GL_ONE)
    fadeInTime?: number;   // FADE_IN_TIME
    fadeOutTime?: number;  // FADE_OUT_TIME
    text?: string;         // Text content (GUI_CAPTION)
    texture?: string;      // Texture path (.psi, .bmp)
    scale?: number;        // Scale (used in captions)
    
    // Internal simulator state control
    enabled?: boolean;
    active?: boolean;
    line?: number;         // Original line in the .guidef file for debugging
}
