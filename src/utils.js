import { useEffect, useMemo, useRef } from 'react';

export function useImmediateEffect(effect, deps) {
  const cleanup = useRef();
  useMemo(() => {
    if (cleanup.current) {
      cleanup.current();
    }
    cleanup.current = effect();
  }, deps);
}

export const serializeHookArgs = hookArgs => {
  try {
    return stableStringify(hookArgs);
  } catch {
    throw new Error('Invalid Hook Args');
  }
};

function stableStringify(value) {
  return JSON.stringify(value, stableStringifyReplacer);
}

function stableStringifyReplacer(_key, value) {
  if (typeof value === 'function') {
    throw new Error();
  }

  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = value[key];
        return result;
      }, {});
  }

  return value;
}
function isPlainObject(o) {
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

function hasObjectPrototype(o) {
  return Object.prototype.toString.call(o) === '[object Object]';
}

export function usePrevious(value) {
  // The ref object is a generic container whose current property is mutable ...
  // ... and can hold any value, similar to an instance property on a class
  const ref = useRef();

  // Store current value in ref
  useEffect(() => {
    ref.current = value;
  }, [value]); // Only re-run if value changes

  // Return previous value (happens before update in useEffect above)
  return ref.current;
}
