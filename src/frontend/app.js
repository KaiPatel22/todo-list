(function () {
    // eslint-disable-next-line no-undef
    const vscode = acquireVsCodeApi();

    const inputField = document.getElementById('taskInput');
    const taskList = document.getElementById('taskList');

    function createListItem(task) {
        const listItem = document.createElement('li');
        listItem.style.display = 'flex';
        listItem.style.alignItems = 'center';
        listItem.style.gap = '8px';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = task.completed;
        checkbox.addEventListener('change', () => {
            vscode.postMessage({ type: 'toggle', id: task.id });
        });

        const text = document.createElement('span');
        text.textContent = task.desc; // textContent, not innerHTML, so user text can't inject HTML
        text.style.flex = '1';
        if (task.completed) {
            listItem.classList.add('completed'); // greyed out + struck through, styled in extension.js
        }

        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-btn'; // styled in extension.js: grey, only visible on hover
        deleteButton.textContent = '×';
        deleteButton.title = 'Delete task';
        deleteButton.setAttribute('aria-label', 'Delete task');
        deleteButton.addEventListener('click', () => {
            vscode.postMessage({ type: 'delete', id: task.id });
        });

        listItem.append(checkbox, text, deleteButton);
        return listItem;
    }

    function render(tasks) {
        taskList.innerHTML = '';
        tasks.forEach(task => taskList.appendChild(createListItem(task)));
    }

    function addTask() {
        const desc = inputField.value.trim();
        if (!desc) {
            return;
        }
        vscode.postMessage({ type: 'add', desc });
        inputField.value = '';
    }

    inputField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            addTask();
        }
    });

    // Handle messages coming FROM the extension
    window.addEventListener('message', (event) => {
        const msg = event.data;
        if (msg.type === 'tasks') {
            render(msg.tasks);
        }
    });

    // Ask for the initial list once the script has loaded
    vscode.postMessage({ type: 'ready' });
})();
