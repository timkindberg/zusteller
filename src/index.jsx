import { useEffect, useMemo, useRef } from 'react';
import zcreate from 'zustand';
import shallow from 'zustand/shallow';
import { serializeHookArgs, useImmediateEffect, usePrevious } from './utils';

const debugEnabled = false;
const debug = (...args) => (debugEnabled ? console.log(...args) : void 0);

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
  const SLAVE = '__ZUSTELLER_SLAVE__';
  function getHookIfFirstSubscriber(subscriberCount) {
    if (subscriberCount === 1) return useHook;
    return () => SLAVE;
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
    debug(i, 'hash', hookArgsHash);
    const prevHash = usePrevious(hookArgsHash);
    if (prevHash !== hookArgsHash)
      debug('hash changed', { prev: prevHash, next: hookArgsHash });
    debug(i, '-----------------');
    debug(i, 'total subscribers', subscriberCounts[hookArgsHash]);

    // Get Hook Result
    const useHook = getHookIfFirstSubscriber(subscriberIndexRef.current);
    const result = useHook(...hookArgs);
    debug(i, 'result', result);

    // Set isEqual
    if (Array.isArray(result) && !defaultIsEqual) {
      isEqual = shallow;
    }
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
      const useZStore = zcreate(() => ({ value: result }));
      const useStoreWrapper = (...args) => useZStore(...args);
      useStoreWrapper.hash = hookArgsHash;
      useStoreWrapper.getState = () => useZStore.getState().value;
      useStoreWrapper.subscribe = (listener, selector, isEqual) =>
        useZStore.subscribe(
          listener,
          internalSelector(selector, i),
          internalIsEqual(isEqual, i)
        );
      useStoreWrapper.destroy = () => useZStore.destroy();
      storeFamily[hookArgsHash] = useStoreWrapper;
      return useZStore;
    }, [hookArgsHash]);

    const prevUseZStore = usePrevious(useZStore);
    const prevResult = usePrevious(result);
    if (prevUseZStore !== useZStore) debug('store changed');
    if (prevResult !== result)
      debug('result changed', { prev: prevResult, next: result });

    let resultChanged = true;
    if (Array.isArray(result) && shallow(prevResult, result))
      resultChanged = false;

    useEffect(() => {
      debug(i, 'zustand update effect', result, resultChanged);
      if (result === SLAVE || !resultChanged) return;
      debug(i, 'update zustand store with result', result);
      useZStore.setState({ value: result });
    }, [useZStore, result]);

    const instanceSelector = internalSelector(selector, i);
    const storeResult = useZStore(
      instanceSelector,
      internalIsEqual(isEqual, i)
    );
    const returnVal =
      result === SLAVE ? storeResult : instanceSelector({ value: result });
    debug(i, 'hookResult', storeResult);
    debug(i, 'selector result', instanceSelector({ value: result }));
    debug(i, 'returnVal', returnVal);

    return returnVal;
  }

  useStore.family = storeFamily;
  useStore.withArgs = (hookArgs = []) => {
    const hookArgsHash = serializeHookArgs(hookArgs);
    debug('withArgs', storeFamily[hookArgsHash]);
    return storeFamily[hookArgsHash];
  };
  Object.assign(useStore, useStore.withArgs());
  return useStore;
}
