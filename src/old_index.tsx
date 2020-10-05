import React, { useEffect, useMemo } from 'react';
import { render as nilRender } from 'react-nil';
import zcreate, { UseStore } from 'zustand';
import { EqualityChecker } from 'zustand/vanilla';

declare module 'react-nil';

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

type StoreFamily<THookArgs extends any[]> = Map<any[], StoreInfo<THookArgs>>;

export interface UseValueStore<T> {
  (): T;
  <U>(selector: StateSelector<T, U>, equalityFn?: EqualityChecker<U>): U;
  // getState: any | (() => T);
  // subscribe: any | Subscribe<T>;
  // destroy: Destroy;
  // TODO Narrow this type
  family: StoreFamily;
}

type StateInValue<TState> = { value?: TState };
type HookArgs = any[];
type HookReturnsState<TState, THookArgs extends any[]> = (
  ...any: THookArgs
) => TState;
type SelectorResult<TState, U> = TState | U | undefined;

type StoreInfo<THookArgs extends any[]> = {
  useZStore: UseStore<any>;
  reactRoot: HTMLElement;
  render: (args: THookArgs) => void;
};

export default function create<TState, THookArgs extends any[]>(
  hook: HookReturnsState<TState, THookArgs>,
  ...defaultHookArgs: THookArgs
): UseValueStore<TState> {
  const storeFamily = new Map();

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
    args?: HookArgs,
    selector?: StateSelector<TState, U>,
    isEqual?: EqualityChecker<TState>
  ): SelectorResult<TState, U>;
  function useStore<U>(
    selector?: StateSelector<TState, U>,
    isEqual?: EqualityChecker<TState>
  ): SelectorResult<TState, U>;
  function useStore<U>(...args: any[]): SelectorResult<TState, U> {
    let hookArgs: THookArgs[] = [];
    let selector;
    let isEqual;
    if (Array.isArray(args[0])) {
      hookArgs = args[0] as THookArgs;
      [, selector, isEqual] = args;
    } else {
      [selector, isEqual] = args;
    }

    const storeInfo: StoreInfo<THookArgs> = useMemo(() => {
      const memoizedStoreInfo = storeFamily.get(hookArgs ?? defaultHookArgs);
      if (memoizedStoreInfo) return memoizedStoreInfo;

      const useZStore: UseStore<StateInValue<TState>> = zcreate(() => ({}));
      const reactRoot = document.createElement('div');
      const render = (args: THookArgs) =>
        nilRender(
          <StoreComponent<TState, THookArgs>
            hook={hook}
            hookArgs={args}
            useZStore={useZStore}
          />,
          reactRoot
        );

      const storeInfo = { useZStore, reactRoot, render };
      storeFamily.set(hookArgs, storeInfo);
      return storeInfo;
    }, hookArgs);

    return storeInfo.useZStore<U>(
      // @ts-ignore
      internalSelector<U>(selector),
      // @ts-ignore
      internalIsEqual(isEqual)
    );
  }

  // useStore.getState = () => useZStore.getState().value;
  // useStore.subscribe = function subscribe<U>(
  //   listener: StateListener<TState>,
  //   selector: StateSelector<TState, U>,
  //   isEqual?: EqualityChecker<TState>
  // ) {
  //   return useZStore.subscribe(
  //     // @ts-ignore
  //     listener,
  //     internalSelector<U>(selector),
  //     isEqual
  //   );
  // };
  // useStore.destroy = () => useZStore.destroy();
  useStore.family = storeFamily;
  return useStore;
}

type StoreProps<TState, THookArgs extends any[]> = {
  hook: HookReturnsState<TState, THookArgs>;
  hookArgs: THookArgs;
  useZStore: UseStore<StateInValue<TState>>;
};

function StoreComponent<TState, THookArgs extends any[]>({
  hook: useHook,
  hookArgs,
  useZStore,
}: StoreProps<TState, THookArgs>) {
  const result: TState = useHook(...hookArgs);
  useEffect(() => {
    useZStore.setState({ value: result });
  }, [useZStore, result]);
  return null;
}

export const serializeHookArgs = (hookArgs: any[]): string => {
  try {
    return stableStringify(hookArgs);
  } catch {
    throw new Error('Invalid Hook Args');
  }
};

function stableStringifyReplacer(_key: string, value: any): unknown {
  if (typeof value === 'function') {
    throw new Error();
  }

  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = value[key];
        return result;
      }, {} as any);
  }

  return value;
}

export function stableStringify(value: any): string {
  return JSON.stringify(value, stableStringifyReplacer);
}
export function isPlainObject(o: any): o is Object {
  if (!hasObjectPrototype(o)) {
    return false;
  }

  // If has modified constructor
  const ctor = o.constructor;
  if (typeof ctor === 'undefined') {
    return true;
  }

  // If has modified prototype
  const prot = ctor.prototype;
  if (!hasObjectPrototype(prot)) {
    return false;
  }

  // If constructor does not have an Object-specific method
  if (!prot.hasOwnProperty('isPrototypeOf')) {
    return false;
  }

  // Most likely a plain Object
  return true;
}

function hasObjectPrototype(o: any): boolean {
  return Object.prototype.toString.call(o) === '[object Object]';
}
