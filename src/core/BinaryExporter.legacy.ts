// /src/core/BinaryExporter.ts

import * as fs from 'fs';
import { GuiCommand } from './Types';

/*
 * Gearbox Binary Structure (32 bytes - MIPS/DMA Alignment):
 * 00-01: Type ID (uint16) -> Mapped according to Gearbox C++ classes
 * 02-03: X (int16)
 * 04-05: Y (int16)
 * 06-07: W (int16)
 * 08-09: H (int16)
 * 10-13: Color (uint32 - RGBA packed)
 * 14-17: Hover/Highlight Color (uint32 - RGBA)
 * 18-19: Z-Plane (int16)
 * 20-21: DependsOn Index (int16, -1 if none)
 * 22-23: Blend Mode ID (uint16) -> GL_ONE, GL_SRC_ALPHA, etc.
 * 24-25: Fade In Time (uint16) -> In milliseconds
 * 26-27: Fade Out Time (uint16) -> In milliseconds
 * 28-31: Reserved (4 bytes of final padding)
 */

export class BinaryExporter {
    
    public static exportToFile(commands: GuiCommand[], outputPath: string): void {
        const buffer = this.generateBuffer(commands);
        fs.writeFileSync(outputPath, buffer);
        console.log(`✅ Gearbox PS2 binary generated: ${outputPath} (${buffer.length} bytes)`);
    }

    private static generateBuffer(commands: GuiCommand[]): Buffer {
        const ELEMENT_SIZE = 32;
        const buffer = Buffer.alloc(commands.length * ELEMENT_SIZE);

        const nameToIndex = new Map<string, number>();
        commands.forEach((cmd, i) => nameToIndex.set(cmd.name, i));

        commands.forEach((cmd, i) => {
            const offset = i * ELEMENT_SIZE;

            // 1. Type ID (Based on string dump from C++ classes)
            buffer.writeUInt16LE(this.getTypeCode(cmd.type), offset + 0);

            // 2. Geometry (Little-Endian for the Emotion Engine)
            buffer.writeInt16LE(Math.round(cmd.x || 0), offset + 2);
            buffer.writeInt16LE(Math.round(cmd.y || 0), offset + 4);
            buffer.writeInt16LE(Math.round(cmd.w || 0), offset + 6);
            buffer.writeInt16LE(Math.round(cmd.h || 0), offset + 8);

            // 3. Gearbox Colors (RGBA packed for the Graphics Synthesizer)
            buffer.writeUInt32LE(this.rgbaToUint32(cmd.color || "rgba(255,255,255,1)"), offset + 10);
            buffer.writeUInt32LE(this.rgbaToUint32(cmd.hoverColor || "rgba(255,255,0,1)"), offset + 14);

            // 4. Layer Depth (Z-Plane)
            buffer.writeInt16LE(cmd.zPlane || 0, offset + 18);

            // 5. Dependency Index (Pointer Index)
            const depIndex = cmd.dependsOn ? (nameToIndex.get(cmd.dependsOn) ?? -1) : -1;
            buffer.writeInt16LE(depIndex, offset + 20);

            // 6. Blend Mode (Reverse engineering of GL_* constants)
            // If the command has a blendMode (e.g. "GL_ONE GL_ONE"), map it to an ID
            const blendId = this.getBlendModeId(cmd.blendMode || "GL_SRC_ALPHA GL_ONE_MINUS_SRC_ALPHA");
            buffer.writeUInt16LE(blendId, offset + 22);

            // 7. Fade Times (Converting float to uint16 in ms)
            const fadeIn = Math.round((cmd.fadeInTime || 0) * 1000);
            const fadeOut = Math.round((cmd.fadeOutTime || 0) * 1000);
            buffer.writeUInt16LE(fadeIn, offset + 24);
            buffer.writeUInt16LE(fadeOut, offset + 26);

            // 8. Final Padding (remaining 4 bytes to reach 32)
            buffer.fill(0, offset + 28, offset + 32);
        });

        return buffer;
    }

    private static rgbaToUint32(rgba: string): number {
        const match = rgba.match(/\d+(\.\d+)?/g);
        if (!match) return 0xFFFFFFFF;

        const [r, g, b, a] = match.map(Number);
        
        // PS2 GS format: A-B-G-R (place Alpha channel in the highest bits)
        const alpha = Math.round((a ?? 1) * 255) & 0xFF;
        return (alpha << 24) | ((b & 0xFF) << 16) | ((g & 0xFF) << 8) | (r & 0xFF);
    }

    private static getTypeCode(type: string): number {
        const types: Record<string, number> = {
            'GUI_SCREEN': 0,        // GUIScreen.cpp
            'GUI_GENERIC': 1,       // GUIElementGeneric.cpp
            'GUI_CAPTION': 2,       // GUIElementCaption.cpp
            'GUI_INPUT': 3,         // GUIElementInput.cpp
            'GUI_DEPENDENCY': 4,    // GUIElementDependency.cpp
            'GUI_ACTION': 5         // GUIAction.cpp
        };
        return types[type.toUpperCase()] ?? 1;
    }

    private static getBlendModeId(blendMode: string): number {
        // Mapping of Blend IDs based on the Gearbox engine
        // This tells the PS2 whether it should add colors or use normal transparency
        const modes: Record<string, number> = {
            'GL_ONE GL_ONE': 1,                        // Additive (Glow/Fire)
            'GL_SRC_ALPHA GL_ONE_MINUS_SRC_ALPHA': 2,  // Normal Alpha
            'GL_SRC_COLOR GL_ONE': 3,                  // Modulate
            'GL_ZERO GL_SRC_COLOR': 4                  // Multiply
        };
        return modes[blendMode.toUpperCase()] ?? 2;    // Default to Normal Alpha
    }
}
