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

  function internalSelector(selector, id = 0) {
    return ({ value }) => {
      debug('internalSelector', id, value);
      if (value == null) return value;
      if (typeof selector === 'function') {
        return selector(value);
      }
      return value;
    };
  }
  function internalIsEqual(eqFn, i) {
    if (typeof eqFn === 'function') {
      return ({ value: prevValue }, { value: nextValue }) =>
        eqFn(prevValue, nextValue);
    }
    return undefined;
  }

  const subscriberCounts = {};

  function useStore(...args) {
    let hookArgs = [];
    let selector;
    let isEqual;
    if (Array.isArray(args[0])) {
      hookArgs = args[0];
      [, selector, isEqual] = args;
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

    const i = subscriberIndexRef.current;
    debug(i, '-----------------');
    debug(i, 'hash', hookArgsHash);
    const prevHash = usePrevious(hookArgsHash);
    if (prevHash !== hookArgsHash)
      debug('hash changed', { prev: prevHash, next: hookArgsHash });
    debug(i, 'total subscribers', subscriberCounts[hookArgsHash]);

    // Set isEqual
    if (isEqual == null && defaultIsEqual) {
      isEqual = defaultIsEqual;
    }

    // Create or Get Cached Zustand Store Hook
    const useZStore = useMemo(() => {
      debug('enter memo');
      const cachedStore = storeFamily[hookArgsHash];
      if (cachedStore) {
        debug(i, 'use cached');
        return cachedStore;
      }

      debug(i, 'make new');
      const useZStore = zcreate(() => ({ value: undefined }));
      const useStoreWrapper = (...args) => useZStore(...args);
      useStoreWrapper.hash = hookArgsHash;
      useStoreWrapper.setState = () => {
        throw new Error(SET_STATE_ERR);
      };
      useStoreWrapper.getState = () => useZStore.getState().value;
      useStoreWrapper.subscribe = (listener, selector, isEqual) =>
        useZStore.subscribe(
          listener,
          internalSelector(selector, i),
          internalIsEqual(isEqual, i)
        );
      useStoreWrapper.destroy = () => useZStore.destroy();
      storeFamily[hookArgsHash] = useStoreWrapper;

      const node = document.createElement('div');
      console.log(i, 'render');
      render(
        <StoreComponent
          useHook={useHook}
          hookArgs={hookArgs}
          useZStore={useZStore}
        />,
        node
      );

      // TODO unmountComponentAtNode and cleanup

      return useZStore;
    }, [hookArgsHash]);

    const storeResult = useZStore(
      internalSelector(selector, i),
      internalIsEqual(isEqual, i)
    );
    debug(i, 'hookResult', storeResult);

    return storeResult;
  }

  useStore.family = storeFamily;
  useStore.fromArgs = (hookArgs = []) => {
    const hookArgsHash = serializeHookArgs(hookArgs);
    debug('fromArgs', storeFamily[hookArgsHash]);
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
        internalSelector(selector),
        internalIsEqual(isEqual)
      );
  };
  useStore.destroy = (hookArgs = []) => useStore.fromArgs(hookArgs).destroy();
  return useStore;
}

function StoreComponent({ useHook, hookArgs = [], useZStore }) {
  const result = useHook(...hookArgs);
  useZStore.getState().value = result;
  debug('StoreComponent render', result);
  useImmediateEffect(() => {
    debug('StoreComponent effect', result);
    useZStore.setState({ value: result });
  }, [useZStore, result]);
  return null;
}
