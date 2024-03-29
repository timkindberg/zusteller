# zusteller

Your global state savior. "Just hooks" + [zustand](https://github.com/react-spring/zustand).

## Disclaimer 

Zusteller is ~~brand new,~~ experimental ~~, and under development~~.

To enable the use of hooks within zustand **we render a React element into an HTMLElement in memory and it runs the hook.** 
When the hook result changes, we update the zustand store. 

We need more validation that this approach is performant and doesn't introduce any unexpected or dangerous bugs.

At the very minimum it serves as a proposal for how canonical React global state might be handled. 

[Update 08/28/21]

This is a fun experiment but I'm not super comfortable with the overall technical direction; it requires a bit of a hack to make it work.

I love the API though, that was always the driving force. I stubbornly acheived it, but to what end?

At my work, we chose react-tracked to get a very similar API. It gives me (mostly) what I wanted without any implementation hacks. It uses canonical React Context which will age better and always work well as new React versions come out.

## Motivation:

**It is rare that I need global state. Really rare.** You can fill 99% of your needs with regular React Hooks and a fetch caching library
(e.g. [react-query](https://react-query.tanstack.com/docs/overview) or [swr](https://github.com/vercel/swr)).

However, when you need to use global state you have to learn a new API. Redux, Zustand, Recoil...the APIs are nice but they
lack one main thing. **They are not "just hooks".**

A library that only _exposes_ a hook is nice, but if it cannot _nest_ hooks within, if it can't compose hooks in both
directions, then it is what I'm calling a "Terminal Hook". **It's the end of the line.**

Being a "Terminal Hook" brings challenges. How do you compose or merge various global states together? Redux has 
`combineReducers`. Recoil has `Selectors`. **Hooks compose naturally.**

Zustand was one of the first libraries to figure out how to elegantly share state without Context. It also has
selectors, a required feature when it's time to optimize performance. Zustand is my go-to global state solution and I consider
it to be a great accomplishment. **But it uses a custom API and I really like hooks.**

#### So... what if Zustand could work with regular hooks?

It might look something like this. 

----

## "Just hooks" + Zustand

### Pass create a hook

First import `create` from `zusteller`.

```js
import create from 'zusteller'
```

Pass `create` a hook. 

```js
const useMyState = () => useState(42)
const useStore = create(useMyState)
```

Or pass an inline-anonymous hook.

```js
const useStore = create(() => useState(42))
```

Now components can share the same state. When state updates they will all re-render. 
```js
const ComponentA = () => {
  const [state, setState] = useStore()
}
const ComponentB = () => {
  const [state, setState] = useStore()  
}
```

### Perform Logic and Compose Other Hooks

Use as many `useState` as you need.

```js
const useStore = create(() => {
  const [foo, setFoo] = useState()
  const [bar, setBar] = useState()
  //... do some logic
  return //... some things ...
})
```

Use other custom hooks together.

```js
const useStore = create(() => {
  const name = useUserName()
  const locale = useLocale()
  return { name, locale }
})
```

Use 3rd party hooks.

```js
import useImmer from 'use-immer'
import usePromise from 'react-use-promise'
const useStore = create(() => {
  const [person, updatePerson] = useImmer({
    id: 1,
    name: "Michael",
    age: 33
  });
  const [products, error] = usePromise(fetch('/api/cart' + person.id))
  return {products, person, updatePerson}
})
```

> Note: Contextual hooks will not work, see the section at the bottom.

### The returned zustand hook

The hook you are returned is a small wrapper around a regular [zustand](https://github.com/react-spring/zustand) hook object.

Use it in multiple React components. The state will be shared.

```js
const useStore = create(useState)

const ComponentA = () => {
  const [foo, setFoo] = useStore()
}
const ComponentB = () => {
  const [foo, setFoo] = useStore()
}
```

Use zustand's selector functionality normally, [reference their docs](https://github.com/react-spring/zustand#selecting-multiple-state-slices) for more info.

```js
const useStore = create(useState)

// ComponentA only rerenders if `foo` changes
const ComponentA = () => {
  const foo = useStore(s => s[0])
}

// ComponentA only rerenders if `setFoo` changes
const ComponentB = () => {
  const setFoo = useStore(s => s[1])
}
```

Use it outside of React, using the `getState` prototype method.

> zustand has a `setState` method on the hook, but zusteller does not.

```js
const useStore = create(useState)

const unsub = useStore.subscribe(console.log, s => s[0]) // Log anytime foo changes

const [foo, setFoo] = useStore.getState()
document.getElementById('button').on('click', () => setFoo('bar'))

unsub()
```

While zustand can only store `object` state, zusteller allows `literals, objects, arrays, and undefined/null`.

```js
const useStore = create(() => {
  if (false) return { foo: true }
  return 'a regular string'
})

// Just be sure to protect your selectors if the return type can be variable
const Component = () => {
  const msg = useStore(s => s?.foo)
}
```

### Passing Parameters to The Store's Underlying Hook

This is called atomFamily in Recoil and Jotai. It's the ability to create many forked instances of the store based on
parameters passed in during usage.

So if our hook took a parameter, for example an id.
```js
const useUserStore = create(id => {
  return useUser(id)
})
```

You can provide the parameters by passing them in an array as the first argument to the store.
```js
const ComponentA = () => {
  const user = useUserStore([42])
}
```

Each unique combination of parameters gets its own store instance. If two or more components pass the same parameters,
they will share a store.
```js
const ComponentA = () => {
  const user = useUserStore([42])
}
const ComponentB = () => {
  const user = useUserStore([96])
}
const ComponentC = () => {
  const user = useUserStore() // undefined is it's own unique parameter
}
const ComponentD = () => {
  const user = useUserStore([42]) // D will share a store with A
}
```

The arguments you pass to the hook are safely memo-ized (just like react-query does). For example this is fine.
```js
const ComponentA = () => {
  const user = useUserStore([42, { foo: true, bar: [1, 2, 3] }, 'hello', null])
}
```

## Examples

<details>
  <summary>Migrate Zustand's Doc Examples</summary>
  
> You'll have to follow along at https://github.com/pmndrs/zustand/blob/master/README.md
> I only recreate the code blocks not all of the text.

```js
import create from 'zusteller'

const useStore = create(() => {
  const [bears, setBears] = useState(0)
  const increasePopulation = () => setBears(prev => prev + 1)
  const removeAllBears = () => setBears(0)
  return { bears, increasePopulation, removeAllBears }
})
```

```jsx
function BearCounter() {
  const bears = useStore(state => state.bears)
  return <h1>{bears} around here ...</h1>
}

function Controls() {
  const increasePopulation = useStore(state => state.increasePopulation)
  return <button onClick={increasePopulation}>one up</button>
}
```

### Async actions

I'd just use react-query for this but let's recreate it anyway.

```js
import create from 'zusteller'

const useStore = create(() => {
  const [fishies, setFishies] = useState({})
  const fetch = async pond => {
    const response = await fetch(pond)
    setFishies(await response.json())
  }
  return {fishies, fetch}
})
```

Oh wait, but now we can compose other hooks! So we *can* use react-query. Would you look at that?

```js
import create from 'zusteller'
import { useQuery } from 'react-query'

const useStore = create(() => {
  const [pond, setPond] = useState('foo')
  const { data, ...queryInfo } = useQuery('fishies', () => fetch(`/api/${pond}`))
  // Maybe you need to alter the response in some way?
  // Who knows why people need global state... :shrug
  const fishies = data.map(fish => fish.slippery = true)
  return {fishies, queryInfo, setPond}
})

```

### Reading/writing state and reacting to changes outside of components

Works just like zustand.

> Except there is no `setState` prototype method. You must use methods exposed by
your hook to modify the internal hook's state.

```js
const useStore = create(() => useState({ paw: true, snout: true, fur: true }))

// Getting non-reactive fresh state
const paw = useStore.getState().paw
// Listening to all changes, fires on every change
const unsub1 = useStore.subscribe(console.log)
// Listening to selected changes, in this case when "paw" changes
const unsub2 = useStore.subscribe(console.log, state => state.paw)
// Subscribe also supports an optional equality function
const unsub3 = useStore.subscribe(console.log, state => [state.paw, state.fur], shallow)
// Updating state, will trigger listeners
const [, setState] = useStore.getState()
setState(prev => ({ ...prev, paw: false }))
// Unsubscribe listeners
unsub1()
unsub2()
unsub3()
// Destroying the store (removing all listeners)
useStore.destroy()
```

### Using zusteller without React

Not possible. Use zustand. Zusteller uses hooks, and hooks must be run using react and react-dom.

### Want to use immer? 

Use a 3rd party immer hook or write your own.

```js
import create from 'zusteller'
import produce from 'immer'

const useImmerState = initialState => {
    const [state, setState] = useState(initialState)
    const setImmerState = useCallback(setter => setState(produce(setter)), [])
    return [state, setImmerState]
}

const useStore = create(() => useImmerState({ lush: { forrest: { contains: { a: "bear" } } } }))

function Component() {
    const [state, setState] = useStore()
    setState(state => {
      state.lush.forrest.contains = null
    })
}
```

### Can't live without redux-like reducers and action types?

No judgement I guess. Here's how you do it, you just use `useReducer`. Simple.

```js
import create from 'zusteller'
import { useReducer } from 'react'

const types = { increase: "INCREASE", decrease: "DECREASE" }

const reducer = (state, { type, by = 1 }) => {
  switch (type) {
    case types.increase: return { grumpiness: state.grumpiness + by }
    case types.decrease: return { grumpiness: state.grumpiness - by }
  }
}

const useStore = create(() => useReducer(reducer, {grumpiness: 0}))

function Component() {
  const [state, dispatch] = useStore()
  dispatch({ type: types.increase, by: 2 })
}
```
</details>








<details>
  <summary>Migrate Constate's Doc Examples</summary>
  
> You'll have to follow along at https://github.com/diegohaz/constate/blob/master/README.md
> I only recreate the code blocks not all of the text.

```jsx
import React, { useState } from "react";
import create from "zusteller";

// 1️⃣ Create a custom hook as usual
function useCounter() {
  const [count, setCount] = useState(0);
  const increment = () => setCount(prevCount => prevCount + 1);
  return { count, increment };
}

// 2️⃣ Wrap your hook with the create function
const useCounterStore = create(useCounter);

function Button() {
  // 3️⃣ Use store hook instead of custom hook
  const { increment } = useCounterStore();
  return <button onClick={increment}>+</button>;
}

function Count() {
  // 4️⃣ Use store hook in other components
  const { count } = useCounterStore();
  return <span>{count}</span>;
}

function App() {
  // 5️⃣ DO NOT wrap your components with Provider
  return (
    <>
      <Count />
      <Button />
    </>
  );
}
```

Advanced Example

```jsx
import React, { useState, useCallback } from "react";
import create from "zusteller";

// 1️⃣ Create a custom hook that receives props
function useCounter({ initialCount = 0 }) {
  const [count, setCount] = useState(initialCount);
  // 2️⃣ Wrap your updaters with useCallback or use dispatch from useReducer
  const increment = useCallback(() => setCount(prev => prev + 1), []);
  return { count, increment };
}

// 3️⃣ Wrap your hook with the constate factory splitting the values
// 3.5 Pass props to your hook
const useCounterStore = create(() => useCounter({ initialCount: 10 }));

function Button() {
  // 4️⃣ Select just the increment function that will never trigger a re-render
  // 4.5 we get at it via our selector
  const increment = useCounterStore(s => s.increment);
  return <button onClick={increment}>+</button>;
}

function Count() {
  // 5️⃣ Use the state in other components
  // 5.5 Use the selector to only subscribe to the count
  const count = useCount(s => s.count);
  return <span>{count}</span>;
}

function App() {
  // 6️⃣ DO NOT wrap your components with Provider 
  return (
    <>
      <Count />
      <Button />
    </>
  );
}
```
</details>








<details>
  <summary>Migrate Recoil's Atoms Tutorial</summary>
  
> You'll have to follow along at https://recoiljs.org/docs/basic-tutorial/atoms
> I only recreate the code blocks not all of the text.

```js
const useTodoListStore = create(() => {
  // I'm gonna use this immer hook... because it'll make mutations easier
  // You can see the implementation up above somewhere
  const [todoList, setTodoList] = useImmerState([])
  return { todoList }
})
```

```jsx
function TodoList() {
  const todoList = useTodoListStore(s => s.todoList);

  return (
    <>
      {}
      {}
      <TodoItemCreator />

      {todoList.map((todoItem) => (
        <TodoItem key={todoItem.id} item={todoItem} />
      ))}
    </>
  );
}
```

```jsx
// Modify our hook to add the "addTodo" logic **there**
// We should keep the business logic together
const useTodoListStore = create(() => {
  const [todoList, setTodoList] = useImmerState([])

  // Wrap these bad boys in a memo so they won't cause rerenders
  // when they are selected
  const todoActions = useMemo(() => ({
    add: text => setTodoList(draft => {
      draft.push({ id: getId(), text, isComplete: false })
    })
  }), [])

  return { todoList, todoActions }
})
    

function TodoItemCreator() {
  const [inputValue, setInputValue] = useState('');
  const todoActions = useTodoListStore(s => s.todoActions);

  const addItem = () => {
    todoActions.add(inputValue)
    setInputValue('');
  };

  const onChange = ({target: {value}}) => {
    setInputValue(value);
  };

  return (
    <div>
      <input type="text" value={inputValue} onChange={onChange} />
      <button onClick={addItem}>Add</button>
    </div>
  );
}

let id = 0;
function getId() {
  return id++;
}
```

```jsx
// Modify our hook to add the Edit, Toggle and Delete logic
// Again, trying to keep busineses logic together
const useTodoListStore = create(() => {
  const [todoList, setTodoList] = useImmerState([])

  // Wrap these bad boys in a memo so they won't cause rerenders
  // when they are selected
  const todoActions = useMemo(() => ({
    add: text => setTodoList(draft => {
      draft.push({ id: getId(), text, isComplete: false })
    }),
    edit: (todo, text) => setTodoList(draft => {
      const todo = draft.find(t => t.id === todo.id)
      todo.text = text
    }),
    toggle: todo => setTodoList(draft => {
      const todo = draft.find(t => t.id === todo.id)
      todo.isComplete = !todo.isComplete
    }),
    delete: todo => setTodoList(draft => {
      return draft.filter(t => t.id !== todo.id)
    })
  }), [])

  return { todoList, todoActions }
})

function TodoItem({item}) {
  const todoActions = useTodoListStore(s => s.todoActions)

  return (
    <div>
      <input type="text" value={item.text} onChange={e => todoActions.edit(item, e.target.value)} />
      <input
        type="checkbox"
        checked={item.isComplete}
        onChange={() => todoActions.toggle(item)}
      />
      <button onClick={() => deleteItem(item)}>X</button>
    </div>
  );
}
```
</details>








<details>
  <summary>Migrate Recoil's Selectors Tutorial</summary>
  
  > These code example reference variables created in the previous section
  
  > You'll have to follow along at https://recoiljs.org/docs/basic-tutorial/selectors
  > I only recreate the code blocks not all of the text.
  
```js
const useTodoListFilterStore = create(() => useState('Show All'));
```

```js
const useFilteredTodoListStore = create(() => {
  const [filter] = useFilteredTodoListStore()
  const { todoList } = useTodoListStore()
  switch (filter) {
    case 'Show Completed':
      return todoList.filter((item) => item.isComplete);
    case 'Show Uncompleted':
      return todoList.filter((item) => !item.isComplete);
    default:
      return todoList;
  }
})
```

> Side Note: In their tutorial they say "The filteredTodoListState internally keeps track of two dependencies: 
> todoListFilterState and todoListState so that it re-runs if either of those change."
>
> That is what hooks do!

```jsx
function TodoList() {
  const todoList = useFilteredTodoListStore();

  return (
    <>
      <TodoListStats />
      <TodoListFilters />
      <TodoItemCreator />

      {todoList.map((todoItem) => (
        <TodoItem item={todoItem} key={todoItem.id} />
      ))}
    </>
  );
}
```

```jsx
function TodoListFilters() {
  const [filter, setFilter] = useTodoListFilterStore();

  const updateFilter = ({target: {value}}) => {
    setFilter(value);
  };

  return (
    <>
      Filter:
      <select value={filter} onChange={updateFilter}>
        <option value="Show All">All</option>
        <option value="Show Completed">Completed</option>
        <option value="Show Uncompleted">Uncompleted</option>
      </select>
    </>
  );
}
```

```js
const useTodoListStatsStore = create(() => {
  const { todoList } = useTodoListStore()
  const totalNum = todoList.length;
  const totalCompletedNum = todoList.filter((item) => item.isComplete).length;
  const totalUncompletedNum = totalNum - totalCompletedNum;
  const percentCompleted = totalNum === 0 ? 0 : totalCompletedNum / totalNum;

  return {
    totalNum,
    totalCompletedNum,
    totalUncompletedNum,
    percentCompleted,
  };
})
```

```jsx
function TodoListStats() {
  const {
    totalNum,
    totalCompletedNum,
    totalUncompletedNum,
    percentCompleted,
  } = useTodoListStatsStore();

  const formattedPercentCompleted = Math.round(percentCompleted * 100);

  return (
    <ul>
      <li>Total items: {totalNum}</li>
      <li>Items completed: {totalCompletedNum}</li>
      <li>Items not completed: {totalUncompletedNum}</li>
      <li>Percent completed: {formattedPercentCompleted}</li>
    </ul>
  );
}
```
</details>








<details>
  <summary>Migrate Recoil's Asynchronous Data Queries Guide</summary>
  
> You'll have to follow along at https://recoiljs.org/docs/guides/asynchronous-data-queries
> I only recreate the code blocks not all of the text.

### Synchronous Example

```jsx
const useCurrentUserIDStore = create(() => useState(1))

const useCurrentUserNameStore = create(() => {
  const [id] = useCurrentUserIDStore()
  return tableOfUsers[id].name;
});

function CurrentUserInfo() {
  const userName = useCurrentUserNameStore();
  return <div>{userName}</div>;
}

function MyApp() {
  return (
    <CurrentUserInfo />
  );
}
```

### Asynchronous Example

Hey let's use react-query my current favorite library! I mean really this example doesn't
even need global state at all... react-query is all you need here. But I'll show it anyway.

```jsx
import { useQuery } from 'react-query'

const useCurrentUserNameStore = create(() => {
  const [id] = useCurrentUserIDStore()
  const { data } = useQuery(['user/details', id], (_, id) => myDBQuery({ userID: id }))
  return data?.name;
})

function CurrentUserInfo() {
  const userName = useCurrentUserNameStore();
  return <div>{userName}</div>;
}
```

Hmm ok so this one... I mean Suspense isn't really supported. It's not NOT supported either.
Like if you set the `suspense: true` option in react-query it will work. But I have a hot take,
maybe suspense is not so great. I prefer managing the loading state inside the component that
is actually loading!! This way I can show a custom tailored skeleton, or continue showing
stale data when it's refetching.

```jsx
function MyApp() {
  return (
    <RecoilRoot>
      <React.Suspense fallback={<div>Loading...</div>}>
        <CurrentUserInfo />
      </React.Suspense>
    </RecoilRoot>
  );
}
```

I'm not gonna talk about ErrorBoundaries, whatever.

### Queries with Parameters

Ok now this one is interesting let's see... I'd just react-query for this without zusteller.

```jsx
function UserInfo(id) {
  const { data } = useQuery(['user/details', id], (_, id) => myDBQuery({ userID: id }))
  return <div>{data?.name}</div>;
}
```

But that's cheating... so what if we *needed* to pass parameters to our hook? Hmm...
ok let's just pretend react-query wasn't invented yet.

```jsx
// So this is basically a poor man's react-query
const useUserNameStore = create((userID) => {
  const [name, setName] = useState('')
  const [error, setError] = useState()
  useEffect(() => {
    myDBQuery({userID}).then(response => {
      setResponse(response.error ?? response.name)
    });
  }, [id])
  if (error) return error
  return name
})

function UserInfo({ id }) {
  // Provide a hookArgs array as the first param to the store hook
  const { data } = useUserNameStore([id])
  return <div>{data?.name}</div>;
}
```

Or we could use a 3rd party library hook like react-use-promise. It's a little nicer,
but again react-query would just be better here. But this illustrates passing in parameters.
```jsx
import usePromise from 'react-use-promise'

const useUserNameStore = create((userID) => {
  const [result, error] = usePromise(myDBQuery({userID}))
  return error ?? result.name
})

function UserInfo(id) {
  const { data } = useUserNameStore([id])
  return <div>{data?.name}</div>;
}
```
</details>






<details>
  <summary>What about `React.Context`?</summary>
  
This only partially works. It works ok with global themes or other providers that wrap your whole app.

But it's can behave badly if you have components sharing the same store but living under different contexts.

```js
// Make a Context
const SomeContext = React.createContext()

// Make a Zusteller store that uses the context
const useContextStore = create(() => useContext(SomeContext))

// Make a component that uses the zusteller store
const Component = () => {
  const value = useContextStore()
  return <div>{value}</div>
}

// Have two providers, each a Component in each
const App = () => {
  return (
    <>
      <SomeContext.Provider value={true}>
        <Component/>
      </SomeContext.Provider>
      <SomeContext.Provider value={false}>
        <Component/>
      </SomeContext.Provider>
    </>
  )
}
```
That's because the underlying hook is being run only by the first component that uses the store hook.
So context will be relative to that first subscribing component. So in the example above, both components
would like use the value of `true`. So yeah...

One way we could fix this in the future is by returning a React element from `create`.
You could then place this element anywhere as your Context.Consumer location.

```jsx
const SomeContext = React.createContext()

// This is not yet possible, just showing an idea
// Maybe we have an additional `create.withManualInsert`
// Idk what name to give it...
const useStore = create.withManualInsert(() => {
  return useContext(SomeContext)
})

const App = () => {
  return (
    <SomeContext.Provider>
      <useStore.ContextConsumerPoint /> // Now all useStore usages will pick up the context from an intentional place
    </SomeContext.Provider>
  )
}
```

Maybe we also have a way to return it's own context. For a `constate` flavor. 
This would lower the state from global to contextual.

```jsx
// This is not yet possible, just showing an idea
// Maybe we have an additional `create.withContext`
const useStore = create.withContext(MyContext => () => {
  return useContext(MyContext)
})

const App = () => {
  return (
    // Now useStore has both a Provider AND a Store insertion point :shrug??
    <useStore.Provider>
      <useStore.Store />
    </useStore.Provider>
  )
}

```
</details>
