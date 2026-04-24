// /src/webview/PreviewProvider.ts

import * as vscode from 'vscode';
import * as path from 'path';
import { GuiCommand } from '../core/Types';

export class LauncherPreviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'launcher.preview';
    public _view?: vscode.WebviewView;

    private _onDidReceiveMessage = new vscode.EventEmitter<any>();
    public readonly onDidReceiveMessage = this._onDidReceiveMessage.event;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        const activeEditor = vscode.window.activeTextEditor;
        const documentUri = activeEditor?.document.uri;

        const folderUri = documentUri 
                ? vscode.Uri.file(path.dirname(documentUri.fsPath)) 
                : undefined;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'out'),
                vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'media'),

                vscode.Uri.file(path.dirname(vscode.window.activeTextEditor?.document.uri.fsPath || ''))
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(data => {
            this._onDidReceiveMessage.fire(data);
        });
    }

    public update(commands: GuiCommand[]) {
        if (this._view) {
            this._view.webview.postMessage({ type: 'render', commands });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'main.js')
        );

        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'media', 'style.css')
        );

        const nonce = getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    <meta http-equiv="Content-Security-Policy" 
          content="default-src 'none'; 
                   style-src ${webview.cspSource} 'unsafe-inline'; 
                   script-src 'nonce-${nonce}'; 
                   img-src ${webview.cspSource} https:;">

    <link rel="stylesheet" href="${styleUri}">
</head>
<body>
    <canvas id="screen" width="640" height="448"></canvas>

    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
