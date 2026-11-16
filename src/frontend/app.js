(function () {
    // eslint-disable-next-line no-undef
    const vscode = acquireVsCodeApi();

    const inputField = document.getElementById('taskInput');
    const taskList = document.getElementById('taskList');
    const refPopup = document.getElementById('refPopup');

    // "@" autocomplete state
    let popupItems = [];   // current search results shown in the popup
    let activeIndex = 0;   // highlighted result
    let latestQuery = null; // ignore results for queries the user has already typed past
    let pendingRefs = [];  // refs picked for the task currently being typed

    // "src/frontend/app.js" -> "app.js", folders get a trailing slash: "src/frontend/"
    function displayName(ref) {
        const name = ref.relPath.split('/').pop();
        return ref.isFolder ? name + '/' : name;
    }

    function escapeRegExp(text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // Fills `container` with the task text, turning each "@path" from task.refs into a clickable link
    function renderDesc(container, task) {
        const refs = task.refs || [];
        if (!refs.length) {
            container.textContent = task.desc;
            return;
        }

        const refsByToken = new Map(refs.map(ref => ['@' + ref.relPath, ref]));
        // Longest first so "@src/app.js" wins over "@src"
        const tokens = [...refsByToken.keys()].sort((a, b) => b.length - a.length).map(escapeRegExp);
        const parts = task.desc.split(new RegExp(`(${tokens.join('|')})`));

        parts.forEach(part => {
            const ref = refsByToken.get(part);
            if (!ref) {
                container.append(part); // plain text node, can't inject HTML
                return;
            }
            const link = document.createElement('a');
            link.className = 'ref';
            link.textContent = displayName(ref);
            link.title = ref.relPath + (ref.isFolder ? ' (reveal in Explorer)' : ' (open file)');
            link.href = '#';
            link.addEventListener('click', (e) => {
                e.preventDefault();
                vscode.postMessage({ type: 'openRef', uri: ref.uri, isFolder: ref.isFolder });
            });
            container.append(link);
        });
    }

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
        renderDesc(text, task);
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
        // Drop refs whose "@path" the user deleted from the text before submitting
        const refs = pendingRefs.filter(ref => desc.includes('@' + ref.relPath));
        vscode.postMessage({ type: 'add', desc, refs });
        inputField.value = '';
        pendingRefs = [];
        hidePopup();
    }

    // Returns the "@query" being typed just before the cursor, or null
    function getMentionQuery() {
        const beforeCursor = inputField.value.slice(0, inputField.selectionStart);
        const match = beforeCursor.match(/(^|\s)@([^\s@]*)$/);
        return match ? match[2] : null;
    }

    function showPopup(items) {
        popupItems = items;
        activeIndex = 0;
        if (!items.length) {
            hidePopup();
            return;
        }
        refPopup.innerHTML = '';
        items.forEach((item, index) => {
            const option = document.createElement('li');
            const name = document.createElement('span');
            name.textContent = displayName(item);
            option.appendChild(name);

            // Show the containing folder dimmed after the name
            const dir = item.relPath.split('/').slice(0, -1).join('/');
            if (dir) {
                const dirLabel = document.createElement('span');
                dirLabel.className = 'ref-dir';
                dirLabel.textContent = dir;
                option.appendChild(dirLabel);
            }
            option.title = item.relPath;
            // mousedown + preventDefault keeps focus in the input, so blur doesn't close the popup first
            option.addEventListener('mousedown', (e) => {
                e.preventDefault();
                selectItem(index);
            });
            refPopup.appendChild(option);
        });
        refPopup.hidden = false;
        highlight(0);
    }

    function hidePopup() {
        refPopup.hidden = true;
        popupItems = [];
        latestQuery = null;
    }

    function highlight(index) {
        activeIndex = (index + popupItems.length) % popupItems.length; // wrap around
        [...refPopup.children].forEach((option, i) => option.classList.toggle('active', i === activeIndex));
        refPopup.children[activeIndex].scrollIntoView({ block: 'nearest' });
    }

    // Replaces the "@query" before the cursor with "@full/path " and remembers the ref
    function selectItem(index) {
        const item = popupItems[index];
        const cursor = inputField.selectionStart;
        const beforeCursor = inputField.value.slice(0, cursor).replace(/@[^\s@]*$/, '@' + item.relPath + ' ');
        inputField.value = beforeCursor + inputField.value.slice(cursor);
        inputField.setSelectionRange(beforeCursor.length, beforeCursor.length);

        if (!pendingRefs.some(ref => ref.uri === item.uri)) {
            pendingRefs.push(item);
        }
        hidePopup();
        inputField.focus();
    }

    inputField.addEventListener('input', () => {
        const query = getMentionQuery();
        if (query === null) {
            hidePopup();
            return;
        }
        latestQuery = query;
        vscode.postMessage({ type: 'searchFiles', query });
    });

    inputField.addEventListener('keydown', (e) => {
        if (!refPopup.hidden) {
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    highlight(activeIndex + 1);
                    return;
                case 'ArrowUp':
                    e.preventDefault();
                    highlight(activeIndex - 1);
                    return;
                case 'Enter':
                case 'Tab':
                    e.preventDefault(); // pick the file instead of adding the task
                    selectItem(activeIndex);
                    return;
                case 'Escape':
                    e.preventDefault();
                    hidePopup();
                    return;
            }
        }
        if (e.key === 'Enter') {
            addTask();
        }
    });

    inputField.addEventListener('blur', hidePopup);

    // Handle messages coming FROM the extension
    window.addEventListener('message', (event) => {
        const msg = event.data;
        if (msg.type === 'tasks') {
            render(msg.tasks);
        } else if (msg.type === 'fileResults' && msg.query === latestQuery) {
            showPopup(msg.items);
        }
    });

    // Ask for the initial list once the script has loaded
    vscode.postMessage({ type: 'ready' });
})();
