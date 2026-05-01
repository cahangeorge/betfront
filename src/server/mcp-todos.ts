import fs from 'node:fs';

const todosPath = './mcp-todos.json';

export type Todo = {
  id: number;
  title: string;
};

const todos: Todo[] = fs.existsSync(todosPath)
  ? (JSON.parse(fs.readFileSync(todosPath, 'utf8')) as Todo[])
  : [{ id: 1, title: 'Buy groceries' }];

let subscribers: Array<(todos: Todo[]) => void> = [];

export function getTodos(): Todo[] {
  return todos;
}

export function addTodo(title: string) {
  todos.push({ id: todos.length + 1, title });
  fs.writeFileSync(todosPath, JSON.stringify(todos, null, 2));
  notifySubscribers();
}

export function subscribeToTodos(callback: (todos: Todo[]) => void) {
  subscribers.push(callback);
  callback(todos);
  return () => {
    subscribers = subscribers.filter((cb) => cb !== callback);
  };
}

function notifySubscribers() {
  for (const cb of subscribers) {
    try {
      cb(todos);
    } catch {}
  }
}
