const vscode = require('vscode');

const EXCLUDE = '**/{node_modules,.git}/**';
const MAX_FILES = 2000;
const MAX_RESULTS = 20;

/**
 * Lists the workspace's files and folders so the webview can autocomplete "@" references.
 * The list is built lazily and thrown away whenever files are created or deleted.
 */
class FileIndex {
    constructor() {
        this.entries = null;
        // Only care about create/delete (ignore change events)
        this.watcher = vscode.workspace.createFileSystemWatcher('**/*', false, true, false);
        this.watcher.onDidCreate(() => { this.entries = null; });
        this.watcher.onDidDelete(() => { this.entries = null; });
    }

    async getEntries() {
        if (this.entries) {
            return this.entries;
        }
        const uris = await vscode.workspace.findFiles('**/*', EXCLUDE, MAX_FILES);
        const files = [];
        const folders = new Map(); // relPath -> entry, so each folder is added once

        for (const uri of uris) {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
            if (!workspaceFolder) {
                continue;
            }
            const relPath = vscode.workspace.asRelativePath(uri, false);
            files.push({ relPath, uri: uri.toString(), isFolder: false });

            // Add every parent folder, e.g. "src/frontend/app.js" -> "src", "src/frontend"
            const parts = relPath.split('/');
            for (let i = 1; i < parts.length; i++) {
                const folderPath = parts.slice(0, i).join('/');
                if (!folders.has(folderPath)) {
                    const folderUri = vscode.Uri.joinPath(workspaceFolder.uri, ...parts.slice(0, i));
                    folders.set(folderPath, { relPath: folderPath, uri: folderUri.toString(), isFolder: true });
                }
            }
        }

        this.entries = [...folders.values(), ...files];
        return this.entries;
    }

    /**
     * @param {string} query text typed after "@"
     */
    async search(query) {
        const q = query.toLowerCase();
        const entries = await this.getEntries();
        const baseName = (entry) => entry.relPath.split('/').pop().toLowerCase();

        // Lower score = better match: name starts with query, then name contains it, then path contains it
        const score = (entry) => {
            const name = baseName(entry);
            if (name.startsWith(q)) {
                return 0;
            }
            return name.includes(q) ? 1 : 2;
        };

        return entries
            .filter(entry => entry.relPath.toLowerCase().includes(q))
            .sort((a, b) => score(a) - score(b) || a.relPath.length - b.relPath.length)
            .slice(0, MAX_RESULTS);
    }

    dispose() {
        this.watcher.dispose();
    }
}

module.exports = FileIndex;
