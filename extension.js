const vscode = require('vscode');

const TasksStorage = require('./src/backend/storage');
const FileIndex = require('./src/backend/fileIndex');

/**
 * Supplies the webview shown in the "Todo List" sidebar (Activity Bar icon on the left).
 * The view id must match "views" -> "todoList" -> "id" in package.json.
 */
class TasksViewProvider {
	static viewId = 'todoList.tasksView';

	/**
	 * @param {vscode.Uri} extensionUri
	 * @param {TasksStorage} storage
	 * @param {FileIndex} fileIndex
	 */
	constructor(extensionUri, storage, fileIndex) {
		this.extensionUri = extensionUri;
		this.storage = storage;
		this.fileIndex = fileIndex;
	}

	/**
	 * Called by VS Code the first time the view becomes visible.
	 * @param {vscode.WebviewView} webviewView
	 */
	resolveWebviewView(webviewView) {
		const webview = webviewView.webview;

		webview.options = {
			enableScripts: true,
			// Only allow the webview to load files from src/frontend
			localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'src', 'frontend')]
		};

		webview.html = getWebviewContent(webview, this.extensionUri);

		// Send the current list to the webview
		const sendTasks = () => webview.postMessage({ type: 'tasks', tasks: this.storage.getTasks() });

		// Handle messages coming FROM the webview
		webview.onDidReceiveMessage(async (msg) => {
			switch (msg.type) {
				case 'ready': // webview loaded, wants initial data
					break;
				case 'add':
					await this.storage.addTask(msg.desc, msg.refs);
					break;
				case 'toggle':
					await this.storage.toggleTask(msg.id);
					break;
				case 'delete':
					await this.storage.deleteTask(msg.id);
					break;
				case 'searchFiles': // user typed "@query", reply with matching files/folders
					webview.postMessage({
						type: 'fileResults',
						query: msg.query,
						items: await this.fileIndex.search(msg.query)
					});
					return;
				case 'openRef': // user clicked a file/folder reference on a task
					await openRef(msg.uri, msg.isFolder);
					return;
			}
			sendTasks(); // always reply with the fresh list
		});
	}
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	const storage = new TasksStorage(context);
	const fileIndex = new FileIndex();

	context.subscriptions.push(
		fileIndex,
		vscode.window.registerWebviewViewProvider(
			TasksViewProvider.viewId,
			new TasksViewProvider(context.extensionUri, storage, fileIndex)
		)
	);

	// The old command now just opens the sidebar view.
	// "<viewId>.focus" is a command VS Code creates automatically for every view.
	context.subscriptions.push(
		vscode.commands.registerCommand('todo-list.helloWorld', () =>
			vscode.commands.executeCommand(`${TasksViewProvider.viewId}.focus`)
		)
	);
}

/**
 * Opens a referenced file in the editor, or reveals a referenced folder in the Explorer.
 * @param {string} uriString
 * @param {boolean} isFolder
 */
async function openRef(uriString, isFolder) {
	const uri = vscode.Uri.parse(uriString);
	try {
		if (isFolder) {
			await vscode.commands.executeCommand('revealInExplorer', uri);
		} else {
			await vscode.window.showTextDocument(uri);
		}
	} catch {
		vscode.window.showWarningMessage(`Couldn't open ${uri.fsPath}. It may have been moved or deleted.`);
	}
}

/**
 * @param {vscode.Webview} webview
 * @param {vscode.Uri} extensionUri
 */
