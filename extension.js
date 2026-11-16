const vscode = require('vscode');

const TasksStorage = require('./src/backend/storage');

/**
 * Supplies the webview shown in the "Todo List" sidebar (Activity Bar icon on the left).
 * The view id must match "views" -> "todoList" -> "id" in package.json.
 */
class TasksViewProvider {
	static viewId = 'todoList.tasksView';

	/**
	 * @param {vscode.Uri} extensionUri
	 * @param {TasksStorage} storage
	 */
	constructor(extensionUri, storage) {
		this.extensionUri = extensionUri;
		this.storage = storage;
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
					await this.storage.addTask(msg.desc);
					break;
				case 'toggle':
					await this.storage.toggleTask(msg.id);
					break;
				case 'delete':
					await this.storage.deleteTask(msg.id);
					break;
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

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			TasksViewProvider.viewId,
			new TasksViewProvider(context.extensionUri, storage)
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
		.add-row { display: flex; gap: 6px; margin-bottom: 10px; }
		input[type="text"] {
			flex: 1;
			min-width: 0;
			padding: 4px 6px;
			color: var(--vscode-input-foreground);
			background: var(--vscode-input-background);
			border: 1px solid var(--vscode-input-border, transparent);
		}
		input[type="text"]:focus { outline: 1px solid var(--vscode-focusBorder); }
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
	</style>
</head>
<body>
	<div class="add-row">
		<input id="taskInput" type="text" placeholder="Enter a task">
		<button id="addTaskButton">Add</button>
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
