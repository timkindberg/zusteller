import React, { useMemo, useRef } from 'react';
import { render } from 'react-nil';
import zcreate from 'zustand';
import { serializeHookArgs, useImmediateEffect, usePrevious } from './utils';

const debugEnabled = true;
const debug = (...args) => (debugEnabled ? console.log(...args) : void 0);
const SET_STATE_ERR =
  'Zusteller stores do not support setState. You must set state via methods returned from your hook.';

export default function create(useHook, defaultIsEqual) {
  const storeFamily = {};

  function makeInternalSelector(selector, id = 0) {
    return ({ value }) => {
      debug('makeInternalSelector', id, value);
      if (value == null) return value;
      if (typeof selector === 'function') {
        return selector(value);
      }
      return value;
    };
  }
  function makeInternalIsEqual(eqFn, i) {
    if (typeof eqFn === 'function') {
      return ({ value: prevValue }, { value: nextValue }) =>
        eqFn(prevValue, nextValue);
    }
    return undefined;
  }

  const subscriberCounts = {};

  // Make the default no-args store
  const defaultStore = makeNewZustandStore('[]', [], 0);
  // const defaultStore = storeFamily['[]'];

  function makeNewZustandStore(hookArgsHash, hookArgs, id) {
    const useZStore = zcreate(() => ({ value: undefined }));
    const useStoreWrapper = (...args) => useZStore(...args);
    useStoreWrapper.hash = hookArgsHash;
    useStoreWrapper.setState = () => {
      throw new Error(SET_STATE_ERR);
    };
    useStoreWrapper.getState = () => {
      debug('useStoreWrapper.getState', useZStore.getState().value);
      return useZStore.getState().value;
    };
    useStoreWrapper.subscribe = (listener, selector, isEqual) =>
      useZStore.subscribe(
        listener,
        makeInternalSelector(selector, id),
        makeInternalIsEqual(isEqual, id)
      );
    useStoreWrapper.destroy = () => useZStore.destroy();
    storeFamily[hookArgsHash] = useStoreWrapper;

    const node = document.createElement('div');
    console.log(id, 'render');
    render(
      <StoreComponent
        useHook={useHook}
        hookArgs={hookArgs}
        useZStore={useZStore}
      />,
      node
    );

    return useZStore;
  }

  function useStore(...args) {
    let hookArgs = [];
    let selector;
    let isEqual;
    if (Array.isArray(args[0])) {
      hookArgs = args[0];
      [, selector, isEqual] = args;
    } else if (args[0] != null && typeof args[0] != 'function') {
      throw new Error(
        'Invalid Argument: Only a selector function or args array is supported. Did you mean to wrap your args in an array?'
      );
    } else {
      [selector, isEqual] = args;
    }

    // Hook Args Hash
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const hookArgsHash = useMemo(() => serializeHookArgs(hookArgs), hookArgs);

    // Register a subscribing component by incrementing
    // the subscriber subscriberCount
    const subscriberIndexRef = useRef(-1);
    useImmediateEffect(() => {
      if (subscriberCounts[hookArgsHash] == null) {
        subscriberCounts[hookArgsHash] = 0;
      }
      subscriberCounts[hookArgsHash] = subscriberCounts[hookArgsHash] + 1;
      subscriberIndexRef.current = subscriberCounts[hookArgsHash];
      return () => {
        subscriberCounts[hookArgsHash] = subscriberCounts[hookArgsHash] - 1;
        subscriberIndexRef.current = -1;
      };
    }, []);

    const id = subscriberIndexRef.current;
    debug(id, '-----------------');
    debug(id, 'hash', hookArgsHash);
    const prevHash = usePrevious(hookArgsHash);
    if (prevHash !== hookArgsHash)
      debug('hash changed', { prev: prevHash, next: hookArgsHash });
    debug(id, 'total subscribers', subscriberCounts[hookArgsHash]);

    // Set isEqual
    if (isEqual == null && defaultIsEqual) {
      isEqual = defaultIsEqual;
    }

    // Create or Get Cached Zustand Store Hook
    const isNewlyMadeRef = useRef(false);
    const useZStore = useMemo(() => {
      debug('enter memo');
      const cachedStore = storeFamily[hookArgsHash];
      if (cachedStore) {
        debug(id, 'use cached');
        return cachedStore;
      }

      debug(id, 'make new');
      isNewlyMadeRef.current = true;
      return makeNewZustandStore(hookArgsHash, hookArgs, id);
    }, [hookArgsHash]);

    const internalSelector = makeInternalSelector(selector, id);
    const internalIsEqual = makeInternalIsEqual(isEqual, id);
    const storeResult = useZStore(internalSelector, internalIsEqual);
    debug(id, 'hookResult', storeResult);

    const defaultResult = internalSelector(defaultStore.getState());
    debug(id, 'defaultResult', defaultResult);

    if (
      isNewlyMadeRef.current &&
      storeResult === undefined &&
      defaultResult !== undefined
    ) {
      debug(
        id,
        'return defaultResult for newly made hook args store',
        defaultResult
      );
      isNewlyMadeRef.current = false;
      return defaultResult;
    }

    return storeResult;
  }

  useStore.family = storeFamily;
  useStore.fromArgs = (hookArgs = []) => {
    const hookArgsHash = serializeHookArgs(hookArgs);
    debug('fromArgs', storeFamily[hookArgsHash]);
    const cachedStore = storeFamily[hookArgsHash];
    if (cachedStore) return cachedStore;
    makeNewZustandStore(hookArgsHash, hookArgs);
    return storeFamily[hookArgsHash];
  };
  useStore.getState = (hookArgs = []) => {
    return useStore.fromArgs(hookArgs).getState();
  };
  useStore.setState = () => {
    throw new Error(SET_STATE_ERR);
  };
  useStore.subscribe = (...args) => {
    let hookArgs = [];
    let listener;
    let selector;
    let isEqual;
    if (Array.isArray(args[0])) {
      [hookArgs, listener, selector, isEqual] = args;
    } else {
      [listener, selector, isEqual] = args;
    }
    useStore
      .fromArgs(hookArgs)
      .getState()
      .subscribe(
        listener,
        makeInternalSelector(selector),
        makeInternalIsEqual(isEqual)
      );
  };
  useStore.destroy = (hookArgs = []) => useStore.fromArgs(hookArgs).destroy();
  return useStore;
}

function StoreComponent({ useHook, hookArgs = [], useZStore }) {
  debug('StoreComponent hookArgs', hookArgs);
  const result = useHook(...hookArgs);
  useZStore.getState().value = result;
  debug('StoreComponent render', result);
  useImmediateEffect(() => {
    debug('StoreComponent effect', result);
    useZStore.setState({ value: result });
  }, [useZStore, result]);
  return null;
}