function getWebviewContent(webview, extensionUri) {
	// Convert the file path into a URI the webview is allowed to load
	const scriptUri = webview.asWebviewUri(
		vscode.Uri.joinPath(extensionUri, 'src', 'frontend', 'app.js')
	);
	const nonce = getNonce();

	// The --vscode-* CSS variables make the view match the user's colour theme.
	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy"
		content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
	<title>Todo List</title>
	<style>
		body {
			padding: 8px 4px;
			color: var(--vscode-foreground);
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
		}
		.add-row { margin-bottom: 10px; }
		.input-wrap { position: relative; }
		/* "@" autocomplete dropdown, shown under the input */
		.ref-popup {
			position: absolute;
			top: 100%;
			left: 0;
			right: 0;
			z-index: 10;
			max-height: 200px;
			overflow-y: auto;
			list-style: none;
			margin: 2px 0 0;
			padding: 2px 0;
			color: var(--vscode-editorSuggestWidget-foreground, var(--vscode-foreground));
			background: var(--vscode-editorSuggestWidget-background, var(--vscode-input-background));
			border: 1px solid var(--vscode-editorSuggestWidget-border, var(--vscode-widget-border, transparent));
		}
		.ref-popup li {
			padding: 2px 6px;
			cursor: pointer;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
		/* Folder path shown dimmed after the name, like VS Code's quick open */
		.ref-popup .ref-dir {
			margin-left: 6px;
			font-size: 0.9em;
			opacity: 0.7;
		}
		.ref-popup li.active {
			color: var(--vscode-editorSuggestWidget-selectedForeground, var(--vscode-list-activeSelectionForeground));
			background: var(--vscode-editorSuggestWidget-selectedBackground, var(--vscode-list-activeSelectionBackground));
		}
		/* Clickable @file / @folder reference inside a task: a small grey box, like Copilot Chat's file pills */
		.ref {
			display: inline-block;
			padding: 0 4px;
			margin: 0 1px;
			border-radius: 4px;
			border: 1px solid var(--vscode-widget-border, transparent);
			background: var(--vscode-textCodeBlock-background, var(--vscode-editorWidget-background));
			color: var(--vscode-foreground);
			font-size: 0.92em;
			line-height: 1.4;
			text-decoration: none;
			vertical-align: baseline;
			cursor: pointer;
		}
		.ref:hover {
			background: var(--vscode-list-hoverBackground);
			border-color: var(--vscode-focusBorder);
		}
		#taskList li.completed .ref {
			color: inherit;
			text-decoration: line-through;
			opacity: 0.7;
		}
		input[type="text"] {
			width: 100%;
			box-sizing: border-box;
			padding: 4px 6px;
			color: var(--vscode-input-foreground);
			background: var(--vscode-input-background);
			border: 1px solid var(--vscode-input-border, transparent);
		}
		input[type="text"]:focus { outline: 1px solid var(--vscode-focusBorder); }
		/* Small grey italic hint under the input, aligned to its right edge */
		.add-hint {
			margin-top: 3px;
			text-align: right;
			font-size: 0.85em;
			font-style: italic;
			color: var(--vscode-descriptionForeground);
		}
		button {
			padding: 4px 10px;
			color: var(--vscode-button-foreground);
			background: var(--vscode-button-background);
			border: none;
			cursor: pointer;
		}
		button:hover { background: var(--vscode-button-hoverBackground); }
		#taskList { list-style: none; padding: 0; margin: 0; }
		#taskList li { padding: 3px 0; }
		#taskList li span { overflow-wrap: anywhere; }
		#taskList li.completed span {
			color: var(--vscode-disabledForeground, var(--vscode-descriptionForeground));
			text-decoration: line-through;
		}
		#taskList li.completed input[type="checkbox"] { opacity: 0.6; }
		#taskList .delete-btn {
			visibility: hidden;
			padding: 0 4px;
			font-size: 20px;
			line-height: 1;
			color: var(--vscode-descriptionForeground);
			background: transparent;
		}
		#taskList li:hover .delete-btn,
		#taskList li:focus-within .delete-btn { visibility: visible; }
		#taskList .delete-btn:hover {
			color: var(--vscode-foreground);
			background: transparent;
		}
	</style>
</head>
<body>
	<div class="add-row">
		<div class="input-wrap">
			<input id="taskInput" type="text" placeholder="Enter a task (@ to reference a file)">
			<ul id="refPopup" class="ref-popup" hidden></ul>
		</div>
		<div class="add-hint">'Enter' to add</div>
	</div>
	<ul id="taskList"></ul>
	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function getNonce() {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let text = '';
	for (let i = 0; i < 32; i++) {
		text += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return text;
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
};
