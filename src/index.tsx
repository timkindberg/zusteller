import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import zcreate, { UseStore } from 'zustand';
import { Destroy, EqualityChecker } from 'zustand/vanilla';

export declare type StateSelector<T, U> = (state: T) => U;
export declare type StateListener<T> = (state: T) => void;
export interface Subscribe<T> {
  (listener: StateListener<T>): () => void;
  <U>(
    listener: StateListener<T>,
    selector?: StateSelector<T, U>,
    equalityFn?: EqualityChecker<U>
  ): () => void;
}
export interface UseValueStore<T> {
  (): T;
  <U>(selector: StateSelector<T, U>, equalityFn?: EqualityChecker<U>): U;
  getState: any | (() => T);
  subscribe: any | Subscribe<T>;
  destroy: Destroy;
}

type StateInValue<TState> = { value?: TState };
type HookArgs = any[];
type HookReturnsState<TState> = (...any: HookArgs) => TState;
type SelectorResult<TState, U> = TState | U | undefined;

export default function create<TState>(
  hook: HookReturnsState<TState>,
  ...hookArgs: HookArgs
): UseValueStore<TState> {
  const useZStore: UseStore<StateInValue<TState>> = zcreate(() => ({}));
  const reactRoot = document.createElement('div');
  ReactDOM.render(
    <StoreComponent<TState> hook={hook} hookArgs={hookArgs} useZStore={useZStore} />,
    reactRoot
  );
  function internalSelector<U>(selector?: StateSelector<TState, U>) {
    return ({ value }: StateInValue<TState>): SelectorResult<U, TState> => {
      if (value == null) return value;
      if (typeof selector === 'function') {
        return selector(value);
      }
      return value;
    };
  }
  function internalIsEqual(eqFn?: EqualityChecker<TState | undefined>) {
    if (typeof eqFn === 'function') {
      return (
        { value: prevValue }: StateInValue<TState>,
        { value: nextValue }: StateInValue<TState>
      ): boolean => eqFn(prevValue, nextValue);
    }
    return undefined;
  }
  function useStore<U>(
    selector?: StateSelector<TState, U>,
    isEqual?: EqualityChecker<TState>
  ): SelectorResult<TState, U> {
    return useZStore<U>(
      // @ts-ignore
      internalSelector<U>(selector),
      // @ts-ignore
      internalIsEqual(isEqual)
    );
  }
  useStore.getState = () => useZStore.getState().value;
  useStore.subscribe = function subscribe<U>(
    listener: StateListener<TState>,
    selector: StateSelector<TState, U>,
    isEqual?: EqualityChecker<TState>
  ) {
    return useZStore.subscribe(
      // @ts-ignore
      listener,
      internalSelector<U>(selector),
      isEqual
    );
  };

  useStore.destroy = () => useZStore.destroy();
  return useStore;
}

type StoreProps<TState> = {
  hook: HookReturnsState<TState>;
  hookArgs: HookArgs;
  useZStore: UseStore<StateInValue<TState>>;
};

function StoreComponent<TState>({
  hook: useHook,
  hookArgs,
  useZStore,
}: StoreProps<TState>) {
  const result: TState = useHook(...hookArgs);
  useEffect(() => {
    useZStore.setState({ value: result });
  }, [useZStore, result]);
  return null;
}
