# zusteller

Your global state savior. "Just hooks" + [zustand](https://github.com/react-spring/zustand).

## Motivation:

It is rare that I need global state. Really rare. You can fill 99% of your needs with regular React Hooks and a fetch caching library
(e.g. [react-query](https://react-query.tanstack.com/docs/overview) or [swr](https://github.com/vercel/swr)).

However, when you need to use global state you have to learn a new API. Redux, Zustand, Recoil...the APIs are nice but they
lack one main thing. **They are not "just hooks".**

A library that only _exposes_ a hook is nice, but if it cannot _nest_ hooks within, if it can't compose hooks in both
directions, then it is what I'm calling a "Terminal Hook". **It's the end of the line.**

Being a "Terminal Hook" brings challenges. How do compose or merge various global states together? Redux has 
`combineReducers`. Recoil has `Selectors`. **Hooks compose naturally.**

Zustand was one of the first libraries to figure out how to elegantly share state without Context. It also has has
selectors, a required feature when it's time to optimize performance. Zustand was my go-to state solution and I consider
it to be a great accomplishment. **But it uses a custom API and I really like hooks.**

##### What if Zustand could work with regular hooks?

----

## "Just hooks" + Zustand

It might look something like this. You can pass any hook. In it's simplest form just pass the `useState` hook.
Any additional args are passed straight to the hook.

```js
import create from 'zusteller' 

// Just like zustand, we create a store, but pass it your hook and any hook args.
const useTitle = create(useState, 'Welcome');

const Title = () => {
  // Use regular zustand selectors
  const title = useTitle(s => s[0]);
  return <h1>{title}</h1>;
};

const TitleInput = () => {
  // If you don't use a selector you get the whole state
  const [title, setTitle] = useTitle();
  return <input value={title} onChange={e => setTitle(e.target.value)} />;
};

const App = () => {
  return (
    <>
      <Title />
      <TitleInput />
    </>
  );
};
```

Or for more complex needs, here we:
- Creating two zusteller hooks from `useState` hooks
- Creating a new hook that composes those hooks

```js
import create from 'zusteller' 

// Notice we pass inline anonymous hooks to these two create calls.
const useMsg = create(useState, 'Welcome');
const useName = create(useState, 'Tim');

const useWelcomeMsg = () => {
  const msg = useMsg(s => s[0]);
  const name = useName(s => s[0]);
  return `${msg}, ${name}`;
};

// Now use the useWelcomeMsg hook anywhere
```

You have the freedom to build your hooks however you want. Use as many or as little zusteller hooks as you need.

## Notes:

The hook returned from `create` is a small wrapper around a regular zustand hook. We use zustand under the hood.

The differences:
- Zustand only allows state to be an `object`, but Zusteller allows `literals, objects, arrays, and undefined/null`.
- Zustand has a `setState` method on the hook, but Zusteller does not. If you want to alter state you need to expose a
  method in your hook and use it, e.g. `useSomeZustellerState.getState().setSomething()`
  
To enable the use of hooks we render a React element into an HTMLElement in memory and it runs the hook. When the hook
result changes, we update the zustand store. 

We also do some smoothing over to allow any value, not just objects.

## Additional Examples

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

#### Async actions

The example from Zustand's page. I'd just use react-query for this but it's a simple example.

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

But now we can use react-query and zustand together seamlessly.

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

## Reading/writing state and reacting to changes outside of components

Works just like zustand except there is no `setState` prototype method. You must use methods exposed by
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

## Using zusteller without React

Not possible. Use zustand. Zusteller uses hooks, and hooks must be run using react and react-dom.

## Want to use immer? 

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

## Can't live without redux-like reducers and action types?

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
