import React, { useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import zcreate from 'zustand';
import { serializeHookArgs, useImmediateEffect } from './utils';

export default function create(hook, ...defaultHookArgs) {
  const storeFamily = {};

  function internalSelector(selector) {
    return ({ value }) => {
      if (value == null) return value;
      if (typeof selector === 'function') {
        return selector(value);
      }
      return value;
    };
  }
  function internalIsEqual(eqFn) {
    if (typeof eqFn === 'function') {
      return ({ value: prevValue }, { value: nextValue }) =>
        eqFn(prevValue, nextValue);
    }
    return undefined;
  }

  function useStore(...args) {
    let hookArgs;
    let selector;
    let isEqual;
    if (Array.isArray(args[0])) {
      hookArgs = args[0];
      [, selector, isEqual] = args;
    } else {
      [selector, isEqual] = args;
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const hookArgsHash = useMemo(() => serializeHookArgs(hookArgs), hookArgs);
    const storeHookRef = useRef(() => {});

    console.log({ hookArgs, selector, hash: hookArgsHash });

    useImmediateEffect(() => {
      let storeHook;
      let node;
      const cachedStore = storeFamily[hookArgsHash];
      if (cachedStore) {
        ({ storeHook, node } = cachedStore);
        console.log('use cached');
      } else {
        storeHook = zcreate(() => ({}));
        storeHook.hash = hookArgsHash;
        useStore.getState = () => storeHook.getState().value;
        useStore.subscribe = (listener, selector, isEqual) =>
          storeHook.subscribe(
            listener,
            internalSelector(selector),
            internalIsEqual(isEqual)
          );
        useStore.destroy = () => storeHook.destroy();
        node = document.createElement('div');
        node.setAttribute('id', hookArgsHash);
        storeFamily[hookArgsHash] = { storeHook, node };
        console.log('make new');
        console.log('render');
        ReactDOM.render(
          <StoreComponent
            hook={hook}
            hookArgs={hookArgs}
            storeHook={storeHook}
          />,
          node
        );
      }

      storeHookRef.current = storeHook;

      return () => {
        console.log('unmount');
        // When we unmount the component using the store, also unmount the store node
        ReactDOM.unmountComponentAtNode(node);
      };
    }, [hookArgsHash]);

    return storeHookRef.current(
      internalSelector(selector),
      internalIsEqual(isEqual)
    );
  }

  useStore.family = storeFamily;
  return useStore;
}

function StoreComponent({
  hook: useHook,
  hookArgs = [],
  storeHook: useZStore,
}) {
  const result = useHook(...hookArgs);
  console.log('StoreComponent render', result);
  useImmediateEffect(() => {
    console.log('StoreComponent effect', result);
    useZStore.setState({ value: result });
  }, [useZStore, result]);
  return null;
}
