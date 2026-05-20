class TasksStorage {
    constructor(context) {
        this.storage = context.globalState;
        this.key = 'tasks';
    }

    getTasks(){
        console.log(this.storage.get(this.key, []));
        return this.storage.get(this.key, []);
    }

    saveTasks(tasks){
        console.log('Saving tasks:', tasks);
        return this.storage.update(this.key, tasks);
    }

    addTask(task){
        const tasks = this.getTasks();
        const newTask = {
            id: Date.now().toString(),
            desc: task,
            completed: false
        }
        tasks.push(newTask);
        console.log('Adding task:', newTask);
        return this.saveTasks(tasks).then(() => newTask);
    }

    toggleTask(id){
        const tasks = this.getTasks().map(task => {
            task.id === id ?  {...task, completed: !task.completed} : task
        });
        console.log('Toggling task with id:', id);
        return this.saveTasks(tasks);
    }

    deleteTask(id){
        console.log('Deleting task with id:', id);
        const tasks = this.getTasks().filter(task => task.id !== id);
        return this.saveTasks(tasks);
    }

}

module.exports = TasksStorage;