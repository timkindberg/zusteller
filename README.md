# zusteller

Your global state savior. "Just hooks" + [zustand](https://github.com/react-spring/zustand).

## Disclaimer 

Zusteller is brand new and under development. However, it's a tiny library without much to it.

To enable the use of hooks within zustand **we render a React element into an HTMLElement in memory and it runs the hook.** 
When the hook result changes, we update the zustand store. 

We need more validation that this approach doesn't introduce any unexpected or dangerous bugs.

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

Pass `create` a hook. Here we pass the `useState` hook provided by React.

```js
const useStore = create(useState)
```

Pass your own custom hook.

```js
const useStore = create(useMyOwnHook)
```

### Hook args

If the hook takes args, provide them as additional args to `create`.


```js
const useStore = create(useState, initialState)
const useStore = create(useMyOwnHook, initialA, initialB, initialC, ...etc)
```

### Inline anonymous hook

Or write an inline anonymous hook (and skip passing hook args).

```js
const useStore = create(() => {
  return useStore('Hello')
})

const useStore = create() => {
  const [foo, setFoo] = useState()
  const [bar, setBar] = useState()
  ... do some logic
  return ... some things ...
})
```

### The returned zustand hook

The hook you are returned is a small wrapper around a regular zustand hook object. Zusteller is built on zustand!
The difference is instead of creating a store with zustand's `(set, get) => ({})` creator function, you've essentially
*lifted* a regular hook to become global. You can now share that lifted hook's state anywhere.

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

## Let's Recreate Zustand's Doc Examples

> Let's recreate the first example from zustand's page using zusteller

First create your store, your store is a hook and so is your state inside.

```js
import create from 'zusteller'

const useStore = create(() => {
  const [bears, setBears] = useState(0)
  const increasePopulation = () => setBears(prev => prev + 1)
  const removeAllBears = () => setBears(0)
  return { bears, increasePopulation, removeAllBears }
})
```

Then use your hook, no Providers! This part is the **same** as zustand!

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

The example from zustand's page. I'd just use react-query for this but let's recreate it anyway.

```js
import create from 'zusteller'

const useStore = create(() => {
  const [fishies, setFishies] = useState({})
  const fetch = async pond => {
    const response = await fetch(pond)
    setFishies(await response.json())
  }
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
const useStore = create(useState, { paw: true, snout: true, fur: true })

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

Use a 3rd party immer hook or write your own

```js
import create from 'zusteller'
import produce from 'immer'

const useImmerState = initialState => {
    const [state, setState] = useState(initialState)
    const setImmerState = useCallback(setter => setState(produce(setter)), [])
    return [state, setImmerState]
}

const useStore = create(useImmerState, { lush: { forrest: { contains: { a: "bear" } } } })

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

const useStore = create(useReducer, reducer, {grumpiness: 0})

function Component() {
  const [state, dispatch] = useStore()
  dispatch({ type: types.increase, by: 2 })
}
```

## Let's Recreate Constate's Doc Examples

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
  // 3️⃣ Use context instead of custom hook
  const { increment } = useCounterStore();
  return <button onClick={increment}>+</button>;
}

function Count() {
  // 4️⃣ Use context in other components
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
const useCounterStore = create(useCounter, { initialCount: 10 });

function Button() {
  // 4️⃣ Use the updater context that will never trigger a re-render
  // 4.5 we get at it via our selector
  const increment = useCounterStore(s => s.increment);
  return <button onClick={increment}>+</button>;
}

function Count() {
  // 5️⃣ Use the state context in other components
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
  
### What about `React.Context`?

Ok you got me! You found the missing feature :(

This wouldn't work.

```js
// Remember, this hook is being run in an isolated React element in memory!
// It will not pick up this context value, because it's not in your app's
// React tree.
const useSomeContextVal = () => {
  return useContext(SomeContext)
}

const useStore = create(useSomeContextVal)
```

One way we could fix this in the future is by returning a React element from `create`.
You could then place this element anywhere as your Context.Consumer location.

```js
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
      <useStore.Store /> // Now useStore will pick up the context properly
    </SomeContext.Provider>
  )
}
```

Maybe we also have a way to return a full context. For a `constate` flavor.

```js
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
