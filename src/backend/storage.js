class TasksStorage {
    constructor(context) {
        this.storage = context.workspaceState;
        this.key = 'tasks';
    }

    getTasks(){
        // Return a copy so callers never mutate the stored array directly
        return [...this.storage.get(this.key, [])];
    }

    saveTasks(tasks){
        console.log('Saving tasks:', tasks);
        return this.storage.update(this.key, tasks);
    }

    addTask(task, refs = []){
        const tasks = this.getTasks();
        const newTask = {
            id: Date.now().toString(),
            desc: task,
            completed: false,
            refs // [{ relPath, uri, isFolder }] for each @file/@folder in desc
        }
        tasks.push(newTask);
        console.log('Adding task:', newTask);
        return this.saveTasks(tasks).then(() => newTask);
    }

    toggleTask(id){
        const tasks = this.getTasks().map(task => 
            task.id === id ?  {...task, completed: !task.completed} : task
        );
        console.log('Toggling task with id:', id);
        return this.saveTasks(tasks);
    }

    editTask(id, desc, refs = []){
        const tasks = this.getTasks().map(task =>
            task.id === id ? {...task, desc, refs} : task
        );
        console.log('Editing task with id:', id);
        return this.saveTasks(tasks);
    }

    deleteTask(id){
        console.log('Deleting task with id:', id);
        const tasks = this.getTasks().filter(task => task.id !== id);
        return this.saveTasks(tasks);
    }

}

module.exports = TasksStorage;