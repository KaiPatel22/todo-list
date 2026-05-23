(function () {
    const vscode = acquireVsCodeApi();

    document.addEventListener('DOMContentLoaded', () => {
        const inputField = document.getElementById('taskInput');
        const addButton = document.getElementById('addTaskButton');
        const taskList = document.getElementById('taskList');

        function createListItem(description, id){
            const listItem = document.createElement('li');
            listItem.style.display = 'flex';
            listItem.style.alignItems = 'center';
            listItem.style.gap = '8px';

            return listItem;
        }


    });

});

/*
IDEA 

have code for creating a list item in here, the html needed etc...
Have event listeners e.g. 
    add button clicked --> post a message to add a task passing the params such as description and id 
Pass messages back towards somewhere (idk yet)
Probably want to post messages to the extension.js and then from there call TaskStorage methods such as addTask
*/  