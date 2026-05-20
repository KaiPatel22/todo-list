// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "todo-list" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('todo-list.helloWorld', function () {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		vscode.window.showInformationMessage('Todo List Extension started successfully!');

		var windowPanel = vscode.window.createWebviewPanel(
			'todoList', // Internal identifier for the panel 
			'Visual Studio Todo List Extension', // Title of the panel displayed to the user
			vscode.ViewColumn.One, // Show the new webview in the first column
			{} // Webview options (e.g., enable scripts, retain context when hidden, etc.)
		);
		windowPanel.webview.html = getWebviewContent();
	});

	context.subscriptions.push(disposable);
}

function getWebviewContent() {
	return `<!DOCTYPE html>
	<head>
		<title>Todo List</title>
	</head>
	<body>
		<h1>Todo List Extension</h1>
		<p>This is a simple todo list extension for Visual Studio Code.</p>
	</body>
	</html>`;
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
