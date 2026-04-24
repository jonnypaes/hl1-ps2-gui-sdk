// /src/core/BinaryExporter.ts

import * as fs from 'fs';
import * as zlib from 'zlib';
import { GuiCommand } from './Types';

/**
 * ============================================================================
 * Gearbox PS2 GUI Binary SDK (Unified Deterministic Edition)
 * ============================================================================
 * - No heuristics
 * - No magic guessing
 * - Fully round-trip stable
 * ============================================================================
 */

const ELEMENT_SIZE = 32;

/**
 * --------------------------------------------------------------------------
 * Canonical Magic Signatures (byte-accurate)
 * --------------------------------------------------------------------------
 */
const MAGIC = {
    MPC: Buffer.from(".MPC"),
    CMP: Buffer.from("CMP."),
    COMPRESSED_STRING: Buffer.from("COMPRESSED")
};

/**
 * --------------------------------------------------------------------------
 * Binary Format Descriptor (single source of truth)
 * --------------------------------------------------------------------------
 */
interface BinaryFormat {
    name: string;
    magic: Buffer;
    headerSize: number;
    compressedOffset: number;
    versioned?: boolean;
}

const FORMATS: Record<string, BinaryFormat> = {
    MPC_STANDARD: {
        name: "MPC_STANDARD",
        magic: MAGIC.MPC,
        headerSize: 12,
        compressedOffset: 12
    },
    GEARBOX_CANONICAL: {
        name: "GEARBOX_CANONICAL",
        magic: MAGIC.CMP,
        headerSize: 16,
        compressedOffset: 16,
        versioned: true
    },
    STRING_COMPRESSED: {
        name: "STRING_COMPRESSED",
        magic: MAGIC.COMPRESSED_STRING,
        headerSize: 10,
        compressedOffset: 10
    }
};

/**
 * ============================================================================
 * EXPORTER
 * ============================================================================
 */
export class BinaryExporter {

    public static format: BinaryFormat = FORMATS.MPC_STANDARD;

    public static exportToFile(commands: GuiCommand[], outputPath: string): void {

        const raw = this.encodeCommands(commands);
        const compressed = zlib.deflateSync(raw, { level: 9 });

        const header = this.buildHeader(raw.length, compressed.length);

        fs.writeFileSync(outputPath, Buffer.concat([header, compressed]));
    }

    private static buildHeader(rawSize: number, compressedSize: number): Buffer {

        switch (this.format.name) {

            case "STRING_COMPRESSED":
                return Buffer.from("COMPRESSED");

            case "GEARBOX_CANONICAL": {
                const buf = Buffer.alloc(16);
                MAGIC.CMP.copy(buf, 0);

                buf.writeUInt32LE(rawSize, 4);
                buf.writeUInt32LE(compressedSize, 8);

                // ⚠ unknown field preserved as 0 (do not assume meaning)
                buf.writeUInt32LE(0, 12);

                return buf;
            }

            case "MPC_STANDARD":
            default: {
                const buf = Buffer.alloc(12);
                MAGIC.MPC.copy(buf, 0);

                buf.writeUInt32LE(rawSize, 4);
                buf.writeUInt32LE(compressedSize, 8);

                return buf;
            }
        }
    }

    /**
     * =========================================================================
     * ENCODER (two-pass safe dependency resolution)
     * =========================================================================
     */
    private static encodeCommands(commands: GuiCommand[]): Buffer {

        const buffer = Buffer.alloc(commands.length * ELEMENT_SIZE);

        // PASS 1: index map
        const indexMap = new Map<string, number>();
        commands.forEach((c, i) => indexMap.set(c.name, i));

        // PASS 2: encode
        commands.forEach((cmd, i) => {

            const o = i * ELEMENT_SIZE;

            buffer.writeUInt16LE(this.getTypeCode(cmd.type), o + 0);

            buffer.writeInt16LE(this.i16(cmd.x), o + 2);
            buffer.writeInt16LE(this.i16(cmd.y), o + 4);
            buffer.writeInt16LE(this.i16(cmd.w), o + 6);
            buffer.writeInt16LE(this.i16(cmd.h), o + 8);

            buffer.writeUInt32LE(this.rgba(cmd.color), o + 10);
            buffer.writeUInt32LE(this.rgba(cmd.hoverColor), o + 14);

            buffer.writeInt16LE(this.i16(cmd.zPlane), o + 18);

            const dep = cmd.dependsOn && indexMap.has(cmd.dependsOn)
                ? indexMap.get(cmd.dependsOn)!
                : -1;

            buffer.writeInt16LE(dep, o + 20);

            buffer.writeUInt16LE(this.blend(cmd.blendMode), o + 22);

            buffer.writeUInt16LE(this.ms(cmd.fadeInTime), o + 24);
            buffer.writeUInt16LE(this.ms(cmd.fadeOutTime), o + 26);

            buffer.writeUInt32LE(0, o + 28);
        });

        return buffer;
    }

    /**
     * =========================================================================
     * HELPERS (strict, deterministic)
     * =========================================================================
     */
    private static i16(v?: number): number {
        return Math.max(-32768, Math.min(32767, Math.round(v || 0)));
    }

    private static ms(v?: number): number {
        return Math.max(0, Math.min(65535, Math.round((v || 0) * 1000)));
    }

    private static rgba(input?: string): number {
        if (!input) return 0xFFFFFFFF;

        const m = input.match(/\d+(\.\d+)?/g);
        if (!m) return 0xFFFFFFFF;

        let [r, g, b, a = "1"] = m.map(Number);

        const alpha = Math.round((Number(a) > 1 ? Number(a) / 255 : Number(a)) * 255);

        return (
            ((alpha & 0xFF) << 24) |
            ((b & 0xFF) << 16) |
            ((g & 0xFF) << 8) |
            (r & 0xFF)
        ) >>> 0;
    }

    private static getTypeCode(t?: string): number {
        return {
            GUI_SCREEN: 0,
            GUI_GENERIC: 1,
            GUI_CAPTION: 2,
            GUI_INPUT: 3,
            GUI_DEPENDENCY: 4,
            GUI_ACTION: 5
        }[(t || "").toUpperCase()] ?? 1;
    }

    private static blend(b?: string): number {
        return {
            "GL_ONE GL_ONE": 1,
            "GL_SRC_ALPHA GL_ONE_MINUS_SRC_ALPHA": 2,
            "GL_SRC_COLOR GL_ONE": 3,
            "GL_ZERO GL_SRC_COLOR": 4
        }[(b || "").toUpperCase()] ?? 2;
    }
}

/**
 * ============================================================================
 * LOADER (strict format dispatch, no heuristics)
 * ============================================================================
 */
export class BinaryLoader {

    public static load(path: string): Buffer {

        const file = fs.readFileSync(path);
        const format = this.detect(file);

        if (!format) {
            throw new Error("Unknown binary format");
        }

        const body = file.subarray(format.compressedOffset);

        return zlib.inflateSync(body);
    }

    private static detect(file: Buffer): BinaryFormat | null {

        for (const key in FORMATS) {
            const f = FORMATS[key];

            if (file.subarray(0, f.magic.length).equals(f.magic)) {
                return f;
            }
        }

        return null;
    }
}
