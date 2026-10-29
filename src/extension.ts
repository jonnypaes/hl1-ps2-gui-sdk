// /src/extension.ts

import * as vscode from 'vscode';
import * as path from 'path';
import { LauncherPreviewProvider } from './webview/PreviewProvider';
import { Scanner } from './core/Scanner';
import { Parser } from './core/Parser';
import { BinaryExporter } from './core/BinaryExporter';
import { inspectGuidef } from './core/GuidefInspection';

export function activate(context: vscode.ExtensionContext) {
    const provider = new LauncherPreviewProvider(context.extensionUri);

    // 1. Register Webview Provider
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(LauncherPreviewProvider.viewType, provider)
    );

    // 2. Listener for messages from the Webview
    context.subscriptions.push(
        provider.onDidReceiveMessage((message: any) => {
            if (message.type === 'ELEMENT_CLICK') {
                const editor = vscode.window.activeTextEditor;
                if (!editor) return;

                if (message.line) {
                    const pos = new vscode.Position(message.line - 1, 0);
                    editor.selection = new vscode.Selection(pos, pos);
                    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
                } else {
                    const text = editor.document.getText();
                    const regex = new RegExp(`NAME\\s+${message.name}`, 'i');
                    const match = regex.exec(text);
                    if (match) {
                        const pos = editor.document.positionAt(match.index);
                        editor.selection = new vscode.Selection(pos, pos);
                        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
                    }
                }
            }
        })
    );

    // 3. Preview Update Logic with Webview URI support
    const updatePreview = (document: vscode.TextDocument) => {
        // Language and extension validation
        if (document.languageId !== 'launcher' && !document.fileName.endsWith('.guidef')) return;
        
        try {
            const scanner = new Scanner(document.getText());
            const tokens = scanner.scanTokens(); 
            const parser = new Parser(tokens);
            const rawCommands = parser.parse();
            
            const folderUri = vscode.Uri.file(path.dirname(document.uri.fsPath));

            // TEXTURE CONVERSION: PSI -> PNG -> Webview URI
            const commands = rawCommands.map(cmd => {
                if (cmd.texture) {
                    const original = cmd.texture.trim();
                    
                    // 1. Resolve file name: handles "gordon psi" or "gordon.psi" -> "gordon.png"
                    let fileName = original
                        .replace(/\s+psi$/i, '.png')  // Replace space+psi with .png
                        .replace(/\.psi$/i, '.png');  // Replace .psi with .png
                    
                    // 2. Create full path
                    const fileUri = vscode.Uri.joinPath(folderUri, fileName);
                    
                    // 3. Convert to Webview URI if the view is ready
                    if (provider._view) {
                        cmd.texture = provider._view.webview.asWebviewUri(fileUri).toString();
                        // Now the log will show the real URL (vscode-webview://...)
                        console.log(`🖼️ [Render] ${original} -> ${cmd.texture}`);
                    }
                }
                return cmd;
            });

            // Send commands sorted by Z_PLANE
            provider.update(commands.sort((a, b) => a.zPlane - b.zPlane));
        } catch (e) {
            console.error("Error in rendering pipeline:", e);
        }
    };

    // Document event listeners
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(e => updatePreview(e.document)),
        vscode.window.onDidChangeActiveTextEditor(e => e && updatePreview(e.document))
    );

    // The same source-only inspection engine used by the static browser site.
    // Deliberately independent from legacy preview and binary exporting.
    const inspectionChannel = vscode.window.createOutputChannel('HL1 PS2 GUIDEF Inspector');
    context.subscriptions.push(inspectionChannel);
    context.subscriptions.push(vscode.commands.registerCommand('hl-ps2-sdk.inspectGuidef', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('Open a guidef.txt to inspect its source.');
            return;
        }
        const result = inspectGuidef(editor.document.getText());
        inspectionChannel.clear();
        inspectionChannel.appendLine('GUIDEF source inspection (not verified PS2 runtime behavior)');
        inspectionChannel.appendLine('File: ' + editor.document.uri.toString());
        inspectionChannel.appendLine('Lines: ' + result.lines.length + ', blocks: ' + result.blocks.length +
            ', notes: ' + result.diagnostics.length);
        for (const block of result.blocks) {
            inspectionChannel.appendLine('[' + block.id + '] ' + block.type + ' @ ' + block.startLine +
                (block.endLine !== null ? '..' + block.endLine : '..unclosed') +
                (block.parentId !== null ? ' parent #' + block.parentId : ''));
            for (const prop of block.properties) {
                inspectionChannel.appendLine('  L' + prop.line + ' ' + prop.key + ' ' + prop.value);
            }
        }
        for (const diagnostic of result.diagnostics) {
            inspectionChannel.appendLine(diagnostic.severity.toUpperCase() + ' L' + diagnostic.line +
                ' ' + diagnostic.code + ': ' + diagnostic.message);
        }
        inspectionChannel.show(true);
    }));

    // 4. Build Command
    const buildCommand = vscode.commands.registerCommand('hl-ps2-sdk.buildBinary', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            try {
                const scanner = new Scanner(editor.document.getText());
                const parser = new Parser(scanner.scanTokens());
                const commands = parser.parse();
                const binPath = editor.document.uri.fsPath.replace(/\.[^/.]+$/, "") + ".gui.bin";
                
                BinaryExporter.exportToFile(commands, binPath);
                vscode.window.showInformationMessage(`🎮 PS2-Strike build completed: ${binPath}`);
            } catch (err: any) {
                vscode.window.showErrorMessage(`Erro no build: ${err.message}`);
            }
        }
    });
    context.subscriptions.push(buildCommand);

    // Initial Trigger
    if (vscode.window.activeTextEditor) {
        setTimeout(() => updatePreview(vscode.window.activeTextEditor!.document), 500);
    }
}

export function deactivate() {}
