// /src/core/Validator.ts

import * as vscode from 'vscode';
import { GuiCommand } from './Types'; // ✅ Single source of truth

export class Validator {
    // 80% safe area (Title Safe) for PS2 NTSC resolution (640x448)
    // This prevents elements from being cut off on CRT TVs
    private static SAFE_ZONE = { x1: 64, y1: 48, x2: 576, y2: 400 };

    // Validates GUI commands and returns diagnostics for VS Code.
    public static validate(commands: GuiCommand[]): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];

        for (let i = 0; i < commands.length; i++) {
            const cmd = commands[i];

            // 1. Title Safe check (generates a warning)
            if (cmd.x < this.SAFE_ZONE.x1 || (cmd.x + cmd.w) > this.SAFE_ZONE.x2 || 
                cmd.y < this.SAFE_ZONE.y1 || (cmd.y + cmd.h) > this.SAFE_ZONE.y2) {
                
                diagnostics.push(this.createDiagnostic(
                    cmd.line ?? 1, // ✅ TS2345 fix: ensures it is never undefined
                    `Element '${cmd.name}' is outside the TV safe area (Title Safe). It may be cut off on CRTs.`,
                    vscode.DiagnosticSeverity.Warning
                ));
            }

            // 2. Collision / overlap detection (AABB) on the same Z layer
            for (let j = i + 1; j < commands.length; j++) {
                const other = commands[j];
                
                // Só valida colisão se estiverem no mesmo plano Z
                if (cmd.zPlane === other.zPlane && this.intersects(cmd, other)) {
                    diagnostics.push(this.createDiagnostic(
                        cmd.line ?? 1, // ✅ TS2345 fix
                        `Overlap detected at Z:${cmd.zPlane} between '${cmd.name}' and '${other.name}'.`,
                        vscode.DiagnosticSeverity.Information
                    ));
                }
            }

            // 3. Maximum resolution validation (critical error for the engine)
            if (cmd.w > 640 || cmd.h > 448) {
                diagnostics.push(this.createDiagnostic(
                    cmd.line ?? 1, // ✅ TS2345 fix
                    `Element '${cmd.name}' exceeds the maximum PS2 screen size (640x448).`,
                    vscode.DiagnosticSeverity.Error
                ));
            }
        }

        return diagnostics;
    }

    // Helper to create a VS Code diagnostic object
    private static createDiagnostic(line: number, message: string, severity: vscode.DiagnosticSeverity): vscode.Diagnostic {
        // VS Code uses 0-based indexing for lines, hence line - 1
        // Ensure the minimum line is 1 to avoid negative index
        const safeLine = Math.max(1, line);
        const range = new vscode.Range(
            new vscode.Position(safeLine - 1, 0),
            new vscode.Position(safeLine - 1, 80)
        );
        return new vscode.Diagnostic(range, message, severity);
    }

    // AABB algorithm for rectangle intersection
    private static intersects(a: GuiCommand, b: GuiCommand): boolean {
        return (
            a.x < b.x + b.w &&
            a.x + a.w > b.x &&
            a.y < b.y + b.h &&
            a.y + a.h > b.y
        );
    }
}
